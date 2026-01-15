import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export default function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  testID,
}: Props) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        isDisabled && styles.btnDisabled,
        pressed && !isDisabled && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827", // negro suave
  },
  btnPressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  btnDisabled: { opacity: 0.55 },
  text: { color: "white", fontSize: 16, fontWeight: "600" },
});
