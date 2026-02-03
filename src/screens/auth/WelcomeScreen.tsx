import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Shield, Sparkles, Users } from "lucide-react-native";
import { Button } from "@/components/common/Button";
import { useTheme, useThemeColors } from "@/theme/colors";

const features = [
  { icon: Users, title: "Facil de usar", description: "Interfaz clara para tu equipo." },
  { icon: Shield, title: "Seguro", description: "Datos protegidos y sesiones seguras." },
  { icon: Sparkles, title: "Flexible", description: "Adapta rutas, vehiculos y roles." },
];

const logo = require("../../../assets/welcome/logo.png");

export function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const { scheme } = useTheme();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const isNarrow = width < 360;
  const isWide = width >= 720;

  const logoWidth = Math.min(Math.round(width * 1.15), 520);
  const logoHeight = Math.round(logoWidth * 0.6);

  const gradientColors: [string, string, ...string[]] =
    scheme === "dark"
      ? ["#0b1220", "#0f172a", "#111827"]
      : ["#e8f1fb", "#ffffff", "#c6ddf5"];

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide && styles.contentWide,
          isNarrow && styles.contentNarrow,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.brandOverlay}>FLEETFLOW</Text>
          <View style={styles.logoBlock}>
            <ImageBackground
              source={logo}
              style={[styles.logoBg, { width: logoWidth, height: logoHeight }]}
              imageStyle={styles.logoImage}
              resizeMode="contain"
            />
            {scheme === "dark" && <View style={styles.logoShade} />}
          </View>
          <Text style={styles.title}>Gestiona tu flota en web y movil</Text>
          <Text style={styles.subtitle}>
            Monitorea rutas, vehiculos y equipo desde un solo lugar.
          </Text>
        </View>

        <View style={[styles.features, isNarrow && styles.featuresStack]}>
          {features.map((item) => (
            <View
              key={item.title}
              style={[styles.featureCard, isNarrow && styles.featureCardStack]}
            >
              <item.icon color={colors.primary} size={18} />
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureText}>{item.description}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button title="Iniciar sesion" onPress={() => navigation.navigate("Login")} />
          <Button
            title="Crear cuenta"
            variant="secondary"
            onPress={() => navigation.navigate("Register")}
          />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    content: {
      flexGrow: 1,
      justifyContent: "space-between",
      gap: 18,
    },
    contentWide: {
      paddingHorizontal: 24,
    },
    contentNarrow: {
      paddingHorizontal: 6,
    },
    hero: {
      gap: 10,
      marginTop: 24,
      position: "relative",
    },
    brandOverlay: {
      textTransform: "uppercase",
      letterSpacing: 3,
      color: colors.primary,
      fontWeight: "700",
      fontSize: 12,
      marginBottom: 6,
    },
    logoBlock: {
      width: "100%",
      alignItems: "center",
      overflow: "visible",
    },
    logoBg: {
      justifyContent: "flex-start",
      alignSelf: "center",
    },
    logoImage: {
      backgroundColor: "transparent",
    },
    logoShade: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "#0b1220",
      opacity: 0.25,
      borderRadius: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
    },
    features: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    featuresStack: {
      flexDirection: "column",
    },
    featureCard: {
      flex: 1,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      gap: 6,
    },
    featureCardStack: {
      width: "100%",
    },
    featureTitle: {
      fontWeight: "700",
      color: colors.text,
    },
    featureText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    actions: {
      marginTop: 10,
      gap: 10,
      marginBottom: 12,
    },
  });
