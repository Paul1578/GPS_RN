import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { useFleet } from "@/context/FleetContext";
import { useAuth } from "@/context/AuthContext";
import { fetchRoutePositions } from "@/services/fleetApi";
import { useThemeColors, type ThemeColors } from "@/theme/colors";
import { formatVehicleLabel } from "@/utils/formatVehicleLabel";

type LatLngTuple = [number, number];

type LineFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
  properties: Record<string, unknown>;
};

const DEFAULT_CENTER: [number, number] = [-77.0428, -12.0464];
const DEFAULT_ZOOM = 11;
const USER_ZOOM = 14;
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

type MapCanvasProps = {
  mapStyle: string;
  style: any;
  colors: ThemeColors;
  autoCameraEnabled: boolean;
  cameraBounds?: { ne: [number, number]; sw: [number, number] };
  cameraCenter: [number, number];
  cameraZoom: number;
  locationGranted: boolean;
  onFirstUserLocation: (coord: [number, number]) => void;
  onUserInteraction: () => void;
  pathCoords: LatLngTuple[];
  routeGeometry: LineFeature | null;
  routeError: boolean;
  straightLineFeature: LineFeature | null;
  trackingLine: LineFeature | null;
  trackingPoint: LatLngTuple | null;
  markerStyle: any;
  trackingMarkerStyle: any;
};

