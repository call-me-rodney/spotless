// Credentials are read from the environment rather than hardcoded, because
// unlike the database URL these are secrets. Both are optional: with no
// GOOGLE_MAPS_API_KEY the planner falls back to the offline optimiser, and
// with no OPENWEATHER_API_KEY a plan request must carry explicit coordinates.
export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';
export const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? '';

export const hasGoogleCredentials = (): boolean => GOOGLE_MAPS_API_KEY.length > 0;
export const hasGeocoderCredentials = (): boolean => OPENWEATHER_API_KEY.length > 0;

export const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
export const GOOGLE_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
export const OPENWEATHER_GEOCODE_URL = 'https://api.openweathermap.org/geo/1.0/direct';

// computeRoutes handles the ordering itself only up to this many stops; beyond
// it we buy a cost matrix instead and order locally.
export const DIRECT_ROUTE_MAX_STOPS = 2;

// Google's practical waypoint ceiling, and a sane cap on matrix size (n+1)^2.
export const MAX_STOPS_PER_ROUTE = 25;

export const DEFAULT_RADIUS_KM = 10;

// Outbound calls are capped so a hanging provider cannot stall a plan request.
export const PROVIDER_TIMEOUT_MS = 10_000;

// Geocoded coordinates are held in memory only, never written to a table.
export const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
