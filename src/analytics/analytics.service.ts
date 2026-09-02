import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col } from 'sequelize';
import { Subject, from, EMPTY } from 'rxjs';
import { auditTime, switchMap, share, catchError } from 'rxjs/operators';
import { Case } from '../case/models/case.model';
import { Collector } from '../collectors/models/collector.model';
import { WasteInstance } from '../waste/models/wasteInstance.model';
import { WasteType } from '../waste/models/wasteType.model';
import { Route } from '../routing/models/route.model';
import { RouteStop } from '../routing/models/routeStop.model';
import { Status, Priority } from '../case/types/enum.type';
import type {
  AnalyticsSnapshot,
  CasesOverview,
  LiveView,
  RouteView,
  WasteMetrics,
  WasteTypeMetric,
} from './types/int.type';

// A case in one of these states needs nobody dispatched to it, so it drops
// off the heat map and the tracker.
const SETTLED_STATUSES = [Status.closed, Status.rejected];

// How much a case's priority contributes to its heat-map weight.
const SEVERITY: Record<string, number> = {
  [Priority.low]: 1,
  [Priority.medium]: 2,
  [Priority.high]: 3,
};

// A burst of CNN detections would otherwise recompute the snapshot once per
// row; collapse anything inside this window into a single broadcast.
const RECOMPUTE_WINDOW_MS = 250;

interface Hookable {
  addHook(hook: string, name: string, handler: (...args: unknown[]) => void): unknown;
}

interface SequelizeTransaction {
  afterCommit(callback: () => void): unknown;
}

const HOOK_NAME = 'analytics-snapshot';
const WATCHED_HOOKS = [
  'afterCreate',
  'afterUpdate',
  'afterDestroy',
  'afterRestore',
  'afterBulkCreate',
  'afterBulkUpdate',
  'afterBulkDestroy',
];

@Injectable()
export class AnalyticsService implements OnModuleInit {
  constructor(
    @InjectModel(Case) private caseModel: typeof Case,
    @InjectModel(WasteInstance) private wasteInstanceModel: typeof WasteInstance,
    @InjectModel(WasteType) private wasteTypeModel: typeof WasteType,
    @InjectModel(Route) private routeModel: typeof Route,
  ) {}

  private readonly logger = new Logger(AnalyticsService.name);
  private readonly dirty = new Subject<void>();

  // The gateway subscribes to this; nothing else in the app knows it exists.
  // auditTime (not debounceTime) guarantees a steady write stream still
  // produces updates rather than starving while writes keep arriving.
  // The inner catchError is load-bearing: without it a failed recompute became
  // an unhandled RxJS error that killed the whole Node process, not just the
  // broadcast. Catching inside switchMap drops the bad tick and leaves the
  // stream — and the server — alive.
  readonly snapshots$ = this.dirty.pipe(
    auditTime(RECOMPUTE_WINDOW_MS),
    switchMap(() =>
      from(this.snapshot()).pipe(
        catchError((error: any) => {
          this.logger.error(`Snapshot recompute failed, skipping this update: ${error?.message ?? error}`);
          return EMPTY;
        }),
      ),
    ),
    share(),
  );

  // Hooks are attached from this side, so no domain module imports analytics
  // and no domain service knows a dashboard exists.
  onModuleInit(): void {
    // Typed structurally: the four model classes have no common supertype
    // narrow enough for addHook, and registering a hook is all that is needed.
    const watched = [
      this.caseModel,
      this.wasteInstanceModel,
      this.wasteTypeModel,
      this.routeModel,
    ] as unknown as Hookable[];

    for (const model of watched) {
      for (const hook of WATCHED_HOOKS) {
        // Named hooks replace rather than stack, which keeps `start:dev`
        // reloads from registering the same handler repeatedly.
        model.addHook(hook, HOOK_NAME, (...args: unknown[]) => this.onModelWrite(args));
      }
    }
  }

