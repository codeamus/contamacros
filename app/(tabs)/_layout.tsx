// app/(tabs)/_layout.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";

export default function TabsLayout() {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  useEffect(() => {
    if (Platform.OS === "android") {
      // Hace que la barra de Android sea transparente y la app se dibuje detrás
      NavigationBar.setPositionAsync("absolute");
      NavigationBar.setBackgroundColorAsync("#00000000"); // Totalmente transparente
      NavigationBar.setButtonStyleAsync("light"); // Para que la 'rayita' sea clara u oscura
    }
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.textPrimary,
          tabBarInactiveTintColor: colors.textSecondary,

          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            // AJUSTE CLAVE:
            height: Platform.OS === "ios" ? 88 : 75, // Un poco más alto para dar margen
            paddingBottom: Platform.OS === "ios" ? 28 : 22, // Sube los textos en Android
            paddingTop: 10,
          },
          tabBarLabelStyle: {
            fontFamily: typography.body?.fontFamily,
            fontSize: 11,
            fontWeight: "600",
            // Un pequeño margen extra para el texto
            marginBottom: Platform.OS === "android" ? 2 : 0,
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
          name="create-food"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="create-recipe"
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
                size={focused ? size ?? 22 : size ?? 20}
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
                size={focused ? size ?? 22 : size ?? 20}
                color={focused ? colors.brand : color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="my-foods"
          options={{
            title: "Mis Comidas",
            tabBarIcon: ({ color, focused, size }) => (
              <MaterialCommunityIcons
                name="chef-hat"
                size={focused ? size ?? 22 : size ?? 20}
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
                size={focused ? size ?? 22 : size ?? 20}
                color={focused ? colors.brand : color}
              />
            ),
          }}
        />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="about-smart-coach-pro" options={{ href: null }} />
        <Tabs.Screen name="scan" options={{ href: null }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="ranking" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
