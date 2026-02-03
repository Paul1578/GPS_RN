import { useState } from "react";
import { StyleSheet, Text, View, Switch, ScrollView } from "react-native";
import { Shield, UserCircle, Lock, Moon } from "lucide-react-native";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { useAuth } from "@/context/AuthContext";
import { notify, notifyError } from "@/utils/notify";
import { useTheme, useThemeColors, type ThemeColors } from "@/theme/colors";

export function ProfileScreen() {
  const { user, logout, logoutAll, changePassword } = useAuth();
  const { preference, setPreference } = useTheme();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  if (!user) return null;

  const permissionLabels = {
    canViewMap: "Ver Mapa en Tiempo Real",
    canCreateRoutes: "Crear y Gestionar Rutas",
    canManageVehicles: "Gestionar Vehículos",
    canManageTeam: "Gestionar Equipo",
    canViewOwnRoute: "Ver Mi Ruta",
    canAccessSuperAdmin: "Acceso a Panel Super Admin",
    canManageAllOrganizations: "Gestionar Todas las Organizaciones",
    canViewSystemLogs: "Ver Logs del Sistema",
    canExportData: "Exportar Datos del Sistema",
  } as const;

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      notifyError("Completa todos los campos de contraseña");
      return;
    }
    if (newPassword.length < 8) {
      notifyError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      notifyError("Las contraseñas no coinciden");
      return;
    }
    if (currentPassword === newPassword) {
      notifyError("La nueva contraseña no puede ser igual a la actual");
      return;
    }
    setLoadingPassword(true);
    const result = await changePassword(currentPassword, newPassword, confirmNewPassword);
    setLoadingPassword(false);
    if (result.ok) {
      notify("Contraseña actualizada. Inicia sesión nuevamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowPasswordForm(false);
      await logout();
    } else {
      notifyError(result.message ?? "No se pudo cambiar la contraseña");
    }
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    notify("Cerraste sesión en todos los dispositivos");
  };

  const isDark = preference === "dark";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Mi perfil</Text>

      <Card style={{ gap: 12 }}>
        <View style={styles.row}>
          <UserCircle color={colors.primary} size={26} />
          <View>
            <Text style={styles.name}>
              {user.nombres} {user.apellidos}
            </Text>
            <Text style={styles.muted}>{user.usuario}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Shield color="#2563eb" size={20} />
          <Text style={styles.badge}>{user.role}</Text>
        </View>

        {user.teamName && (
          <View style={styles.row}>
            <Text style={styles.label}>Equipo</Text>
            <Text style={styles.value}>{user.teamName}</Text>
          </View>
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={styles.sectionHeader}>
          <View style={styles.row}>
            <Moon color={colors.textMuted} size={18} />
            <Text style={styles.sectionTitle}>Modo oscuro</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(value) => setPreference(value ? "dark" : "light")}
          />
        </View>
        <Text style={styles.helperText}>
          Cambia el tema de la app. Se guarda en este dispositivo.
        </Text>
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={styles.sectionHeader}>
          <View style={styles.row}>
            <Lock color={colors.textMuted} size={18} />
            <Text style={styles.sectionTitle}>Seguridad</Text>
          </View>
          <Button
            title={showPasswordForm ? "Ocultar" : "Cambiar contraseña"}
            variant="secondary"
            onPress={() => setShowPasswordForm((prev) => !prev)}
          />
        </View>
        {showPasswordForm && (
          <View style={{ gap: 10 }}>
            <TextField
              label="Contraseña actual"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextField
              label="Nueva contraseña"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextField
              label="Confirmar nueva contraseña"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
            />
            <Button
              title={loadingPassword ? "Actualizando..." : "Actualizar contraseña"}
              onPress={handleChangePassword}
              disabled={loadingPassword}
            />
            <Button
              title="Cerrar sesión en todos los dispositivos"
              variant="secondary"
              onPress={handleLogoutAll}
            />
          </View>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={styles.sectionTitle}>Permisos</Text>
        {Object.entries(permissionLabels).map(([key, label]) => (
          <View key={key} style={styles.permissionRow}>
            <Text style={styles.permissionLabel}>{label}</Text>
            <Text style={styles.permissionValue}>
              {user.permissions?.[key as keyof typeof user.permissions] ? "Sí" : "No"}
            </Text>
          </View>
        ))}
      </Card>

      <Button title="Cerrar sesión" variant="secondary" onPress={logout} />
      <Button title="Cerrar sesión en todos" variant="danger" onPress={handleLogoutAll} />
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
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    name: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    muted: {
      color: colors.textMuted,
    },
    badge: {
      textTransform: "capitalize",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.chipBg,
      color: colors.primary,
      fontWeight: "700",
    },
    label: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    value: {
      color: colors.text,
      fontWeight: "700",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    permissionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    permissionLabel: {
      color: colors.textSoft,
      flex: 1,
    },
    permissionValue: {
      color: colors.text,
      fontWeight: "700",
    },
  });
