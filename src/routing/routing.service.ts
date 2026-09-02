import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Route } from './models/route.model';
import { RouteStop } from './models/routeStop.model';
import { Case } from '../case/models/case.model';
import { Collector } from '../collectors/models/collector.model';
import { Status } from '../case/types/enum.type';
import { RouteProvider, RouteStatus } from './types/enum.type';
import type { Coordinates, OptimizedRoute, RouteCandidate, RouteOptimizer } from './types/int.type';
import { PlanRouteDto } from './dto/plan-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { GeocodingService } from './geocoding.service';
import { OfflineRouteOptimizer } from './optimizers/offline.optimizer';
import { GoogleRoutesOptimizer } from './optimizers/googleRoutes.optimizer';
import { GoogleMatrixOptimizer } from './optimizers/googleMatrix.optimizer';
import { haversineMeters } from './optimizers/geometry';
import {
  DEFAULT_RADIUS_KM,
  DIRECT_ROUTE_MAX_STOPS,
  MAX_STOPS_PER_ROUTE,
  hasGoogleCredentials,
} from './routing.config';

// Only cases nobody is working yet are worth planning: pending or open. A case
// already inProgress belongs to someone, and closed/rejected need no visit.
const PLANNABLE_STATUSES = [Status.pending, Status.open];

// A route in one of these states no longer holds its cases, so they become
// available to plan again.
const FINISHED_ROUTE_STATUSES = [RouteStatus.completed, RouteStatus.cancelled];

