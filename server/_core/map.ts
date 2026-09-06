/**
 * Google Maps API Integration for Manus WebDev Templates
 *
 * Main function: makeRequest<T>(endpoint, params) - Makes authenticated requests to Google Maps APIs
 * All credentials are automatically injected. Array parameters use | as separator.
 *
 * See API examples below the type definitions for usage patterns.
 */

import { ENV } from "./env";

// ============================================================================
// Configuration
// ============================================================================

type MapsConfig = {
  baseUrl: string;
  apiKey: string;
};

const MAPS_REQUEST_TIMEOUT_MS = 10_000;
const MAPS_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAPS_MAX_REQUEST_BODY_BYTES = 64 * 1024;
const MAPS_MAX_ENDPOINT_LENGTH = 256;
const MAPS_MAX_PARAMS = 32;
const MAPS_MAX_PARAM_KEY_LENGTH = 64;
const MAPS_MAX_PARAM_VALUE_LENGTH = 2048;
const MAPS_MAX_ARRAY_VALUES = 50;
const MAPS_MAX_URL_LENGTH = 8192;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function getMapsConfig(): MapsConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Google Maps proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("Google Maps proxy configuration is invalid");
  }
  const isLocalDevelopment =
    !ENV.isProduction &&
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !isLocalDevelopment) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Google Maps proxy configuration is invalid");
  }

  return { baseUrl: parsed.toString().replace(/\/+$/, ""), apiKey };
}

const validateEndpoint = (endpoint: string): void => {
  if (
    typeof endpoint !== "string" ||
    endpoint.length === 0 ||
    endpoint.length > MAPS_MAX_ENDPOINT_LENGTH ||
    !/^\/(?:maps\/api|v1)\/[A-Za-z0-9._~/-]+$/.test(endpoint) ||
    endpoint.split("/").some(segment => segment === "." || segment === "..")
  ) {
    throw new Error("Google Maps endpoint is invalid");
  }
};

const serializeParamValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    if (value.length === 0 || value.length > MAPS_MAX_ARRAY_VALUES) {
      throw new Error("Google Maps parameters are invalid");
    }
    return value.map(serializeParamValue).join("|");
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Google Maps parameters are invalid");
    return String(value);
  }
  if (typeof value !== "string" && typeof value !== "boolean") {
    throw new Error("Google Maps parameters are invalid");
  }
  const serialized = String(value);
  if (
    serialized.length > MAPS_MAX_PARAM_VALUE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(serialized)
  ) {
    throw new Error("Google Maps parameters are invalid");
  }
  return serialized;
};

const readBoundedResponse = async (response: Response): Promise<string> => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      totalBytes += value.byteLength;
      if (totalBytes > MAPS_MAX_RESPONSE_BYTES)
        throw new Error("response too large");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
};

// ============================================================================
// Core Request Handler
// ============================================================================

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}

/**
 * Make authenticated requests to Google Maps APIs
 *
 * @param endpoint - The API endpoint (e.g., "/maps/api/geocode/json")
 * @param params - Query parameters for the request
 * @param options - Additional request options
 * @returns The API response
 */
