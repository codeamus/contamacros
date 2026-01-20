// src/presentation/components/ui/Toast.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastConfig = {
  message: string;
  type?: ToastType;
  duration?: number; // en ms
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
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
  onHide,
  colors,
  typography,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animación de entrada con efecto bounce suave
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHide();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onHide, translateY, opacity, scale]);

  const getIconName = (): React.ComponentProps<
    typeof MaterialCommunityIcons
  >["name"] => {
    if (icon) return icon;
    switch (type) {
      case "success":
        return "check-circle";
      case "error":
        return "alert-circle";
      case "warning":
        return "alert";
      case "info":
        return "information";
      default:
        return "check-circle";
    }
  };

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

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return colors.surface;
      case "error":
        return colors.surface;
      case "warning":
        return colors.surface;
      case "info":
        return colors.surface;
      default:
        return colors.surface;
    }
  };

  // Altura aproximada de la barra de navegación inferior
  const tabBarHeight = Platform.OS === "ios" ? 88 : 70;
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + tabBarHeight + 16,
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
            backgroundColor: getBackgroundColor(),
            borderColor:
              type === "success" ? colors.brand : colors.border,
            borderWidth: type === "success" ? 1.5 : 1,
            shadowColor: colors.textPrimary,
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={getIconName()}
            size={24}
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
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 18,
    maxWidth: "95%",
    minWidth: 120,
    alignSelf: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    marginRight: 12,
    flexShrink: 0,
  },
  message: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    flexShrink: 1,
  },
});
