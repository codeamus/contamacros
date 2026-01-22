// app/(tabs)/_layout.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

export default function TabsLayout() {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textSecondary,

        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 70,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? 26 : 12,
          elevation: 8, // Sombra en Android
          shadowColor: "#000", // Sombra en iOS
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },

        tabBarLabelStyle: {
          fontFamily: typography.body?.fontFamily,
          fontSize: 12,
          fontWeight: "600", // Más bold para mejor legibilidad
        },
      }}
    >
      {/* ✅ Mantener index como redirect, pero NO mostrarlo como tab */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      {/* ✅ Si existe add-food (o cualquier otra screen auxiliar), ocultarla */}
      <Tabs.Screen
        name="add-food"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="home"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, focused, size }) => (
            <Feather
              name="home"
              size={focused ? (size ?? 22) : (size ?? 20)}
              color={focused ? colors.brand : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "Diario",
          tabBarIcon: ({ color, focused, size }) => (
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={focused ? (size ?? 22) : (size ?? 20)}
              color={focused ? colors.brand : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="my-foods"
        options={{
          title: "Mis comidas",
          tabBarIcon: ({ color, focused, size }) => (
            <MaterialCommunityIcons
              name="chef-hat"
              size={focused ? (size ?? 22) : (size ?? 20)}
              color={focused ? colors.brand : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reportes",
          tabBarIcon: ({ color, focused, size }) => (
            <MaterialCommunityIcons
              name="chart-line"
              size={focused ? (size ?? 22) : (size ?? 20)}
              color={focused ? colors.brand : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, focused, size }) => (
            <Feather
              name="settings"
              size={focused ? (size ?? 22) : (size ?? 20)}
              color={focused ? colors.brand : color}
            />
          ),
        }}
      />
      <Tabs.Screen name="scan" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="ranking" options={{ href: null }} />
    </Tabs>
  );
}
