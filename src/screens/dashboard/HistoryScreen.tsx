import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Eye, Filter, XCircle, CheckCircle, Clock } from "lucide-react-native";
import { Card } from "@/components/common/Card";
import { useFleet } from "@/context/FleetContext";
import { useAuth } from "@/context/AuthContext";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

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
  const { routes } = useFleet();
  const { getAllUsers, user } = useAuth();
  const colors = useThemeColors();
  const styles = getStyles(colors);
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
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

      <Card>
        {filtered.length === 0 && (
          <Text style={styles.muted}>No hay rutas para el filtro seleccionado.</Text>
        )}
        {filtered.map((route) => {
          const driver = users.find((u) => u.id === route.conductorId);
          const meta = mapStatus(route.estado);
          return (
            <TouchableOpacity
              key={route.id}
              style={styles.item}
              onPress={() => setSelectedId(route.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{route.nombre || "Ruta"}</Text>
                <Text style={styles.muted}>
                  Vehículo: {route.vehiculoId} · Conductor:{" "}
                  {driver ? `${driver.nombres} ${driver.apellidos}` : route.conductorId}
                </Text>
                <Text style={styles.date}>
                  Inicio:{" "}
                  {route.fechaInicio
                    ? new Date(route.fechaInicio).toLocaleString()
                    : "N/D"}
                </Text>
              </View>
              {renderBadge(meta)}
              <Eye color={colors.textMuted} size={18} />
            </TouchableOpacity>
          );
        })}
      </Card>

      {selected && (
        <Card>
          <Text style={styles.detailTitle}>{selected.nombre}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Vehículo</Text>
            <Text style={styles.value}>{selected.vehiculoId}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Conductor</Text>
            <Text style={styles.value}>{selected.conductorId}</Text>
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
      )}
    </ScrollView>
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
    item: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
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
