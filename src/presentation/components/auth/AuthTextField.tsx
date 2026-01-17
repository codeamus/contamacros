// src/presentation/components/auth/AuthTextField.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string | null;

  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPressRightIcon?: () => void;

  containerStyle?: any;
  inputStyle?: any;
} & Omit<TextInputProps, "value" | "onChangeText">;

export default function AuthTextField({
  label,
  value,
  onChangeText,
  error,
  leftIcon,
  rightIcon,
  onPressRightIcon,
  containerStyle,
  inputStyle,
  ...inputProps
}: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.cta
    : focused
      ? colors.brand
      : colors.border;

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text
        style={[
          styles.label,
          {
            color: colors.textSecondary,
            fontFamily: typography.subtitle?.fontFamily,
          },
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surface,
            borderColor,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.brand}
          autoCapitalize={inputProps.autoCapitalize ?? "none"}
          underlineColorAndroid="transparent"
          importantForAutofill="yes"
          {...inputProps}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              fontFamily: typography.body?.fontFamily,
              backgroundColor: "transparent", // ✅ crítico
              // ✅ crítico: asegura que el texto se vea incluso con overlay iOS
              lineHeight: 18,
              paddingVertical: 0,
            },
            inputStyle,
          ]}
          // ✅ reduce glitches de iOS autofill
          textContentType={inputProps.textContentType}
          autoComplete={inputProps.autoComplete as any}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {rightIcon && (
          <Pressable
            onPress={onPressRightIcon}
            hitSlop={10}
            style={styles.iconRight}
          >
            {rightIcon}
          </Pressable>
        )}
      </View>

      {!!error && (
        <Text
          style={[
            styles.error,
            {
              color: colors.cta,
              fontFamily: typography.body?.fontFamily,
            },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },

  label: { fontSize: 13 },

  inputWrap: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },

  input: {
    flex: 1,
    fontSize: 14,
    includeFontPadding: false, // Android
    ...(Platform.OS === "android"
      ? { textAlignVertical: "center" as const }
      : null),
  },

  iconLeft: { alignItems: "center", justifyContent: "center" },
  iconRight: { alignItems: "center", justifyContent: "center" },

  error: { fontSize: 12 },
});
