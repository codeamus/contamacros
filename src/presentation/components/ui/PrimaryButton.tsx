// src/presentation/components/ui/PrimaryButton.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;

  /** Icono opcional (ej: <Feather name="log-in" size={18} />) */
  icon?: React.ReactNode;
};

export default function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  testID,
  icon,
}: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.cta,
          borderColor: colors.border,
        },
        isDisabled && styles.btnDisabled,
        pressed && !isDisabled && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onCta} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: colors.onCta,
                fontFamily: typography.subtitle?.fontFamily,
              },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  btnDisabled: {
    opacity: 0.55,
  },

  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  text: {
    fontSize: 16,
    lineHeight: 20,
  },
});