const KM_TO_DEGREES_LAT = 1 / 110.574;

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @InjectModel(Route) private routeModel: typeof Route,
    @InjectModel(RouteStop) private routeStopModel: typeof RouteStop,
    @InjectModel(Case) private caseModel: typeof Case,
    @InjectModel(Collector) private collectorModel: typeof Collector,
    private readonly geocoding: GeocodingService,
    private readonly offline: OfflineRouteOptimizer,
    private readonly googleRoutes: GoogleRoutesOptimizer,
    private readonly googleMatrix: GoogleMatrixOptimizer,
  ) {}

  private readonly routeIncludes = [
    { model: Collector, attributes: ['id', 'name'] },
    {
      model: RouteStop,
      include: [{ model: Case, attributes: ['id', 'status', 'priority', 'latitude', 'longitude', 'imagePath'] }],
    },
  ];

  // ---- planning --------------------------------------------------------

  async plan(dto: PlanRouteDto): Promise<Route> {
    try {
      const collector = await this.collectorModel.findByPk(dto.collectorId);
      if (!collector) {
        throw new NotFoundException(`Collector '${dto.collectorId}' not found`);
      }

      const origin = await this.resolveOrigin(dto, collector);
      const radiusKm = dto.radiusKm ?? DEFAULT_RADIUS_KM;
      const maxStops = dto.maxStops ?? MAX_STOPS_PER_ROUTE;

      const candidates = await this.selectCandidates(origin, radiusKm, maxStops);
      if (candidates.length === 0) {
        throw new BadRequestException(
          `No open, verified cases within ${radiusKm}km of the origin are available to plan`,
        );
      }

      const optimizer = this.pickOptimizer(candidates.length);
      const optimized = await optimizer.optimize(origin, candidates);

      return await this.persist(dto, collector.id, origin, optimized);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to plan route');
    }
  }

  // Explicit coordinates win. Otherwise the collector's address is geocoded,
  // and that answer lives only in GeocodingService's in-memory cache.
  private async resolveOrigin(dto: PlanRouteDto, collector: Collector): Promise<Coordinates> {
    if (dto.originLatitude !== undefined && dto.originLongitude !== undefined) {
      return { latitude: dto.originLatitude, longitude: dto.originLongitude };
    }

    if (!collector.address) {
      throw new BadRequestException(
        `Collector '${collector.name}' has no address to geocode — send originLatitude and originLongitude`,
      );
    }

    const geocoded = await this.geocoding.geocode(collector.address);
    if (!geocoded) {
      throw new BadRequestException(
        `Could not resolve '${collector.address}' to coordinates. Send originLatitude and originLongitude, ` +
          `or set OPENWEATHER_API_KEY. Note the geocoder matches place names, not street addresses.`,
      );
    }

    this.logger.log(`Origin for '${collector.name}' resolved to ${geocoded.matchedName} (held in memory only)`);
    return { latitude: geocoded.latitude, longitude: geocoded.longitude };
  }

  // Selection is deliberately plain SQL plus a haversine pass: cheap, and it
  // keeps the paid provider seeing only cases that are genuinely plannable.
  private async selectCandidates(
    origin: Coordinates,
    radiusKm: number,
    maxStops: number,
  ): Promise<RouteCandidate[]> {
    // A bounding box first so Postgres does the coarse filter on indexed
    // columns; the exact circle is applied afterwards in memory.
    const latDelta = radiusKm * KM_TO_DEGREES_LAT;
    const cosLat = Math.max(Math.cos((origin.latitude * Math.PI) / 180), 0.01);
    const lonDelta = latDelta / cosLat;

    const claimed = await this.claimedCaseIds();

    const rows = await this.caseModel.findAll({
      where: {
        caseVerified: true,
        status: { [Op.in]: PLANNABLE_STATUSES },
        latitude: { [Op.between]: [origin.latitude - latDelta, origin.latitude + latDelta] },
        longitude: { [Op.between]: [origin.longitude - lonDelta, origin.longitude + lonDelta] },
        ...(claimed.length > 0 ? { id: { [Op.notIn]: claimed } } : {}),
      },
      attributes: ['id', 'latitude', 'longitude'],
    });

    const radiusMeters = radiusKm * 1000;

    return rows
      .map((row) => ({
        caseId: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
        distanceFromOriginMeters: haversineMeters(origin, row),
      }))
      .filter((candidate) => candidate.distanceFromOriginMeters <= radiusMeters)
      // Nearest first, so the cap keeps the closest cases rather than an
      // arbitrary slice of whatever the database returned.
      .sort((a, b) => a.distanceFromOriginMeters - b.distanceFromOriginMeters)
      .slice(0, maxStops);
  }

  // Cases already committed to a route that is still live.
  private async claimedCaseIds(): Promise<string[]> {
    const stops = await this.routeStopModel.findAll({
      attributes: ['caseId'],
      include: [
        {
          model: Route,
          attributes: [],
          required: true,
          where: { status: { [Op.notIn]: FINISHED_ROUTE_STATUSES } },
        },
      ],
      raw: true,
    });
    return [...new Set(stops.map((stop) => stop.caseId))];
  }

  // The whole provider decision, in one place.
  private pickOptimizer(stopCount: number): RouteOptimizer {
    if (!hasGoogleCredentials()) {
      return this.offline;
    }
    return stopCount <= DIRECT_ROUTE_MAX_STOPS ? this.googleRoutes : this.googleMatrix;
  }

  // Route and stops are written together: a route with no stops, or stops
  // with no route, is never a state anyone can observe.
  private async persist(
    dto: PlanRouteDto,
    collectorId: string,
    origin: Coordinates,
    optimized: OptimizedRoute,
  ): Promise<Route> {
    const created = await this.routeModel.sequelize!.transaction(async (transaction) => {
      const route = await this.routeModel.create(
        {
          name: dto.name ?? `Run ${new Date().toISOString().slice(0, 10)}`,
          collectorId,
          status: RouteStatus.draft,
          plannedFor: dto.plannedFor ?? new Date().toISOString().slice(0, 10),
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          totalDistanceMeters: optimized.totalDistanceMeters,
          totalDurationSeconds: optimized.totalDurationSeconds,
          encodedPolyline: optimized.encodedPolyline,
          provider: optimized.provider,
          optimizedAt: new Date(),
        } as any,
        { transaction },
      );

      await this.routeStopModel.bulkCreate(
        optimized.stops.map((stop) => ({
          routeId: route.id,
          caseId: stop.caseId,
          sequence: stop.sequence,
          legDistanceMeters: stop.legDistanceMeters,
          legDurationSeconds: stop.legDurationSeconds,
        })) as any,
        { transaction },
      );

      return route;
    });

    return await this.findOne(created.id);
  }

  // ---- reads and lifecycle ---------------------------------------------

  async findAll(collectorId?: string): Promise<Route[]> {
    try {
      return await this.routeModel.findAll({
        where: collectorId ? { collectorId } : {},
        include: this.routeIncludes,
        order: [
          ['createdAt', 'DESC'],
          [{ model: RouteStop, as: 'stops' }, 'sequence', 'ASC'],
        ],
      });
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve routes');
    }
  }

  async findOne(id: string): Promise<Route> {
    try {
      const found = await this.routeModel.findByPk(id, {
        include: this.routeIncludes,
        order: [[{ model: RouteStop, as: 'stops' }, 'sequence', 'ASC']],
      });
      if (!found) {
        throw new NotFoundException(`Route '${id}' not found`);
      }
      return found;
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to retrieve route');
    }
  }

  async update(id: string, dto: UpdateRouteDto): Promise<Route> {
    try {
      const found = await this.routeModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Route '${id}' not found`);
      }
      await found.update({ ...dto });
      return await this.findOne(id);
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to update route');
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const found = await this.routeModel.findByPk(id);
      if (!found) {
        throw new NotFoundException(`Route '${id}' not found`);
      }
      await found.destroy();
    } catch (error: any) {
      throw this.asHttpError(error, 'Failed to remove route');
    }
  }

  private asHttpError(error: any, context: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (error?.name === 'SequelizeForeignKeyConstraintError') {
      return new BadRequestException('A referenced collector or case does not exist');
    }
    return new InternalServerErrorException(`${context}: ${error?.message ?? 'unknown error'}`);
  }
}
