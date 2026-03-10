export type LatLngTuple = [number, number];
export type LngLatTuple = [number, number];

export type LineFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: LngLatTuple[];
  };
  properties: Record<string, unknown>;
};

export const parseCoord = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const toLngLat = ([lat, lng]: LatLngTuple): LngLatTuple => [lng, lat];
export const toLatLng = ([lng, lat]: LngLatTuple): LatLngTuple => [lat, lng];

export const sanitizeLngLatCoordinates = (coords: unknown): LngLatTuple[] => {
  if (!Array.isArray(coords)) return [];
  return coords
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const lng = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return [lng, lat] as LngLatTuple;
    })
    .filter((pair): pair is LngLatTuple => !!pair);
};

export const buildLineFeatureFromLngLat = (coords: LngLatTuple[]): LineFeature | null => {
  if (coords.length < 2) return null;
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coords,
    },
    properties: {},
  };
};

export const buildLineFeatureFromLatLng = (coords: LatLngTuple[]): LineFeature | null =>
  buildLineFeatureFromLngLat(coords.map(toLngLat));

export const areLatLngArraysEqual = (a: LatLngTuple[], b: LatLngTuple[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i][0] - b[i][0]) > 1e-6 || Math.abs(a[i][1] - b[i][1]) > 1e-6) {
      return false;
    }
  }
  return true;
};

export const computeBoundsFromLngLat = (coords: LngLatTuple[]) => {
  if (coords.length < 2) return null;
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  coords.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
  return {
    ne: [maxLng, maxLat] as LngLatTuple,
    sw: [minLng, minLat] as LngLatTuple,
  };
};

const toRadians = (value: number) => (value * Math.PI) / 180;

export const distanceMeters = (a: LatLngTuple, b: LatLngTuple) => {
  const earthRadius = 6371000;
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]);
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const distanceToSegmentMeters = (
  point: LatLngTuple,
  segmentStart: LatLngTuple,
  segmentEnd: LatLngTuple
) => {
  const ax = segmentStart[1];
  const ay = segmentStart[0];
  const bx = segmentEnd[1];
  const by = segmentEnd[0];
  const px = point[1];
  const py = point[0];
  const dx = bx - ax;
  const dy = by - ay;
  const segLenSquared = dx * dx + dy * dy;
  if (segLenSquared === 0) return distanceMeters(point, segmentStart);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segLenSquared));
  const projection: LatLngTuple = [ay + dy * t, ax + dx * t];
  return distanceMeters(point, projection);
};

export const distanceToPolylineMeters = (point: LatLngTuple, polyline: LatLngTuple[]) => {
  if (polyline.length < 2) return null;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const dist = distanceToSegmentMeters(point, polyline[i], polyline[i + 1]);
    if (dist < min) min = dist;
  }
  return Number.isFinite(min) ? min : null;
};

export const formatTrackingAge = (ageMs: number) => {
  if (ageMs < 1000) return "<1s";
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s`;
  const minutes = Math.floor(ageMs / 60_000);
  const seconds = Math.round((ageMs % 60_000) / 1000);
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours}h ${restMinutes}m`;
};

