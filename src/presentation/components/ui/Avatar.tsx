// src/presentation/components/ui/Avatar.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type AvatarProps = {
  avatarUrl: string | null | undefined;
  fullName: string | null | undefined;
  size?: number;
  colors: any;
  typography: any;
};

/**
 * Genera un color basado en el hash del nombre
 */
function generateColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generar colores vibrantes (HSL)
  const hue = Math.abs(hash) % 360;
  // Saturaciones y luminosidades que generen colores bonitos
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60%

  // Convertir HSL a RGB
  const c = ((1 - Math.abs(2 * (lightness / 100) - 1)) * (saturation / 100)) / 100;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness / 100 - c / 2;

  let r = 0, g = 0, b = 0;
  if (hue >= 0 && hue < 60) {
    r = c; g = x; b = 0;
  } else if (hue >= 60 && hue < 120) {
    r = x; g = c; b = 0;
  } else if (hue >= 120 && hue < 180) {
    r = 0; g = c; b = x;
  } else if (hue >= 180 && hue < 240) {
    r = 0; g = x; b = c;
  } else if (hue >= 240 && hue < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const rgb = [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];

  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Obtiene la inicial del nombre
 */
function getInitial(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) return "?";
  const trimmed = name.trim();
  const firstChar = trimmed[0].toUpperCase();
  // Si el nombre tiene múltiples palabras, usar primera letra
  return firstChar;
}

export function Avatar({
  avatarUrl,
  fullName,
  size = 56,
  colors,
  typography,
}: AvatarProps) {
  const hasAvatar = avatarUrl && avatarUrl.trim().length > 0;
  const displayName = fullName || "Usuario";
  const backgroundColor = hasAvatar 
    ? undefined 
    : generateColorFromName(displayName);
  const initial = getInitial(fullName);

  // Si la URL ya incluye un parámetro de tiempo, usarla directamente
  // Si no, agregar parámetro de tiempo para romper el cache
  const avatarUrlWithCacheBust = useMemo(() => {
    if (!hasAvatar || !avatarUrl) return null;
    // Si la URL ya tiene un parámetro de tiempo (viene de Settings), usarla directamente
    if (avatarUrl.includes("?t=") || avatarUrl.includes("&t=")) {
      return avatarUrl;
    }
    // Si no, agregar el parámetro de tiempo
    const separator = avatarUrl.includes("?") ? "&" : "?";
    return `${avatarUrl}${separator}t=${Date.now()}`;
  }, [avatarUrl]);

  if (hasAvatar) {
    return (
      <Image
        source={{ uri: avatarUrlWithCacheBust! }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor || colors.brand,
        },
      ]}
    >
      <Text
        style={[
          styles.initial,
          {
            fontSize: size * 0.4,
            color: "#FFFFFF",
            fontFamily: typography.subtitle?.fontFamily,
            fontWeight: "700",
          },
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  initial: {
    textAlign: "center",
  },
});
