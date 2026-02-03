import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Shield, UserCheck, UserMinus, Plus, X, Truck } from "lucide-react-native";
import { Card } from "@/components/common/Card";
import { TextField } from "@/components/common/TextField";
import { Button } from "@/components/common/Button";
import { useAuth, UserPermissions, UserRole } from "@/context/AuthContext";
import { useFleet } from "@/context/FleetContext";
import { notify, notifyError } from "@/utils/notify";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

const roles: { id: UserRole; label: string }[] = [
  { id: "superadmin", label: "Super Admin" },
  { id: "gerente", label: "Gerente" },
  { id: "logistica", label: "Logística" },
  { id: "chofer", label: "Chofer" },
];

const permissionLabels: Record<keyof UserPermissions, string> = {
  canViewMap: "Ver Mapa en Tiempo Real",
  canCreateRoutes: "Crear y Gestionar Rutas",
  canManageVehicles: "Gestionar Vehículos",
  canManageTeam: "Gestionar Equipo",
  canViewOwnRoute: "Ver Mi Ruta",
  canAccessSuperAdmin: "Acceso a Panel Super Admin",
  canManageAllOrganizations: "Gestionar Todas las Organizaciones",
  canViewSystemLogs: "Ver Logs del Sistema",
  canExportData: "Exportar Datos del Sistema",
};

