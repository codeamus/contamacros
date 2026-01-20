// app/(tabs)/settings.tsx
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme, type ThemeMode } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

type SettingItemProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  colors: any;
  typography: any;
};

const SettingItem = React.memo(function SettingItem({
  icon,
  label,
  value,
  onPress,
  rightElement,
  colors,
  typography,
}: SettingItemProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: onPress ? (pressed ? 0.7 : 1) : 1,
        },
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: `${colors.brand}15`,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={colors.brand}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 15,
            color: colors.textPrimary,
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        {value && (
          <Text
            style={{
              fontFamily: typography.body?.fontFamily,
              fontSize: 13,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {value}
          </Text>
        )}
      </View>

      {rightElement || (
        onPress && (
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        )
      )}
    </Pressable>
  );
});

type ThemeOptionProps = {
  mode: ThemeMode;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  selected: boolean;
  onPress: () => void;
  colors: any;
  typography: any;
};

const ThemeOption = React.memo(function ThemeOption({
  mode,
  label,
  icon,
  selected,
  onPress,
  colors,
  typography,
}: ThemeOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: 16,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected
            ? `${colors.brand}10`
            : colors.surface,
          alignItems: "center",
          gap: 8,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={selected ? colors.brand : colors.textSecondary}
      />
      <Text
        style={{
          fontFamily: typography.subtitle?.fontFamily,
          fontSize: 13,
          color: selected ? colors.brand : colors.textSecondary,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const s = makeStyles(colors, typography);

  const [loading, setLoading] = useState(false);

  const handleThemeChange = useCallback(
    async (mode: ThemeMode) => {
      await setThemeMode(mode);
      showToast({
        message: `Tema cambiado a ${mode === "system" ? "automático" : mode === "light" ? "claro" : "oscuro"}`,
        type: "success",
        duration: 1500,
      });
    },
    [setThemeMode, showToast],
  );

  const onLogout = useCallback(() => {
    setLoading(true);
    signOut().finally(() => {
      setLoading(false);
    });
  }, [signOut]);

  const goalLabel = useMemo(() => {
    if (!profile?.goal) return "—";
    const goalMap: Record<string, string> = {
      deficit: "Déficit calórico",
      maintain: "Mantenimiento",
      surplus: "Superávit calórico",
    };
    return goalMap[profile.goal] || profile.goal;
  }, [profile?.goal]);

  const activityLabel = useMemo(() => {
    if (!profile?.activity_level) return "—";
    const activityMap: Record<string, string> = {
      sedentary: "Sedentario",
      light: "Ligera",
      moderate: "Moderada",
      high: "Alta",
      very_high: "Muy alta",
    };
    return activityMap[profile.activity_level] || profile.activity_level;
  }, [profile?.activity_level]);

  const genderLabel = useMemo(() => {
    if (!profile?.gender) return "—";
    return profile.gender === "male" ? "Masculino" : "Femenino";
  }, [profile?.gender]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerContent}>
            <View style={s.avatarContainer}>
              <MaterialCommunityIcons
                name="account-circle"
                size={56}
                color={colors.brand}
              />
            </View>
            <View style={s.headerText}>
              <Text style={s.headerTitle}>
                {profile?.full_name || profile?.email?.split("@")[0] || "Usuario"}
              </Text>
              <Text style={s.headerSubtitle}>
                {profile?.email || "Sin email"}
              </Text>
            </View>
          </View>
        </View>

        {/* Perfil Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Perfil</Text>
          <View style={s.sectionContent}>
            <SettingItem
              icon="email-outline"
              label="Email"
              value={profile?.email || "—"}
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="target"
              label="Objetivo"
              value={goalLabel}
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="fire"
              label="Meta diaria"
              value={
                profile?.daily_calorie_target
                  ? `${profile.daily_calorie_target} kcal`
                  : "—"
              }
              colors={colors}
              typography={typography}
            />
            {profile?.height_cm && (
              <>
                <View style={{ height: 10 }} />
                <SettingItem
                  icon="human-male-height"
                  label="Altura"
                  value={`${profile.height_cm} cm`}
                  colors={colors}
                  typography={typography}
                />
              </>
            )}
            {profile?.weight_kg && (
              <>
                <View style={{ height: 10 }} />
                <SettingItem
                  icon="scale-bathroom"
                  label="Peso"
                  value={`${profile.weight_kg} kg`}
                  colors={colors}
                  typography={typography}
                />
              </>
            )}
            {profile?.gender && (
              <>
                <View style={{ height: 10 }} />
                <SettingItem
                  icon="gender-male-female"
                  label="Género"
                  value={genderLabel}
                  colors={colors}
                  typography={typography}
                />
              </>
            )}
            {profile?.activity_level && (
              <>
                <View style={{ height: 10 }} />
                <SettingItem
                  icon="run"
                  label="Nivel de actividad"
                  value={activityLabel}
                  colors={colors}
                  typography={typography}
                />
              </>
            )}
          </View>
        </View>

        {/* Preferencias Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Preferencias</Text>
          <View style={s.sectionContent}>
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontFamily: typography.body?.fontFamily,
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginBottom: 12,
                  paddingHorizontal: 4,
                }}
              >
                Tema de la aplicación
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <ThemeOption
                  mode="light"
                  label="Claro"
                  icon="weather-sunny"
                  selected={themeMode === "light"}
                  onPress={() => handleThemeChange("light")}
                  colors={colors}
                  typography={typography}
                />
                <ThemeOption
                  mode="dark"
                  label="Oscuro"
                  icon="weather-night"
                  selected={themeMode === "dark"}
                  onPress={() => handleThemeChange("dark")}
                  colors={colors}
                  typography={typography}
                />
                <ThemeOption
                  mode="system"
                  label="Automático"
                  icon="theme-light-dark"
                  selected={themeMode === "system"}
                  onPress={() => handleThemeChange("system")}
                  colors={colors}
                  typography={typography}
                />
              </View>
            </View>
          </View>
        </View>

        {/* App Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>App</Text>
          <View style={s.sectionContent}>
            <SettingItem
              icon="information-outline"
              label="Versión"
              value="1.0.0"
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="help-circle-outline"
              label="Ayuda y soporte"
              onPress={() => {
                showToast({
                  message: "Próximamente disponible",
                  type: "info",
                  duration: 2000,
                });
              }}
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="shield-check-outline"
              label="Privacidad"
              onPress={() => {
                showToast({
                  message: "Próximamente disponible",
                  type: "info",
                  duration: 2000,
                });
              }}
              colors={colors}
              typography={typography}
            />
          </View>
        </View>

        {/* Cuenta Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cuenta</Text>
          <View style={s.sectionContent}>
            <Pressable
              onPress={onLogout}
              disabled={loading}
              style={({ pressed }) => [
                s.logoutButton,
                {
                  opacity: pressed ? 0.8 : 1,
                  backgroundColor: colors.surface,
                  borderColor: "#EF4444",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="logout"
                size={20}
                color="#EF4444"
              />
              <Text
                style={[
                  s.logoutText,
                  {
                    fontFamily: typography.subtitle?.fontFamily,
                    color: "#EF4444",
                  },
                ]}
              >
                {loading ? "Cerrando sesión..." : "Cerrar sesión"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 18,
    },
    header: {
      marginBottom: 24,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    avatarContainer: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: `${colors.brand}15`,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: `${colors.brand}30`,
    },
    headerText: {
      flex: 1,
      gap: 4,
    },
    headerTitle: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 24,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    headerSubtitle: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    sectionContent: {
      gap: 0,
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 2,
      gap: 10,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: "600",
    },
  });
}
