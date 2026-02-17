import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
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
import { Pencil, Plus, Trash2, X, MapPin, Search, ArrowLeft } from "lucide-react-native";
import { TextField } from "@/components/common/TextField";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Route, useFleet } from "@/context/FleetContext";
import { useAuth } from "@/context/AuthContext";
import { notify, notifyError } from "@/utils/notify";
import { useThemeColors, type ThemeColors } from "@/theme/colors";
import { formatVehicleLabel } from "@/utils/formatVehicleLabel";

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

const USER_ZOOM = 14;
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

const parseCoord = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
};

type MapPickerCanvasProps = {
  mapStyle: string;
  colors: ThemeColors;
  routeBounds?: { ne: [number, number]; sw: [number, number] };
  mapCenter: [number, number];
  mapZoom: number;
  locationGranted: boolean;
  onFirstUserLocation: (coord: [number, number]) => void;
  onPress: (lat: number, lng: number) => void;
  originCoord: [number, number] | null;
  destinationCoord: [number, number] | null;
  stopCoords: Array<[number, number]>;
  routeGeometry: LineFeature | null;
  routeError: boolean;
  straightLineFeature: LineFeature | null;
  markerDot: any;
  markerOrigin: any;
  markerDestination: any;
  markerStop: any;
};

const MapPickerCanvas = memo(function MapPickerCanvas({
  mapStyle,
  colors,
  routeBounds,
  mapCenter,
  mapZoom,
  locationGranted,
  onFirstUserLocation,
  onPress,
  originCoord,
  destinationCoord,
  stopCoords,
  routeGeometry,
  routeError,
  straightLineFeature,
  markerDot,
  markerOrigin,
  markerDestination,
  markerStop,
}: MapPickerCanvasProps) {
  return (
    <MapView
      style={{ flex: 1 }}
      mapStyle={mapStyle}
      logoEnabled
      attributionEnabled
      surfaceView={false}
      onPress={(event) => {
        const coords = (event as any)?.geometry?.coordinates as number[] | undefined;
        if (!coords || coords.length < 2) return;
        const [lng, lat] = coords;
        onPress(lat, lng);
      }}
    >
      <Camera
        bounds={
          routeBounds
            ? {
                ...routeBounds,
                paddingTop: 80,
                paddingBottom: 140,
                paddingLeft: 60,
                paddingRight: 60,
              }
            : undefined
        }
        centerCoordinate={routeBounds ? undefined : mapCenter}
        zoomLevel={routeBounds ? undefined : mapZoom}
        animationDuration={500}
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
      {originCoord && (
        <PointAnnotation id="origin" coordinate={originCoord}>
          <View style={[markerDot, markerOrigin]} />
        </PointAnnotation>
      )}
      {destinationCoord && (
        <PointAnnotation id="destination" coordinate={destinationCoord}>
          <View style={[markerDot, markerDestination]} />
        </PointAnnotation>
      )}
      {stopCoords.map((coord, idx) => (
        <PointAnnotation key={`stop-${idx}`} id={`stop-${idx}`} coordinate={coord}>
          <View style={[markerDot, markerStop]} />
        </PointAnnotation>
      ))}
      {routeGeometry ? (
        <ShapeSource id="routePreviewOsrm" shape={routeGeometry}>
          <LineLayer
            id="routePreviewOsrmShadow"
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
            id="routePreviewOsrmLayer"
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
        <ShapeSource id="routePreviewFallback" shape={straightLineFeature}>
          <LineLayer
            id="routePreviewFallbackLayer"
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
    </MapView>
  );
});

export function RoutesScreen() {
  const { user } = useAuth();
  const canCreateRoutes = !!user?.permissions?.canCreateRoutes;
  const { routes, vehicles, drivers, addRoute, updateRoute, deleteRoute } = useFleet();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
  const [locationGranted, setLocationGranted] = useState(Platform.OS !== "android");
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<LineFeature | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [osrmStatus, setOsrmStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [osrmPoints, setOsrmPoints] = useState(0);
  const [osrmNote, setOsrmNote] = useState("");
  const osrmAbortRef = useRef<AbortController | null>(null);
  const osrmDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const originCoord = useMemo<[number, number] | null>(() => {
    const lat = parseCoord(form.origenLat);
    const lng = parseCoord(form.origenLng);
    if (lat === null || lng === null) return null;
    return [lng, lat];
  }, [form.origenLat, form.origenLng]);

  const destinationCoord = useMemo<[number, number] | null>(() => {
    const lat = parseCoord(form.destinoLat);
    const lng = parseCoord(form.destinoLng);
    if (lat === null || lng === null) return null;
    return [lng, lat];
  }, [form.destinoLat, form.destinoLng]);

  const stopCoords = useMemo<Array<[number, number]>>(
    () =>
      stops
        .map((stop) => {
          const lat = parseCoord(stop.lat);
          const lng = parseCoord(stop.lng);
          if (lat === null || lng === null) return null;
          return [lng, lat] as [number, number];
        })
        .filter((coord): coord is [number, number] => !!coord),
    [stops]
  );

  const selectableVehicles = useMemo(() => {
    if (editingRoute) return vehicles;
    return vehicles.filter((v) => v.estado === "disponible");
  }, [vehicles, editingRoute]);

  const vehicleById = useMemo(
    () => new Map(vehicles.map((veh) => [veh.id, veh])),
    [vehicles]
  );
  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers]
  );

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

  const hasRoutePoints = useMemo(() => {
    const latO = parseCoord(form.origenLat);
    const lngO = parseCoord(form.origenLng);
    if (latO !== null && lngO !== null) return true;
    for (const stop of stops) {
      const lat = parseCoord(stop.lat);
      const lng = parseCoord(stop.lng);
      if (lat !== null && lng !== null) return true;
    }
    const latD = parseCoord(form.destinoLat);
    const lngD = parseCoord(form.destinoLng);
    return latD !== null && lngD !== null;
  }, [form.origenLat, form.origenLng, form.destinoLat, form.destinoLng, stops]);

  const straightLineFeature = useMemo<LineFeature | null>(() => {
    const points: Array<[number, number]> = [];
    const originLat = parseCoord(form.origenLat);
    const originLng = parseCoord(form.origenLng);
    if (originLat !== null && originLng !== null) {
      points.push([originLng, originLat]);
    }
    stops.forEach((stop) => {
      const lat = parseCoord(stop.lat);
      const lng = parseCoord(stop.lng);
      if (lat !== null && lng !== null) points.push([lng, lat]);
    });
    const destLat = parseCoord(form.destinoLat);
    const destLng = parseCoord(form.destinoLng);
    if (destLat !== null && destLng !== null) {
      points.push([destLng, destLat]);
    }
    if (points.length < 2) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: points,
      },
      properties: {},
    };
  }, [form.origenLat, form.origenLng, form.destinoLat, form.destinoLng, stops]);

  const computeRegion = (): MapRegion => {
    const points: Array<{ lat: number; lng: number }> = [];
    const latO = parseCoord(form.origenLat);
    const lngO = parseCoord(form.origenLng);
    const latD = parseCoord(form.destinoLat);
    const lngD = parseCoord(form.destinoLng);
    if (latO !== null && lngO !== null) points.push({ lat: latO, lng: lngO });
    stops.forEach((s) => {
      const lat = parseCoord(s.lat);
      const lng = parseCoord(s.lng);
      if (lat !== null && lng !== null) points.push({ lat, lng });
    });
    if (latD !== null && lngD !== null) points.push({ lat: latD, lng: lngD });
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

  useEffect(() => {
    if (showMapPicker && !mapInitRef.current) {
      if (!hasRoutePoints && userCoord) {
        setMapCenter(userCoord);
        setMapZoom(USER_ZOOM);
      } else {
        const region = computeRegion();
        setMapCenter([region.longitude, region.latitude]);
        setMapZoom(regionToZoom(region));
      }
      mapInitRef.current = true;
    }
    if (!showMapPicker) {
      mapInitRef.current = false;
    }
  }, [showMapPicker]);

  useEffect(() => {
    if (!showMapPicker) {
      setRouteGeometry(null);
      setRouteError(false);
      setRouteLoading(false);
      setOsrmStatus("idle");
      setOsrmPoints(0);
      setOsrmNote("");
      return;
    }
    if (!hasRoutePoints) {
      setRouteGeometry(null);
      setRouteError(false);
      setOsrmStatus("idle");
      setOsrmPoints(0);
      setOsrmNote("");
      return;
    }

    const originLat = parseCoord(form.origenLat);
    const originLng = parseCoord(form.origenLng);
    const destLat = parseCoord(form.destinoLat);
    const destLng = parseCoord(form.destinoLng);
    if (originLat === null || originLng === null || destLat === null || destLng === null) {
      setRouteGeometry(null);
      return;
    }

    const coords: Array<[number, number]> = [
      [originLng, originLat],
      ...stops
        .map((stop) => {
          const lat = parseCoord(stop.lat);
          const lng = parseCoord(stop.lng);
          if (lat === null || lng === null) return null;
          return [lng, lat] as [number, number];
        })
        .filter((item): item is [number, number] => !!item),
      [destLng, destLat],
    ];

    if (coords.length < 2) {
      setRouteGeometry(null);
      setRouteError(false);
      setOsrmStatus("idle");
      setOsrmPoints(0);
      setOsrmNote("");
      return;
    }

    if (osrmDebounceRef.current) {
      clearTimeout(osrmDebounceRef.current);
    }
    osrmDebounceRef.current = setTimeout(() => {
      osrmAbortRef.current?.abort();
      const controller = new AbortController();
      osrmAbortRef.current = controller;
      const coordString = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
      setRouteLoading(true);
      setRouteError(false);
      setOsrmStatus("loading");
      setOsrmNote("");

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
            setOsrmStatus("error");
            setOsrmPoints(0);
            setOsrmNote("Sin geometria");
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
          setOsrmStatus("ok");
          setOsrmPoints(cleanCoords.length);
          setOsrmNote("");
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.warn("No se pudo calcular la ruta con OSRM", error);
          setRouteGeometry(null);
          setRouteError(true);
          setOsrmStatus("error");
          setOsrmPoints(0);
          setOsrmNote(error instanceof Error ? error.message : "Error OSRM");
        })
        .finally(() => {
          if (!controller.signal.aborted) setRouteLoading(false);
        });
    }, 400);

    return () => {
      if (osrmDebounceRef.current) clearTimeout(osrmDebounceRef.current);
    };
  }, [
    showMapPicker,
    hasRoutePoints,
    form.origenLat,
    form.origenLng,
    form.destinoLat,
    form.destinoLng,
    stops,
  ]);

  useEffect(() => {
    if (!showMapPicker || hasRoutePoints || !userCoord) return;
    setMapCenter(userCoord);
    setMapZoom(USER_ZOOM);
  }, [showMapPicker, hasRoutePoints, userCoord]);

  const routeBounds = useMemo(() => {
    if (routeGeometry?.geometry?.coordinates?.length) {
      return computeBounds(routeGeometry.geometry.coordinates);
    }
    if (hasRoutePoints && straightLineFeature?.geometry?.coordinates?.length) {
      return computeBounds(straightLineFeature.geometry.coordinates);
    }
    return null;
  }, [routeGeometry, straightLineFeature, hasRoutePoints]);

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
          <Text style={styles.debugText}>
            OSRM: {osrmStatus} · pts: {osrmPoints}
            {osrmNote ? ` · ${osrmNote}` : ""}
          </Text>
        </View>

        <View style={styles.mapFull}>
          <MapPickerCanvas
            mapStyle={STYLE_URL}
            colors={colors}
            routeBounds={routeBounds ?? undefined}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            locationGranted={locationGranted}
            onFirstUserLocation={(coord) => {
              if (userCoord) return;
              setUserCoord(coord);
            }}
            onPress={handleMapPress}
            originCoord={originCoord}
            destinationCoord={destinationCoord}
            stopCoords={stopCoords}
            routeGeometry={routeGeometry}
            routeError={routeError}
            straightLineFeature={straightLineFeature}
            markerDot={styles.markerDot}
            markerOrigin={styles.markerOrigin}
            markerDestination={styles.markerDestination}
            markerStop={styles.markerStop}
          />
          {routeLoading && (
            <View style={styles.routeLoading} pointerEvents="none">
              <Text style={styles.routeLoadingText}>Calculando ruta...</Text>
            </View>
          )}
          {!routeLoading && routeError && (
            <View style={styles.routeLoading} pointerEvents="none">
              <Text style={styles.routeLoadingText}>
                OSRM no disponible, mostrando línea recta
              </Text>
            </View>
          )}
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

  const listCount = routes.length;
  const renderRouteItem = ({ item, index }: { item: Route; index: number }) => {
    const vehicleLabel = formatVehicleLabel(
      vehicleById.get(item.vehiculoId),
      item.vehiculoId
    );
    const driver = driverById.get(item.conductorId);
    const driverLabel = driver
      ? `${driver.firstName} ${driver.lastName}`.trim()
      : item.conductorId;
    const isFirst = index === 0;
    const isLast = index === listCount - 1;
    return (
      <View
        style={[
          styles.listItem,
          isFirst && styles.listItemFirst,
          isLast && styles.listItemLast,
        ]}
      >
        <View style={[styles.routeItem, !isLast && styles.itemDivider]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeName}>{item.nombre}</Text>
            <Text style={styles.muted}>
              Vehiculo: {vehicleLabel} | Conductor: {driverLabel}
            </Text>
            <Text
              style={[
                styles.badge,
                { backgroundColor: statusColor[item.estado] ?? colors.border },
              ]}
            >
              {item.estado}
            </Text>
          </View>
          <TouchableOpacity onPress={() => startEdit(item)}>
            <Pencil color={colors.primary} size={18} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(item.id)}>
            <Trash2 color={colors.dangerText} size={18} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={routes}
      keyExtractor={(item) => item.id}
      renderItem={renderRouteItem}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      initialNumToRender={10}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={
        <>
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
                        {formatVehicleLabel(veh)}
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
                          prev.map((s, i) =>
                            i === idx ? { ...s, lat: value } : s
                          )
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
                          prev.map((s, i) =>
                            i === idx ? { ...s, lng: value } : s
                          )
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

          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Rutas registradas</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <Card>
          <Text style={styles.muted}>Aun no tienes rutas creadas.</Text>
        </Card>
      }
    />
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
    debugText: {
      color: colors.textMuted,
      fontSize: 11,
    },
    mapFull: {
      flex: 1,
      position: "relative",
    },
    routeLoading: {
      position: "absolute",
      top: 16,
      alignSelf: "center",
      zIndex: 10,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    routeLoadingText: {
      color: colors.textMuted,
      fontWeight: "600",
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
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    listItem: {
      backgroundColor: colors.surface,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
    },
    listItemFirst: {
      borderTopWidth: 1,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overflow: "hidden",
    },
    listItemLast: {
      borderBottomWidth: 1,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      overflow: "hidden",
    },
    itemDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listHeader: {
      paddingVertical: 4,
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