export function TeamScreen() {
  const {
    user,
    getTeamUsers,
    refreshTeamUsers,
    updateUserRole,
    updateUserStatus,
    updateUserPermissions,
    createUser,
    isSuperAdmin,
  } = useAuth();
  const {
    drivers,
    vehicles,
    refreshDrivers,
    addDriver,
    assignVehicleToDriver,
    unassignVehicleFromDriver,
  } = useFleet();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateDriver, setShowCreateDriver] = useState(false);
  const [editingPermissionsUserId, setEditingPermissionsUserId] = useState<string | null>(null);
  const [permissionsForm, setPermissionsForm] = useState<UserPermissions>({
    canViewMap: false,
    canCreateRoutes: false,
    canManageVehicles: false,
    canManageTeam: false,
    canViewOwnRoute: false,
    canAccessSuperAdmin: false,
    canManageAllOrganizations: false,
    canViewSystemLogs: false,
    canExportData: false,
  });
  const [createUserForm, setCreateUserForm] = useState({
    nombres: "",
    apellidos: "",
    usuario: "",
    email: "",
    role: "chofer" as UserRole,
    documentNumber: "",
    phoneNumber: "",
  });
  const [createDriverForm, setCreateDriverForm] = useState({
    userId: "",
    firstName: "",
    lastName: "",
    documentNumber: "",
    phoneNumber: "",
  });
  const [assignSelection, setAssignSelection] = useState<Record<string, string>>({});

  const team = getTeamUsers();
  const canManageTeam = !!user?.permissions?.canManageTeam;

  useEffect(() => {
    void refreshTeamUsers();
    void refreshDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choferUsers = useMemo(
    () => team.filter((u) => u.role === "chofer"),
    [team]
  );

  const availableVehicles = useMemo(
    () => vehicles.filter((v) => v.estado === "disponible"),
    [vehicles]
  );

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setLoadingId(userId);
    await updateUserRole(userId, role);
    setLoadingId(null);
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    setLoadingId(userId);
    await updateUserStatus(userId, isActive);
    setLoadingId(null);
  };

  const handleEditPermissions = (userId: string) => {
    const target = team.find((u) => u.id === userId);
    if (!target) return;
    setPermissionsForm(target.permissions);
    setEditingPermissionsUserId(userId);
  };

  const handleSavePermissions = () => {
    if (!editingPermissionsUserId) return;
    updateUserPermissions(editingPermissionsUserId, permissionsForm);
    notify("Permisos actualizados");
    setEditingPermissionsUserId(null);
  };

  const handleCreateUser = async () => {
    if (!createUserForm.nombres || !createUserForm.apellidos || !createUserForm.usuario || !createUserForm.email) {
      notifyError("Completa nombres, apellidos, usuario y correo");
      return;
    }
    if (
      createUserForm.role === "chofer" &&
      (!createUserForm.documentNumber || !createUserForm.phoneNumber)
    ) {
      notifyError("Para chofer indica documento y teléfono");
      return;
    }
    const ok = await createUser({
      nombres: createUserForm.nombres,
      apellidos: createUserForm.apellidos,
      identificacion: createUserForm.documentNumber,
      usuario: createUserForm.usuario,
      email: createUserForm.email,
      role: createUserForm.role,
      teamId: undefined,
      password: "",
    });
    if (!ok) {
      notifyError("No se pudo crear el usuario");
      return;
    }
    await refreshTeamUsers();

    if (createUserForm.role === "chofer") {
      const createdUser = getTeamUsers().find((u) => u.usuario === createUserForm.usuario);
      if (createdUser) {
        const result = await addDriver({
          userId: createdUser.id,
          firstName: createUserForm.nombres,
          lastName: createUserForm.apellidos,
          documentNumber: createUserForm.documentNumber,
          phoneNumber: createUserForm.phoneNumber,
        });
        if (!result.ok) {
          notifyError(result.message ?? "No se pudo crear el chofer");
        } else {
          await refreshDrivers();
        }
      } else {
        notifyError("No se pudo localizar el usuario creado para vincular chofer");
      }
    }

    notify("Usuario creado");
    setShowCreateUser(false);
    setCreateUserForm({
      nombres: "",
      apellidos: "",
      usuario: "",
      email: "",
      role: "chofer",
      documentNumber: "",
      phoneNumber: "",
    });
  };

  const handleCreateDriver = async () => {
    const { userId, firstName, lastName, documentNumber, phoneNumber } = createDriverForm;
    if (!userId || !firstName || !lastName || !documentNumber || !phoneNumber) {
      notifyError("Completa todos los campos del chofer");
      return;
    }
    const result = await addDriver({ userId, firstName, lastName, documentNumber, phoneNumber });
    if (result.ok) {
      notify("Chofer creado");
      setCreateDriverForm({
        userId: "",
        firstName: "",
        lastName: "",
        documentNumber: "",
        phoneNumber: "",
      });
      setShowCreateDriver(false);
      await refreshDrivers();
      return;
    }
    notifyError(result.message ?? "No se pudo crear el chofer");
  };

  if (!canManageTeam) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 14 }}
      >
        <Text style={styles.title}>Equipo</Text>
        <Card>
          <Text style={styles.muted}>
            No tienes permisos para gestionar el equipo.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
    >
      <Text style={styles.title}>Equipo</Text>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.subtitle}>Miembros</Text>
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => setShowCreateUser((prev) => !prev)}
          >
            {showCreateUser ? <X color={colors.primary} size={16} /> : <Plus color={colors.primary} size={16} />}
            <Text style={styles.actionChipText}>
              {showCreateUser ? "Ocultar" : "Nuevo usuario"}
            </Text>
          </TouchableOpacity>
        </View>

        {showCreateUser && (
          <View style={styles.formCard}>
            <TextField
              label="Nombres"
              value={createUserForm.nombres}
              onChangeText={(v) => setCreateUserForm((s) => ({ ...s, nombres: v }))}
            />
            <TextField
              label="Apellidos"
              value={createUserForm.apellidos}
              onChangeText={(v) => setCreateUserForm((s) => ({ ...s, apellidos: v }))}
            />
            <TextField
              label="Usuario"
              value={createUserForm.usuario}
              onChangeText={(v) => setCreateUserForm((s) => ({ ...s, usuario: v }))}
              autoCapitalize="none"
            />
            <TextField
              label="Correo"
              value={createUserForm.email}
              onChangeText={(v) => setCreateUserForm((s) => ({ ...s, email: v }))}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.selectorRow}>
              <Text style={styles.label}>Rol</Text>
              <View style={styles.roleRow}>
                {roles.map((role) => {
                  const active = role.id === createUserForm.role;
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                      onPress={() => setCreateUserForm((s) => ({ ...s, role: role.id }))}
                    >
                      <Text style={[styles.roleText, active && styles.roleTextActive]}>
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {createUserForm.role === "chofer" && (
              <>
                <TextField
                  label="Documento"
                  value={createUserForm.documentNumber}
                  onChangeText={(v) => setCreateUserForm((s) => ({ ...s, documentNumber: v }))}
                />
                <TextField
                  label="Teléfono"
                  value={createUserForm.phoneNumber}
                  onChangeText={(v) => setCreateUserForm((s) => ({ ...s, phoneNumber: v }))}
                />
              </>
            )}
            <Button title="Crear usuario" onPress={handleCreateUser} />
          </View>
        )}

        {team.length === 0 && <Text style={styles.muted}>No hay usuarios aún.</Text>}
        {team.map((member) => {
          const role = roles.find((r) => r.id === member.role);
          const isEditingPermissions = editingPermissionsUserId === member.id;
          return (
            <View key={member.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {member.nombres} {member.apellidos}
                </Text>
                <Text style={styles.muted}>{member.usuario}</Text>
                <View style={styles.row}>
                  <View style={styles.badge}>
                    <Shield color={colors.primary} size={14} />
                    <Text style={styles.badgeText}>{role?.label ?? member.role}</Text>
                  </View>
                  <View style={styles.badge}>
                    {member.isActive ? (
                      <UserCheck color="#16a34a" size={14} />
                    ) : (
                      <UserMinus color="#b91c1c" size={14} />
                    )}
                    <Text
                      style={[
                        styles.badgeText,
                        { color: member.isActive ? "#16a34a" : "#b91c1c" },
                      ]}
                    >
                      {member.isActive ? "Activo" : "Inactivo"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ alignItems: "flex-end", gap: 8 }}>
                {isSuperAdmin() && (
                  <View style={styles.roleRow}>
                    {roles.map((r) => {
                      const active = r.id === member.role;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[styles.roleChip, active && styles.roleChipActive]}
                          onPress={() => handleRoleChange(member.id, r.id)}
                          disabled={loadingId === member.id}
                        >
                          <Text style={[styles.roleText, active && styles.roleTextActive]}>
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <View style={styles.switchRow}>
                  <Text style={styles.muted}>Activo</Text>
                  <Switch
                    value={member.isActive ?? true}
                    onValueChange={(value) => handleStatusChange(member.id, value)}
                  />
                </View>
                {isSuperAdmin() && (
                  <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={() =>
                      isEditingPermissions
                        ? setEditingPermissionsUserId(null)
                        : handleEditPermissions(member.id)
                    }
                  >
                    <Text style={styles.permissionText}>
                      {isEditingPermissions ? "Cerrar permisos" : "Permisos"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {isEditingPermissions && (
                <View style={styles.permissionsBox}>
                  {(Object.keys(permissionLabels) as Array<keyof UserPermissions>).map((key) => (
                    <View key={key} style={styles.permissionRow}>
                      <Text style={styles.permissionLabel}>{permissionLabels[key]}</Text>
                      <Switch
                        value={permissionsForm[key] ?? false}
                        onValueChange={(value) =>
                          setPermissionsForm((prev) => ({ ...prev, [key]: value }))
                        }
                      />
                    </View>
                  ))}
                  <Button title="Guardar permisos" onPress={handleSavePermissions} />
                </View>
              )}
            </View>
          );
        })}
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.subtitle}>Choferes</Text>
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => setShowCreateDriver((prev) => !prev)}
          >
            {showCreateDriver ? <X color={colors.primary} size={16} /> : <Plus color={colors.primary} size={16} />}
            <Text style={styles.actionChipText}>
              {showCreateDriver ? "Ocultar" : "Nuevo chofer"}
            </Text>
          </TouchableOpacity>
        </View>

        {showCreateDriver && (
          <View style={styles.formCard}>
            <View style={styles.selectorRow}>
              <Text style={styles.label}>Usuario (chofer)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {choferUsers.map((userItem) => {
                  const active = userItem.id === createDriverForm.userId;
                  return (
                    <TouchableOpacity
                      key={userItem.id}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                      onPress={() =>
                        setCreateDriverForm((s) => ({
                          ...s,
                          userId: userItem.id,
                          firstName: userItem.nombres,
                          lastName: userItem.apellidos,
                        }))
                      }
                    >
                      <Text style={[styles.roleText, active && styles.roleTextActive]}>
                        {userItem.nombres} {userItem.apellidos}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <TextField
              label="Nombres"
              value={createDriverForm.firstName}
              onChangeText={(v) => setCreateDriverForm((s) => ({ ...s, firstName: v }))}
            />
            <TextField
              label="Apellidos"
              value={createDriverForm.lastName}
              onChangeText={(v) => setCreateDriverForm((s) => ({ ...s, lastName: v }))}
            />
            <TextField
              label="Documento"
              value={createDriverForm.documentNumber}
              onChangeText={(v) => setCreateDriverForm((s) => ({ ...s, documentNumber: v }))}
            />
            <TextField
              label="Teléfono"
              value={createDriverForm.phoneNumber}
              onChangeText={(v) => setCreateDriverForm((s) => ({ ...s, phoneNumber: v }))}
            />
            <Button title="Crear chofer" onPress={handleCreateDriver} />
          </View>
        )}

        {drivers.length === 0 && <Text style={styles.muted}>No hay choferes registrados.</Text>}
        {drivers.map((driver) => {
          const assignedVehicle = vehicles.find((v) => v.id === driver.vehicleId);
          const availableList = assignedVehicle
            ? [assignedVehicle, ...availableVehicles.filter((v) => v.id !== assignedVehicle.id)]
            : availableVehicles;
          return (
            <View key={driver.id} style={styles.driverItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {driver.firstName} {driver.lastName}
                </Text>
                <Text style={styles.muted}>Documento: {driver.documentNumber}</Text>
                <Text style={styles.muted}>Teléfono: {driver.phoneNumber}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Truck color={colors.primary} size={14} />
                    <Text style={styles.badgeText}>
                      {assignedVehicle ? `Vehículo: ${assignedVehicle.placa}` : "Sin vehículo"}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ gap: 8, alignItems: "flex-end" }}>
                {availableList.length > 0 && (
                  <View style={styles.selectorRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {availableList.map((veh) => {
                        const active = (assignSelection[driver.id] ?? driver.vehicleId) === veh.id;
                        return (
                          <TouchableOpacity
                            key={veh.id}
                            style={[styles.roleChip, active && styles.roleChipActive]}
                            onPress={() =>
                              setAssignSelection((prev) => ({ ...prev, [driver.id]: veh.id }))
                            }
                          >
                            <Text style={[styles.roleText, active && styles.roleTextActive]}>
                              {veh.placa}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
                <View style={styles.driverActions}>
                  <Button
                    title="Asignar"
                    onPress={async () => {
                      const vehicleId = assignSelection[driver.id] ?? driver.vehicleId;
                      if (!vehicleId) {
                        notifyError("Selecciona un vehículo");
                        return;
                      }
                      const result = await assignVehicleToDriver(driver.id, vehicleId);
                      if (!result.ok) {
                        notifyError(result.message ?? "No se pudo asignar vehículo");
                      }
                    }}
                  />
                  {driver.vehicleId && (
                    <Button
                      title="Desasignar"
                      variant="secondary"
                      onPress={async () => {
                        const result = await unassignVehicleFromDriver(driver.id);
                        if (!result.ok) {
                          notifyError(result.message ?? "No se pudo desasignar vehículo");
                        }
                      }}
                    />
                  )}
                </View>
              </View>
            </View>
          );
        })}
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
    subtitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    muted: {
      color: colors.textMuted,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    formCard: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    actionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.chipBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    actionChipText: {
      color: colors.primary,
      fontWeight: "700",
    },
    item: {
      flexDirection: "row",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexWrap: "wrap",
    },
    name: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    badgeText: {
      fontWeight: "700",
      color: colors.primary,
    },
    row: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    badgeRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 6,
      flexWrap: "wrap",
    },
    roleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      maxWidth: 280,
      justifyContent: "flex-end",
    },
    roleChip: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    roleChipActive: {
      backgroundColor: colors.chipBg,
      borderColor: colors.chipBorder,
    },
    roleText: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    roleTextActive: {
      color: colors.primary,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    permissionButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    permissionText: {
      color: colors.primary,
      fontWeight: "600",
    },
    permissionsBox: {
      width: "100%",
      marginTop: 10,
      gap: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    permissionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    permissionLabel: {
      flex: 1,
      color: colors.textSoft,
    },
    selectorRow: {
      marginBottom: 12,
      gap: 6,
    },
    label: {
      color: colors.textSoft,
      fontWeight: "600",
    },
    driverItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexWrap: "wrap",
    },
    driverActions: {
      gap: 8,
    },
  });
