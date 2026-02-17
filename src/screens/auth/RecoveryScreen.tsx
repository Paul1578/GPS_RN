import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { notify, notifyError } from "@/utils/notify";
import { useAuth } from "@/context/AuthContext";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

export function RecoveryScreen() {
  const navigation = useNavigation<any>();
  const { apiFetch } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRecovery = async () => {
    if (!email.trim()) {
      notifyError("Ingresa tu correo");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/Auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        skipAuth: true,
      });
      notify("Si el correo existe, recibirás instrucciones para recuperar el acceso.");
    } catch (error) {
      console.error("Error solicitando recuperación:", error);
      notifyError("No se pudo enviar la solicitud, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Recuperar acceso</Text>
        <Text style={styles.subtitle}>
          Te enviaremos un enlace para restablecer tu contraseña o usuario.
        </Text>
        <TextField
          label="Correo"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="correo@empresa.com"
        />
        <Button title="Enviar instrucciones" onPress={handleRecovery} loading={loading} />
        <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
          Volver al inicio de sesión
        </Text>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 520,
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
