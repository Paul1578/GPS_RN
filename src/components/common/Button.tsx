import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useThemeColors } from "@/theme/colors";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: ButtonProps) {
  const colors = useThemeColors();
  const palette = getVariantColors(colors, variant);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border },
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: palette.text }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const getVariantColors = (
  colors: ReturnType<typeof useThemeColors>,
  variant: ButtonVariant
) => {
  if (variant === "secondary") {
    return {
      background: colors.secondary,
      text: colors.secondaryText,
      border: colors.borderStrong,
    };
  }
  if (variant === "danger") {
    return {
      background: colors.danger,
      text: colors.dangerText,
      border: colors.dangerText,
    };
  }
  return {
    background: colors.primary,
    text: colors.primaryText,
    border: colors.primary,
  };
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
});
