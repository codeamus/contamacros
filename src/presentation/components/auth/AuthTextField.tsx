// src/presentation/components/auth/AuthTextField.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React, { useState } from "react";
import {
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

  /** Icono opcional a la izquierda */
  leftIcon?: React.ReactNode;

  /** Icono opcional a la derecha (ej: ojo password) */
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
            borderColor: error
              ? colors.cta
              : focused
              ? colors.brand
              : colors.border,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
          placeholderTextColor={colors.textSecondary}
          {...inputProps}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              fontFamily: typography.body?.fontFamily,
            },
            inputStyle,
          ]}
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
  wrap: {
    gap: 6,
  },

  label: {
    fontSize: 13,
  },

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
  },

  iconLeft: {
    alignItems: "center",
    justifyContent: "center",
  },

  iconRight: {
    alignItems: "center",
    justifyContent: "center",
  },

  error: {
    fontSize: 12,
  },
});