export async function makeRequest<T = unknown>(
  endpoint: string,
  params: Record<string, unknown> = {},
  options: RequestOptions = {}
): Promise<T> {
  const { baseUrl, apiKey } = getMapsConfig();
  validateEndpoint(endpoint);
  const method = options.method ?? "GET";
  if (method !== "GET" && method !== "POST") {
    throw new Error("Google Maps request method is invalid");
  }
  if (method === "GET" && options.body !== undefined) {
    throw new Error("Google Maps GET requests cannot include a body");
  }

  // Construct full URL: baseUrl + /v1/maps/proxy + endpoint
  const url = new URL(`${baseUrl}/v1/maps/proxy${endpoint}`);

  // Add API key as query parameter (standard Google Maps API authentication)
  url.searchParams.append("key", apiKey);

  // Add other query parameters
  const entries = Object.entries(params);
  if (entries.length > MAPS_MAX_PARAMS) {
    throw new Error("Google Maps parameters are invalid");
  }
  entries.forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (
        key.length === 0 ||
        key.length > MAPS_MAX_PARAM_KEY_LENGTH ||
        key.toLowerCase() === "key" ||
        !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(key)
      ) {
        throw new Error("Google Maps parameters are invalid");
      }
      url.searchParams.append(key, serializeParamValue(value));
    }
  });

  if (url.toString().length > MAPS_MAX_URL_LENGTH) {
    throw new Error("Google Maps request URL is too large");
  }

  let requestBody: string | undefined;
  if (options.body !== undefined) {
    if (!isRecord(options.body))
      throw new Error("Google Maps request body is invalid");
    try {
      requestBody = JSON.stringify(options.body);
    } catch {
      throw new Error("Google Maps request body is invalid");
    }
    if (Buffer.byteLength(requestBody, "utf8") > MAPS_MAX_REQUEST_BODY_BYTES) {
      throw new Error("Google Maps request body is too large");
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAPS_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method,
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Google Maps API request failed (${response.status})`);
    }

    try {
      const payload: unknown = JSON.parse(await readBoundedResponse(response));
      if (!isRecord(payload)) throw new Error("invalid response");
      return payload as T;
    } catch {
      throw new Error("Google Maps API returned an invalid response");
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Google Maps API ")
    ) {
      throw error;
    }
    throw new Error("Google Maps API request failed");
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export type TravelMode = "driving" | "walking" | "bicycling" | "transit";
export type MapType = "roadmap" | "satellite" | "terrain" | "hybrid";
export type SpeedUnit = "KPH" | "MPH";

export type LatLng = {
  lat: number;
  lng: number;
};

export type DirectionsResult = {
  routes: Array<{
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      start_address: string;
      end_address: string;
      start_location: LatLng;
      end_location: LatLng;
      steps: Array<{
        distance: { text: string; value: number };
        duration: { text: string; value: number };
        html_instructions: string;
        travel_mode: string;
        start_location: LatLng;
        end_location: LatLng;
      }>;
    }>;
    overview_polyline: { points: string };
    summary: string;
    warnings: string[];
    waypoint_order: number[];
  }>;
  status: string;
};

export type DistanceMatrixResult = {
  rows: Array<{
    elements: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      status: string;
    }>;
  }>;
  origin_addresses: string[];
  destination_addresses: string[];
  status: string;
};

export type GeocodingResult = {
  results: Array<{
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    formatted_address: string;
    geometry: {
      location: LatLng;
      location_type: string;
      viewport: {
        northeast: LatLng;
        southwest: LatLng;
      };
    };
    place_id: string;
    types: string[];
  }>;
  status: string;
};

export type PlacesSearchResult = {
  results: Array<{
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
      location: LatLng;
    };
    rating?: number;
    user_ratings_total?: number;
    business_status?: string;
    types: string[];
  }>;
  status: string;
};

export type PlaceDetailsResult = {
  result: {
    place_id: string;
    name: string;
    formatted_address: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: Array<{
      author_name: string;
      rating: number;
      text: string;
      time: number;
    }>;
    opening_hours?: {
      open_now: boolean;
      weekday_text: string[];
    };
    geometry: {
      location: LatLng;
    };
  };
  status: string;
};

export type ElevationResult = {
  results: Array<{
    elevation: number;
    location: LatLng;
    resolution: number;
  }>;
  status: string;
};

export type TimeZoneResult = {
  dstOffset: number;
  rawOffset: number;
  status: string;
  timeZoneId: string;
  timeZoneName: string;
};

export type RoadsResult = {
  snappedPoints: Array<{
    location: LatLng;
    originalIndex?: number;
    placeId: string;
  }>;
};

// ============================================================================
// Google Maps API Reference
// ============================================================================

/**
 * GEOCODING - Convert between addresses and coordinates
 * Endpoint: /maps/api/geocode/json
 * Input: { address: string } OR { latlng: string }  // latlng: "37.42,-122.08"
 * Output: GeocodingResult  // results[0].geometry.location, results[0].formatted_address
 */

/**
 * DIRECTIONS - Get navigation routes between locations
 * Endpoint: /maps/api/directions/json
 * Input: { origin: string, destination: string, mode?: TravelMode, waypoints?: string, alternatives?: boolean }
 * Output: DirectionsResult  // routes[0].legs[0].distance, duration, steps
 */

/**
 * DISTANCE MATRIX - Calculate travel times/distances for multiple origin-destination pairs
 * Endpoint: /maps/api/distancematrix/json
 * Input: { origins: string, destinations: string, mode?: TravelMode, units?: "metric"|"imperial" }  // origins: "NYC|Boston"
 * Output: DistanceMatrixResult  // rows[0].elements[1] = first origin to second destination
 */

/**
 * PLACE SEARCH - Find businesses/POIs by text query
 * Endpoint: /maps/api/place/textsearch/json
 * Input: { query: string, location?: string, radius?: number, type?: string }  // location: "40.7,-74.0"
 * Output: PlacesSearchResult  // results[].name, rating, geometry.location, place_id
 */

/**
 * NEARBY SEARCH - Find places near a specific location
 * Endpoint: /maps/api/place/nearbysearch/json
 * Input: { location: string, radius: number, type?: string, keyword?: string }  // location: "40.7,-74.0"
 * Output: PlacesSearchResult
 */

/**
 * PLACE DETAILS - Get comprehensive information about a specific place
 * Endpoint: /maps/api/place/details/json
 * Input: { place_id: string, fields?: string }  // fields: "name,rating,opening_hours,website"
 * Output: PlaceDetailsResult  // result.name, rating, opening_hours, etc.
 */

/**
 * ELEVATION - Get altitude data for geographic points
 * Endpoint: /maps/api/elevation/json
 * Input: { locations?: string, path?: string, samples?: number }  // locations: "39.73,-104.98|36.45,-116.86"
 * Output: ElevationResult  // results[].elevation (meters)
 */

/**
 * TIME ZONE - Get timezone information for a location
 * Endpoint: /maps/api/timezone/json
 * Input: { location: string, timestamp: number }  // timestamp: Math.floor(Date.now()/1000)
 * Output: TimeZoneResult  // timeZoneId, timeZoneName
 */

/**
 * ROADS - Snap GPS traces to roads, find nearest roads, get speed limits
 * - /v1/snapToRoads: Input: { path: string, interpolate?: boolean }  // path: "lat,lng|lat,lng"
 * - /v1/nearestRoads: Input: { points: string }  // points: "lat,lng|lat,lng"
 * - /v1/speedLimits: Input: { path: string, units?: SpeedUnit }
 * Output: RoadsResult
 */

/**
 * PLACE AUTOCOMPLETE - Real-time place suggestions as user types
 * Endpoint: /maps/api/place/autocomplete/json
 * Input: { input: string, location?: string, radius?: number }
 * Output: { predictions: Array<{ description: string, place_id: string }> }
 */

/**
 * STATIC MAPS - Generate map images as URLs (for emails, reports, <img> tags)
 * Endpoint: /maps/api/staticmap
 * Input: URL params - center: string, zoom: number, size: string, markers?: string, maptype?: MapType
 * Output: Image URL (not JSON) - use directly in <img src={url} />
 * Note: Construct URL manually with getMapsConfig() for auth
 */
