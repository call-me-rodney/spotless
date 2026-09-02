export enum RouteStatus {
    draft = "draft",
    dispatched = "dispatched",
    inProgress = "inProgress",
    completed = "completed",
    cancelled = "cancelled",
}

export enum RouteStopStatus {
    pending = "pending",
    arrived = "arrived",
    collected = "collected",
    skipped = "skipped",
}

// Which strategy produced the ordering. Recorded per route so a plan can be
// read back knowing whether it followed real roads or straight-line distance.
export enum RouteProvider {
    // <= 2 stops: computeRoutes returns the route directly.
    googleRoutes = "google.computeRoutes",
    // > 2 stops: computeRouteMatrix for real travel costs, nearest neighbour locally.
    googleRouteMatrix = "google.computeRouteMatrix",
    // No GCP credentials: haversine distances, nearest neighbour, no road data.
    offline = "offline.haversine",
}
