import { RouteProvider } from './enum.type';

export interface Coordinates {
    latitude: number;
    longitude: number;
}

// A case that is a candidate for, or already on, a run.
export interface RouteCandidate extends Coordinates {
    caseId: string;
    // Straight-line distance from the depot, used for selection before any
    // provider is consulted.
    distanceFromOriginMeters: number;
}

// One visit in the order an optimiser produced.
export interface OptimizedStop {
    caseId: string;
    sequence: number;
    // Cost of the leg from the previous stop, or from the origin for sequence 1.
    // Null when the provider cannot supply it (the offline optimiser has no
    // road data, so it reports distance but never duration).
    legDistanceMeters: number | null;
    legDurationSeconds: number | null;
}

export interface OptimizedRoute {
    provider: RouteProvider;
    stops: OptimizedStop[];
    totalDistanceMeters: number | null;
    totalDurationSeconds: number | null;
    encodedPolyline: string | null;
}

// The one contract every strategy implements. RoutingService picks between
// them purely on stop count and whether credentials exist.
export interface RouteOptimizer {
    readonly provider: RouteProvider;
    optimize(origin: Coordinates, stops: RouteCandidate[]): Promise<OptimizedRoute>;
}

export interface GeocodeResult extends Coordinates {
    // What the geocoder actually matched, which may be broader than the query.
    matchedName: string;
    country: string | null;
}
