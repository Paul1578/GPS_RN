import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
} from "@maplibre/maplibre-react-native";
import { Pencil, Plus, Trash2, X, MapPin, Search, ArrowLeft } from "lucide-react-native";
import { TextField } from "@/components/common/TextField";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Route, useFleet } from "@/context/FleetContext";
import { useAuth } from "@/context/AuthContext";
import { notify, notifyError } from "@/utils/notify";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

type StopInput = { nombre: string; lat: string; lng: string };

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type LineFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
  properties: Record<string, unknown>;
};

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const estados: Route["estado"][] = [
  "pendiente",
  "en_progreso",
  "completada",
  "cancelada",
];

const DEFAULT_REGION: MapRegion = {
  latitude: -12.0464,
  longitude: -77.0428,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function RoutesScreen() {
  const { user } = useAuth();
  const canCreateRoutes = !!user?.permissions?.canCreateRoutes;
  const { routes, vehicles, drivers, addRoute, updateRoute, deleteRoute } = useFleet();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [loading, setLoading] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    vehiculoId: "",
    conductorId: "",
    carga: "",
    origenLat: "",
    origenLng: "",
    destinoLat: "",
    destinoLng: "",
    estado: "pendiente" as Route["estado"],
  });
  const [stops, setStops] = useState<StopInput[]>([]);
  const [showCoords, setShowCoords] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectMode, setSelectMode] = useState<"origin" | "destination" | "stop">("origin");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    DEFAULT_REGION.longitude,
    DEFAULT_REGION.latitude,
  ]);
  const [mapZoom, setMapZoom] = useState(11);
  const mapInitRef = useRef(false);

  const selectableVehicles = useMemo(() => {
    if (editingRoute) return vehicles;
    return vehicles.filter((v) => v.estado === "disponible");
  }, [vehicles, editingRoute]);

  const resetForm = () => {
    setForm({
      nombre: "",
      vehiculoId: "",
      conductorId: "",
      carga: "",
      origenLat: "",
      origenLng: "",
      destinoLat: "",
      destinoLng: "",
      estado: "pendiente",
    });
    setStops([]);
    setEditingRoute(null);
    setSelectMode("origin");
    setSearchQuery("");
    setSearchResults([]);
  };

  const validateCoord = (lat: number, lng: number, label: string) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      notifyError(`${label}: coordenadas inválidas`);
      return false;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      notifyError(`${label}: lat debe estar entre -90 y 90, lng entre -180 y 180`);
      return false;
    }
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
      notifyError(`${label}: coordenadas inválidas (0,0)`);
      return false;
    }
    return true;
  };

  const buildStopsPayload = () => {
    return stops.map((stop, idx) => ({
      nombre: stop.nombre?.trim() || `Parada ${idx + 1}`,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
    }));
  };

  const handleSubmit = async () => {
    if (!form.nombre || !form.vehiculoId || !form.conductorId || !form.carga) {
      notifyError("Completa nombre, vehiculo, conductor y carga");
      return;
    }
    const origenLat = Number(form.origenLat);
    const origenLng = Number(form.origenLng);
    const destinoLat = Number(form.destinoLat);
    const destinoLng = Number(form.destinoLng);
    if (!validateCoord(origenLat, origenLng, "Origen")) return;
    if (!validateCoord(destinoLat, destinoLng, "Destino")) return;
    for (let i = 0; i < stops.length; i += 1) {
      const stop = stops[i];
      const lat = Number(stop.lat);
      const lng = Number(stop.lng);
      if (!validateCoord(lat, lng, `Parada ${i + 1}`)) return;
    }

    setLoading(true);
    const payload = {
      nombre: form.nombre,
      vehiculoId: form.vehiculoId,
      conductorId: form.conductorId,
      carga: form.carga,
      origen: { lat: origenLat, lng: origenLng, nombre: "Origen" },
      destino: { lat: destinoLat, lng: destinoLng, nombre: "Destino" },
      puntos: buildStopsPayload(),
      estado: form.estado,
      fechaInicio: undefined,
      fechaFin: undefined,
      evidencias: [],
      notas: "",
      teamId: undefined,
    };
    const result = editingRoute
      ? await updateRoute(editingRoute.id, payload)
      : await addRoute(payload);
    setLoading(false);
    if (result.ok) {
      notify(editingRoute ? "Ruta actualizada" : "Ruta creada");
      resetForm();
    } else if (result.message) {
      notifyError(result.message);
    }
  };

  const statusColor: Record<string, string> = {
    en_progreso: "#2563eb",
    completada: "#16a34a",
    pendiente: "#f59e0b",
    cancelada: "#ef4444",
  };

  const startEdit = (route: Route) => {
    setEditingRoute(route);
    setForm({
      nombre: route.nombre ?? "",
      vehiculoId: route.vehiculoId ?? "",
      conductorId: route.conductorId ?? "",
      carga: route.carga ?? "",
      origenLat: route.origen?.lat?.toString() ?? "",
      origenLng: route.origen?.lng?.toString() ?? "",
      destinoLat: route.destino?.lat?.toString() ?? "",
      destinoLng: route.destino?.lng?.toString() ?? "",
      estado: route.estado ?? "pendiente",
    });
    setStops(
      (route.puntos ?? []).map((p) => ({
        nombre: p.nombre ?? "",
        lat: p.lat?.toString() ?? "",
        lng: p.lng?.toString() ?? "",
      }))
    );
  };

  const confirmDelete = (routeId: string) => {
    Alert.alert("Eliminar ruta", "¿Seguro que deseas eliminar esta ruta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const result = await deleteRoute(routeId);
          if (!result.ok && result.message) {
            notifyError(result.message);
          }
        },
      },
    ]);
  };

  const computeRegion = (): MapRegion => {
    const points: Array<{ lat: number; lng: number }> = [];
    const latO = Number(form.origenLat);
    const lngO = Number(form.origenLng);
    const latD = Number(form.destinoLat);
    const lngD = Number(form.destinoLng);
    if (Number.isFinite(latO) && Number.isFinite(lngO)) points.push({ lat: latO, lng: lngO });
    stops.forEach((s) => {
      const lat = Number(s.lat);
      const lng = Number(s.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng });
    });
    if (Number.isFinite(latD) && Number.isFinite(lngD)) points.push({ lat: latD, lng: lngD });
    if (points.length === 0) return DEFAULT_REGION;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latitude = (minLat + maxLat) / 2;
    const longitude = (minLng + maxLng) / 2;
    const latitudeDelta = Math.max(0.05, (maxLat - minLat) * 1.5);
    const longitudeDelta = Math.max(0.05, (maxLng - minLng) * 1.5);
    return { latitude, longitude, latitudeDelta, longitudeDelta };
  };

  const regionToZoom = (region: MapRegion) => {
    const delta = Math.max(region.longitudeDelta, region.latitudeDelta);
    const zoom = Math.log2(360 / delta);
    return Math.min(18, Math.max(3, zoom));
  };

  const handleMapPress = (lat: number, lng: number) => {
    if (selectMode === "origin") {
      setForm((s) => ({ ...s, origenLat: lat.toString(), origenLng: lng.toString() }));
    } else if (selectMode === "destination") {
      setForm((s) => ({ ...s, destinoLat: lat.toString(), destinoLng: lng.toString() }));
    } else {
      setStops((prev) => [...prev, { nombre: "", lat: lat.toString(), lng: lng.toString() }]);
    }
  };

  useEffect(() => {
    if (showMapPicker && !mapInitRef.current) {
      const region = computeRegion();
      setMapCenter([region.longitude, region.latitude]);
      setMapZoom(regionToZoom(region));
      mapInitRef.current = true;
    }
    if (!showMapPicker) {
      mapInitRef.current = false;
    }
  }, [showMapPicker]);

  const fetchSearch = async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) return [];
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "es",
        "User-Agent": "FleetFlowApp",
      },
    });
    if (!response.ok) return [];
    return (await response.json()) as SearchResult[];
  };

  const handleSearch = async () => {
    const results = await fetchSearch(searchQuery);
    setSearchResults(results);
  };

  const applySearchResult = (result: SearchResult) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (selectMode === "origin") {
      setForm((s) => ({ ...s, origenLat: lat.toString(), origenLng: lng.toString() }));
    } else if (selectMode === "destination") {
      setForm((s) => ({ ...s, destinoLat: lat.toString(), destinoLng: lng.toString() }));
    } else {
      setStops((prev) => [...prev, { nombre: result.display_name, lat: lat.toString(), lng: lng.toString() }]);
    }
    setMapCenter([lng, lat]);
    setMapZoom(14);
    setSearchResults([]);
  };

  if (!canCreateRoutes) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 14 }}
      >
        <Text style={styles.title}>Gestion de rutas</Text>
        <Card>
          <Text style={styles.muted}>
            No tienes permisos para crear o gestionar rutas.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  if (showMapPicker) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.mapTopBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setShowMapPicker(false)}
          >
            <ArrowLeft color={colors.text} size={20} />
          </TouchableOpacity>
          <Text style={styles.mapTitle}>Seleccionar ubicaciones</Text>
        </View>

        <View style={styles.mapHeader}>
          <View style={styles.modeRow}>
            {([
              { key: "origin", label: "Origen" },
              { key: "destination", label: "Destino" },
              { key: "stop", label: "Parada" },
            ] as const).map((mode) => {
              const active = selectMode === mode.key;
              return (
                <TouchableOpacity
                  key={mode.key}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => setSelectMode(mode.key)}
                >
                  <MapPin color={active ? colors.primary : colors.textMuted} size={14} />
                  <Text style={[styles.modeText, active && styles.modeTextActive]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.helper}>
            Toca el mapa para fijar {selectMode === "origin" ? "origen" : selectMode === "destination" ? "destino" : "parada"}.
          </Text>
        </View>

        <View style={styles.mapFull}>
          <MapView
            style={{ flex: 1 }}
            mapStyle={STYLE_URL}
            logoEnabled
            attributionEnabled
            onPress={(event) => {
              const coords = (event as any)?.geometry?.coordinates as number[] | undefined;
              if (!coords || coords.length < 2) return;
              const [lng, lat] = coords;
              handleMapPress(lat, lng);
            }}
          >
            <Camera centerCoordinate={mapCenter} zoomLevel={mapZoom} animationDuration={500} />
            {Number.isFinite(Number(form.origenLat)) &&
              Number.isFinite(Number(form.origenLng)) && (
                <PointAnnotation
                  id="origin"
                  coordinate={[Number(form.origenLng), Number(form.origenLat)]}
                >
                  <View style={[styles.markerDot, styles.markerOrigin]} />
                </PointAnnotation>
              )}
            {Number.isFinite(Number(form.destinoLat)) &&
              Number.isFinite(Number(form.destinoLng)) && (
                <PointAnnotation
                  id="destination"
                  coordinate={[Number(form.destinoLng), Number(form.destinoLat)]}
                >
                  <View style={[styles.markerDot, styles.markerDestination]} />
                </PointAnnotation>
              )}
            {stops.map((stop, idx) => {
              const lat = Number(stop.lat);
              const lng = Number(stop.lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              return (
                <PointAnnotation key={`stop-${idx}`} id={`stop-${idx}`} coordinate={[lng, lat]}>
                  <View style={[styles.markerDot, styles.markerStop]} />
                </PointAnnotation>
              );
            })}
            {(() => {
              const points: Array<{ lat: number; lng: number }> = [];
              if (Number.isFinite(Number(form.origenLat)) && Number.isFinite(Number(form.origenLng))) {
                points.push({
                  lat: Number(form.origenLat),
                  lng: Number(form.origenLng),
                });
              }
              stops.forEach((s) => {
                const lat = Number(s.lat);
                const lng = Number(s.lng);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  points.push({ lat, lng });
                }
              });
              if (Number.isFinite(Number(form.destinoLat)) && Number.isFinite(Number(form.destinoLng))) {
                points.push({
                  lat: Number(form.destinoLat),
                  lng: Number(form.destinoLng),
                });
              }
              if (points.length > 1) {
                const lineFeature: LineFeature = {
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates: points.map((p) => [p.lng, p.lat]),
                  },
                  properties: {},
                };
                return (
                  <ShapeSource id="routePreview" shape={lineFeature}>
                    <LineLayer
                      id="routePreviewLayer"
                      style={{ lineColor: colors.primary, lineWidth: 3 }}
                    />
                  </ShapeSource>
                );
              }
              return null;
            })()}
          </MapView>
        </View>

        <View style={styles.searchBlock}>
          <Text style={styles.label}>
            Buscar {selectMode === "origin" ? "origen" : selectMode === "destination" ? "destino" : "parada"}
          </Text>
          <View style={styles.searchRow}>
            <TextField
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Dirección u lugar"
              style={{ flex: 1 }}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Search color={colors.primaryText} size={16} />
            </TouchableOpacity>
          </View>
          {searchResults.map((item) => (
            <TouchableOpacity
              key={`${item.lat}-${item.lon}`}
              style={styles.searchResult}
              onPress={() => applySearchResult(item)}
            >
              <Text style={styles.searchText}>{item.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mapActions}>
          <Button title="Listo" onPress={() => setShowMapPicker(false)} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
    >
      <Text style={styles.title}>Gestion de rutas</Text>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {editingRoute ? "Editar ruta" : "Nueva ruta"}
          </Text>
          {editingRoute && (
            <TouchableOpacity style={styles.clearButton} onPress={resetForm}>
              <X color={colors.textMuted} size={16} />
              <Text style={styles.clearText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
        <TextField
          label="Nombre"
          value={form.nombre}
          onChangeText={(v) => setForm((s) => ({ ...s, nombre: v }))}
          placeholder="Ruta principal"
        />
        <TextField
          label="Descripcion de carga"
          value={form.carga}
          onChangeText={(v) => setForm((s) => ({ ...s, carga: v }))}
          placeholder="Electronicos / paquetes"
        />

        <View style={styles.selectorRow}>
          <Text style={styles.label}>Vehiculo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectableVehicles.map((veh) => {
              const active = veh.id === form.vehiculoId;
              return (
                <TouchableOpacity
                  key={veh.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setForm((s) => ({ ...s, vehiculoId: veh.id }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {veh.placa}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.selectorRow}>
          <Text style={styles.label}>Conductor</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {drivers.map((driver) => {
              const active = driver.id === form.conductorId;
              return (
                <TouchableOpacity
                  key={driver.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setForm((s) => ({ ...s, conductorId: driver.id }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {driver.firstName} {driver.lastName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.selectorRow}>
          <Text style={styles.label}>Estado</Text>
          <View style={styles.stateRow}>
            {estados.map((estado) => {
              const active = estado === form.estado;
              return (
                <TouchableOpacity
                  key={estado}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setForm((s) => ({ ...s, estado }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {estado.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Card style={styles.locationCard}>
          <Text style={styles.sectionSubtitle}>Ubicaciones</Text>
          <Text style={styles.muted}>
            Origen, destino y paradas se seleccionan en el mapa.
          </Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Origen</Text>
            <Text style={styles.locationValue}>
              {form.origenLat && form.origenLng
                ? `${Number(form.origenLat).toFixed(5)}, ${Number(form.origenLng).toFixed(5)}`
                : "Sin seleccionar"}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Destino</Text>
            <Text style={styles.locationValue}>
              {form.destinoLat && form.destinoLng
                ? `${Number(form.destinoLat).toFixed(5)}, ${Number(form.destinoLng).toFixed(5)}`
                : "Sin seleccionar"}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Paradas</Text>
            <Text style={styles.locationValue}>{stops.length}</Text>
          </View>
          <Button title="Abrir mapa" onPress={() => setShowMapPicker(true)} />
        </Card>

        <TouchableOpacity
          style={styles.toggleCoords}
          onPress={() => setShowCoords((prev) => !prev)}
        >
          <Text style={styles.toggleCoordsText}>
            {showCoords ? "Ocultar coordenadas" : "Usar coordenadas manuales"}
          </Text>
        </TouchableOpacity>

        {showCoords && (
          <>
            <View style={styles.row}>
              <TextField
                label="Origen lat"
                value={form.origenLat}
                onChangeText={(v) => setForm((s) => ({ ...s, origenLat: v }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
              <TextField
                label="Origen lng"
                value={form.origenLng}
                onChangeText={(v) => setForm((s) => ({ ...s, origenLng: v }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
            </View>
            <View style={styles.row}>
              <TextField
                label="Destino lat"
                value={form.destinoLat}
                onChangeText={(v) => setForm((s) => ({ ...s, destinoLat: v }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
              <TextField
                label="Destino lng"
                value={form.destinoLng}
                onChangeText={(v) => setForm((s) => ({ ...s, destinoLng: v }))}
                keyboardType="numeric"
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}

        <View style={styles.selectorRow}>
          <View style={styles.stopHeader}>
            <Text style={styles.label}>Paradas</Text>
            <TouchableOpacity
              style={styles.addStop}
              onPress={() =>
                setStops((prev) => [...prev, { nombre: "", lat: "", lng: "" }])
              }
            >
              <Plus color={colors.primary} size={16} />
              <Text style={styles.addStopText}>Agregar parada</Text>
            </TouchableOpacity>
          </View>
          {stops.length === 0 && (
            <Text style={styles.muted}>Aún no hay paradas intermedias.</Text>
          )}
          {stops.map((stop, idx) => (
            <View key={`stop-${idx}`} style={styles.stopCard}>
              <View style={styles.stopHeaderRow}>
                <Text style={styles.stopTitle}>Parada {idx + 1}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setStops((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <X color={colors.dangerText} size={16} />
                </TouchableOpacity>
              </View>
              <TextField
                label="Nombre (opcional)"
                value={stop.nombre}
                onChangeText={(value) =>
                  setStops((prev) =>
                    prev.map((s, i) =>
                      i === idx ? { ...s, nombre: value } : s
                    )
                  )
                }
                placeholder={`Parada ${idx + 1}`}
              />
              <View style={styles.row}>
                <TextField
                  label="Lat"
                  value={stop.lat}
                  onChangeText={(value) =>
                    setStops((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, lat: value } : s))
                    )
                  }
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
                <TextField
                  label="Lng"
                  value={stop.lng}
                  onChangeText={(value) =>
                    setStops((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, lng: value } : s))
                    )
                  }
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))}
        </View>
        <Button
          title={editingRoute ? "Actualizar ruta" : "Crear ruta"}
          onPress={handleSubmit}
          loading={loading}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Rutas registradas</Text>
        {routes.length === 0 && (
          <Text style={styles.muted}>Aun no tienes rutas creadas.</Text>
        )}
        {routes.map((route) => (
          <View key={route.id} style={styles.routeItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeName}>{route.nombre}</Text>
              <Text style={styles.muted}>
                Vehiculo: {route.vehiculoId} | Conductor: {route.conductorId}
              </Text>
              <Text
                style={[
                  styles.badge,
                  { backgroundColor: statusColor[route.estado] ?? colors.border },
                ]}
              >
                {route.estado}
              </Text>
            </View>
            <TouchableOpacity onPress={() => startEdit(route)}>
              <Pencil color={colors.primary} size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(route.id)}>
              <Trash2 color={colors.dangerText} size={18} />
            </TouchableOpacity>
          </View>
        ))}
      </Card>
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
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
      flex: 1,
    },
    sectionSubtitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
      gap: 10,
      flexWrap: "wrap",
    },
    clearButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
    },
    clearText: {
      color: colors.textMuted,
      fontWeight: "600",
    },
    selectorRow: {
      marginBottom: 12,
      gap: 6,
    },
    label: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    stateRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
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
    row: {
      flexDirection: "row",
      gap: 10,
    },
    mapHeader: {
      gap: 8,
      marginBottom: 8,
    },
    modeRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    modeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    modeChipActive: {
      backgroundColor: colors.chipBg,
      borderColor: colors.chipBorder,
    },
    modeText: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    modeTextActive: {
      color: colors.primary,
    },
    helper: {
      color: colors.textMuted,
      fontSize: 12,
    },
    mapFull: {
      flex: 1,
    },
    mapTopBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
    },
    mapTitle: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    backBtn: {
      padding: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    mapActions: {
      padding: 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    searchBlock: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 6,
      backgroundColor: colors.background,
    },
    searchRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    searchBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    searchResult: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    searchText: {
      color: colors.textSoft,
      fontSize: 12,
    },
    toggleCoords: {
      paddingVertical: 8,
    },
    toggleCoordsText: {
      color: colors.primary,
      fontWeight: "600",
    },
    stopHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    addStop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    addStopText: {
      color: colors.primary,
      fontWeight: "600",
    },
    stopCard: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      marginTop: 8,
    },
    stopHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    stopTitle: {
      fontWeight: "700",
      color: colors.text,
    },
    routeItem: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    routeName: {
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    muted: {
      color: colors.textMuted,
    },
    badge: {
      alignSelf: "flex-start",
      color: "#fff",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      marginTop: 6,
      textTransform: "capitalize",
    },
    locationCard: {
      gap: 10,
    },
    locationRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    locationLabel: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    locationValue: {
      color: colors.text,
      fontWeight: "600",
    },
    markerDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    markerOrigin: {
      backgroundColor: "#2563eb",
    },
    markerDestination: {
      backgroundColor: "#16a34a",
    },
    markerStop: {
      backgroundColor: "#f59e0b",
    },
  });
