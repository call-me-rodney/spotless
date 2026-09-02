// The single payload pushed to every connected dashboard. One object rather
// than three streams, so a dashboard never renders a half-updated view.
export interface AnalyticsSnapshot {
    generatedAt: string;
    live: LiveView;
    cases: CasesOverview;
    waste: WasteMetrics;
}

// ---- 1. live heat map, case tracker, route viewer ----------------------

export interface LiveView {
    points: HeatPoint[];
    activeCases: TrackedCase[];
    routes: RouteView[];
}

export interface HeatPoint {
    caseId: string;
    latitude: number;
    longitude: number;
    // severity x observed load — see AnalyticsService.weigh().
    weight: number;
    status: string;
    priority: string | null;
    verified: boolean;
}

export interface TrackedCase {
    id: string;
    status: string;
    priority: string | null;
    verified: boolean;
    latitude: number;
    longitude: number;
    reportedAt: string;
    collector: { id: string; name: string } | null;
    wasteQuantity: number;
}

export interface RouteView {
    id: string;
    name: string;
    status: string;
    collectorId: string;
    totalDistanceMeters: number | null;
    totalDurationSeconds: number | null;
    // Google's encoded polyline for drawing the run, when one was computed.
    encodedPolyline: string | null;
    // Ordered by sequence. No `unresolvedCaseIds` companion is needed any
    // more — a foreign key cannot point at a case that is not there.
    stops: RouteStopView[];
}

export interface RouteStopView {
    caseId: string;
    sequence: number;
    status: string;
    latitude: number | null;
    longitude: number | null;
    caseStatus: string | null;
    priority: string | null;
    estimatedArrival: string | null;
}

// ---- 2. cases overview -------------------------------------------------

export interface CasesOverview {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    verified: number;
    unverified: number;
    unassigned: number;
    openedLast24h: number;
    openedLast7d: number;
    avgResolutionHours: number | null;
}

// ---- 3. waste metrics --------------------------------------------------

export interface WasteMetrics {
    totalDetections: number;
    totalQuantity: number;
    byType: WasteTypeMetric[];
    byHazardLevel: Record<string, number>;
}

export interface WasteTypeMetric {
    wasteTypeId: string;
    name: string;
    hazardLevel: string | null;
    detections: number;
    quantity: number;
}