  // Model hooks fire INSIDE the caller's transaction. Recomputing there reads
  // pre-commit state on a different connection, so the signal is deferred to
  // afterCommit — which also means a rolled-back write broadcasts nothing.
  private onModelWrite(args: unknown[]): void {
    const options = args.find(
      (arg): arg is { transaction?: SequelizeTransaction } =>
        typeof arg === 'object' && arg !== null && 'transaction' in arg,
    );

    const transaction = options?.transaction;
    if (transaction && typeof transaction.afterCommit === 'function') {
      transaction.afterCommit(() => this.dirty.next());
      return;
    }

    this.dirty.next();
  }

  async snapshot(): Promise<AnalyticsSnapshot> {
    const [live, cases, waste] = await Promise.all([
      this.liveView(),
      this.casesOverview(),
      this.wasteMetrics(),
    ]);
    return { generatedAt: new Date().toISOString(), live, cases, waste };
  }

  // ---- 1. live heat map, case tracker, route viewer --------------------

  async liveView(): Promise<LiveView> {
    const active = await this.caseModel.findAll({
      where: { status: { [Op.notIn]: SETTLED_STATUSES } },
      include: [{ model: Collector, attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    const quantities = await this.quantityByCase();

    const points = active.map((c) => ({
      caseId: c.id,
      latitude: c.latitude,
      longitude: c.longitude,
      weight: this.weigh(c.priority, quantities.get(c.id) ?? 0),
      status: c.status,
      priority: c.priority ?? null,
      verified: Boolean(c.caseVerified),
    }));

    const activeCases = active.map((c) => ({
      id: c.id,
      status: c.status,
      priority: c.priority ?? null,
      verified: Boolean(c.caseVerified),
      latitude: c.latitude,
      longitude: c.longitude,
      reportedAt: c.timeTaken?.toISOString() ?? c.createdAt.toISOString(),
      collector: c.collector ? { id: c.collector.id, name: c.collector.name } : null,
      wasteQuantity: quantities.get(c.id) ?? 0,
    }));

    return { points, activeCases, routes: await this.routeViews() };
  }

  // Stops come back ordered and already joined to their case. The previous
  // string-array model needed a second query plus a stale-id reconciliation
  // pass; the foreign key makes both unnecessary.
  private async routeViews(): Promise<RouteView[]> {
    const routes = await this.routeModel.findAll({
      include: [
        {
          model: RouteStop,
          include: [{ model: Case, attributes: ['id', 'latitude', 'longitude', 'status', 'priority'] }],
        },
      ],
      order: [
        ['createdAt', 'DESC'],
        // Must name the association alias: passing the bare model class makes
        // Sequelize fail to resolve it and throw at query-build time.
        [{ model: RouteStop, as: 'stops' }, 'sequence', 'ASC'],
      ],
    });

    return routes.map((route) => ({
      id: route.id,
      name: route.name,
      status: route.status,
      collectorId: route.collectorId,
      totalDistanceMeters: route.totalDistanceMeters ?? null,
      totalDurationSeconds: route.totalDurationSeconds ?? null,
      encodedPolyline: route.encodedPolyline ?? null,
      stops: (route.stops ?? []).map((stop) => ({
        caseId: stop.caseId,
        sequence: stop.sequence,
        status: stop.status,
        latitude: stop.case?.latitude ?? null,
        longitude: stop.case?.longitude ?? null,
        caseStatus: stop.case?.status ?? null,
        priority: stop.case?.priority ?? null,
        estimatedArrival: stop.estimatedArrival?.toISOString() ?? null,
      })),
    }));
  }

  // ---- 2. cases overview ----------------------------------------------

  async casesOverview(): Promise<CasesOverview> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [byStatus, byPriority, total, verified, unassigned, openedLast24h, openedLast7d, resolution] =
      await Promise.all([
        this.countGroupedBy('status'),
        this.countGroupedBy('priority'),
        this.caseModel.count(),
        this.caseModel.count({ where: { caseVerified: true } }),
        this.caseModel.count({
          where: { collectorId: null as any, status: { [Op.notIn]: SETTLED_STATUSES } },
        }),
        this.caseModel.count({ where: { createdAt: { [Op.gte]: dayAgo } } }),
        this.caseModel.count({ where: { createdAt: { [Op.gte]: weekAgo } } }),
        this.averageResolutionHours(),
      ]);

    return {
      total,
      byStatus,
      byPriority,
      verified,
      unverified: total - verified,
      unassigned,
      openedLast24h,
      openedLast7d,
      avgResolutionHours: resolution,
    };
  }

  private async countGroupedBy(column: 'status' | 'priority'): Promise<Record<string, number>> {
    const rows = await this.caseModel.findAll({
      attributes: [column, [fn('COUNT', col('id')), 'count']],
      group: [column],
      raw: true,
    });

    const counts: Record<string, number> = {};
    for (const row of rows as unknown as Record<string, string>[]) {
      // A null priority means "not yet triaged" — worth showing, not dropping.
      counts[row[column] ?? 'unset'] = Number(row.count);
    }
    return counts;
  }

  private async averageResolutionHours(): Promise<number | null> {
    const closed = await this.caseModel.findAll({
      where: { closedAt: { [Op.ne]: null as any } },
      attributes: ['createdAt', 'closedAt'],
      raw: true,
    });
    if (closed.length === 0) {
      return null;
    }

    const totalMs = closed.reduce(
      (sum, c: any) => sum + (new Date(c.closedAt).getTime() - new Date(c.createdAt).getTime()),
      0,
    );
    return Number((totalMs / closed.length / 3_600_000).toFixed(2));
  }

  // ---- 3. waste metrics ------------------------------------------------

  async wasteMetrics(): Promise<WasteMetrics> {
    const rows = await this.wasteInstanceModel.findAll({
      attributes: [
        'wasteTypeId',
        [fn('SUM', col('quantity')), 'quantity'],
        [fn('COUNT', col('id')), 'detections'],
      ],
      group: ['wasteTypeId'],
      raw: true,
    });

    // The catalog is small, so joining it in memory keeps the aggregate query
    // simple and lets paranoid filtering stay automatic on both queries.
    const types = await this.wasteTypeModel.findAll({ attributes: ['id', 'name', 'hazardLevel'] });
    const typeById = new Map(types.map((t) => [t.id, t]));

    const byType: WasteTypeMetric[] = (rows as unknown as Record<string, string>[])
      .map((row) => {
        const type = typeById.get(row.wasteTypeId);
        return {
          wasteTypeId: row.wasteTypeId,
          name: type?.name ?? 'unknown',
          hazardLevel: type?.hazardLevel ?? null,
          detections: Number(row.detections),
          quantity: Number(row.quantity),
        };
      })
      .sort((a, b) => b.quantity - a.quantity);

    const byHazardLevel: Record<string, number> = {};
    for (const entry of byType) {
      const key = entry.hazardLevel ?? 'unclassified';
      byHazardLevel[key] = (byHazardLevel[key] ?? 0) + entry.quantity;
    }

    return {
      totalDetections: byType.reduce((sum, t) => sum + t.detections, 0),
      totalQuantity: byType.reduce((sum, t) => sum + t.quantity, 0),
      byType,
      byHazardLevel,
    };
  }

  // ---- helpers ---------------------------------------------------------

  private async quantityByCase(): Promise<Map<string, number>> {
    const rows = await this.wasteInstanceModel.findAll({
      attributes: ['caseId', [fn('SUM', col('quantity')), 'quantity']],
      group: ['caseId'],
      raw: true,
    });
    return new Map(
      (rows as unknown as Record<string, string>[]).map((r) => [r.caseId, Number(r.quantity)]),
    );
  }

  // Severity from triage, scaled by how much was actually observed, so a
  // high-priority pile with 40 items outranks a high-priority stray wrapper.
  private weigh(priority: string | null, quantity: number): number {
    const severity = SEVERITY[priority ?? ''] ?? 1;
    return severity * Math.max(1, quantity);
  }
}
