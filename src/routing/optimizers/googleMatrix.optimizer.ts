import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RouteProvider } from '../types/enum.type';
import type { Coordinates, OptimizedRoute, RouteCandidate, RouteOptimizer } from '../types/int.type';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MATRIX_URL, PROVIDER_TIMEOUT_MS } from '../routing.config';
import { CostMatrix, nearestNeighbourOrder, twoOptImprove } from './geometry';

const waypoint = (point: Coordinates) => ({
  waypoint: { location: { latLng: { latitude: point.latitude, longitude: point.longitude } } },
});

// Used once a run outgrows computeRoutes' direct handling. One matrix call
// buys real road travel times between every pair of points; the ordering is
// then solved locally with nearest neighbour + 2-opt, which avoids paying for
// Google's waypoint optimisation on every replan.
//
// The trade-off is no polyline — the matrix endpoint does not return geometry.
// Fetching one would cost a second computeRoutes call, so it is left null and
// the client can draw straight lines between the ordered stops.
@Injectable()
export class GoogleMatrixOptimizer implements RouteOptimizer {
  readonly provider = RouteProvider.googleRouteMatrix;

  async optimize(origin: Coordinates, stops: RouteCandidate[]): Promise<OptimizedRoute> {
    const points = [origin, ...stops];
    const elements = await this.call({
      origins: points.map(waypoint),
      destinations: points.map(waypoint),
      travelMode: 'DRIVE',
    });

    const { durations, distances } = this.toMatrices(elements, points.length);

    // Order on time, not distance — the fastest run is what a crew cares about.
    const order = twoOptImprove(nearestNeighbourOrder(durations), durations);

    let previous = 0;
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;

    const ordered = order.map((node, index) => {
      const legDurationSeconds = durations[previous][node];
      const legDistanceMeters = distances[previous][node];
      totalDurationSeconds += legDurationSeconds;
      totalDistanceMeters += legDistanceMeters;
      previous = node;

      return {
        caseId: stops[node - 1].caseId,
        sequence: index + 1,
        legDistanceMeters,
        legDurationSeconds,
      };
    });

    return {
      provider: this.provider,
      stops: ordered,
      totalDistanceMeters,
      totalDurationSeconds,
      encodedPolyline: null,
    };
  }

  private async call(body: unknown): Promise<any[]> {
    try {
      const response = await fetch(GOOGLE_MATRIX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`computeRouteMatrix responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('computeRouteMatrix returned an unexpected shape');
      }
      return payload;
    } catch (error: any) {
      throw new ServiceUnavailableException(`computeRouteMatrix failed: ${error?.message ?? 'unknown error'}`);
    }
  }

  // The matrix arrives as a flat, unordered element list carrying its own
  // indices, so it is scattered back into two square matrices.
  private toMatrices(elements: any[], size: number): { durations: CostMatrix; distances: CostMatrix } {
    const blank = () =>
      Array.from({ length: size }, () => Array.from({ length: size }, () => Number.POSITIVE_INFINITY));

    const durations = blank();
    const distances = blank();

    for (let i = 0; i < size; i++) {
      durations[i][i] = 0;
      distances[i][i] = 0;
    }

    for (const element of elements) {
      const from = element?.originIndex;
      const to = element?.destinationIndex;
      if (typeof from !== 'number' || typeof to !== 'number') {
        continue;
      }
      // ROUTE_NOT_FOUND leaves the pair at Infinity so the solver avoids it.
      if (element.condition && element.condition !== 'ROUTE_EXISTS') {
        continue;
      }

      const seconds = Number.parseInt(String(element.duration ?? '').replace(/s$/, ''), 10);
      durations[from][to] = Number.isFinite(seconds) ? seconds : Number.POSITIVE_INFINITY;
      distances[from][to] = typeof element.distanceMeters === 'number' ? element.distanceMeters : 0;
    }

    return { durations, distances };
  }
}
