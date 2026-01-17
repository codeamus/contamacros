// app/(onboarding)/result.tsx
import { StorageKeys } from "@/core/storage/keys";
import { storage } from "@/core/storage/storage";
import { calculateCalorieGoal } from "@/domain/services/calorieGoals";
import { computeMacroTargets } from "@/domain/services/macroTargets";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { activityLabel, goalLabel } from "@/presentation/utils/goalLabel";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Helpers
 */
function round(n: number) {
  return Math.round(n);
}
function fmt(n: number) {
  return new Intl.NumberFormat("es-CL").format(round(n));
}
function goalDbToDomain(goal: string) {
  // DB: "deficit" | "maintain" | "surplus"
  // Dominio: "deficit" | "maintenance" | "surplus"
  if (goal === "maintain") return "maintenance";
  return goal as "deficit" | "maintenance" | "surplus";
}

export default function ResultScreen() {
  const { profile, refreshProfile, updateProfile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Relee perfil al entrar para asegurar datos frescos
  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draft = useMemo(() => {
    if (!profile) return null;

    const gender = (profile as any).gender as "male" | "female" | null;
    const birthDate = (profile as any).birth_date as string | null;
    const activityLevel = (profile as any).activity_level as
      | "sedentary"
      | "light"
      | "moderate"
      | "high"
      | "very_high"
      | null;

    const heightCm = profile.height_cm ?? null;
    const weightKg = profile.weight_kg ?? null;
    const goalDb = profile.goal ?? null;

    if (
      !gender ||
      !birthDate ||
      !activityLevel ||
      !heightCm ||
      !weightKg ||
      !goalDb
    ) {
      return null;
    }

    return {
      gender,
      birthDate,
      activityLevel,
      heightCm,
      weightKg,
      goalType: goalDbToDomain(goalDb),
    };
  }, [profile]);

  const computed = useMemo(() => {
    if (!draft) return null;
    try {
      const res = calculateCalorieGoal(draft, {
        roundTo: 10,
        allowedDeficitAdjustments: [-0.1, -0.15],
        allowedSurplusAdjustments: [0.05, 0.1, 0.15],
      });
      return res;
    } catch (e: any) {
      return { error: e?.message ?? "No pudimos calcular tu objetivo." } as any;
    }
  }, [draft]);

  useEffect(() => {
    if ((computed as any)?.error) setErr((computed as any).error);
  }, [computed]);

  const canConfirm =
    !!draft && !!computed && !(computed as any).error && !loading;

  async function onConfirm() {
    if (!draft || !computed || (computed as any).error) return;

    setErr(null);
    setLoading(true);

    try {
      // 1) Guardar objetivo calórico + ajuste
      const res1 = await updateProfile({
        daily_calorie_target: computed.dailyCalorieTarget,
        goal_adjustment: computed.goalAdjustment,
      } as any);

      if (!res1.ok) {
        setErr(res1.message ?? "No pudimos guardar tu meta calórica.");
        await storage.setJson(StorageKeys.PENDING_PROFILE_SYNC, {
          daily_calorie_target: computed.dailyCalorieTarget,
          goal_adjustment: computed.goalAdjustment,
        });
        return;
      }

      // 2) Calcular macros y guardar
      const macros = computeMacroTargets({
        calories: computed.dailyCalorieTarget,
        weightKg: draft.weightKg,
      });

      const res2 = await updateProfile({
        protein_g: macros.proteinG,
        carbs_g: macros.carbsG,
        fat_g: macros.fatG,
      });

      if (!res2.ok) {
        setErr(res2.message ?? "No pudimos guardar tus macros.");
        await storage.setJson(StorageKeys.PENDING_PROFILE_SYNC, {
          protein_g: macros.proteinG,
          carbs_g: macros.carbsG,
          fat_g: macros.fatG,
        });
        return;
      }

      // 3) Finalizar onboarding
      const res3 = await updateProfile({
        onboarding_completed: true,
      });

      if (!res3.ok) {
        setErr(res3.message ?? "No pudimos finalizar el onboarding.");
        await storage.setJson(StorageKeys.PENDING_PROFILE_SYNC, {
          onboarding_completed: true,
        });
        return;
      }

      // ✅ AuthGate detecta onboarding_completed y hace el redirect.
    } catch {
      setErr("No pudimos completar el onboarding.");
    } finally {
      setLoading(false);
    }
  }

  const styles = makeStyles(colors, typography);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        <View style={styles.screen}>
          {/* HERO (idéntico a las otras pantallas) */}
          <View style={styles.heroFrame}>
            <View style={styles.heroHalo} />
            <View style={styles.heroCard}>
              <Image
                source={require("../../assets/images/onboarding/onboarding-5.png")}
                style={styles.heroImage}
                contentFit="contain"
              />
            </View>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
          >
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.logoBadge}>
                  <MaterialCommunityIcons
                    name="calculator"
                    size={22}
                    color={colors.onCta}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kicker}>Onboarding</Text>
                  <Text style={styles.title}>Tu objetivo diario</Text>
                </View>
              </View>

              <Text style={styles.subtitle}>
                Este valor se calcula con tu cuerpo y tu nivel de actividad. No
                cambia automáticamente.
              </Text>

              {!draft ? (
                <View style={[styles.alert, { marginTop: 16 }]}>
                  <Feather
                    name="alert-triangle"
                    size={16}
                    color={colors.onCta}
                  />
                  <Text style={styles.alertText}>
                    Nos faltan datos para calcular tu objetivo. Vuelve atrás y
                    completa los pasos del onboarding.
                  </Text>
                </View>
              ) : (
                <>
                  {/* KPI */}
                  <View style={styles.kpiBox}>
                    <Text style={styles.kpiLabel}>Meta calórica</Text>
                    <Text style={styles.kpiValue}>
                      {computed && !(computed as any).error
                        ? `${fmt(computed.dailyCalorieTarget)} kcal`
                        : "—"}
                    </Text>
                    <Text style={styles.kpiHint}>
                      Basado en TDEE{" "}
                      {computed && !(computed as any).error
                        ? `${fmt(computed.tdee)} kcal`
                        : "—"}
                    </Text>
                  </View>

                  {/* Pills */}
                  {computed && !(computed as any).error && (
                    <View style={{ gap: 10, marginTop: 14 }}>
                      <Pill
                        icon="user"
                        label={`Edad estimada: ${computed.ageYears} años`}
                        colors={colors}
                        typography={typography}
                      />
                      <Pill
                        icon="activity"
                        label={`Actividad: ${activityLabel(
                          (profile as any)?.activity_level ?? "",
                        )}`}
                        colors={colors}
                        typography={typography}
                      />
                      <Pill
                        icon="target"
                        label={`Objetivo: ${goalLabel(profile?.goal ?? "")}`}
                        colors={colors}
                        typography={typography}
                      />
                    </View>
                  )}
                </>
              )}

              {!!err && (
                <View style={[styles.alert, { marginTop: 14 }]}>
                  <Feather
                    name="alert-triangle"
                    size={16}
                    color={colors.onCta}
                  />
                  <Text style={styles.alertText}>{err}</Text>
                </View>
              )}

              <View style={{ marginTop: 18 }}>
                <PrimaryButton
                  title="Confirmar objetivo"
                  onPress={onConfirm}
                  loading={loading}
                  disabled={!canConfirm}
                />
              </View>

              <Text style={styles.footerNote}>
                Podrás recalcular tu objetivo cuando cambien tus datos.
              </Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({
  icon,
  label,
  colors,
  typography,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  colors: any;
  typography: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.cta,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Feather name={icon} size={16} color={colors.onCta} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: typography.body?.fontFamily,
          fontSize: 13,
          color: colors.textPrimary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    screen: {
      flex: 1,
      backgroundColor:
        colors.background === "#22C55E"
          ? "rgba(34,197,94,0.95)"
          : colors.background,
    },

    // ✅ EXACTAMENTE igual a goal/about/activity/profile
    heroFrame: {
      alignItems: "center",
      marginTop: 28,
      marginBottom: 8,
    },
    heroHalo: {
      position: "absolute",
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: "rgba(34,197,94,0.18)",
    },
    heroCard: {
      width: "86%",
      aspectRatio: 1,
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
    },
    heroImage: {
      width: "100%",
      height: "100%",
      borderRadius: 20,
    },

    // ✅ EXACTAMENTE igual a goal/about/activity/profile
    sheetWrap: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      marginHorizontal: 18,
      marginBottom: 18,
      padding: 18,
      borderRadius: 28,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.14,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
        },
        android: { elevation: 8 },
      }),
    },

    header: { flexDirection: "row", alignItems: "center", gap: 12 },

    logoBadge: {
      width: 46,
      height: 46,
      borderRadius: 18,
      backgroundColor: colors.cta,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    kicker: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      marginBottom: 2,
    },

    title: { ...typography.title, color: colors.textPrimary },

    subtitle: { marginTop: 8, color: colors.textSecondary, ...typography.body },

    kpiBox: {
      marginTop: 16,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "rgba(34,197,94,0.08)",
    },
    kpiLabel: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
    },
    kpiValue: {
      marginTop: 6,
      fontFamily: typography.title?.fontFamily,
      fontSize: 32,
      color: colors.textPrimary,
    },
    kpiHint: {
      marginTop: 4,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    alert: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.cta,
      borderWidth: 1,
      borderColor: colors.border,
    },

    alertText: {
      flex: 1,
      color: colors.onCta,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      lineHeight: 16,
    },

    footerNote: {
      marginTop: 12,
      textAlign: "center",
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
    },
  });
}
