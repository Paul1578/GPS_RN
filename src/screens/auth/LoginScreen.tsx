import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { useAuth } from "@/context/AuthContext";
import { notifyError } from "@/utils/notify";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      notifyError("Ingresa tu usuario y contraseña");
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok && result.message) {
      notifyError(result.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>Ingresa para administrar tu flota</Text>
        <TextField
          label="Correo / usuario"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="correo@empresa.com"
        />
        <TextField
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        <Button title="Ingresar" onPress={handleSubmit} loading={loading} />
        <View style={styles.linksRow}>
          <Text style={styles.link} onPress={() => navigation.navigate("Recovery")}>
            ¿Olvidaste tus datos?
          </Text>
          <Text style={styles.link} onPress={() => navigation.navigate("Register")}>
            Crear cuenta
          </Text>
        </View>
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
      marginBottom: 4,
    },
    subtitle: {
      color: colors.textMuted,
      marginBottom: 16,
    },
    linksRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 14,
    },
    link: {
      color: colors.primary,
      fontWeight: "600",
    },
  });
