import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RouteProvider } from '../types/enum.type';
import type { Coordinates, OptimizedRoute, RouteCandidate, RouteOptimizer } from '../types/int.type';
import { GOOGLE_MAPS_API_KEY, GOOGLE_ROUTES_URL, PROVIDER_TIMEOUT_MS } from '../routing.config';

const waypoint = (point: Coordinates) => ({
  location: { latLng: { latitude: point.latitude, longitude: point.longitude } },
});

// Used for short runs (<= DIRECT_ROUTE_MAX_STOPS). computeRoutes both orders
// the stops and returns the drawable polyline in a single billed call, so
// there is no reason to buy a matrix and solve it ourselves at this size.
//
// The run is modelled as a round trip: it leaves the depot and returns to it,
// which is what makes ordering meaningful even with only two stops.
@Injectable()
export class GoogleRoutesOptimizer implements RouteOptimizer {
  readonly provider = RouteProvider.googleRoutes;

  async optimize(origin: Coordinates, stops: RouteCandidate[]): Promise<OptimizedRoute> {
    const body = {
      origin: waypoint(origin),
      destination: waypoint(origin),
      intermediates: stops.map(waypoint),
      travelMode: 'DRIVE',
      optimizeWaypointOrder: true,
    };

    const payload = await this.call(body);
    const route = payload?.routes?.[0];
    if (!route) {
      throw new ServiceUnavailableException('Google returned no route for these stops');
    }

    // Google reports where each intermediate ended up. Absent it (a single
    // stop needs no ordering) the input order stands.
    const order: number[] = route.optimizedIntermediateWaypointIndex ?? stops.map((_, i) => i);

    // legs[0] is depot -> first stop, so the leg arriving at position i is legs[i].
    const legs: any[] = Array.isArray(route.legs) ? route.legs : [];

    const ordered = order.map((stopIndex, position) => {
      const leg = legs[position];
      return {
        caseId: stops[stopIndex].caseId,
        sequence: position + 1,
        legDistanceMeters: typeof leg?.distanceMeters === 'number' ? leg.distanceMeters : null,
        legDurationSeconds: this.seconds(leg?.duration),
      };
    });

    return {
      provider: this.provider,
      stops: ordered,
      totalDistanceMeters: typeof route.distanceMeters === 'number' ? route.distanceMeters : null,
      totalDurationSeconds: this.seconds(route.duration),
      encodedPolyline: route.polyline?.encodedPolyline ?? null,
    };
  }

  private async call(body: unknown): Promise<any> {
    try {
      const response = await fetch(GOOGLE_ROUTES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          // Google bills partly on the fields requested, so ask for exactly
          // what gets persisted and nothing more.
          'X-Goog-FieldMask': [
            'routes.distanceMeters',
            'routes.duration',
            'routes.polyline.encodedPolyline',
            'routes.optimizedIntermediateWaypointIndex',
            'routes.legs.distanceMeters',
            'routes.legs.duration',
          ].join(','),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`computeRoutes responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
      return await response.json();
    } catch (error: any) {
      throw new ServiceUnavailableException(`computeRoutes failed: ${error?.message ?? 'unknown error'}`);
    }
  }

  // Google returns protobuf durations as strings like "1234s".
  private seconds(duration: unknown): number | null {
    if (typeof duration !== 'string') {
      return null;
    }
    const parsed = Number.parseInt(duration.replace(/s$/, ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
