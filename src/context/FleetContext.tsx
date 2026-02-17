import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  fetchRoutes,
  fetchVehicles,
  type RouteApiDto,
  type VehicleApiDto,
} from "@/services/fleetApi";

export interface Vehicle {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  estado: "disponible" | "en_ruta" | "mantenimiento";
  ubicacionActual?: { lat: number; lng: number };
  teamId?: string;
  descripcion?: string;
  isActive?: boolean;
}

export type RouteEvidence =
  | {
      id: string;
      type: "image";
      content: string;
      description?: string;
      timestamp: string;
    }
  | { id: string; type: "note"; content: string; timestamp: string };

export interface Route {
  id: string;
  nombre: string;
  vehiculoId: string;
  conductorId: string;
  carga: string;
  origen?: { lat: number; lng: number; nombre?: string };
  destino?: { lat: number; lng: number; nombre?: string };
  puntos: Array<{ lat: number; lng: number; nombre?: string }>;
  estado: "pendiente" | "en_progreso" | "completada" | "cancelada";
  fechaCreacion: string;
  fechaInicio?: string;
  fechaFin?: string;
  teamId?: string;
  evidencias?: RouteEvidence[];
  notas?: string;
  isActive?: boolean;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  phoneNumber: string;
  isActive?: boolean;
  vehicleId?: string;
  userId: string;
}

interface FleetContextType {
  vehicles: Vehicle[];
  routes: Route[];
  drivers: Driver[];

  addVehicle: (vehicle: Omit<Vehicle, "id">) => Promise<ActionResult>;
  updateVehicle: (id: string, vehicle: Partial<Vehicle>) => Promise<ActionResult>;
  deleteVehicle: (id: string) => Promise<ActionResult>;

  addRoute: (route: Omit<Route, "id" | "fechaCreacion">) => Promise<ActionResult>;
  updateRoute: (id: string, route: Partial<Route>) => Promise<ActionResult>;
  deleteRoute: (id: string) => Promise<ActionResult>;

  updateVehicleLocation: (
    vehicleId: string,
    location: { lat: number; lng: number }
  ) => Promise<ActionResult>;
  registerRoutePosition: (
    routeId: string,
    location: { lat: number; lng: number },
    meta?: { recordedAt?: string; speedKmh?: number; heading?: number }
  ) => Promise<ActionResult>;
  addRouteEvidence: (
    routeId: string,
    evidence: Omit<RouteEvidence, "id" | "timestamp">
  ) => void;

  getRoutesByDriver: (driverId: string) => Route[];
  getTeamVehicles: () => Vehicle[];
  getTeamRoutes: () => Route[];

  refreshDrivers: (onlyActive?: boolean) => Promise<void>;
  addDriver: (driver: Omit<Driver, "id" | "isActive" | "vehicleId">) => Promise<ActionResult>;
  assignVehicleToDriver: (driverId: string, vehicleId: string) => Promise<ActionResult>;
  unassignVehicleFromDriver: (driverId: string) => Promise<ActionResult>;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

type ApiVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  description?: string | null;
  status?: number;
  isActive?: boolean;
};

type ApiRoutePoint = {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  name?: string;
};

type ApiRoute = {
  id: string;
  vehicleId: string;
  driverId: string;
  name: string;
  origin?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    name?: string;
  };
  destination?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    name?: string;
  };
  points: ApiRoutePoint[];
  cargoDescription?: string;
  plannedStart?: string;
  plannedEnd?: string;
  status?: string | number;
  isActive?: boolean;
};

type ApiDriver = {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  phoneNumber: string;
  isActive?: boolean;
  vehicleId?: string;
  userId: string;
};

type ActionResult = { ok: boolean; message?: string };

const resolveApiMessage = (error: unknown, fallback: string): string => {
  const data = (error as any)?.data;
  const status = (error as any)?.status;
  const explicitMessage =
    data?.message ||
    (Array.isArray(data?.errors) ? data.errors.join(", ") : undefined) ||
    (error as Error)?.message;

  if (status === 401) {
    return "Tu sesion expiro, inicia sesion nuevamente.";
  }

  return explicitMessage || fallback;
};

