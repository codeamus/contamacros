// app/(tabs)/_layout.tsx
import WeightPredictor from "@/presentation/components/predictor/WeightPredictor";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs, router, useSegments } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

export default function TabsLayout() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const segments = useSegments();
  
  // Detectar si estamos en la pantalla de scan
  const isScanScreen = useMemo(() => {
    return segments.includes("scan");
  }, [segments]);
  
  // Estilos dinámicos
  const addFoodPressableStyle = useMemo(() => ({
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minWidth: 56,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.brand,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    flexDirection: "row" as const,
    gap: 4,
  }), [colors.brand]);
  
  const addFoodLabelStyle = useMemo(() => ({
    fontFamily: typography.body?.fontFamily,
    fontSize: 11,
    fontWeight: "600" as const,
    color: colors.onCta,
    letterSpacing: 0.3,
  }), [typography.body?.fontFamily, colors.onCta]);

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
            title: "Comidas",
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
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="scan" options={{ href: null }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="ranking" options={{ href: null }} />
      </Tabs>
      {/* Predictor Inteligente - Persistente en toda la app (oculto en scan) */}
      {!isScanScreen && <WeightPredictor />}

      {/* Botón Agregar comida - A la misma altura que WeightPredictor (oculto en scan) */}
      {!isScanScreen && (
        <View style={[styles.addFoodButton, { bottom: 100, left: 18 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: "/(tabs)/add-food",
              params: { meal: "snack" },
            });
          }}
          style={({ pressed }) => [
            addFoodPressableStyle,
            pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
          ]}
        >
          <MaterialCommunityIcons
            name="food-apple"
            size={16}
            color={colors.onCta}
          />
          <Text style={addFoodLabelStyle}>
            Agregar Comida
          </Text>
        </Pressable>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addFoodButton: {
    position: "absolute",
    zIndex: 1000,
  },
});
