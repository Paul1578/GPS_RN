import { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useThemeColors } from "@/theme/colors";

interface TextFieldProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, helperText, error, style, ...props }, ref) => {
    const colors = useThemeColors();
    return (
      <View style={styles.container}>
        {label && <Text style={[styles.label, { color: colors.textSoft }]}>{label}</Text>}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              borderColor: colors.inputBorder,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
            },
            style,
            error ? styles.inputError : undefined,
            props.multiline ? styles.multiline : undefined,
          ]}
          placeholderTextColor={colors.placeholder}
          {...props}
        />
        {error ? (
          <Text style={[styles.error, { color: colors.dangerText }]}>{error}</Text>
        ) : helperText ? (
          <Text style={[styles.helper, { color: colors.textMuted }]}>{helperText}</Text>
        ) : null}
      </View>
    );
  }
);

TextField.displayName = "TextField";

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  helper: {
    marginTop: 6,
    fontSize: 12,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
  },
  inputError: {
    borderColor: "#fda4af",
    backgroundColor: "#fff1f2",
  },
});
