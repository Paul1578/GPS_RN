import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppNavigator } from "@/navigation/AppNavigator";
import { AuthProvider } from "@/context/AuthContext";
import { FleetProvider } from "@/context/FleetContext";
import { ThemeProvider, useTheme } from "@/theme/colors";

function AppShell() {
  const { scheme, colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <StatusBar
        style={scheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.background}
      />
      <AppNavigator />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <FleetProvider>
              <AppShell />
            </FleetProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
