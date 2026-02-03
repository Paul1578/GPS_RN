import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MapPin, Package, Timer } from "lucide-react-native";
import { Card } from "@/components/common/Card";
import { useAuth } from "@/context/AuthContext";
import { useFleet } from "@/context/FleetContext";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

export function DriverRouteScreen() {
  const { user } = useAuth();
  const canViewOwnRoute = !!user?.permissions?.canViewOwnRoute;
  const { getRoutesByDriver } = useFleet();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const routes = useMemo(() => {
    if (!user?.driverId && !user?.id) return [];
    return getRoutesByDriver(user.driverId ?? user.id);
  }, [getRoutesByDriver, user]);

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

      {routes.length === 0 && (
        <Card>
          <Text style={styles.muted}>No tienes rutas asignadas.</Text>
        </Card>
      )}

      {routes.map((route) => (
        <Card key={route.id} style={{ gap: 8 }}>
          <Text style={styles.routeTitle}>{route.nombre}</Text>
          <View style={styles.row}>
            <MapPin color="#2563eb" size={18} />
            <Text style={styles.value}>
              Origen: {route.origen?.nombre ?? `${route.origen?.lat}, ${route.origen?.lng}`}
            </Text>
          </View>
          <View style={styles.row}>
            <MapPin color="#16a34a" size={18} />
            <Text style={styles.value}>
              Destino: {route.destino?.nombre ?? `${route.destino?.lat}, ${route.destino?.lng}`}
            </Text>
          </View>
          <View style={styles.row}>
            <Package color="#ea580c" size={18} />
            <Text style={styles.value}>{route.carga}</Text>
          </View>
          <View style={styles.row}>
            <Timer color={colors.textMuted} size={18} />
            <Text style={styles.value}>
              Inicio:{" "}
              {route.fechaInicio
                ? new Date(route.fechaInicio).toLocaleString()
                : "Por definir"}
            </Text>
          </View>
        </Card>
      ))}
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
  });