const statusNumberToState = (status?: number): Vehicle["estado"] => {
  switch (status) {
    case 1:
      return "en_ruta";
    case 2:
      return "mantenimiento";
    default:
      return "disponible";
  }
};

const stateToStatusNumber = (estado: Vehicle["estado"]): number => {
  if (estado === "en_ruta") return 1;
  if (estado === "mantenimiento") return 2;
  return 0;
};

const stateToApiStatusNumber = (estado?: Route["estado"]): number => {
  if (!estado) return 0;
  const key = estado.toLowerCase();
  if (key.includes("progreso")) return 1;
  if (key.includes("complet")) return 2;
  if (key.includes("cancel")) return 3;
  return 0;
};

const normalizeIsActive = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["false", "0", "no"].includes(lower)) return false;
    if (["true", "1", "yes"].includes(lower)) return true;
  }
  return true;
};

const mapApiVehicle = (apiVehicle: ApiVehicle): Vehicle => ({
  id: apiVehicle.id,
  placa: apiVehicle.plate,
  marca: apiVehicle.brand,
  modelo: apiVehicle.model,
  anio: apiVehicle.year,
  descripcion: apiVehicle.description ?? undefined,
  estado: statusNumberToState(apiVehicle.status),
  isActive: normalizeIsActive(apiVehicle.isActive),
});

const mapApiRoute = (apiRoute: ApiRoute): Route => {
  const normalizeStatus = (status?: string | number): Route["estado"] => {
    if (typeof status === "number") {
      if (status === 1) return "en_progreso";
      if (status === 2) return "completada";
      if (status === 3) return "cancelada";
      return "pendiente";
    }
    const key = (status ?? "").toString().toLowerCase();
    if (key.includes("progress") || key.includes("curso") || key.includes("progreso"))
      return "en_progreso";
    if (key.includes("complete") || key.includes("complet")) return "completada";
    if (key.includes("cancel")) return "cancelada";
    return "pendiente";
  };

  const puntos =
    apiRoute.points?.map((p, idx) => ({
      lat: p.latitude ?? (p as any).Latitude ?? p.lat ?? 0,
      lng: p.longitude ?? (p as any).Longitude ?? p.lng ?? 0,
      nombre: p.name ?? `Punto ${idx + 1}`,
    })) ?? [];

  return {
    id: apiRoute.id,
    nombre: apiRoute.name,
    vehiculoId: apiRoute.vehicleId,
    conductorId: apiRoute.driverId,
    carga: apiRoute.cargoDescription ?? "",
    origen: apiRoute.origin
      ? {
          lat: apiRoute.origin.lat ?? apiRoute.origin.latitude ?? 0,
          lng: apiRoute.origin.lng ?? apiRoute.origin.longitude ?? 0,
          nombre: apiRoute.origin.name,
        }
      : undefined,
    destino: apiRoute.destination
      ? {
          lat: apiRoute.destination.lat ?? apiRoute.destination.latitude ?? 0,
          lng: apiRoute.destination.lng ?? apiRoute.destination.longitude ?? 0,
          nombre: apiRoute.destination.name,
        }
      : undefined,
    puntos,
    estado: normalizeStatus(apiRoute.status),
    fechaCreacion: apiRoute.plannedStart ?? new Date().toISOString(),
    fechaInicio: apiRoute.plannedStart,
    fechaFin: apiRoute.plannedEnd,
    isActive: normalizeIsActive(apiRoute.isActive),
  };
};

const mapApiDriver = (apiDriver: ApiDriver): Driver => ({
  id: apiDriver.id,
  firstName: apiDriver.firstName,
  lastName: apiDriver.lastName,
  documentNumber: apiDriver.documentNumber,
  phoneNumber: apiDriver.phoneNumber,
  isActive: normalizeIsActive(apiDriver.isActive),
  vehicleId: apiDriver.vehicleId,
  userId: apiDriver.userId,
});

