import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Car, Pencil, Trash2, X } from "lucide-react-native";
import { TextField } from "@/components/common/TextField";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { useFleet, Vehicle } from "@/context/FleetContext";
import { useAuth } from "@/context/AuthContext";
import { notify, notifyError } from "@/utils/notify";
import { useThemeColors, type ThemeColors } from "@/theme/colors";
import { formatVehicleLabel } from "@/utils/formatVehicleLabel";

const estados: Vehicle["estado"][] = ["disponible", "en_ruta", "mantenimiento"];

export function VehiclesScreen() {
  const { user } = useAuth();
  const canManageVehicles = !!user?.permissions?.canManageVehicles;
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useFleet();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({
    placa: "",
    marca: "",
    modelo: "",
    anio: "",
    descripcion: "",
    estado: "disponible" as Vehicle["estado"],
  });
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setForm({
      placa: "",
      marca: "",
      modelo: "",
      anio: "",
      descripcion: "",
      estado: "disponible",
    });
    setEditingVehicle(null);
  };

  const handleSubmit = async () => {
    if (!form.placa || !form.marca || !form.modelo || !form.anio) {
      notifyError("Completa placa, marca, modelo y anio");
      return;
    }
    const anio = Number(form.anio);
    if (!Number.isFinite(anio)) {
      notifyError("El anio debe ser numerico");
      return;
    }
    setLoading(true);
    const result = editingVehicle
      ? await updateVehicle(editingVehicle.id, {
          placa: form.placa,
          marca: form.marca,
          modelo: form.modelo,
          anio,
          descripcion: form.descripcion,
          estado: form.estado,
        })
      : await addVehicle({
          placa: form.placa,
          marca: form.marca,
          modelo: form.modelo,
          anio,
          descripcion: form.descripcion,
          estado: form.estado,
        });
    setLoading(false);
    if (result.ok) {
      notify(editingVehicle ? "Vehiculo actualizado" : "Vehiculo creado");
      resetForm();
    } else if (result.message) {
      notifyError(result.message);
    }
  };

  const startEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setForm({
      placa: vehicle.placa,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      anio: vehicle.anio.toString(),
      descripcion: vehicle.descripcion ?? "",
      estado: vehicle.estado,
    });
  };

  if (!canManageVehicles) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, gap: 14 }}
      >
        <Text style={styles.title}>Vehiculos</Text>
        <Card>
          <Text style={styles.muted}>No tienes permisos para gestionar vehículos.</Text>
        </Card>
      </ScrollView>
    );
  }

  const listCount = vehicles.length;
  const renderVehicle = ({ item, index }: { item: Vehicle; index: number }) => {
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
        <View style={[styles.item, !isLast && styles.itemDivider]}>
          <View style={styles.icon}>
            <Car color={colors.primary} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{formatVehicleLabel(item)}</Text>
            <Text style={styles.muted}>Año: {item.anio}</Text>
            <Text style={styles.badge}>{item.estado}</Text>
          </View>
          <TouchableOpacity onPress={() => startEdit(item)}>
            <Pencil color={colors.primary} size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              const result = await deleteVehicle(item.id);
              if (!result.ok && result.message) {
                notifyError(result.message);
              }
            }}
          >
            <Trash2 color={colors.dangerText} size={18} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={vehicles}
      keyExtractor={(item) => item.id}
      renderItem={renderVehicle}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Vehiculos</Text>
          <Card>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {editingVehicle ? "Editar vehiculo" : "Nuevo vehiculo"}
              </Text>
              {editingVehicle && (
                <TouchableOpacity style={styles.clearButton} onPress={resetForm}>
                  <X color={colors.textMuted} size={16} />
                  <Text style={styles.clearText}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextField
              label="Placa"
              value={form.placa}
              onChangeText={(v) => setForm((s) => ({ ...s, placa: v }))}
            />
            <View style={styles.row}>
              <TextField
                label="Marca"
                value={form.marca}
                onChangeText={(v) => setForm((s) => ({ ...s, marca: v }))}
                style={{ flex: 1 }}
              />
              <TextField
                label="Modelo"
                value={form.modelo}
                onChangeText={(v) => setForm((s) => ({ ...s, modelo: v }))}
                style={{ flex: 1 }}
              />
            </View>
            <TextField
              label="Anio"
              value={form.anio}
              onChangeText={(v) => setForm((s) => ({ ...s, anio: v }))}
              keyboardType="numeric"
            />
            <TextField
              label="Descripcion"
              value={form.descripcion}
              onChangeText={(v) => setForm((s) => ({ ...s, descripcion: v }))}
              multiline
            />
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
                        {estado}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Button
              title={editingVehicle ? "Actualizar" : "Guardar"}
              onPress={handleSubmit}
              loading={loading}
            />
          </Card>

          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Listado</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <Card>
          <Text style={styles.muted}>No hay vehiculos registrados.</Text>
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
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    clearButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    clearText: {
      color: colors.textMuted,
      fontWeight: "600",
    },
    row: {
      flexDirection: "row",
      gap: 10,
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
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
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
    icon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: colors.chipBg,
      alignItems: "center",
      justifyContent: "center",
    },
    name: {
      fontWeight: "700",
      color: colors.text,
    },
    badge: {
      textTransform: "capitalize",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.chipBg,
      color: colors.primary,
      fontWeight: "700",
      alignSelf: "flex-start",
      marginTop: 6,
    },
    muted: {
      color: colors.textMuted,
    },
  });
