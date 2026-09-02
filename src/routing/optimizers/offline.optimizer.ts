import { Injectable } from '@nestjs/common';
import { RouteProvider } from '../types/enum.type';
import type { Coordinates, OptimizedRoute, RouteCandidate, RouteOptimizer } from '../types/int.type';
import { buildHaversineMatrix, nearestNeighbourOrder, twoOptImprove } from './geometry';

// The no-credentials fallback. Orders stops by straight-line distance using
// nearest neighbour refined with 2-opt — no network call, no API key, no cost.
//
// Distances are as-the-crow-flies and therefore optimistic; durations are left
// null rather than invented, because without road data any number would be a
// guess. A dashboard should show "—" for the time on these routes.
@Injectable()
export class OfflineRouteOptimizer implements RouteOptimizer {
  readonly provider = RouteProvider.offline;

  async optimize(origin: Coordinates, stops: RouteCandidate[]): Promise<OptimizedRoute> {
    if (stops.length === 0) {
      return {
        provider: this.provider,
        stops: [],
        totalDistanceMeters: 0,
        totalDurationSeconds: null,
        encodedPolyline: null,
      };
    }

    const cost = buildHaversineMatrix(origin, stops);
    const order = twoOptImprove(nearestNeighbourOrder(cost), cost);

    let previous = 0;
    let totalDistanceMeters = 0;

    const ordered = order.map((node, index) => {
      const legDistanceMeters = cost[previous][node];
      totalDistanceMeters += legDistanceMeters;
      previous = node;

      return {
        // node is 1-based because index 0 in the matrix is the depot.
        caseId: stops[node - 1].caseId,
        sequence: index + 1,
        legDistanceMeters,
        legDurationSeconds: null,
      };
    });

    return {
      provider: this.provider,
      stops: ordered,
      totalDistanceMeters,
      totalDurationSeconds: null,
      encodedPolyline: null,
    };
  }
}