const toApiRoutePayload = (route: Partial<Route>) => {
  const toApiPoint = (
    point: { lat?: number; lng?: number; nombre?: string } | undefined,
    fallbackName: string
  ) =>
    point
      ? {
          lat: Number(point.lat ?? 0),
          lng: Number(point.lng ?? 0),
          name: point.nombre ?? fallbackName,
        }
      : undefined;

  const stops =
    route.puntos?.map((p, idx) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      name: p.nombre ?? `Parada ${idx + 1}`,
    })) ?? [];

  const points: Array<{ lat: number; lng: number; name?: string }> = [];
  const originPoint = toApiPoint(route.origen, "Origen");
  if (originPoint) points.push(originPoint);
  points.push(...stops);
  const destinationPoint = toApiPoint(route.destino, "Destino");
  if (destinationPoint) points.push(destinationPoint);

  const plannedStart = route.fechaInicio ?? new Date().toISOString();
  const plannedEnd =
    route.fechaFin ??
    new Date(new Date(plannedStart).getTime() + 60 * 60 * 1000).toISOString();

  return {
    vehicleId: route.vehiculoId,
    driverId: route.conductorId,
    name: route.nombre,
    origin: toApiPoint(route.origen, "Origen"),
    destination: toApiPoint(route.destino, "Destino"),
    points,
    cargoDescription: route.carga,
    plannedStart,
    plannedEnd,
    status: stateToApiStatusNumber(route.estado),
    isActive: true,
  };
};

const generateId = () => {
  const hasCrypto =
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function";
  return hasCrypto
    ? globalThis.crypto.randomUUID()
    : `id-${Math.random().toString(16).slice(2)}-${Date.now()}`;
};

