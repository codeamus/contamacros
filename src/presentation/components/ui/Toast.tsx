// src/presentation/components/ui/Toast.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastConfig = {
  message: string;
  type?: ToastType;
  duration?: number;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  position?: "top" | "bottom"; // ✅ Nueva propiedad opcional
};

type ToastProps = ToastConfig & {
  onHide: () => void;
  colors: any;
  typography: any;
};

export function Toast({
  message,
  type = "success",
  duration = 2500,
  icon,
  position = "top", // ✅ Por defecto arriba para evitar el teclado
  onHide,
  colors,
  typography,
}: ToastProps) {
  const insets = useSafeAreaInsets();

  // Ajustamos la animación inicial según la posición
  const startValue = position === "top" ? -100 : 100;
  const translateY = useRef(new Animated.Value(startValue)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: startValue,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => onHide());
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onHide, startValue]);

  // Lógica de colores (mantenida igual a la tuya)
  const getIconColor = () => {
    switch (type) {
      case "success":
        return colors.brand;
      case "error":
        return "#EF4444";
      case "warning":
        return "#F59E0B";
      case "info":
        return colors.textPrimary;
      default:
        return colors.brand;
    }
  };

  // ✅ Cálculo dinámico de posición
  const positionStyle =
    position === "top"
      ? { top: insets.top + (Platform.OS === "ios" ? 10 : 20) }
      : { bottom: insets.bottom + (Platform.OS === "ios" ? 88 : 70) + 16 };

  return (
    <Animated.View
      style={[
        styles.container,
        positionStyle,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: colors.surface,
            borderColor: type === "success" ? colors.brand : colors.border,
            borderWidth: type === "success" ? 1.5 : 1,
            shadowColor: "#000",
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={
              icon ||
              (type === "success"
                ? "check-circle"
                : type === "error"
                  ? "alert-circle"
                  : "information")
            }
            size={22}
            color={getIconColor()}
          />
        </View>
        <Text
          style={[
            styles.message,
            {
              fontFamily: typography.subtitle?.fontFamily,
              color: colors.textPrimary,
            },
          ]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10000, // Por encima de todo, incluso el header
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: "90%",
    alignSelf: "center",
    // Sombra más sutil y moderna
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  iconContainer: {
    marginRight: 10,
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
});
