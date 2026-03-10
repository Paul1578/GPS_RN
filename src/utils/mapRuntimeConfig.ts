import AsyncStorage from "@react-native-async-storage/async-storage";

export type MapBaseStyle = "osm_light" | "osm_dark" | "osm_contrast";
export type RouteStatusFilter =
  | "all"
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type MapViewOptions = {
  showStops: boolean;
  showOriginDestinationMarkers: boolean;
  showPlannedLine: boolean;
  showTrackingLine: boolean;
  showOnlySelectedRoute: boolean;
  showRoutesPanel: boolean;
  routeStatusFilter: RouteStatusFilter;
  baseMapStyle: MapBaseStyle;
};

export type RouteViewport = {
  center: [number, number];
  zoom: number;
};

export const MAP_STORAGE_KEYS = {
  options: "fleetflow:rn:map-view-options",
  routeViewports: "fleetflow:rn:map-route-viewports",
} as const;

export const MAP_TRACKING_CONFIG = {
  pollVisibleMs: 20_000,
  pollHiddenMs: 90_000,
  staleMs: 2 * 60 * 1000,
  offRouteThresholdMeters: 120,
  maxErrorBackoff: 4,
} as const;

export const MAP_LAYOUT_CONFIG = {
  defaultCenter: [-78.467834, -0.180653] as [number, number], // Quito aprox (lng, lat)
  defaultZoom: 11,
  userZoom: 14,
  osrmCacheTtlMs: 10 * 60 * 1000,
} as const;

export const DEFAULT_MAP_VIEW_OPTIONS: MapViewOptions = {
  showStops: true,
  showOriginDestinationMarkers: true,
  showPlannedLine: true,
  showTrackingLine: true,
  showOnlySelectedRoute: false,
  showRoutesPanel: true,
  routeStatusFilter: "all",
  baseMapStyle: "osm_light",
};

export const MAP_BASE_STYLE_OPTIONS: Array<{ value: MapBaseStyle; label: string }> = [
  { value: "osm_light", label: "OSM claro" },
  { value: "osm_dark", label: "OSM oscuro" },
  { value: "osm_contrast", label: "Alto contraste" },
];

const isRouteStatusFilter = (value: unknown): value is RouteStatusFilter =>
  value === "all" ||
  value === "pending" ||
  value === "in_progress" ||
  value === "completed" ||
  value === "cancelled";

const isBaseMapStyle = (value: unknown): value is MapBaseStyle =>
  value === "osm_light" || value === "osm_dark" || value === "osm_contrast";

const sanitizeMapOptions = (raw: Partial<MapViewOptions> | null): MapViewOptions => ({
  showStops:
    typeof raw?.showStops === "boolean" ? raw.showStops : DEFAULT_MAP_VIEW_OPTIONS.showStops,
  showOriginDestinationMarkers:
    typeof raw?.showOriginDestinationMarkers === "boolean"
      ? raw.showOriginDestinationMarkers
      : DEFAULT_MAP_VIEW_OPTIONS.showOriginDestinationMarkers,
  showPlannedLine:
    typeof raw?.showPlannedLine === "boolean"
      ? raw.showPlannedLine
      : DEFAULT_MAP_VIEW_OPTIONS.showPlannedLine,
  showTrackingLine:
    typeof raw?.showTrackingLine === "boolean"
      ? raw.showTrackingLine
      : DEFAULT_MAP_VIEW_OPTIONS.showTrackingLine,
  showOnlySelectedRoute:
    typeof raw?.showOnlySelectedRoute === "boolean"
      ? raw.showOnlySelectedRoute
      : DEFAULT_MAP_VIEW_OPTIONS.showOnlySelectedRoute,
  showRoutesPanel:
    typeof raw?.showRoutesPanel === "boolean"
      ? raw.showRoutesPanel
      : DEFAULT_MAP_VIEW_OPTIONS.showRoutesPanel,
  routeStatusFilter: isRouteStatusFilter(raw?.routeStatusFilter)
    ? raw.routeStatusFilter
    : DEFAULT_MAP_VIEW_OPTIONS.routeStatusFilter,
  baseMapStyle: isBaseMapStyle(raw?.baseMapStyle)
    ? raw.baseMapStyle
    : DEFAULT_MAP_VIEW_OPTIONS.baseMapStyle,
});

export const loadMapViewOptions = async (): Promise<MapViewOptions> => {
  try {
    const raw = await AsyncStorage.getItem(MAP_STORAGE_KEYS.options);
    if (!raw) return DEFAULT_MAP_VIEW_OPTIONS;
    return sanitizeMapOptions(JSON.parse(raw) as Partial<MapViewOptions>);
  } catch {
    return DEFAULT_MAP_VIEW_OPTIONS;
  }
};

export const saveMapViewOptions = async (options: MapViewOptions) => {
  try {
    await AsyncStorage.setItem(MAP_STORAGE_KEYS.options, JSON.stringify(options));
  } catch {
    // noop
  }
};

export const loadRouteViewports = async (): Promise<Record<string, RouteViewport>> => {
  try {
    const raw = await AsyncStorage.getItem(MAP_STORAGE_KEYS.routeViewports);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RouteViewport>;
    if (!parsed || typeof parsed !== "object") return {};
    const sanitized: Record<string, RouteViewport> = {};
    Object.entries(parsed).forEach(([routeId, viewport]) => {
      if (
        Array.isArray(viewport?.center) &&
        viewport.center.length === 2 &&
        Number.isFinite(viewport.center[0]) &&
        Number.isFinite(viewport.center[1]) &&
        Number.isFinite(viewport.zoom)
      ) {
        sanitized[routeId] = {
          center: [viewport.center[0], viewport.center[1]],
          zoom: viewport.zoom,
        };
      }
    });
    return sanitized;
  } catch {
    return {};
  }
};

export const saveRouteViewports = async (viewports: Record<string, RouteViewport>) => {
  try {
    await AsyncStorage.setItem(MAP_STORAGE_KEYS.routeViewports, JSON.stringify(viewports));
  } catch {
    // noop
  }
};

const styleByBaseMap: Record<MapBaseStyle, { tiles: string; attribution: string }> = {
  osm_light: {
    tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  osm_dark: {
    tiles: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors © CARTO",
  },
  osm_contrast: {
    tiles: "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors (HOT style)",
  },
};

export const getMapStyleObject = (style: MapBaseStyle) => {
  const selected = styleByBaseMap[style] ?? styleByBaseMap.osm_light;
  return {
    version: 8,
    name: `fleetflow-${style}`,
    sources: {
      basemap: {
        type: "raster",
        tiles: [selected.tiles],
        tileSize: 256,
        attribution: selected.attribution,
      },
    },
    layers: [
      {
        id: "basemap-layer",
        type: "raster",
        source: "basemap",
      },
    ],
  };
};
