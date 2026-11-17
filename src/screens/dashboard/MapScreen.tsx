import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Camera,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  UserLocation,
} from "@maplibre/maplibre-react-native";
import {
  Crosshair,
  Filter,
  MapPin,
  Route as RouteIcon,
  Search,
  Truck,
  ChevronDown,
  ChevronUp,
  Layers,
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react-native";
import { useFleet } from "@/context/FleetContext";
import { useAuth } from "@/context/AuthContext";
import { fetchRoutePositions } from "@/services/fleetApi";
import { useThemeColors, type ThemeColors } from "@/theme/colors";
import { formatDriverLabel } from "@/utils/formatDriverLabel";
import { formatVehicleLabel } from "@/utils/formatVehicleLabel";
import {
  areLatLngArraysEqual,
  buildLineFeatureFromLngLat,
  buildLineFeatureFromLatLng,
  computeBoundsFromLngLat,
  distanceToPolylineMeters,
  formatTrackingAge,
  parseCoord,
  toLatLng,
  toLngLat,
  type LatLngTuple,
  type LineFeature,
  type LngLatTuple,
} from "@/utils/mapGeometry";
import {
  DEFAULT_MAP_VIEW_OPTIONS,
  getMapStyleObject,
  loadMapViewOptions,
  loadRouteViewports,
  MAP_BASE_STYLE_OPTIONS,
  MAP_LAYOUT_CONFIG,
  MAP_TRACKING_CONFIG,
  saveMapViewOptions,
  saveRouteViewports,
  type MapViewOptions,
  type RouteStatusFilter,
  type RouteViewport,
} from "@/utils/mapRuntimeConfig";

type CameraBounds = { ne: [number, number]; sw: [number, number] };
type CameraCommand =
  | { kind: "bounds"; bounds: CameraBounds; token: number }
  | { kind: "center"; center: [number, number]; zoom: number; token: number };
type CameraCommandInput =
  | { kind: "bounds"; bounds: CameraBounds }
  | { kind: "center"; center: [number, number]; zoom: number };

type MapCanvasProps = {
  mapStyle: any;
  colors: ThemeColors;
  camera: CameraCommand;
  locationGranted: boolean;
  onFirstUserLocation: (coord: [number, number]) => void;
  onUserInteraction: (payload: any) => void;
  originCoord: [number, number] | null;
  destinationCoord: [number, number] | null;
  stopCoords: Array<[number, number]>;
  showOriginDestinationMarkers: boolean;
  showStops: boolean;
  showPlannedLine: boolean;
  showTrackingLine: boolean;
  plannedFeature: LineFeature | null;
  fallbackFeature: LineFeature | null;
  routeError: boolean;
  trackingFeature: LineFeature | null;
  trackingPoint: LatLngTuple | null;
  markerOrigin: any;
  markerDestination: any;
  markerStop: any;
  trackingMarker: any;
};

const MapCanvas = memo(function MapCanvas({
  mapStyle,
  colors,
  camera,
  locationGranted,
  onFirstUserLocation,
  onUserInteraction,
  originCoord,
  destinationCoord,
  stopCoords,
  showOriginDestinationMarkers,
  showStops,
  showPlannedLine,
  showTrackingLine,
  plannedFeature,
  fallbackFeature,
  routeError,
  trackingFeature,
  trackingPoint,
  markerOrigin,
  markerDestination,
  markerStop,
  trackingMarker,
}: MapCanvasProps) {
  return (
    <MapView
      style={{ flex: 1 }}
      mapStyle={mapStyle}
      logoEnabled
      attributionEnabled
      surfaceView={false}
      onRegionDidChange={onUserInteraction}
    >
      <Camera
        key={camera.token}
        bounds={
          camera.kind === "bounds"
            ? {
                ...camera.bounds,
                paddingTop: 80,
                paddingBottom: 120,
                paddingLeft: 64,
                paddingRight: 64,
              }
            : undefined
        }
        centerCoordinate={camera.kind === "center" ? camera.center : undefined}
        zoomLevel={camera.kind === "center" ? camera.zoom : undefined}
        animationDuration={550}
      />

      {locationGranted && (
        <UserLocation
          visible
          showsUserHeadingIndicator
          onUpdate={(location) => {
            const { latitude, longitude } = location.coords;
            onFirstUserLocation([longitude, latitude]);
          }}
        />
      )}

      {showOriginDestinationMarkers && originCoord && (
        <PointAnnotation id="origin-marker" coordinate={originCoord}>
          <View style={markerOrigin} />
        </PointAnnotation>
      )}
      {showOriginDestinationMarkers && destinationCoord && (
        <PointAnnotation id="destination-marker" coordinate={destinationCoord}>
          <View style={markerDestination} />
        </PointAnnotation>
      )}
      {showStops &&
        stopCoords.map((coord, idx) => (
          <PointAnnotation id={`stop-marker-${idx}`} key={`stop-marker-${idx}`} coordinate={coord}>
            <View style={markerStop} />
          </PointAnnotation>
        ))}

      {showPlannedLine && plannedFeature ? (
        <ShapeSource id="planned-route-line" shape={plannedFeature}>
          <LineLayer
            id="planned-route-shadow"
            style={{
              lineColor: colors.primary,
              lineWidth: 8,
              lineOpacity: 0.25,
              lineBlur: 2,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <LineLayer
            id="planned-route-main"
            style={{
              lineColor: colors.primary,
              lineWidth: 4,
              lineOpacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>
      ) : showPlannedLine && routeError && fallbackFeature ? (
        <ShapeSource id="planned-route-fallback" shape={fallbackFeature}>
          <LineLayer
            id="planned-route-fallback-main"
            style={{
              lineColor: colors.textMuted,
              lineWidth: 2.5,
              lineOpacity: 0.75,
              lineDasharray: [1.5, 1.5],
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>
      ) : null}

      {showTrackingLine && trackingFeature && (
        <ShapeSource id="tracking-route-line" shape={trackingFeature}>
          <LineLayer
            id="tracking-route-main"
            style={{
              lineColor: "#16a34a",
              lineWidth: 4,
              lineOpacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>
      )}

      {trackingPoint && (
        <PointAnnotation
          id="tracking-latest-point"
          coordinate={[trackingPoint[1], trackingPoint[0]]}
        >
          <View style={trackingMarker}>
            <Truck size={13} color="#fff" />
          </View>
        </PointAnnotation>
      )}
    </MapView>
  );
});

const statusToFilter = (status?: string): RouteStatusFilter => {
  const key = (status ?? "").toLowerCase();
  if (key.includes("progress") || key.includes("curso") || key.includes("progreso")) {
    return "in_progress";
  }
  if (key.includes("complete") || key.includes("complet")) return "completed";
  if (key.includes("cancel")) return "cancelled";
  return "pending";
};

const statusMeta = (status?: string) => {
  const key = statusToFilter(status);
  if (key === "in_progress") return { label: "En curso", color: "#16a34a", bg: "#052e1f" };
  if (key === "completed") return { label: "Completada", color: "#60a5fa", bg: "#1e3a8a" };
  if (key === "cancelled") return { label: "Cancelada", color: "#fca5a5", bg: "#7f1d1d" };
  return { label: "Pendiente", color: "#fcd34d", bg: "#78350f" };
};

const STATUS_FILTERS: Array<{ key: RouteStatusFilter; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "in_progress", label: "En curso" },
  { key: "completed", label: "Completadas" },
  { key: "cancelled", label: "Canceladas" },
];

const buildRoutePath = (route: {
  origen?: { lat: number; lng: number } | null;
  destino?: { lat: number; lng: number } | null;
  puntos?: Array<{ lat: number; lng: number }> | null;
}): LatLngTuple[] => {
  const coords: LatLngTuple[] = [];
  if (route.origen) coords.push([route.origen.lat, route.origen.lng]);
  route.puntos?.forEach((point) => coords.push([point.lat, point.lng]));
  if (route.destino) coords.push([route.destino.lat, route.destino.lng]);
  return coords;
};

const getTrackingPollDelay = (
  isAppActive: boolean,
  errorCount: number,
  lastErrorStatus: number | null
) => {
  const base = isAppActive
    ? MAP_TRACKING_CONFIG.pollVisibleMs
    : MAP_TRACKING_CONFIG.pollHiddenMs;
  const backoffLevel = Math.min(MAP_TRACKING_CONFIG.maxErrorBackoff, Math.max(0, errorCount));
  let delay = base * Math.max(1, 2 ** backoffLevel);
  if (lastErrorStatus === 429) delay *= 2;
  return delay;
};

const parseApiErrorMeta = (error: unknown): { status: number | null; message: string } => {
  const status = typeof (error as any)?.status === "number" ? (error as any).status : null;
  const dataMessage = (error as any)?.data?.message;
  const message =
    (typeof dataMessage === "string" && dataMessage) ||
    (error as Error)?.message ||
    "Error de tracking";
  return { status, message };
};

export function MapScreen() {
  const { routes, vehicles, drivers } = useFleet();
  const { apiFetch, user } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const canViewMap = !!user?.permissions?.canViewMap;

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routeSearch, setRouteSearch] = useState("");
  const [showMapOptions, setShowMapOptions] = useState(false);
  const [options, setOptions] = useState<MapViewOptions>(DEFAULT_MAP_VIEW_OPTIONS);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [routeViewportsById, setRouteViewportsById] = useState<Record<string, RouteViewport>>({});
  const [routeViewportsLoaded, setRouteViewportsLoaded] = useState(false);
  const [routesCollapsed, setRoutesCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [tracking, setTracking] = useState<LatLngTuple[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [lastTrackingSyncAt, setLastTrackingSyncAt] = useState<number | null>(null);
  const [trackingErrorCount, setTrackingErrorCount] = useState(0);
  const [trackingLastErrorStatus, setTrackingLastErrorStatus] = useState<number | null>(null);
  const [latestTrackingSample, setLatestTrackingSample] = useState<{
    recordedAt?: string;
    speedKmh?: number;
    heading?: number;
  } | null>(null);

  const [routeGeometry, setRouteGeometry] = useState<LineFeature | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);

  const [followTruck, setFollowTruck] = useState(false);
  const [locationGranted, setLocationGranted] = useState(Platform.OS !== "android");
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === "active");

  const defaultCamera: CameraCommand = useMemo(
    () => ({
      kind: "center",
      center: MAP_LAYOUT_CONFIG.defaultCenter,
      zoom: MAP_LAYOUT_CONFIG.defaultZoom,
      token: 0,
    }),
    []
  );
  const [camera, setCamera] = useState<CameraCommand>(defaultCamera);
  const { height: screenHeight } = useWindowDimensions();

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const trackingAbortRef = useRef<AbortController | null>(null);
  const osrmAbortRef = useRef<AbortController | null>(null);
  const trackingErrorCountRef = useRef(0);
  const trackingLastErrorStatusRef = useRef<number | null>(null);
  const osrmCacheRef = useRef<Map<string, { expiresAt: number; feature: LineFeature }>>(new Map());

  useEffect(() => {
    let mounted = true;
    const loadPersisted = async () => {
      const [persistedOptions, persistedViewports] = await Promise.all([
        loadMapViewOptions(),
        loadRouteViewports(),
      ]);
      if (!mounted) return;
      setOptions(persistedOptions);
      setRouteViewportsById(persistedViewports);
      setOptionsLoaded(true);
      setRouteViewportsLoaded(true);
    };
    void loadPersisted();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!optionsLoaded) return;
    const timeoutId = setTimeout(() => {
      void saveMapViewOptions(options);
    }, 120);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [options, optionsLoaded]);

  useEffect(() => {
    if (!routeViewportsLoaded) return;
    const timeoutId = setTimeout(() => {
      void saveRouteViewports(routeViewportsById);
    }, 320);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [routeViewportsById, routeViewportsLoaded]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      setIsAppActive(nextState === "active");
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let mounted = true;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
      .then((result) => {
        if (!mounted) return;
        setLocationGranted(result === PermissionsAndroid.RESULTS.GRANTED);
      })
      .catch(() => {
        if (!mounted) return;
        setLocationGranted(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);

  const normalizedSearch = routeSearch.trim().toLowerCase();
  const filteredRoutes = useMemo(() => {
    const byStatus =
      options.routeStatusFilter === "all"
        ? routes
        : routes.filter((route) => statusToFilter(route.estado) === options.routeStatusFilter);
    if (!normalizedSearch) return byStatus;

    return byStatus.filter((route) => {
      const vehicle = formatVehicleLabel(vehicleById.get(route.vehiculoId), "");
      const driver = formatDriverLabel(driverById.get(route.conductorId), "");
      const fields = [route.nombre ?? "", vehicle, driver];
      return fields.some((field) => field.toLowerCase().includes(normalizedSearch));
    });
  }, [driverById, normalizedSearch, options.routeStatusFilter, routes, vehicleById]);

  useEffect(() => {
    if (filteredRoutes.length === 0) {
      setSelectedRouteId(null);
      return;
    }
    if (selectedRouteId && filteredRoutes.some((route) => route.id === selectedRouteId)) {
      return;
    }
    setSelectedRouteId(filteredRoutes[0].id);
  }, [filteredRoutes, selectedRouteId]);

  const selectedRoute = useMemo(
    () => filteredRoutes.find((route) => route.id === selectedRouteId) ?? null,
    [filteredRoutes, selectedRouteId]
  );

  const selectedRoutePath = useMemo(
    () => (selectedRoute ? buildRoutePath(selectedRoute) : []),
    [selectedRoute]
  );

  const originCoord = selectedRoute?.origen
    ? ([selectedRoute.origen.lng, selectedRoute.origen.lat] as [number, number])
    : null;
  const destinationCoord = selectedRoute?.destino
    ? ([selectedRoute.destino.lng, selectedRoute.destino.lat] as [number, number])
    : null;
  const stopCoords = useMemo(
    () =>
      (selectedRoute?.puntos ?? [])
        .map((stop) => {
          const lat = parseCoord(stop.lat);
          const lng = parseCoord(stop.lng);
          if (lat === null || lng === null) return null;
          return [lng, lat] as [number, number];
        })
        .filter((value): value is [number, number] => !!value),
    [selectedRoute?.puntos]
  );

  const selectedFallbackFeature = useMemo(
    () => buildLineFeatureFromLatLng(selectedRoutePath),
    [selectedRoutePath]
  );

  const selectedRouteBounds = useMemo(() => {
    if (routeGeometry?.geometry?.coordinates?.length) {
      return computeBoundsFromLngLat(routeGeometry.geometry.coordinates);
    }
    if (selectedFallbackFeature?.geometry?.coordinates?.length) {
      return computeBoundsFromLngLat(selectedFallbackFeature.geometry.coordinates);
    }
    return null;
  }, [routeGeometry, selectedFallbackFeature]);

  const updateCamera = useCallback((next: CameraCommandInput) => {
    setCamera({
      ...next,
      token: Date.now() + Math.random(),
    });
  }, []);

  const fitSelectedRouteBounds = useCallback(() => {
    if (!selectedRouteBounds) return false;
    updateCamera({ kind: "bounds", bounds: selectedRouteBounds });
    return true;
  }, [selectedRouteBounds, updateCamera]);

  const applyRouteViewportOrFit = useCallback(() => {
    if (!selectedRouteId) return;
    const viewport = routeViewportsById[selectedRouteId];
    if (viewport) {
      updateCamera({
        kind: "center",
        center: viewport.center,
        zoom: viewport.zoom,
      });
      return;
    }
    if (fitSelectedRouteBounds()) {
      return;
    }
    if (userCoord) {
      updateCamera({
        kind: "center",
        center: userCoord,
        zoom: MAP_LAYOUT_CONFIG.userZoom,
      });
      return;
    }
    updateCamera({
      kind: "center",
      center: MAP_LAYOUT_CONFIG.defaultCenter,
      zoom: MAP_LAYOUT_CONFIG.defaultZoom,
    });
  }, [fitSelectedRouteBounds, routeViewportsById, selectedRouteId, updateCamera, userCoord]);

  useEffect(() => {
    applyRouteViewportOrFit();
    setFollowTruck(false);
  }, [selectedRouteId, applyRouteViewportOrFit]);

  useEffect(() => {
    if (!followTruck) return;
    if (!tracking.length) return;
    const latest = tracking[tracking.length - 1];
    updateCamera({
      kind: "center",
      center: [latest[1], latest[0]],
      zoom: MAP_LAYOUT_CONFIG.userZoom,
    });
  }, [followTruck, tracking, updateCamera]);

  const trackingFeature = useMemo(() => buildLineFeatureFromLatLng(tracking), [tracking]);
  const trackingPoint = useMemo(
    () => (tracking.length ? tracking[tracking.length - 1] : null),
    [tracking]
  );

  const runTrackingFetch = useCallback(
    async (withSpinner = false) => {
      if (!apiFetch || !selectedRouteId) return false;
      if (withSpinner) setLoadingTracking(true);

      trackingAbortRef.current?.abort();
      const controller = new AbortController();
      trackingAbortRef.current = controller;

      try {
        const positions = await fetchRoutePositions(
          apiFetch,
          selectedRouteId,
          undefined,
          undefined,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return false;

        const sortedByTime = [...positions].sort((a, b) => {
          const aTime = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
          const bTime = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
          return aTime - bTime;
        });
        const latest = sortedByTime[sortedByTime.length - 1];
        setLatestTrackingSample(
          latest
            ? {
                recordedAt: latest.recordedAt,
                speedKmh: latest.speedKmh,
                heading: latest.heading,
              }
            : null
        );

        const normalized = sortedByTime
          .map((position) => {
            const lat = parseCoord((position as any).latitude ?? (position as any).lat);
            const lng = parseCoord((position as any).longitude ?? (position as any).lng);
            if (lat === null || lng === null) return null;
            return [lat, lng] as LatLngTuple;
          })
          .filter((item): item is LatLngTuple => !!item);

        setTracking((prev) => (areLatLngArraysEqual(prev, normalized) ? prev : normalized));
        setLastTrackingSyncAt(Date.now());
        trackingErrorCountRef.current = 0;
        trackingLastErrorStatusRef.current = null;
        setTrackingErrorCount(0);
        setTrackingLastErrorStatus(null);
        return true;
      } catch (error) {
        if (controller.signal.aborted) return false;
        const { status } = parseApiErrorMeta(error);
        const nextCount = Math.min(trackingErrorCountRef.current + 1, 6);
        trackingErrorCountRef.current = nextCount;
        trackingLastErrorStatusRef.current = status;
        setTrackingErrorCount(nextCount);
        setTrackingLastErrorStatus(status);
        return false;
      } finally {
        if (trackingAbortRef.current === controller) {
          trackingAbortRef.current = null;
        }
        if (withSpinner) setLoadingTracking(false);
      }
    },
    [apiFetch, selectedRouteId]
  );

  useEffect(() => {
    if (!apiFetch || !selectedRouteId) {
      setTracking([]);
      setLatestTrackingSample(null);
      setLoadingTracking(false);
      setLastTrackingSyncAt(null);
      setTrackingErrorCount(0);
      setTrackingLastErrorStatus(null);
      trackingErrorCountRef.current = 0;
      trackingLastErrorStatusRef.current = null;
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async (withSpinner: boolean) => {
      if (cancelled) return;
      await runTrackingFetch(withSpinner);
      if (cancelled) return;
      const delay = getTrackingPollDelay(
        appStateRef.current === "active",
        trackingErrorCountRef.current,
        trackingLastErrorStatusRef.current
      );
      timer = setTimeout(() => {
        void loop(false);
      }, delay);
    };

    void loop(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      trackingAbortRef.current?.abort();
    };
  }, [apiFetch, selectedRouteId, runTrackingFetch]);

  useEffect(() => {
    if (!selectedRouteId) return;
    if (!isAppActive) return;
    void runTrackingFetch(false);
  }, [isAppActive, runTrackingFetch, selectedRouteId]);

  useEffect(() => {
    if (!selectedRoute) {
      setRouteGeometry(null);
      setRouteError(false);
      setRouteLoading(false);
      return;
    }

    const points = selectedRoutePath.map(toLngLat);
    if (points.length < 2) {
      setRouteGeometry(null);
      setRouteError(false);
      setRouteLoading(false);
      return;
    }

    const key = points.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
    const cached = osrmCacheRef.current.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      setRouteGeometry(cached.feature);
      setRouteError(false);
      setRouteLoading(false);
      return;
    }

    osrmAbortRef.current?.abort();
    const controller = new AbortController();
    osrmAbortRef.current = controller;
    setRouteLoading(true);
    setRouteError(false);

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${key}?overview=full&geometries=geojson&steps=false`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`OSRM ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const geometry = data?.routes?.[0]?.geometry?.coordinates;
        const line = buildLineFeatureFromLngLat(
          Array.isArray(geometry)
            ? geometry
                .map((pair: unknown) => {
                  if (!Array.isArray(pair) || pair.length < 2) return null;
                  const lng = parseCoord(pair[0]);
                  const lat = parseCoord(pair[1]);
                  if (lat === null || lng === null) return null;
                  return [lng, lat] as LngLatTuple;
                })
                .filter((item: LngLatTuple | null): item is LngLatTuple => !!item)
            : []
        );
        if (!line) {
          setRouteGeometry(null);
          setRouteError(true);
          return;
        }
        osrmCacheRef.current.set(key, {
          feature: line,
          expiresAt: Date.now() + MAP_LAYOUT_CONFIG.osrmCacheTtlMs,
        });
        setRouteGeometry(line);
        setRouteError(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("No se pudo calcular la ruta con OSRM", error);
        setRouteGeometry(null);
        setRouteError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedRoute, selectedRoutePath]);

  const plannedPolylineForDeviation = useMemo<LatLngTuple[]>(() => {
    if (routeGeometry?.geometry?.coordinates?.length) {
      return routeGeometry.geometry.coordinates.map(toLatLng);
    }
    return selectedRoutePath;
  }, [routeGeometry, selectedRoutePath]);

  const trackingAgeMs = useMemo(() => {
    if (!latestTrackingSample?.recordedAt) return null;
    const recordedAtMs = new Date(latestTrackingSample.recordedAt).getTime();
    if (!Number.isFinite(recordedAtMs)) return null;
    const nowMs = lastTrackingSyncAt ?? Date.now();
    return Math.max(0, nowMs - recordedAtMs);
  }, [latestTrackingSample?.recordedAt, lastTrackingSyncAt]);

  const routeDeviationMeters = useMemo(() => {
    if (!trackingPoint || plannedPolylineForDeviation.length < 2) return null;
    return distanceToPolylineMeters(trackingPoint, plannedPolylineForDeviation);
  }, [trackingPoint, plannedPolylineForDeviation]);

  const routeAlerts = useMemo(() => {
    const alerts: Array<{ key: string; label: string; tone: "warn" | "error" }> = [];
    if (!trackingPoint) {
      alerts.push({ key: "no_signal", label: "Sin señal de tracking", tone: "warn" });
    }
    if (trackingAgeMs != null && trackingAgeMs > MAP_TRACKING_CONFIG.staleMs) {
      alerts.push({
        key: "stale",
        label: `Tracking desactualizado (${formatTrackingAge(trackingAgeMs)})`,
        tone: "warn",
      });
    }
    if (plannedPolylineForDeviation.length < 2) {
      alerts.push({ key: "no_geometry", label: "Ruta sin geometría", tone: "error" });
    }
    if (
      routeDeviationMeters != null &&
      routeDeviationMeters > MAP_TRACKING_CONFIG.offRouteThresholdMeters
    ) {
      alerts.push({
        key: "off_route",
        label: `Fuera de ruta (${Math.round(routeDeviationMeters)}m)`,
        tone: "error",
      });
    }
    return alerts;
  }, [plannedPolylineForDeviation.length, routeDeviationMeters, trackingAgeMs, trackingPoint]);

  const trackingHealthLabel = useMemo(() => {
    if (!selectedRouteId) return "Sin ruta";
    if (loadingTracking) return "Sincronizando";
    if (trackingErrorCount > 0) {
      if (trackingLastErrorStatus === 429) return "Límite API";
      if (trackingLastErrorStatus === 401 || trackingLastErrorStatus === 403) {
        return "Sin permisos";
      }
      return `Reintentando (${trackingErrorCount})`;
    }
    if (lastTrackingSyncAt) return "Tracking activo";
    return "Sin datos";
  }, [lastTrackingSyncAt, loadingTracking, selectedRouteId, trackingErrorCount, trackingLastErrorStatus]);

  const selectedVehicleLabel = selectedRoute?.vehiculoId
    ? formatVehicleLabel(vehicleById.get(selectedRoute.vehiculoId), "Vehículo no disponible")
    : "N/D";
  const selectedDriverLabel = selectedRoute?.conductorId
    ? formatDriverLabel(driverById.get(selectedRoute.conductorId), "Conductor no disponible")
    : "N/D";

  const mapStyleObject = useMemo(
    () => getMapStyleObject(options.baseMapStyle),
    [options.baseMapStyle]
  );

  const updateOption = useCallback(<K extends keyof MapViewOptions>(key: K, value: MapViewOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleStatusFilterChange = (filter: RouteStatusFilter) => {
    updateOption("routeStatusFilter", filter);
  };

  const handleMapUserInteraction = (payload: any) => {
    const isUserInteraction = !!payload?.properties?.isUserInteraction;
    if (!isUserInteraction) return;

    if (followTruck && trackingPoint) {
      updateCamera({
        kind: "center",
        center: [trackingPoint[1], trackingPoint[0]],
        zoom: MAP_LAYOUT_CONFIG.userZoom,
      });
      return;
    }

    const center = payload?.geometry?.coordinates;
    const zoomCandidate = payload?.properties?.zoomLevel ?? payload?.properties?.zoom;
    if (
      selectedRouteId &&
      Array.isArray(center) &&
      center.length >= 2 &&
      Number.isFinite(center[0]) &&
      Number.isFinite(center[1]) &&
      Number.isFinite(zoomCandidate)
    ) {
      const viewport: RouteViewport = {
        center: [Number(center[0]), Number(center[1])],
        zoom: Number(zoomCandidate),
      };
      setRouteViewportsById((prev) => ({ ...prev, [selectedRouteId]: viewport }));
    }
  };

  const handleRecenterRoute = () => {
    setFollowTruck(false);
    if (fitSelectedRouteBounds()) return;
    applyRouteViewportOrFit();
  };

  const handleCenterTruck = () => {
    if (!trackingPoint) return;
    setFollowTruck(false);
    updateCamera({
      kind: "center",
      center: [trackingPoint[1], trackingPoint[0]],
      zoom: MAP_LAYOUT_CONFIG.userZoom,
    });
  };

  const handleCenterUser = () => {
    if (!userCoord) return;
    setFollowTruck(false);
    updateCamera({
      kind: "center",
      center: userCoord,
      zoom: MAP_LAYOUT_CONFIG.userZoom,
    });
  };

  const routesForList =
    options.showOnlySelectedRoute && selectedRoute ? [selectedRoute] : filteredRoutes;

  const renderMapPanel = (fullscreen = false) => (
    <View
      style={[
        styles.mapCard,
        fullscreen && styles.mapCardFullscreen,
        fullscreen ? { height: Math.max(320, screenHeight - 116) } : null,
      ]}
    >
      <MapCanvas
        mapStyle={mapStyleObject}
        colors={colors}
        camera={camera}
        locationGranted={locationGranted}
        onFirstUserLocation={(coord) => {
          if (userCoord) return;
          setUserCoord(coord);
        }}
        onUserInteraction={handleMapUserInteraction}
        originCoord={originCoord}
        destinationCoord={destinationCoord}
        stopCoords={stopCoords}
        showOriginDestinationMarkers={options.showOriginDestinationMarkers}
        showStops={options.showStops}
        showPlannedLine={options.showPlannedLine}
        showTrackingLine={options.showTrackingLine}
        plannedFeature={routeGeometry}
        fallbackFeature={selectedFallbackFeature}
        routeError={routeError}
        trackingFeature={trackingFeature}
        trackingPoint={trackingPoint}
        markerOrigin={styles.markerOrigin}
        markerDestination={styles.markerDestination}
        markerStop={styles.markerStop}
        trackingMarker={styles.trackingMarker}
      />

      {selectedRoute && (
        <View style={styles.selectedRouteCard} pointerEvents="none">
          <View style={styles.selectedRouteHeader}>
            <Text style={styles.selectedRouteKicker}>Ruta seleccionada</Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusMeta(selectedRoute.estado).bg },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: statusMeta(selectedRoute.estado).color },
                ]}
              >
                {statusMeta(selectedRoute.estado).label}
              </Text>
            </View>
          </View>
          <Text style={styles.selectedRouteName}>{selectedRoute.nombre}</Text>
          <Text style={styles.selectedRouteMeta}>Vehículo: {selectedVehicleLabel}</Text>
          <Text style={styles.selectedRouteMeta}>Conductor: {selectedDriverLabel}</Text>
        </View>
      )}

      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleRecenterRoute}>
          <RouteIcon color={colors.primaryText} size={16} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleCenterUser}>
          <MapPin color={colors.primaryText} size={16} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleCenterTruck}>
          <Truck color={colors.primaryText} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, followTruck && styles.controlBtnActive]}
          onPress={() => setFollowTruck((prev) => !prev)}
        >
          <Crosshair color={colors.primaryText} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            void runTrackingFetch(true);
          }}
        >
          <RefreshCw color={colors.primaryText} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setShowMapOptions((prev) => !prev)}
        >
          <Layers color={colors.primaryText} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setIsFullscreen((prev) => !prev)}
        >
          {fullscreen ? (
            <Minimize2 color={colors.primaryText} size={16} />
          ) : (
            <Maximize2 color={colors.primaryText} size={16} />
          )}
        </TouchableOpacity>
      </View>

      {(routeLoading || loadingTracking) && (
        <View style={styles.loadingBadge} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingBadgeText}>
            {routeLoading ? "Calculando ruta..." : "Actualizando tracking..."}
          </Text>
        </View>
      )}

      {!routeLoading && routeError && (
        <View style={styles.warningBadge} pointerEvents="none">
          <Text style={styles.warningBadgeText}>
            OSRM no disponible, mostrando línea recta
          </Text>
        </View>
      )}
    </View>
  );

  if (!canViewMap) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={styles.title}>Mapa en tiempo real</Text>
        <View style={styles.detailsCard}>
          <Text style={styles.muted}>No tienes permisos para ver el mapa en tiempo real.</Text>
        </View>
      </View>
    );
  }

  if (!optionsLoaded || !routeViewportsLoaded) {
    return (
      <View style={styles.bootLoadingState}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.bootLoadingText}>Cargando configuración del mapa...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.title}>Mapa en tiempo real</Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBadge}>
            <Text style={styles.kpiBadgeText}>{filteredRoutes.length} rutas</Text>
          </View>
          <View style={styles.kpiBadge}>
            <Text style={styles.kpiBadgeText}>{trackingHealthLabel}</Text>
          </View>
          {routeAlerts.length > 0 && (
            <View style={[styles.kpiBadge, styles.kpiBadgeWarn]}>
              <Text style={styles.kpiBadgeWarnText}>{routeAlerts.length} alertas</Text>
            </View>
          )}
        </View>

        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {STATUS_FILTERS.map((filter) => {
                const active = options.routeStatusFilter === filter.key;
                const count =
                  filter.key === "all"
                    ? routes.length
                    : routes.filter((route) => statusToFilter(route.estado) === filter.key).length;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => handleStatusFilterChange(filter.key)}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {filter.label} {count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Search color={colors.textMuted} size={15} />
              <TextInput
                value={routeSearch}
                onChangeText={setRouteSearch}
                placeholder="Buscar ruta, vehículo o conductor"
                placeholderTextColor={colors.placeholder}
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity
              style={styles.optionsBtn}
              onPress={() => setShowMapOptions((prev) => !prev)}
            >
              <Filter color={colors.primary} size={16} />
            </TouchableOpacity>
          </View>
        </View>

        {showMapOptions && (
          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>Opciones</Text>
            <View style={styles.optionsGrid}>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Solo ruta seleccionada</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    options.showOnlySelectedRoute && styles.toggleButtonOn,
                  ]}
                  onPress={() =>
                    updateOption("showOnlySelectedRoute", !options.showOnlySelectedRoute)
                  }
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      options.showOnlySelectedRoute && styles.toggleButtonTextOn,
                    ]}
                  >
                    {options.showOnlySelectedRoute ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Mostrar paradas</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, options.showStops && styles.toggleButtonOn]}
                  onPress={() => updateOption("showStops", !options.showStops)}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      options.showStops && styles.toggleButtonTextOn,
                    ]}
                  >
                    {options.showStops ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Origen / destino</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    options.showOriginDestinationMarkers && styles.toggleButtonOn,
                  ]}
                  onPress={() =>
                    updateOption(
                      "showOriginDestinationMarkers",
                      !options.showOriginDestinationMarkers
                    )
                  }
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      options.showOriginDestinationMarkers && styles.toggleButtonTextOn,
                    ]}
                  >
                    {options.showOriginDestinationMarkers ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Ruta planificada</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, options.showPlannedLine && styles.toggleButtonOn]}
                  onPress={() => updateOption("showPlannedLine", !options.showPlannedLine)}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      options.showPlannedLine && styles.toggleButtonTextOn,
                    ]}
                  >
                    {options.showPlannedLine ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Tracking real</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, options.showTrackingLine && styles.toggleButtonOn]}
                  onPress={() => updateOption("showTrackingLine", !options.showTrackingLine)}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      options.showTrackingLine && styles.toggleButtonTextOn,
                    ]}
                  >
                    {options.showTrackingLine ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Panel de rutas</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, options.showRoutesPanel && styles.toggleButtonOn]}
                  onPress={() => updateOption("showRoutesPanel", !options.showRoutesPanel)}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      options.showRoutesPanel && styles.toggleButtonTextOn,
                    ]}
                  >
                    {options.showRoutesPanel ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.baseMapRow}>
              {MAP_BASE_STYLE_OPTIONS.map((item) => {
                const active = options.baseMapStyle === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.baseMapChip, active && styles.baseMapChipActive]}
                    onPress={() => updateOption("baseMapStyle", item.value)}
                  >
                    <Text
                      style={[
                        styles.baseMapChipText,
                        active && styles.baseMapChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {renderMapPanel(false)}

        <View style={styles.telemetryCard}>
          <Text style={styles.telemetryTitle}>Telemetría</Text>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>Último ping</Text>
            <Text style={styles.telemetryValue}>
              {trackingAgeMs == null ? "Sin datos" : `hace ${formatTrackingAge(trackingAgeMs)}`}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>Velocidad</Text>
            <Text style={styles.telemetryValue}>
              {latestTrackingSample?.speedKmh != null
                ? `${Math.round(latestTrackingSample.speedKmh)} km/h`
                : "Sin datos"}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>Rumbo</Text>
            <Text style={styles.telemetryValue}>
              {latestTrackingSample?.heading != null
                ? `${Math.round(latestTrackingSample.heading)}°`
                : "Sin datos"}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>Seguimiento</Text>
            <Text style={styles.telemetryValue}>{followTruck ? "Activo" : "Manual"}</Text>
          </View>
          {routeAlerts.length > 0 && (
            <View style={styles.alertList}>
              {routeAlerts.map((alert) => (
                <View
                  key={alert.key}
                  style={[
                    styles.alertPill,
                    alert.tone === "error" ? styles.alertPillError : styles.alertPillWarn,
                  ]}
                >
                  <Text
                    style={[
                      styles.alertPillText,
                      alert.tone === "error"
                        ? styles.alertPillTextError
                        : styles.alertPillTextWarn,
                    ]}
                  >
                    {alert.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {!options.showRoutesPanel && (
          <TouchableOpacity
            style={styles.restoreRoutesBtn}
            onPress={() => updateOption("showRoutesPanel", true)}
          >
            <Text style={styles.restoreRoutesBtnText}>Mostrar rutas</Text>
          </TouchableOpacity>
        )}

        {options.showRoutesPanel && (
          <View style={styles.routesCard}>
            <View style={styles.routesHeader}>
              <Text style={styles.routesTitle}>Rutas planificadas</Text>
              <TouchableOpacity
                style={styles.collapseBtn}
                onPress={() => setRoutesCollapsed((prev) => !prev)}
              >
                {routesCollapsed ? (
                  <ChevronDown color={colors.textMuted} size={16} />
                ) : (
                  <ChevronUp color={colors.textMuted} size={16} />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.routesMeta}>
              {routesForList.length} visibles · {routes.length} total
            </Text>
            {!routesCollapsed && (
              <View style={styles.routeList}>
                {routesForList.map((route) => {
                  const selected = route.id === selectedRouteId;
                  const routeVehicleLabel = formatVehicleLabel(
                    vehicleById.get(route.vehiculoId),
                    "Vehículo no disponible"
                  );
                  const routeDriverLabel = formatDriverLabel(
                    driverById.get(route.conductorId),
                    "Conductor no disponible"
                  );
                  const meta = statusMeta(route.estado);
                  return (
                    <TouchableOpacity
                      key={route.id}
                      style={[styles.routeChip, selected && styles.routeChipSelected]}
                      onPress={() => setSelectedRouteId(route.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.routeChipTitle, selected && styles.routeChipTitleSelected]}>
                          {route.nombre || "Ruta"}
                        </Text>
                        <Text style={styles.routeChipMeta} numberOfLines={1}>
                          {routeVehicleLabel} · {routeDriverLabel}
                        </Text>
                      </View>
                      <View style={[styles.statusPillSmall, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.statusPillSmallText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {routesForList.length === 0 && (
                  <Text style={styles.muted}>No hay rutas para el filtro seleccionado.</Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={isFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fullscreenContainer}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>Mapa en pantalla completa</Text>
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setIsFullscreen(false)}
            >
              <X color={colors.text} size={18} />
            </TouchableOpacity>
          </View>
          {renderMapPanel(true)}
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    kpiRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    kpiBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    kpiBadgeText: {
      color: colors.textSoft,
      fontWeight: "700",
      fontSize: 12,
    },
    kpiBadgeWarn: {
      borderColor: "#f59e0b",
      backgroundColor: "#3f2a10",
    },
    kpiBadgeWarnText: {
      color: "#fcd34d",
      fontWeight: "700",
      fontSize: 12,
    },
    filterSection: {
      gap: 8,
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingRight: 8,
    },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    filterChipActive: {
      borderColor: colors.chipBorder,
      backgroundColor: colors.chipBg,
    },
    filterChipText: {
      color: colors.textMuted,
      fontWeight: "700",
      fontSize: 12,
    },
    filterChipTextActive: {
      color: colors.primary,
    },
    searchRow: {
      flexDirection: "row",
      gap: 8,
    },
    searchField: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 10,
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.inputText,
      paddingVertical: 0,
      fontSize: 13,
    },
    optionsBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    optionsCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 10,
    },
    optionsTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    optionsGrid: {
      gap: 8,
    },
    optionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    optionLabel: {
      color: colors.textSoft,
      fontWeight: "600",
      flex: 1,
    },
    toggleButton: {
      minWidth: 56,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    toggleButtonOn: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    toggleButtonText: {
      color: colors.textMuted,
      fontWeight: "700",
      fontSize: 11,
    },
    toggleButtonTextOn: {
      color: colors.primaryText,
    },
    baseMapRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    baseMapChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    baseMapChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.chipBg,
    },
    baseMapChipText: {
      color: colors.textSoft,
      fontWeight: "600",
      fontSize: 12,
    },
    baseMapChipTextActive: {
      color: colors.primary,
    },
    mapCard: {
      height: 380,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      position: "relative",
    },
    mapCardFullscreen: {
      height: "100%",
      flex: 1,
    },
    selectedRouteCard: {
      position: "absolute",
      top: 10,
      left: 10,
      right: 68,
      borderRadius: 12,
      backgroundColor: "rgba(17,24,39,0.86)",
      borderWidth: 1,
      borderColor: "rgba(148,163,184,0.35)",
      padding: 10,
      gap: 2,
    },
    selectedRouteHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    selectedRouteKicker: {
      color: "#cbd5e1",
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    selectedRouteName: {
      color: "#f8fafc",
      fontSize: 20,
      fontWeight: "700",
    },
    selectedRouteMeta: {
      color: "#cbd5e1",
      fontSize: 12,
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    statusPillText: {
      fontWeight: "700",
      fontSize: 11,
    },
    mapControls: {
      position: "absolute",
      left: 10,
      bottom: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      maxWidth: 250,
    },
    controlBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(148,163,184,0.35)",
      backgroundColor: "rgba(15,23,42,0.84)",
      alignItems: "center",
      justifyContent: "center",
    },
    controlBtnActive: {
      borderColor: "#16a34a",
      backgroundColor: "#14532d",
    },
    loadingBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingBadgeText: {
      color: colors.textMuted,
      fontWeight: "700",
      fontSize: 12,
    },
    warningBadge: {
      position: "absolute",
      bottom: 12,
      right: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#f59e0b",
      backgroundColor: "#3f2a10",
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    warningBadgeText: {
      color: "#fcd34d",
      fontWeight: "700",
      fontSize: 11,
    },
    telemetryCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 8,
    },
    telemetryTitle: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
    telemetryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    telemetryLabel: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    telemetryValue: {
      color: colors.text,
      fontWeight: "700",
    },
    alertList: {
      marginTop: 2,
      gap: 6,
    },
    alertPill: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 7,
    },
    alertPillWarn: {
      backgroundColor: "#3f2a10",
      borderColor: "#f59e0b",
    },
    alertPillError: {
      backgroundColor: "#450a0a",
      borderColor: "#ef4444",
    },
    alertPillText: {
      fontWeight: "700",
      fontSize: 12,
    },
    alertPillTextWarn: {
      color: "#fcd34d",
    },
    alertPillTextError: {
      color: "#fecaca",
    },
    restoreRoutesBtn: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    restoreRoutesBtnText: {
      color: colors.primary,
      fontWeight: "700",
    },
    routesCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 8,
    },
    routesHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    routesTitle: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
    routesMeta: {
      color: colors.textMuted,
      fontSize: 12,
    },
    collapseBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
    },
    routeList: {
      gap: 8,
    },
    routeChip: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    routeChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.chipBg,
    },
    routeChipTitle: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 14,
    },
    routeChipTitleSelected: {
      color: colors.primary,
    },
    routeChipMeta: {
      color: colors.textMuted,
      fontSize: 12,
    },
    statusPillSmall: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    statusPillSmallText: {
      fontWeight: "700",
      fontSize: 10,
    },
    detailsCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
    },
    muted: {
      color: colors.textMuted,
    },
    markerOrigin: {
      width: 13,
      height: 13,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: "#fff",
      backgroundColor: "#2563eb",
    },
    markerDestination: {
      width: 13,
      height: 13,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: "#fff",
      backgroundColor: "#16a34a",
    },
    markerStop: {
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: "#fff",
      backgroundColor: "#f59e0b",
    },
    trackingMarker: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 2.5,
      borderColor: "#fff",
      backgroundColor: "#4c1d95",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#020617",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
      elevation: 6,
    },
    bootLoadingState: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 16,
    },
    bootLoadingText: {
      color: colors.textMuted,
      fontWeight: "600",
    },
    fullscreenContainer: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 12,
      gap: 10,
    },
    fullscreenHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    fullscreenTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    fullscreenCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
  });