const MapCanvas = memo(function MapCanvas({
  mapStyle,
  style,
  colors,
  autoCameraEnabled,
  cameraBounds,
  cameraCenter,
  cameraZoom,
  locationGranted,
  onFirstUserLocation,
  onUserInteraction,
  pathCoords,
  routeGeometry,
  routeError,
  straightLineFeature,
  trackingLine,
  trackingPoint,
  markerStyle,
  trackingMarkerStyle,
}: MapCanvasProps) {
  return (
    <MapView
      style={style}
      mapStyle={mapStyle}
      logoEnabled
      attributionEnabled
      surfaceView={false}
      onRegionDidChange={(payload) => {
        if (payload?.properties?.isUserInteraction) {
          onUserInteraction();
        }
      }}
    >
      {autoCameraEnabled && (
        <Camera
          bounds={
            cameraBounds
              ? {
                  ...cameraBounds,
                  paddingTop: 60,
                  paddingBottom: 100,
                  paddingLeft: 60,
                  paddingRight: 60,
                }
              : undefined
          }
          centerCoordinate={cameraBounds ? undefined : cameraCenter}
          zoomLevel={cameraBounds ? undefined : cameraZoom}
          animationDuration={600}
        />
      )}
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

      {pathCoords.map(([lat, lng], idx) => (
        <PointAnnotation key={`p-${idx}`} id={`p-${idx}`} coordinate={[lng, lat]}>
          <View style={markerStyle} />
        </PointAnnotation>
      ))}

      {routeGeometry ? (
        <ShapeSource id="routeLineOsrm" shape={routeGeometry}>
          <LineLayer
            id="routeLineOsrmShadow"
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
            id="routeLineOsrmLayer"
            style={{
              lineColor: colors.primary,
              lineWidth: 4,
              lineOpacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>
      ) : routeError && straightLineFeature ? (
        <ShapeSource id="routeLineFallback" shape={straightLineFeature}>
          <LineLayer
            id="routeLineFallbackLayer"
            style={{
              lineColor: colors.textMuted,
              lineWidth: 2.5,
              lineOpacity: 0.7,
              lineDasharray: [1.5, 1.5],
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>
      ) : null}

      {trackingLine && (
        <ShapeSource id="trackingLine" shape={trackingLine}>
          <LineLayer
            id="trackingLineLayer"
            style={{ lineColor: "#16a34a", lineWidth: 4 }}
          />
        </ShapeSource>
      )}

      {trackingPoint && (
        <PointAnnotation
          id="tracking-point"
          coordinate={[trackingPoint[1], trackingPoint[0]]}
        >
          <View style={trackingMarkerStyle} />
        </PointAnnotation>
      )}
    </MapView>
  );
});

export function MapScreen() {
  const { routes, vehicles, drivers } = useFleet();
  const { apiFetch, user } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const canViewMap = !!user?.permissions?.canViewMap;
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<LatLngTuple[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<LineFeature | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [autoCameraEnabled, setAutoCameraEnabled] = useState(true);
  const osrmAbortRef = useRef<AbortController | null>(null);
  const [locationGranted, setLocationGranted] = useState(Platform.OS !== "android");
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].id);
    }
  }, [routes, selectedRouteId]);

  useEffect(() => {
    if (selectedRouteId) {
      setAutoCameraEnabled(true);
    }
  }, [selectedRouteId]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let isMounted = true;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
      .then((result) => {
        if (!isMounted) return;
        setLocationGranted(result === PermissionsAndroid.RESULTS.GRANTED);
      })
      .catch(() => {
        if (!isMounted) return;
        setLocationGranted(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? null,
    [routes, selectedRouteId]
  );

  const vehicleById = useMemo(
    () => new Map(vehicles.map((veh) => [veh.id, veh])),
    [vehicles]
  );
  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers]
  );

  const vehicleLabel = selectedRoute?.vehiculoId
    ? formatVehicleLabel(
        vehicleById.get(selectedRoute.vehiculoId),
        selectedRoute.vehiculoId
      )
    : "N/D";
  const driverLabel = selectedRoute?.conductorId
    ? (() => {
        const driver = driverById.get(selectedRoute.conductorId);
        if (!driver) return selectedRoute.conductorId;
        return `${driver.firstName} ${driver.lastName}`.trim();
      })()
    : "N/D";

  useEffect(() => {
    const loadTracking = async () => {
      if (!apiFetch || !selectedRouteId) {
        setTracking([]);
        return;
      }
      setLoadingTracking(true);
      try {
        const positions = await fetchRoutePositions(apiFetch, selectedRouteId);
        const normalized = positions
          .map((p) => {
            const lat = (p as any).latitude ?? (p as any).lat;
            const lng = (p as any).longitude ?? (p as any).lng;
            if (typeof lat !== "number" || typeof lng !== "number") return null;
            return {
              coord: [lat, lng] as LatLngTuple,
              recordedAt: (p as any).recordedAt ?? "",
            };
          })
          .filter((p): p is { coord: LatLngTuple; recordedAt: string } => !!p)
          .sort((a, b) => {
            const aTime = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
            const bTime = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
            return aTime - bTime;
          })
          .map((p) => p.coord);
        setTracking(normalized);
      } catch (error) {
        console.warn("No se pudo cargar el tracking de la ruta", error);
        setTracking([]);
      } finally {
        setLoadingTracking(false);
      }
    };
    void loadTracking();
    const intervalId = setInterval(loadTracking, 20000);
    return () => clearInterval(intervalId);
  }, [apiFetch, selectedRouteId]);

  const sanitizeCoords = (coords: unknown): number[][] => {
    if (!Array.isArray(coords)) return [];
    return coords
      .map((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) return null;
        const lng = Number(pair[0]);
        const lat = Number(pair[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return [lng, lat] as [number, number];
      })
      .filter((pair): pair is [number, number] => !!pair);
  };

  const computeBounds = (coords: number[][]) => {
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
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  };

  const pathCoords = useMemo(() => {
    if (!selectedRoute) return [];
    const coords: LatLngTuple[] = [];
    if (selectedRoute.origen) {
      coords.push([selectedRoute.origen.lat, selectedRoute.origen.lng]);
    }
    selectedRoute.puntos?.forEach((p) => coords.push([p.lat, p.lng]));
    if (selectedRoute.destino) {
      coords.push([selectedRoute.destino.lat, selectedRoute.destino.lng]);
    }
    return coords;
  }, [selectedRoute]);

  const mapCenter = useMemo<[number, number]>(() => {
    const base = pathCoords[0] ?? [DEFAULT_CENTER[1], DEFAULT_CENTER[0]];
    return [base[1], base[0]];
  }, [pathCoords]);

  useEffect(() => {
    if (!selectedRoute) {
      setRouteGeometry(null);
      setRouteError(false);
      setRouteLoading(false);
      return;
    }

    const points: Array<[number, number]> = [];
    if (selectedRoute.origen) {
      points.push([selectedRoute.origen.lng, selectedRoute.origen.lat]);
    }
    selectedRoute.puntos?.forEach((p) => points.push([p.lng, p.lat]));
    if (selectedRoute.destino) {
      points.push([selectedRoute.destino.lng, selectedRoute.destino.lat]);
    }
    if (points.length < 2) {
      setRouteGeometry(null);
      setRouteError(false);
      setRouteLoading(false);
      return;
    }

    osrmAbortRef.current?.abort();
    const controller = new AbortController();
    osrmAbortRef.current = controller;
    setRouteLoading(true);
    setRouteError(false);

    const coordString = points.map(([lng, lat]) => `${lng},${lat}`).join(";");
    fetch(`${OSRM_BASE_URL}/${coordString}?overview=full&geometries=geojson&steps=false`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const geometry = data?.routes?.[0]?.geometry;
        const cleanCoords = sanitizeCoords(geometry?.coordinates);
        if (cleanCoords.length < 2) {
          setRouteGeometry(null);
          setRouteError(true);
          return;
        }
        const feature: LineFeature = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: cleanCoords,
          },
          properties: {},
        };
        setRouteGeometry(feature);
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
  }, [selectedRoute]);

  const straightLineFeature = useMemo<LineFeature | null>(() => {
    if (pathCoords.length < 2) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: pathCoords.map(([lat, lng]) => [lng, lat]),
      },
      properties: {},
    };
  }, [pathCoords]);

  const routeBounds = useMemo(() => {
    if (routeGeometry?.geometry?.coordinates?.length) {
      return computeBounds(routeGeometry.geometry.coordinates);
    }
    if (straightLineFeature?.geometry?.coordinates?.length) {
      return computeBounds(straightLineFeature.geometry.coordinates);
    }
    return null;
  }, [routeGeometry, straightLineFeature]);

  const trackingLine = useMemo<LineFeature | null>(() => {
    if (tracking.length < 2) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: tracking.map(([lat, lng]) => [lng, lat]),
      },
      properties: {},
    };
  }, [tracking]);

  const trackingPoint = useMemo(
    () => (tracking.length ? tracking[tracking.length - 1] : null),
    [tracking]
  );

  const cameraBounds = useMemo(() => {
    if (!routeBounds) return undefined;
    if (!trackingPoint) return routeBounds;
    const [lat, lng] = trackingPoint;
    return {
      ne: [
        Math.max(routeBounds.ne[0], lng),
        Math.max(routeBounds.ne[1], lat),
      ],
      sw: [
        Math.min(routeBounds.sw[0], lng),
        Math.min(routeBounds.sw[1], lat),
      ],
    };
  }, [routeBounds, trackingPoint]);

  const cameraCenter = trackingPoint
    ? ([trackingPoint[1], trackingPoint[0]] as [number, number])
    : userCoord ?? mapCenter;
  const cameraZoom = trackingPoint ? USER_ZOOM : userCoord ? USER_ZOOM : DEFAULT_ZOOM;

  if (!canViewMap) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Text style={styles.title}>Mapa en tiempo real</Text>
        <View style={styles.details}>
          <Text style={styles.muted}>
            No tienes permisos para ver el mapa en tiempo real.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.title}>Mapa en tiempo real</Text>
        <View style={styles.selectorRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {routes.map((route) => {
              const isActive = route.id === selectedRouteId;
              return (
                <TouchableOpacity
                  key={route.id}
                  onPress={() => setSelectedRouteId(route.id)}
                  style={[styles.chip, isActive ? styles.chipActive : undefined]}
                >
                  <Text style={[styles.chipText, isActive ? styles.chipTextActive : undefined]}>
                    {route.nombre || "Ruta"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.counter}>{routes.length} rutas</Text>
        </View>

        <View style={styles.mapCard}>
          <MapCanvas
            key={selectedRouteId ?? "map"}
            mapStyle={STYLE_URL}
            style={{ flex: 1 }}
            colors={colors}
            autoCameraEnabled={autoCameraEnabled}
            cameraBounds={cameraBounds}
            cameraCenter={cameraCenter}
            cameraZoom={cameraZoom}
            locationGranted={locationGranted}
            onFirstUserLocation={(coord) => {
              if (userCoord) return;
              setUserCoord(coord);
            }}
            onUserInteraction={() => {
              if (autoCameraEnabled) setAutoCameraEnabled(false);
            }}
            pathCoords={pathCoords}
            routeGeometry={routeGeometry}
            routeError={routeError}
            straightLineFeature={straightLineFeature}
            trackingLine={trackingLine}
            trackingPoint={trackingPoint}
            markerStyle={styles.markerDot}
            trackingMarkerStyle={styles.trackingMarker}
          />
          {loadingTracking && (
            <View style={styles.loadingBadge} pointerEvents="none">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingBadgeText}>Actualizando...</Text>
            </View>
          )}
        </View>

        {selectedRoute && (
          <View style={styles.details}>
            <Text style={styles.sectionTitle}>{selectedRoute.nombre}</Text>
            <Text style={styles.muted}>Vehiculo: {vehicleLabel}</Text>
            <Text style={styles.muted}>Conductor: {driverLabel}</Text>
            <Text style={styles.muted}>Estado: {selectedRoute.estado}</Text>
          </View>
        )}
      </ScrollView>
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
    selectorRow: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      marginRight: 8,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.chipBg,
      borderColor: colors.chipBorder,
    },
    chipText: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    chipTextActive: {
      color: colors.primary,
    },
    counter: {
      color: colors.textMuted,
      fontWeight: "600",
    },
    mapCard: {
      height: 360,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
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
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    loadingBadgeText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    details: {
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    muted: {
      color: colors.textMuted,
    },
    markerDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    trackingMarker: {
      width: 18,
      height: 18,
      borderRadius: 10,
      backgroundColor: "#7c3aed",
      borderWidth: 3,
      borderColor: "#fff",
    },
  });
