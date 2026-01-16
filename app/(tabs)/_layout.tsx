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
        },

        tabBarLabelStyle: {
          fontFamily: typography.body?.fontFamily,
          fontSize: 12,
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
              name={focused ? "home" : "home"}
              size={size ?? 20}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="diary"
        options={{
          title: "Diario",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={size ?? 20}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size ?? 20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
