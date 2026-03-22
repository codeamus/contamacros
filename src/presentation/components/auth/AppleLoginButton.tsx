// src/presentation/components/auth/AppleLoginButton.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import * as AppleAuthentication from "expo-apple-authentication";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

type Props = {
  onPress: () => void;
  disabled?: boolean;
};

export default function AppleLoginButton({ onPress, disabled = false }: Props) {
  if (Platform.OS !== "ios") return null;

  const { theme } = useTheme();

  const appleButtonStyle =
    theme.mode === "dark"
      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK;

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={appleButtonStyle}
        cornerRadius={16}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  disabled: {
    opacity: 0.55,
    pointerEvents: "none",
  },
  button: {
    height: 48,
    width: "100%",
  },
});
