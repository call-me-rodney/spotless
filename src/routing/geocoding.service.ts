import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  GEOCODE_CACHE_TTL_MS,
  OPENWEATHER_API_KEY,
  OPENWEATHER_GEOCODE_URL,
  PROVIDER_TIMEOUT_MS,
  hasGeocoderCredentials,
} from './routing.config';
import type { GeocodeResult } from './types/int.type';

interface CacheEntry {
  result: GeocodeResult;
  expiresAt: number;
}

// Resolves a collector's address to coordinates via OpenWeather, holding the
// answer in a process-local Map ONLY. Nothing here is ever persisted, so a
// collector's location exists on disk nowhere in this system.
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async geocode(address: string): Promise<GeocodeResult | null> {
    if (!hasGeocoderCredentials()) {
      return null;
    }

    const key = address.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) {
      return null;
    }

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    // Expired entries are dropped rather than served stale.
    if (cached) {
      this.cache.delete(key);
    }

    const result = await this.lookup(address);
    if (result) {
      this.cache.set(key, { result, expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS });
    }
    return result;
  }

  private async lookup(address: string): Promise<GeocodeResult | null> {
    const url = new URL(OPENWEATHER_GEOCODE_URL);
    url.searchParams.set('q', address);
    url.searchParams.set('limit', '1');
    url.searchParams.set('appid', OPENWEATHER_API_KEY);

    let payload: unknown;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`geocoder responded ${response.status}`);
      }
      payload = await response.json();
    } catch (error: any) {
      // A geocoder outage must not take the whole plan request down — the
      // caller can still pass explicit coordinates.
      this.logger.warn(`Geocoding '${address}' failed: ${error?.message ?? 'unknown error'}`);
      throw new ServiceUnavailableException(`Could not reach the geocoder: ${error?.message ?? 'unknown error'}`);
    }

    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }

    const [match] = payload as Array<Record<string, unknown>>;
    if (typeof match.lat !== 'number' || typeof match.lon !== 'number') {
      return null;
    }

    return {
      latitude: match.lat,
      longitude: match.lon,
      matchedName: typeof match.name === 'string' ? match.name : address,
      country: typeof match.country === 'string' ? match.country : null,
    };
  }

  // Exposed for diagnostics; the cache is per-process and dies with it.
  cacheSize(): number {
    return this.cache.size;
  }
}
