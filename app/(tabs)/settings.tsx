// app/(tabs)/settings.tsx
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme, type ThemeMode } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  calculateCalorieGoal,
} from "@/domain/services/calorieGoals";
import type { GoalDb } from "@/domain/models/profileDb";
import { computeMacroTargets } from "@/domain/services/macroTargets";

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
  const { profile, signOut, updateProfile, refreshProfile } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const s = makeStyles(colors, typography, insets);

  const [loading, setLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [weightInput, setWeightInput] = useState("");

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

  const handleUpdateGoal = useCallback(
    async (newGoal: GoalDb) => {
      if (!profile) return;

      setUpdating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        // Convertir "maintain" a "maintenance" para el cálculo
        const goalForCalc = newGoal === "maintain" ? "maintenance" : newGoal;
        
        // Recalcular calorías con el nuevo objetivo
        const calorieResult = calculateCalorieGoal({
          gender: profile.gender || "male",
          birthDate: profile.birth_date || "1990-01-01",
          heightCm: profile.height_cm || 170,
          weightKg: profile.weight_kg || 70,
          activityLevel: profile.activity_level || "moderate",
          goalType: goalForCalc as GoalType,
          goalAdjustment: profile.goal_adjustment,
        });

        // Recalcular macros
        const macros = computeMacroTargets({
          calories: calorieResult.dailyCalorieTarget,
          weightKg: profile.weight_kg || 70,
        });

        // Actualizar perfil (convertir "maintenance" a "maintain" para la DB)
        const goalForDb = newGoal === "maintenance" ? "maintain" : newGoal;
        const res = await updateProfile({
          goal: goalForDb as any,
          daily_calorie_target: calorieResult.dailyCalorieTarget,
          protein_g: macros.proteinG,
          carbs_g: macros.carbsG,
          fat_g: macros.fatG,
        });

        if (!res.ok) {
          showToast({
            message: res.message || "No se pudo actualizar el objetivo",
            type: "error",
            duration: 3000,
          });
          return;
        }

        await refreshProfile();
        setShowGoalModal(false);
        showToast({
          message: "Objetivo actualizado correctamente",
          type: "success",
          duration: 2000,
        });
      } catch (error: any) {
        showToast({
          message: error.message || "Error al actualizar el objetivo",
          type: "error",
          duration: 3000,
        });
          } finally {
        setUpdating(false);
      }
    },
    [profile, updateProfile, refreshProfile, showToast],
  );

  const handleUpdateWeight = useCallback(async () => {
    if (!profile) return;

    const weightNum = parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 300) {
      showToast({
        message: "Ingresa un peso válido (1-300 kg)",
        type: "error",
        duration: 2000,
      });
      return;
    }

    setUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Recalcular calorías con el nuevo peso
      const calorieResult = calculateCalorieGoal({
        gender: profile.gender || "male",
        birthDate: profile.birth_date || "1990-01-01",
        heightCm: profile.height_cm || 170,
        weightKg: weightNum,
          activityLevel: profile.activity_level || "moderate",
          goalType: (profile.goal === "maintain" ? "maintenance" : (profile.goal as GoalType)) || "maintenance",
          goalAdjustment: profile.goal_adjustment,
        });

      // Recalcular macros con el nuevo peso
      const macros = computeMacroTargets({
        calories: calorieResult.dailyCalorieTarget,
        weightKg: weightNum,
      });

      // Actualizar perfil
      const res = await updateProfile({
        weight_kg: weightNum,
        daily_calorie_target: calorieResult.dailyCalorieTarget,
        protein_g: macros.proteinG,
        carbs_g: macros.carbsG,
        fat_g: macros.fatG,
      });

      if (!res.ok) {
        showToast({
          message: res.message || "No se pudo actualizar el peso",
          type: "error",
          duration: 3000,
        });
        return;
      }

      await refreshProfile();
      setShowWeightModal(false);
      setWeightInput("");
      showToast({
        message: "Peso actualizado correctamente",
        type: "success",
        duration: 2000,
      });
    } catch (error: any) {
      showToast({
        message: error.message || "Error al actualizar el peso",
        type: "error",
        duration: 3000,
      });
    } finally {
      setUpdating(false);
    }
  }, [profile, weightInput, updateProfile, refreshProfile, showToast]);

  const goalLabel = useMemo(() => {
    if (!profile?.goal) return "—";
    const goalMap: Record<string, string> = {
      deficit: "Déficit calórico",
      maintain: "Mantenimiento",
      maintenance: "Mantenimiento",
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
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowGoalModal(true);
              }}
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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setWeightInput(profile.weight_kg.toString());
                    setShowWeightModal(true);
                  }}
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

      {/* Modal para editar objetivo */}
      <Modal
        visible={showGoalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setShowGoalModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.modalContent}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Cambiar objetivo</Text>
                <Pressable
                  onPress={() => setShowGoalModal(false)}
                  style={({ pressed }) => [
                    s.modalCloseBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={s.modalBody}>
                <Text style={s.modalDescription}>
                  Selecciona tu nuevo objetivo. Se recalcularán automáticamente
                  tus calorías y macros diarios.
                </Text>

                <View style={s.goalOptions}>
                  {(
                    [
                      { value: "deficit", label: "Déficit calórico", icon: "trending-down" },
                      { value: "maintain", label: "Mantenimiento", icon: "trending-neutral" },
                      { value: "surplus", label: "Superávit calórico", icon: "trending-up" },
                    ] as const
                  ).map((option) => {
                    // Comparar con ambos valores posibles (maintain/maintenance)
                    const isSelected = profile?.goal === option.value || 
                      (option.value === "maintain" && profile?.goal === "maintenance");
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => handleUpdateGoal(option.value as GoalDb)}
                        disabled={updating || isSelected}
                        style={({ pressed }) => [
                          s.goalOption,
                          isSelected && s.goalOptionSelected,
                          (updating || isSelected) && { opacity: pressed ? 0.8 : 1 },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={option.icon as any}
                          size={24}
                          color={isSelected ? colors.brand : colors.textSecondary}
                        />
                        <Text
                          style={[
                            s.goalOptionText,
                            isSelected && s.goalOptionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected && (
                          <Feather
                            name="check"
                            size={18}
                            color={colors.brand}
                            style={{ marginLeft: "auto" }}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {updating && (
                  <View style={s.modalLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={s.modalLoadingText}>
                      Actualizando objetivos...
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal para editar peso */}
      <Modal
        visible={showWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWeightModal(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setShowWeightModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.modalContent}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Actualizar peso</Text>
                <Pressable
                  onPress={() => {
                    setShowWeightModal(false);
                    setWeightInput("");
                  }}
                  style={({ pressed }) => [
                    s.modalCloseBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={s.modalBody}>
                <Text style={s.modalDescription}>
                  Ingresa tu peso actual. Se recalcularán automáticamente tus
                  calorías y macros diarios.
                </Text>

                <View style={s.weightInputContainer}>
                  <TextInput
                    style={s.weightInput}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    placeholder="Ej: 75.5"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <Text style={s.weightInputLabel}>kg</Text>
                </View>

                {updating ? (
                  <View style={s.modalLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={s.modalLoadingText}>Actualizando...</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleUpdateWeight}
                    style={({ pressed }) => [
                      s.modalSaveBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={s.modalSaveBtnText}>Guardar</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any, insets: any) {
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
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 20,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    modalBody: {
      padding: 20,
      gap: 20,
    },
    modalDescription: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    goalOptions: {
      gap: 12,
    },
    goalOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    goalOptionSelected: {
      borderColor: colors.brand,
      backgroundColor: `${colors.brand}10`,
    },
    goalOptionText: {
      flex: 1,
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 15,
      color: colors.textSecondary,
    },
    goalOptionTextSelected: {
      color: colors.brand,
      fontWeight: "600",
    },
    weightInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    weightInput: {
      flex: 1,
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 18,
      color: colors.textPrimary,
    },
    weightInputLabel: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 16,
      color: colors.textSecondary,
    },
    modalSaveBtn: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    modalSaveBtnText: {
      fontFamily: typography.subtitle?.fontFamily,
    fontSize: 16,
      color: colors.onCta,
      fontWeight: "600",
    },
    modalLoading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 16,
    },
    modalLoadingText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
}
