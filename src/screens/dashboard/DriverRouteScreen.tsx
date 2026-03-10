import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
import { MapPin, Package, Timer, Truck, Maximize2, Minimize2, X } from "lucide-react-native";
import { Card } from "@/components/common/Card";
import { useAuth } from "@/context/AuthContext";
import { useFleet } from "@/context/FleetContext";
import { useThemeColors, type ThemeColors } from "@/theme/colors";
import {
  getMapStyleObject,
  loadMapViewOptions,
  MAP_LAYOUT_CONFIG,
} from "@/utils/mapRuntimeConfig";
import {
  buildLineFeatureFromLatLng,
  computeBoundsFromLngLat,
  parseCoord,
  toLngLat,
  type LatLngTuple,
  type LineFeature,
} from "@/utils/mapGeometry";

const DEFAULT_ZOOM = MAP_LAYOUT_CONFIG.defaultZoom;
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

export function DriverRouteScreen() {
  const { user } = useAuth();
  const canViewOwnRoute = !!user?.permissions?.canViewOwnRoute;
  const { routes: allRoutes, drivers, getRoutesByDriver, refreshDrivers, registerRoutePosition } =
    useFleet();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [routeGeometry, setRouteGeometry] = useState<LineFeature | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [locationGranted, setLocationGranted] = useState(
    Platform.OS !== "android"
  );
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);
  const [autoCameraEnabled, setAutoCameraEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState<any>(() => getMapStyleObject("osm_light"));
  const { height: screenHeight } = useWindowDimensions();
  const lastTrackingRef = useRef(0);
  const osrmAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadStyle = async () => {
      const options = await loadMapViewOptions();
      if (!mounted) return;
      setMapStyle(getMapStyleObject(options.baseMapStyle));
    };
    void loadStyle();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.driverId) return;
    if (drivers.some((d) => d.userId === user.id)) return;
    void refreshDrivers();
  }, [drivers, refreshDrivers, user]);

  const driverId = useMemo(() => {
    if (!user) return null;
    return user.driverId ?? drivers.find((d) => d.userId === user.id)?.id ?? null;
  }, [drivers, user]);

  const routes = useMemo(() => {
    if (!driverId) return [];
    if (user?.role === "chofer") {
      return allRoutes.filter(
        (route) =>
          route.conductorId === driverId ||
          route.conductorId === user.id ||
          route.conductorId === user.driverId
      );
    }
    return getRoutesByDriver(driverId);
  }, [allRoutes, driverId, getRoutesByDriver, user?.driverId, user?.id, user?.role]);

  const activeRoute = useMemo(
    () => routes.find((r) => r.estado === "en_progreso" || r.estado === "pendiente") ?? null,
    [routes]
  );

  useEffect(() => {
    if (activeRoute) setAutoCameraEnabled(true);
  }, [activeRoute?.id]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let isMounted = true;
    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    )
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

  const pathCoords = useMemo(() => {
    if (!activeRoute) return [];
    const coords: LatLngTuple[] = [];
    if (activeRoute.origen) {
      coords.push([activeRoute.origen.lat, activeRoute.origen.lng]);
    }
    activeRoute.puntos?.forEach((p) => coords.push([p.lat, p.lng]));
    if (activeRoute.destino) {
      coords.push([activeRoute.destino.lat, activeRoute.destino.lng]);
    }
    return coords;
  }, [activeRoute]);

  const sanitizeCoords = (coords: unknown): Array<[number, number]> => {
    if (!Array.isArray(coords)) return [];
    return coords
      .map((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) return null;
        const lng = parseCoord(pair[0]);
        const lat = parseCoord(pair[1]);
        if (lng === null || lat === null) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return [lng, lat] as [number, number];
      })
      .filter((pair): pair is [number, number] => !!pair);
  };

  useEffect(() => {
    if (!activeRoute) {
      setRouteGeometry(null);
      setRouteError(false);
      setRouteLoading(false);
      return;
    }

    const points: Array<[number, number]> = [];
    if (activeRoute.origen) {
      points.push([activeRoute.origen.lng, activeRoute.origen.lat]);
    }
    activeRoute.puntos?.forEach((p) => points.push([p.lng, p.lat]));
    if (activeRoute.destino) {
      points.push([activeRoute.destino.lng, activeRoute.destino.lat]);
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
    fetch(
      `${OSRM_BASE_URL}/${coordString}?overview=full&geometries=geojson&steps=false`,
      { signal: controller.signal }
    )
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
          geometry: { type: "LineString", coordinates: cleanCoords },
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
  }, [activeRoute]);

  const straightLineFeature = useMemo<LineFeature | null>(() => {
    return buildLineFeatureFromLatLng(pathCoords);
  }, [pathCoords]);

  const routeBounds = useMemo(() => {
    if (routeGeometry?.geometry?.coordinates?.length) {
      return computeBoundsFromLngLat(routeGeometry.geometry.coordinates);
    }
    if (straightLineFeature?.geometry?.coordinates?.length) {
      return computeBoundsFromLngLat(straightLineFeature.geometry.coordinates);
    }
    return null;
  }, [routeGeometry, straightLineFeature]);

  const mapCenter = useMemo<[number, number]>(() => {
    const base = pathCoords[0] ?? [MAP_LAYOUT_CONFIG.defaultCenter[1], MAP_LAYOUT_CONFIG.defaultCenter[0]];
    return [base[1], base[0]];
  }, [pathCoords]);

  if (!user) return null;
  if (!canViewOwnRoute) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        <Text style={styles.title}>Mi ruta</Text>
        <Card>
          <Text style={styles.muted}>No tienes permisos para ver tu ruta.</Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text style={styles.title}>Mi ruta</Text>

      {!activeRoute && (
        <Card>
          <Text style={styles.muted}>No tienes rutas asignadas.</Text>
        </Card>
      )}

      {activeRoute && (
        <>
          <View style={styles.mapCard}>
            <MapView
              style={{ flex: 1 }}
              mapStyle={mapStyle}
              logoEnabled
              attributionEnabled
              surfaceView={false}
              onRegionDidChange={(payload) => {
                if (payload?.properties?.isUserInteraction) {
                  if (autoCameraEnabled) setAutoCameraEnabled(false);
                }
              }}
            >
              {autoCameraEnabled && (
                <Camera
                  bounds={
                    routeBounds
                      ? {
                          ...routeBounds,
                          paddingTop: 60,
                          paddingBottom: 100,
                          paddingLeft: 60,
                          paddingRight: 60,
                        }
                      : undefined
                  }
                  centerCoordinate={routeBounds ? undefined : userCoord ?? mapCenter}
                  zoomLevel={routeBounds ? undefined : DEFAULT_ZOOM}
                  animationDuration={600}
                />
              )}
              {locationGranted && (
                <UserLocation
                  visible={false}
                  onUpdate={(location) => {
                    const { latitude, longitude, speed, heading } = location.coords;
                    setUserCoord([longitude, latitude]);
                    const now = Date.now();
                    if (now - lastTrackingRef.current < 20000) return;
                    lastTrackingRef.current = now;
                    if (activeRoute.estado === "en_progreso") {
                      void registerRoutePosition(
                        activeRoute.id,
                        { lat: latitude, lng: longitude },
                        {
                          recordedAt: new Date().toISOString(),
                          speedKmh:
                            typeof speed === "number" ? speed * 3.6 : undefined,
                          heading:
                            typeof heading === "number" ? heading : undefined,
                        }
                      );
                    }
                  }}
                />
              )}

              {pathCoords.map(([lat, lng], idx) => (
                <PointAnnotation
                  key={`p-${idx}`}
                  id={`p-${idx}`}
                  coordinate={[lng, lat]}
                >
                  <View style={styles.markerDot} />
                </PointAnnotation>
              ))}

              {routeGeometry ? (
                <ShapeSource id="driverRouteLine" shape={routeGeometry}>
                  <LineLayer
                    id="driverRouteShadow"
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
                    id="driverRouteLineLayer"
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
                <ShapeSource id="driverRouteFallback" shape={straightLineFeature}>
                  <LineLayer
                    id="driverRouteFallbackLayer"
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

              {userCoord && (
                <PointAnnotation id="driver-location" coordinate={userCoord}>
                  <View style={styles.truckMarker}>
                    <Truck size={16} color="#fff" />
                  </View>
                </PointAnnotation>
              )}
            </MapView>

            <TouchableOpacity
              style={styles.fullscreenBtn}
              onPress={() => setIsFullscreen(true)}
            >
              <Maximize2 size={16} color={colors.primaryText} />
            </TouchableOpacity>

            {routeLoading && (
              <View style={styles.loadingBadge} pointerEvents="none">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingBadgeText}>Calculando...</Text>
              </View>
            )}
          </View>

          {routeError && (
            <Card>
              <Text style={styles.muted}>
                OSRM no disponible, mostrando línea recta.
              </Text>
            </Card>
          )}

          <Card style={{ gap: 8 }}>
            <Text style={styles.routeTitle}>{activeRoute.nombre}</Text>
            <View style={styles.row}>
              <MapPin color="#2563eb" size={18} />
              <Text style={styles.value}>
                Origen: {activeRoute.origen?.nombre ?? `${activeRoute.origen?.lat}, ${activeRoute.origen?.lng}`}
              </Text>
            </View>
            <View style={styles.row}>
              <MapPin color="#16a34a" size={18} />
              <Text style={styles.value}>
                Destino: {activeRoute.destino?.nombre ?? `${activeRoute.destino?.lat}, ${activeRoute.destino?.lng}`}
              </Text>
            </View>
            <View style={styles.row}>
              <Package color="#ea580c" size={18} />
              <Text style={styles.value}>{activeRoute.carga}</Text>
            </View>
            <View style={styles.row}>
              <Timer color={colors.textMuted} size={18} />
              <Text style={styles.value}>
                Inicio:{" "}
                {activeRoute.fechaInicio
                  ? new Date(activeRoute.fechaInicio).toLocaleString()
                  : "Por definir"}
              </Text>
            </View>
          </Card>
        </>
      )}

      <Modal
        visible={isFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fullscreenContainer}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>Mi ruta · mapa</Text>
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setIsFullscreen(false)}
            >
              <X color={colors.text} size={18} />
            </TouchableOpacity>
          </View>
          <View style={[styles.mapCard, { height: Math.max(320, screenHeight - 110) }]}>
            <MapView
              style={{ flex: 1 }}
              mapStyle={mapStyle}
              logoEnabled
              attributionEnabled
              surfaceView={false}
            >
              <Camera
                bounds={
                  routeBounds
                    ? {
                        ...routeBounds,
                        paddingTop: 60,
                        paddingBottom: 100,
                        paddingLeft: 60,
                        paddingRight: 60,
                      }
                    : undefined
                }
                centerCoordinate={routeBounds ? undefined : userCoord ?? mapCenter}
                zoomLevel={routeBounds ? undefined : DEFAULT_ZOOM}
                animationDuration={500}
              />
              {pathCoords.map(([lat, lng], idx) => (
                <PointAnnotation key={`f-p-${idx}`} id={`f-p-${idx}`} coordinate={[lng, lat]}>
                  <View style={styles.markerDot} />
                </PointAnnotation>
              ))}
              {routeGeometry ? (
                <ShapeSource id="driverRouteLineFull" shape={routeGeometry}>
                  <LineLayer
                    id="driverRouteLineLayerFull"
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
                <ShapeSource id="driverRouteFallbackFull" shape={straightLineFeature}>
                  <LineLayer
                    id="driverRouteFallbackLayerFull"
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
              {userCoord && (
                <PointAnnotation id="driver-location-full" coordinate={userCoord}>
                  <View style={styles.truckMarker}>
                    <Truck size={16} color="#fff" />
                  </View>
                </PointAnnotation>
              )}
            </MapView>
            <TouchableOpacity
              style={styles.fullscreenBtn}
              onPress={() => setIsFullscreen(false)}
            >
              <Minimize2 size={16} color={colors.primaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    muted: {
      color: colors.textMuted,
    },
    routeTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    value: {
      color: colors.text,
      flex: 1,
    },
    mapCard: {
      height: 320,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    markerDot: {
      width: 10,
      height: 10,
      borderRadius: 6,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: "#fff",
    },
    truckMarker: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#fff",
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
    fullscreenBtn: {
      position: "absolute",
      bottom: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(148,163,184,0.4)",
      backgroundColor: "rgba(15,23,42,0.84)",
      alignItems: "center",
      justifyContent: "center",
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
      fontWeight: "700",
      fontSize: 16,
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