export function FleetProvider({ children }: { children: ReactNode }) {
  const { apiFetch, isAuthenticated, isLoadingUser, user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const refreshVehicles = async () => {
    if (!apiFetch) return;
    if (user?.role === "chofer") return;
    const data = await fetchVehicles(apiFetch);
    const active = data.filter((v) => normalizeIsActive((v as any).isActive));
    setVehicles(active.map(mapApiVehicle));
  };

  const refreshRoutes = async () => {
    if (!apiFetch) return;
    const data = await fetchRoutes(apiFetch);
    const active = data.filter((r) => normalizeIsActive((r as any).isActive));

    setRoutes((prev) => {
      const prevMap = new Map(prev.map((r) => [r.id, r]));
      return active.map((apiR) => {
        const mapped = mapApiRoute(apiR as unknown as ApiRoute);
        const old = prevMap.get(mapped.id);
        return old ? { ...mapped, evidencias: old.evidencias, notas: old.notas } : mapped;
      });
    });
  };

  const refreshDrivers = async (onlyActive = true) => {
    if (!apiFetch) return;
    if (user?.role === "chofer") return;
    const query = onlyActive ? "?onlyActive=true" : "";
    const data = await apiFetch<ApiDriver[]>(`/Drivers${query}`);
    const active = data.filter((d) => normalizeIsActive((d as any).isActive));
    setDrivers(active.map(mapApiDriver));
  };

  useEffect(() => {
    const loadVehicles = async () => {
      if (!apiFetch || isLoadingUser || !isAuthenticated) return;
      try {
        await refreshVehicles();
      } catch (error) {
        console.error("Error cargando vehiculos desde API", error);
      }
    };
    void loadVehicles();
  }, [apiFetch, isAuthenticated, isLoadingUser, user?.role]);

  useEffect(() => {
    const loadRoutes = async () => {
      if (!apiFetch || isLoadingUser || !isAuthenticated) return;
      try {
        await refreshRoutes();
      } catch (error) {
        console.error("Error cargando rutas desde API", error);
      }
    };
    void loadRoutes();
  }, [apiFetch, isAuthenticated, isLoadingUser, user?.role]);

  useEffect(() => {
    const loadDrivers = async () => {
      if (!apiFetch || isLoadingUser || !isAuthenticated) return;
      try {
        await refreshDrivers();
      } catch (error) {
        console.error("Error cargando drivers desde API", error);
      }
    };
    void loadDrivers();
  }, [apiFetch, isAuthenticated, isLoadingUser, user?.role]);

  const addVehicle = async (
    vehicle: Omit<Vehicle, "id">
  ): Promise<ActionResult> => {
    try {
      const payload = {
        plate: vehicle.placa,
        brand: vehicle.marca,
        model: vehicle.modelo,
        year: vehicle.anio,
        description: vehicle.descripcion ?? "",
      };

      const created = await apiFetch<ApiVehicle>("/Vehicles", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const mapped = mapApiVehicle(created);
      const updated = [...vehicles, mapped];
      setVehicles(updated);

      return { ok: true, message: "Vehiculo registrado correctamente" };
    } catch (error) {
      console.error("Error al crear vehiculo:", error);
      return {
        ok: false,
        message: resolveApiMessage(error, "No se pudo crear el vehiculo"),
      };
    }
  };

  const updateVehicle = async (
    id: string,
    vehicleData: Partial<Vehicle>
  ): Promise<ActionResult> => {
    try {
      const current = vehicles.find((v) => v.id === id);
      const nextEstado = vehicleData.estado ?? current?.estado;

      const hasCoreFields =
        vehicleData.placa ||
        vehicleData.marca ||
        vehicleData.modelo ||
        vehicleData.anio ||
        vehicleData.descripcion;

      if (hasCoreFields) {
        const payload = {
          plate: vehicleData.placa ?? current?.placa ?? "",
          brand: vehicleData.marca ?? current?.marca ?? "",
          model: vehicleData.modelo ?? current?.modelo ?? "",
          year: vehicleData.anio ?? current?.anio ?? new Date().getFullYear(),
          description: vehicleData.descripcion ?? current?.descripcion ?? "",
        };

        await apiFetch(`/Vehicles/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }

      if (nextEstado && current?.estado !== nextEstado) {
        await apiFetch(`/Vehicles/${id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: stateToStatusNumber(nextEstado) }),
        });
      }

      const updatedVehicles = vehicles.map((v) =>
        v.id === id ? { ...v, ...vehicleData } : v
      );
      setVehicles(updatedVehicles);

      return { ok: true, message: "Vehiculo actualizado" };
    } catch (error) {
      console.error("Error al actualizar vehiculo:", error);
      return {
        ok: false,
        message: resolveApiMessage(error, "No se pudo actualizar el vehiculo"),
      };
    }
  };

  const deleteVehicle = async (id: string): Promise<ActionResult> => {
    try {
      await apiFetch(`/Vehicles/${id}`, { method: "DELETE" });

      const updatedVehicles = vehicles.filter((v) => v.id !== id);
      setVehicles(updatedVehicles);

      return { ok: true, message: "Vehiculo eliminado" };
    } catch (error) {
      console.error("Error al eliminar vehiculo:", error);
      return {
        ok: false,
        message: resolveApiMessage(error, "No se pudo eliminar el vehiculo"),
      };
    }
  };

  const linkDriverVehicle = async (driverId?: string, vehicleId?: string) => {
    if (!driverId || !vehicleId) return;
    try {
      await apiFetch(`/Drivers/${driverId}/assign-vehicle`, {
        method: "PUT",
        body: JSON.stringify({ vehicleId }),
      });
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, vehicleId } : d))
      );
    } catch (error) {
      console.error("No se pudo asignar vehiculo al chofer al crear la ruta:", error);
    }
  };

  const addRoute = async (
    route: Omit<Route, "id" | "fechaCreacion">
  ): Promise<ActionResult> => {
    try {
      const payload = toApiRoutePayload(route);

      await apiFetch<ApiRoute>("/Routes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await linkDriverVehicle(route.conductorId, route.vehiculoId);
      await refreshRoutes();
      return { ok: true, message: "Ruta creada correctamente" };
    } catch (error) {
      console.error("Error al crear ruta:", error);
      return {
        ok: false,
        message: resolveApiMessage(error, "No se pudo crear la ruta"),
      };
    }
  };

  const updateRoute = async (
    id: string,
    routePatch: Partial<Route>
  ): Promise<ActionResult> => {
    try {
      const current = routes.find((r) => r.id === id);
      if (!current) throw new Error("Ruta no encontrada");

      const merged: Route = {
        ...current,
        ...routePatch,
        origen: routePatch.origen ?? current.origen,
        destino: routePatch.destino ?? current.destino,
        puntos: routePatch.puntos ?? current.puntos,
      };

      const payload = {
        vehicleId: merged.vehiculoId,
        driverId: merged.conductorId,
        name: merged.nombre,
        points: [
          ...(merged.origen
            ? [
                {
                  lat: Number(merged.origen.lat ?? 0),
                  lng: Number(merged.origen.lng ?? 0),
                  name: merged.origen.nombre ?? "Origen",
                },
              ]
            : []),
          ...(merged.puntos ?? []).map((p, idx) => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
            name: p.nombre ?? `Parada ${idx + 1}`,
          })),
          ...(merged.destino
            ? [
                {
                  lat: Number(merged.destino.lat ?? 0),
                  lng: Number(merged.destino.lng ?? 0),
                  name: merged.destino.nombre ?? "Destino",
                },
              ]
            : []),
        ],
        origin: merged.origen
          ? {
              lat: Number(merged.origen.lat ?? 0),
              lng: Number(merged.origen.lng ?? 0),
              name: merged.origen.nombre ?? "Origen",
            }
          : undefined,
        destination: merged.destino
          ? {
              lat: Number(merged.destino.lat ?? 0),
              lng: Number(merged.destino.lng ?? 0),
              name: merged.destino.nombre ?? "Destino",
            }
          : undefined,
        cargoDescription: merged.carga ?? "",
        plannedStart:
          merged.fechaInicio ??
          merged.fechaCreacion ??
          new Date().toISOString(),
        plannedEnd:
          merged.fechaFin ??
          new Date(
            new Date(
              merged.fechaInicio ??
                merged.fechaCreacion ??
                new Date().toISOString()
            ).getTime() +
              60 * 60 * 1000
          ).toISOString(),
        status: stateToApiStatusNumber(merged.estado),
        isActive: true,
      };

      await apiFetch<ApiRoute>(`/Routes/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const statusChanged = current.estado !== merged.estado;
      if (statusChanged && merged.estado) {
        await apiFetch<void>(`/Routes/${id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: stateToApiStatusNumber(merged.estado) }),
        });
      }

      await linkDriverVehicle(merged.conductorId, merged.vehiculoId);
      const finished =
        typeof merged.estado === "string" &&
        ["completada", "cancelada"].includes(merged.estado.toLowerCase());
      if (finished && merged.conductorId) {
        await unassignVehicleFromDriver(merged.conductorId);
      }
      await refreshRoutes();
      return { ok: true, message: "Ruta actualizada" };
    } catch (error) {
      console.error("Error al actualizar ruta:", error);
      return {
        ok: false,
        message: resolveApiMessage(error, "No se pudo actualizar la ruta"),
      };
    }
  };

  const deleteRoute = async (id: string): Promise<ActionResult> => {
    try {
      await apiFetch(`/Routes/${id}`, { method: "DELETE" });

      await refreshRoutes();
      return { ok: true, message: "Ruta eliminada" };
    } catch (error) {
      console.error("Error al eliminar ruta:", error);
      return {
        ok: false,
        message: resolveApiMessage(error, "No se pudo eliminar la ruta"),
      };
    }
  };

  const updateVehicleLocation = async (
    vehicleId: string,
    location: { lat: number; lng: number }
  ): Promise<ActionResult> => {
    try {
      await apiFetch(`/Vehicles/${vehicleId}/location`, {
        method: "PUT",
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
        }),
      });
      await updateVehicle(vehicleId, { ubicacionActual: location });
      return { ok: true };
    } catch (error) {
      console.warn(
        "No se pudo persistir ubicacion en backend, usando estado local:",
        error
      );
      await updateVehicle(vehicleId, { ubicacionActual: location });
      return {
        ok: false,
        message: resolveApiMessage(
          error,
          "No se pudo actualizar la ubicacion del vehiculo"
        ),
      };
    }
  };

  const registerRoutePosition = async (
    routeId: string,
    location: { lat: number; lng: number },
    meta?: { recordedAt?: string; speedKmh?: number; heading?: number }
  ): Promise<ActionResult> => {
    try {
      await apiFetch(`/Routes/${routeId}/positions`, {
        method: "POST",
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
          recordedAt: meta?.recordedAt,
          speedKmh: meta?.speedKmh,
          heading: meta?.heading,
        }),
      });
      return { ok: true };
    } catch (error) {
      console.warn("No se pudo registrar tracking en backend:", error);
      return {
        ok: false,
        message: resolveApiMessage(
          error,
          "No se pudo registrar el tracking de la ruta"
        ),
      };
    }
  };

  const addRouteEvidence = (
    routeId: string,
    evidence: Omit<RouteEvidence, "id" | "timestamp">
  ) => {
    const newEvidence: RouteEvidence = {
      ...evidence,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };

    setRoutes((prev) =>
      prev.map((r) =>
        r.id === routeId
          ? { ...r, evidencias: [...(r.evidencias ?? []), newEvidence] }
          : r
      )
    );
  };

  const addDriver = async (
    driver: Omit<Driver, "id" | "isActive" | "vehicleId">
  ): Promise<ActionResult> => {
    try {
      const payload = {
        firstName: driver.firstName,
        lastName: driver.lastName,
        documentNumber: driver.documentNumber,
        phoneNumber: driver.phoneNumber,
        userId: driver.userId,
      };
      const created = await apiFetch<ApiDriver>("/Drivers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const mapped = mapApiDriver(created);
      setDrivers((prev) => [...prev, mapped]);
      return { ok: true, message: "Chofer creado" };
    } catch (error) {
      console.error("Error al crear chofer:", error);
      return { ok: false, message: resolveApiMessage(error, "No se pudo crear el chofer") };
    }
  };

  const assignVehicleToDriver = async (
    driverId: string,
    vehicleId: string
  ): Promise<ActionResult> => {
    try {
      await apiFetch(`/Drivers/${driverId}/assign-vehicle`, {
        method: "PUT",
        body: JSON.stringify({ vehicleId }),
      });
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, vehicleId } : d))
      );
      return { ok: true, message: "Vehiculo asignado" };
    } catch (error) {
      console.error("Error asignando vehiculo:", error);
      return { ok: false, message: resolveApiMessage(error, "No se pudo asignar el vehiculo") };
    }
  };

  const unassignVehicleFromDriver = async (driverId: string): Promise<ActionResult> => {
    try {
      await apiFetch(`/Drivers/${driverId}/unassign-vehicle`, { method: "PUT" });
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, vehicleId: undefined } : d))
      );
      return { ok: true, message: "Vehiculo desasignado" };
    } catch (error) {
      console.error("Error desasignando vehiculo:", error);
      return { ok: false, message: resolveApiMessage(error, "No se pudo desasignar el vehiculo") };
    }
  };

  const getRoutesByDriver = (driverId: string): Route[] =>
    routes.filter((r) => r.conductorId === driverId);

  const getTeamVehicles = (): Vehicle[] => vehicles;

  const getTeamRoutes = (): Route[] => routes;

  return (
    <FleetContext.Provider
      value={{
        vehicles,
        routes,
        drivers,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        addRoute,
        updateRoute,
        deleteRoute,
        updateVehicleLocation,
        registerRoutePosition,
        addRouteEvidence,
        getRoutesByDriver,
        getTeamVehicles,
        getTeamRoutes,
        refreshDrivers,
        addDriver,
        assignVehicleToDriver,
        unassignVehicleFromDriver,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const context = useContext(FleetContext);
  if (context === undefined)
    throw new Error("useFleet debe ser usado dentro de un FleetProvider");
  return context;
}
