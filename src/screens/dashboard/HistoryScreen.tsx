import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Eye, Filter, XCircle, CheckCircle, Clock } from "lucide-react-native";
import { Card } from "@/components/common/Card";
import { useFleet } from "@/context/FleetContext";
import { useAuth } from "@/context/AuthContext";
import { useThemeColors, type ThemeColors } from "@/theme/colors";
import { formatVehicleLabel } from "@/utils/formatVehicleLabel";

type StatusFilter = "all" | string;

const mapStatus = (status?: string) => {
  if (!status) return "pendiente";
  const key = status.toString().toLowerCase();
  if (key.includes("progress") || key.includes("curso") || key.includes("progreso"))
    return "en_progreso";
  if (key.includes("complete") || key.includes("complet")) return "completada";
  if (key.includes("cancel")) return "cancelada";
  return status;
};

export function HistoryScreen() {
  const { routes, vehicles, drivers } = useFleet();
  const { getAllUsers, user } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const canViewHistory =
    !!user?.permissions?.canViewMap || !!user?.permissions?.canCreateRoutes;
  const users = getAllUsers();
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return routes
      .filter(
        (route) =>
          filterStatus === "all" ||
          mapStatus(route.estado) === filterStatus ||
          route.estado?.toString() === filterStatus
      )
      .sort(
        (a, b) =>
          new Date(b.fechaInicio ?? "").getTime() -
          new Date(a.fechaInicio ?? "").getTime()
      );
  }, [routes, filterStatus]);

  const selected = filtered.find((r) => r.id === selectedId) ?? null;
  const vehicleById = useMemo(
    () => new Map(vehicles.map((veh) => [veh.id, veh])),
    [vehicles]
  );
  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers]
  );

  const statusMeta: Record<
    string,
    { color: string; bg: string; label: string; Icon: React.ComponentType<any> }
  > = {
    completada: { color: "#16a34a", bg: "#dcfce7", label: "Completada", Icon: CheckCircle },
    en_progreso: { color: "#2563eb", bg: "#dbeafe", label: "En progreso", Icon: Clock },
    pendiente: { color: "#f59e0b", bg: "#fef3c7", label: "Pendiente", Icon: Clock },
    cancelada: { color: "#b91c1c", bg: "#fee2e2", label: "Cancelada", Icon: XCircle },
  };

  const renderBadge = (status?: string) => {
    const key = mapStatus(status);
    const meta = statusMeta[key] ?? statusMeta.pendiente;
    const Icon = meta.Icon;
    return (
      <View style={[styles.badge, { backgroundColor: meta.bg }]}
        >
        <Icon color={meta.color} size={14} />
        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    );
  };

  const listCount = filtered.length;
  const renderItem = ({
    item,
    index,
  }: {
    item: (typeof filtered)[number];
    index: number;
  }) => {
    const meta = mapStatus(item.estado);
    const vehicleLabel = formatVehicleLabel(
      vehicleById.get(item.vehiculoId),
      item.vehiculoId
    );
    const driver =
      driverById.get(item.conductorId) ?? users.find((u) => u.id === item.conductorId);
    const driverLabel = driver
      ? "firstName" in driver
        ? `${driver.firstName} ${driver.lastName}`.trim()
        : `${(driver as any).nombres ?? ""} ${(driver as any).apellidos ?? ""}`.trim()
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
        <TouchableOpacity
          style={[styles.item, !isLast && styles.itemDivider]}
          onPress={() => setSelectedId(item.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{item.nombre || "Ruta"}</Text>
            <Text style={styles.muted}>
              Vehículo: {vehicleLabel} · Conductor: {driverLabel}
            </Text>
            <Text style={styles.date}>
              Inicio:{" "}
              {item.fechaInicio ? new Date(item.fechaInicio).toLocaleString() : "N/D"}
            </Text>
          </View>
          {renderBadge(meta)}
          <Eye color={colors.textMuted} size={18} />
        </TouchableOpacity>
      </View>
    );
  };

  if (!canViewHistory) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        <Text style={styles.title}>Historial de rutas</Text>
        <Card>
          <Text style={styles.muted}>
            No tienes permisos para ver el historial de rutas.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Historial de rutas</Text>
          <View style={styles.filters}>
            {["all", "en_progreso", "completada", "pendiente", "cancelada"].map((status) => {
              const active = filterStatus === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilterStatus(status as StatusFilter)}
                >
                  <Filter color={active ? colors.primary : colors.textMuted} size={14} />
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {status === "all" ? "Todas" : status.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <Text style={styles.muted}>No hay rutas para el filtro seleccionado.</Text>
        </Card>
      }
      ListFooterComponent={
        selected ? (
          <Card>
            <Text style={styles.detailTitle}>{selected.nombre}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Vehículo</Text>
              <Text style={styles.value}>
                {formatVehicleLabel(
                  vehicleById.get(selected.vehiculoId),
                  selected.vehiculoId
                )}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Conductor</Text>
              <Text style={styles.value}>
                {(() => {
                  const driver =
                    driverById.get(selected.conductorId) ??
                    users.find((u) => u.id === selected.conductorId);
                  if (!driver) return selected.conductorId;
                  if ("firstName" in driver) {
                    return `${driver.firstName} ${driver.lastName}`.trim();
                  }
                  return `${(driver as any).nombres ?? ""} ${(driver as any).apellidos ?? ""}`.trim();
                })()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Carga</Text>
              <Text style={styles.value}>{selected.carga ?? "N/D"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Estado</Text>
              {renderBadge(selected.estado)}
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Inicio</Text>
              <Text style={styles.value}>
                {selected.fechaInicio
                  ? new Date(selected.fechaInicio).toLocaleString()
                  : "N/D"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Fin</Text>
              <Text style={styles.value}>
                {selected.fechaFin
                  ? new Date(selected.fechaFin).toLocaleString()
                  : "N/D"}
              </Text>
            </View>
          </Card>
        ) : (
          <View style={{ height: 4 }} />
        )
      }
    />
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    filters: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    filterChipActive: {
      backgroundColor: colors.chipBg,
      borderColor: colors.chipBorder,
    },
    filterText: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    filterTextActive: {
      color: colors.primary,
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
    item: {
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    itemDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    badgeText: {
      fontWeight: "700",
      textTransform: "capitalize",
    },
    muted: {
      color: colors.textMuted,
    },
    date: {
      color: colors.textSoft,
      marginTop: 4,
    },
    detailTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    label: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    value: {
      color: colors.text,
      fontWeight: "600",
    },
  });
