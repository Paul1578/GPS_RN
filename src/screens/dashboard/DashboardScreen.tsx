import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CalendarClock, Route, Truck, Users } from "lucide-react-native";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";
import { useFleet } from "@/context/FleetContext";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { routes, vehicles } = useFleet();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const permissions = user?.permissions;
  const canViewHistory = !!permissions?.canViewMap || !!permissions?.canCreateRoutes;
  const canManageTeam = !!permissions?.canManageTeam;
  const canViewOwnRoute = !!permissions?.canViewOwnRoute;
  const canCreateRoutes = !!permissions?.canCreateRoutes;

  const activeRoutes = routes.filter((r) => r.estado === "en_progreso").length;
  const completedRoutes = routes.filter((r) => r.estado === "completada").length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Panel</Text>
          <Text style={styles.title}>
            Hola {user?.nombres} {user?.apellidos}
          </Text>
          <Text style={styles.subtitle}>Rol: {user?.role ?? "equipo"}</Text>
        </View>
        {canViewOwnRoute && (
          <Button
            title="Mi ruta"
            variant="secondary"
            onPress={() => navigation.navigate("MiRuta")}
          />
        )}
      </View>

      <View style={styles.grid}>
        <Card style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.icon, { backgroundColor: colors.chipBg }]}>
              <Route color={colors.primary} size={20} />
            </View>
            <Text style={styles.cardValue}>{routes.length}</Text>
          </View>
          <Text style={styles.cardLabel}>Rutas planificadas</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.icon, { backgroundColor: "#e8f5e9" }]}
              >
              <CalendarClock color="#16a34a" size={20} />
            </View>
            <Text style={styles.cardValue}>{activeRoutes}</Text>
          </View>
          <Text style={styles.cardLabel}>En curso</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.icon, { backgroundColor: "#fff4e5" }]}>
              <Truck color="#ea580c" size={20} />
            </View>
            <Text style={styles.cardValue}>{vehicles.length}</Text>
          </View>
          <Text style={styles.cardLabel}>Vehículos</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.icon, { backgroundColor: "#f3e8ff" }]}>
              <Users color="#7c3aed" size={20} />
            </View>
            <Text style={styles.cardValue}>{completedRoutes}</Text>
          </View>
          <Text style={styles.cardLabel}>Completadas</Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.actions}>
          {canViewHistory && (
            <Button
              title="Ver historial"
              variant="secondary"
              onPress={() => navigation.navigate("Historial")}
            />
          )}
          {canManageTeam && (
            <Button
              title="Equipo"
              variant="secondary"
              onPress={() => navigation.navigate("Equipo")}
            />
          )}
          {canCreateRoutes && (
            <Button
              title="Crear ruta"
              onPress={() => navigation.navigate("Rutas")}
            />
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      backgroundColor: colors.surface,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    kicker: {
      textTransform: "uppercase",
      letterSpacing: 3,
      color: colors.textMuted,
      fontWeight: "700",
      fontSize: 12,
      marginBottom: 6,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      color: colors.textMuted,
      marginTop: 4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    card: {
      flex: 1,
      minWidth: "45%",
    },
    cardRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardValue: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.text,
    },
    cardLabel: {
      marginTop: 6,
      color: colors.textMuted,
    },
    icon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
    },
  });
