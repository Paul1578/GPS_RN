import type { ApiRequestOptions } from "@/context/AuthContext";

/**
 * ApiFetcher compartido con AuthContext (añadimos typing para evitar errores en RN).
 */
export type ApiFetcher = <T>(
  path: string,
  options?: ApiRequestOptions
) => Promise<T>;

/* ============================================================
 *  DTOs 1:1 CON LA API
 * ========================================================== */

export interface RouteApiDto {
  id: string;
  vehicleId: string;
  driverId: string;
  name: string;
  origin: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  points: Array<{
    latitude: number;
    longitude: number;
    name?: string;
  }>;
  cargoDescription?: string | null;
  plannedStart: string;
  plannedEnd: string;
  status: number;
  isActive: boolean;
}

export interface RoutePositionApiDto {
  id: string;
  routeId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh: number;
  heading: number;
}

export interface VehicleApiDto {
  id: string;
  name: string;
  model: string;
  brand: string;
  description?: string | null;
  plate: string;
  status: number;
  isActive: boolean;
  year: number;
}

/* ============================================================
 *  QUERY PARAMS Y HELPERS
 * ========================================================== */

export interface RouteQueryParams {
  status?: string;
  vehicleId?: string;
  driverId?: string;
  onlyActive?: boolean;
}

const buildQueryString = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter(
    ([, value]) => typeof value === "string" && value.length > 0
  ) as Array<[string, string]>;

  if (entries.length === 0) return "";
  return `?${new URLSearchParams(Object.fromEntries(entries)).toString()}`;
};

/* ============================================================
 *  LLAMADAS A LA API
 * ========================================================== */

export const fetchRoutes = (
  apiFetch: ApiFetcher,
  params: RouteQueryParams = {}
): Promise<RouteApiDto[]> => {
  const query = buildQueryString({
    status: params.status,
    vehicleId: params.vehicleId,
    driverId: params.driverId,
    onlyActive: params.onlyActive ? "true" : undefined,
  });

  return apiFetch<RouteApiDto[]>(`/Routes${query}`);
};

export const fetchRoutePositions = (
  apiFetch: ApiFetcher,
  routeId: string,
  from?: string,
  to?: string
): Promise<RoutePositionApiDto[]> => {
  const query = buildQueryString({
    from,
    to,
  });

  return apiFetch<RoutePositionApiDto[]>(`/Routes/${routeId}/positions${query}`);
};

export const fetchVehicles = (apiFetch: ApiFetcher): Promise<VehicleApiDto[]> => {
  return apiFetch<VehicleApiDto[]>(`/Vehicles`);
};

/* ============================================================
 *  MODELO NORMALIZADO PARA EL MAPA
 * ========================================================== */

export interface RouteForMap {
  id: string;
  name: string;
  vehicleId: string;
  driverId: string;
  status: number;
  isActive: boolean;
  origin: { latitude: number; longitude: number; name?: string };
  destination: { latitude: number; longitude: number; name?: string };
  points: Array<{ latitude: number; longitude: number; name?: string }>;
}

const normalizePoint = (
  raw: Record<string, unknown>,
  fallbackName: string
): { latitude: number; longitude: number; name?: string } => ({
  latitude:
    (raw as any).latitude ?? (raw as any).lat ?? (raw as any).Latitude ?? 0,
  longitude:
    (raw as any).longitude ?? (raw as any).lng ?? (raw as any).Longitude ?? 0,
  name: (raw as any).name ?? fallbackName,
});

const parsePoints = (
  dto: RouteApiDto | (RouteApiDto & { pointsJson?: string; PointsJson?: string })
) => {
  if (Array.isArray(dto.points)) {
    return dto.points.map((p, idx) => normalizePoint(p as any, `Punto ${idx + 1}`));
  }
  const raw = (dto as any).pointsJson ?? (dto as any).PointsJson;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p, idx) => normalizePoint(p as any, `Punto ${idx + 1}`));
      }
    } catch {
      // ignore parse errors
    }
  }
  return [];
};

export const mapRouteApiToRouteForMap = (dto: RouteApiDto): RouteForMap => ({
  id: dto.id,
  name: dto.name,
  vehicleId: dto.vehicleId,
  driverId: dto.driverId,
  status: dto.status,
  isActive: dto.isActive,
  origin: {
    latitude:
      dto.origin.latitude ??
      (dto as any).origin?.lat ??
      (dto as any).origin?.Latitude ??
      0,
    longitude:
      dto.origin.longitude ??
      (dto as any).origin?.lng ??
      (dto as any).origin?.Longitude ??
      0,
    name: dto.origin.name,
  },
  destination: {
    latitude:
      dto.destination.latitude ??
      (dto as any).destination?.lat ??
      (dto as any).destination?.Latitude ??
      0,
    longitude:
      dto.destination.longitude ??
      (dto as any).destination?.lng ??
      (dto as any).destination?.Longitude ??
      0,
    name: dto.destination.name,
  },
  points: parsePoints(dto),
});

export const mapRoutesApiToRoutesForMap = (dtos: RouteApiDto[]): RouteForMap[] =>
  dtos.map(mapRouteApiToRouteForMap);

export type RouteDto = RouteApiDto;
export type RoutePositionDto = RoutePositionApiDto;
export type VehicleDto = VehicleApiDto;
