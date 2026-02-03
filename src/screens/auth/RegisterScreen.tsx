import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { useAuth } from "@/context/AuthContext";
import { notifyError } from "@/utils/notify";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

export function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { register } = useAuth();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [form, setForm] = useState({
    nombres: "",
    apellidos: "",
    usuario: "",
    password: "",
    confirm: "",
    identificacion: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.nombres || !form.apellidos || !form.usuario || !form.password) {
      notifyError("Completa todos los campos");
      return;
    }
    if (form.password !== form.confirm) {
      notifyError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const ok = await register({
      nombres: form.nombres,
      apellidos: form.apellidos,
      usuario: form.usuario,
      password: form.password,
      identificacion: form.identificacion,
    });
    setLoading(false);
    if (!ok) {
      notifyError("No pudimos registrar tu cuenta");
    }
  };

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>Registra tu equipo en pocos pasos</Text>

        <TextField
          label="Nombres"
          value={form.nombres}
          onChangeText={(v) => update("nombres", v)}
          placeholder="Ana"
        />
        <TextField
          label="Apellidos"
          value={form.apellidos}
          onChangeText={(v) => update("apellidos", v)}
          placeholder="Ramírez"
        />
        <TextField
          label="Usuario (correo)"
          value={form.usuario}
          onChangeText={(v) => update("usuario", v)}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="correo@empresa.com"
        />
        <TextField
          label="Identificación (opcional)"
          value={form.identificacion}
          onChangeText={(v) => update("identificacion", v)}
          placeholder="ID / cédula"
        />
        <TextField
          label="Contraseña"
          value={form.password}
          onChangeText={(v) => update("password", v)}
          secureTextEntry
          placeholder="••••••••"
        />
        <TextField
          label="Confirmar contraseña"
          value={form.confirm}
          onChangeText={(v) => update("confirm", v)}
          secureTextEntry
          placeholder="••••••••"
        />
        <Button title="Registrarme" onPress={handleSubmit} loading={loading} />
        <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
          ¿Ya tienes cuenta? Inicia sesión
        </Text>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 600,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      color: colors.textMuted,
      marginBottom: 16,
    },
    link: {
      marginTop: 14,
      color: colors.primary,
      fontWeight: "600",
    },
  });
