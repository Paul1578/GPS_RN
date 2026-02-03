import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "theme_preference";

type ThemePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  colors: ThemeColors;
  scheme: "light" | "dark";
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const light = {
  background: "#f6f7fb",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  text: "#0f172a",
  textMuted: "#6b7280",
  textSoft: "#4b5563",
  primary: "#1f4f73",
  primaryText: "#ffffff",
  secondary: "#f4f6fb",
  secondaryText: "#1f2933",
  danger: "#fee2e2",
  dangerText: "#b91c1c",
  chipBg: "#e0ecff",
  chipBorder: "#2563eb",
  inputBg: "#ffffff",
  inputBorder: "#d0d7e2",
  inputText: "#111827",
  placeholder: "#9aa5b1",
  shadow: "#000000",
};

const dark = {
  background: "#0b1220",
  surface: "#111827",
  surfaceAlt: "#0f172a",
  border: "#1f2937",
  borderStrong: "#374151",
  text: "#f9fafb",
  textMuted: "#9ca3af",
  textSoft: "#cbd5f5",
  primary: "#3b82f6",
  primaryText: "#ffffff",
  secondary: "#111827",
  secondaryText: "#e5e7eb",
  danger: "#3f0d12",
  dangerText: "#fecaca",
  chipBg: "#1e293b",
  chipBorder: "#3b82f6",
  inputBg: "#0b1220",
  inputBorder: "#1f2937",
  inputText: "#e5e7eb",
  placeholder: "#94a3b8",
  shadow: "#000000",
};

export type ThemeColors = typeof light;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    let isMounted = true;
    const loadPreference = async () => {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (!isMounted) return;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    };
    void loadPreference();
    return () => {
      isMounted = false;
    };
  }, []);

  const setPreference = (value: ThemePreference) => {
    setPreferenceState(value);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, value);
  };

  const scheme: "light" | "dark" =
    preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;

  const colors = scheme === "dark" ? dark : light;

  const value = useMemo(
    () => ({ colors, scheme, preference, setPreference }),
    [colors, scheme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe ser usado dentro de ThemeProvider");
  }
  return ctx;
};

export const useThemeColors = (): ThemeColors => useTheme().colors;
