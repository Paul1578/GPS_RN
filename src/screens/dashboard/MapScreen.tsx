import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ActivityIndicator } from "react-native";
import {
  Camera,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
} from "@maplibre/maplibre-react-native";
import { useFleet } from "@/context/FleetContext";
import { useAuth } from "@/context/AuthContext";
import { fetchRoutePositions } from "@/services/fleetApi";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

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
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function MapScreen() {
  const { routes } = useFleet();
  const { apiFetch, user } = useAuth();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const canViewMap = !!user?.permissions?.canViewMap;
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<LatLngTuple[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);

  useEffect(() => {
    if (routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].id);
    }
  }, [routes, selectedRouteId]);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? null,
    [routes, selectedRouteId]
  );

  useEffect(() => {
    const loadTracking = async () => {
      if (!apiFetch || !selectedRouteId) {
        setTracking([]);
        return;
      }
      setLoadingTracking(true);
      try {
        const positions = await fetchRoutePositions(apiFetch, selectedRouteId);
        const normalized: LatLngTuple[] = positions
          .map((p) => {
            const lat = (p as any).latitude ?? (p as any).lat;
            const lng = (p as any).longitude ?? (p as any).lng;
            if (typeof lat !== "number" || typeof lng !== "number") return null;
            return [lat, lng] as LatLngTuple;
          })
          .filter((p): p is LatLngTuple => !!p);
        setTracking(normalized);
      } catch (error) {
        console.warn("No se pudo cargar el tracking de la ruta", error);
        setTracking([]);
      } finally {
        setLoadingTracking(false);
      }
    };
    void loadTracking();
  }, [apiFetch, selectedRouteId]);

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

  const mapBounds = useMemo(() => {
    if (pathCoords.length < 2) return null;
    const lats = pathCoords.map(([lat]) => lat);
    const lngs = pathCoords.map(([, lng]) => lng);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
      padding: 40,
    };
  }, [pathCoords]);

  const routeLine = useMemo<LineFeature | null>(() => {
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
          <MapView
            key={selectedRouteId ?? "map"}
            style={{ flex: 1 }}
            mapStyle={STYLE_URL}
            logoEnabled
            attributionEnabled
          >
            <Camera
              bounds={mapBounds ?? undefined}
              centerCoordinate={mapBounds ? undefined : mapCenter}
              zoomLevel={mapBounds ? undefined : DEFAULT_ZOOM}
              animationDuration={600}
            />

            {pathCoords.map(([lat, lng], idx) => (
              <PointAnnotation
                key={`p-${idx}`}
                id={`p-${idx}`}
                coordinate={[lng, lat]}
              >
                <View style={styles.markerDot} />
              </PointAnnotation>
            ))}

            {routeLine && (
              <ShapeSource id="routeLine" shape={routeLine}>
                <LineLayer
                  id="routeLineLayer"
                  style={{ lineColor: "#2563eb", lineWidth: 4 }}
                />
              </ShapeSource>
            )}

            {trackingLine && (
              <ShapeSource id="trackingLine" shape={trackingLine}>
                <LineLayer
                  id="trackingLineLayer"
                  style={{ lineColor: "#16a34a", lineWidth: 4 }}
                />
              </ShapeSource>
            )}
          </MapView>
          {loadingTracking && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ marginTop: 8, color: colors.textMuted }}>
                Cargando tracking...
              </Text>
            </View>
          )}
        </View>

        {selectedRoute && (
          <View style={styles.details}>
            <Text style={styles.sectionTitle}>{selectedRoute.nombre}</Text>
            <Text style={styles.muted}>Vehiculo: {selectedRoute.vehiculoId}</Text>
            <Text style={styles.muted}>Conductor: {selectedRoute.conductorId}</Text>
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
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#00000055",
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
  });
