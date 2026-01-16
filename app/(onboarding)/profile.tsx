// app/(onboarding)/profile.tsx
import { StorageKeys } from "@/core/storage/keys";
import { storage } from "@/core/storage/storage";
import { computeMacroTargets } from "@/domain/services/macroTargets";
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

function toIntSafe(s: string) {
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : NaN;
}
function toFloatSafe(s: string) {
  const normalized = s.replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export default function ProfileScreen() {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [height, setHeight] = useState(
    profile?.height_cm ? String(profile.height_cm) : ""
  );
  const [weight, setWeight] = useState(
    profile?.weight_kg ? String(profile.weight_kg) : ""
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const heightNum = useMemo(() => toIntSafe(height), [height]);
  const weightNum = useMemo(() => toFloatSafe(weight), [weight]);

  const heightError = useMemo(() => {
    if (!height.trim()) return "Ingresa tu altura (cm)";
    if (!Number.isFinite(heightNum)) return "Altura inválida";
    if (heightNum < 120 || heightNum > 230)
      return "Usa un valor entre 120 y 230";
    return null;
  }, [height, heightNum]);

  const weightError = useMemo(() => {
    if (!weight.trim()) return "Ingresa tu peso (kg)";
    if (!Number.isFinite(weightNum)) return "Peso inválido";
    if (weightNum < 30 || weightNum > 250) return "Usa un valor entre 30 y 250";
    return null;
  }, [weight, weightNum]);

  const canFinish = !heightError && !weightError;

  async function onFinish() {
    setErr(null);
    if (!canFinish) return;

    setLoading(true);
    try {
      // 1) guarda altura/peso + marca onboarding completo
      const res1 = await updateProfile({
        height_cm: heightNum,
        weight_kg: weightNum,
        onboarding_completed: true,
      });

      if (!res1.ok) {
        setErr(res1.message ?? "No pudimos guardar tu perfil.");
        return;
      }

      const p = await refreshProfile();
      if (!p?.daily_calorie_target) {
        setErr("No encontramos tu meta calórica. Intenta nuevamente.");
        return;
      }

      // 2) calcula macros y guarda
      const macros = computeMacroTargets({
        calories: p.daily_calorie_target,
        weightKg: weightNum,
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

      // ✅ No hacemos router.replace a tabs.
      // AuthGate detecta onboarding_completed y te manda a (tabs).
    } catch {
      setErr("No pudimos guardar tu perfil.");
    } finally {
      setLoading(false);
    }
  }

  // Animación de entrada
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const styles = makeStyles(colors, typography);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons
                name="account"
                size={22}
                color={colors.onCta}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>Onboarding</Text>
              <Text style={styles.title}>Tu perfil</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Solo necesitamos esto para estimar tus metas diarias.
          </Text>

          <View style={{ gap: 14, marginTop: 18 }}>
            <AuthTextField
              label="Altura (cm)"
              value={height}
              onChangeText={setHeight}
              placeholder="Ej: 175"
              keyboardType="numeric"
              error={heightError}
              leftIcon={
                <Feather
                  name="arrow-up"
                  size={18}
                  color={colors.textSecondary}
                />
              }
            />

            <AuthTextField
              label="Peso (kg)"
              value={weight}
              onChangeText={setWeight}
              placeholder="Ej: 80"
              keyboardType="numeric"
              error={weightError}
              leftIcon={
                <Feather
                  name="activity"
                  size={18}
                  color={colors.textSecondary}
                />
              }
            />

            {!!err && (
              <View style={styles.alert}>
                <Feather name="alert-triangle" size={16} color={colors.onCta} />
                <Text style={styles.alertText}>{err}</Text>
              </View>
            )}

            <PrimaryButton
              title="Finalizar"
              onPress={onFinish}
              loading={loading}
              disabled={!canFinish}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      padding: 18,
      justifyContent: "center",
      backgroundColor:
        colors.background === "#22C55E"
          ? "rgba(34,197,94,0.95)"
          : colors.background,
    },

    card: {
      padding: 18,
      borderRadius: 24,
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
        android: { elevation: 7 },
        default: {},
      }),
    },

    header: { flexDirection: "row", alignItems: "center", gap: 12 },

    logoBadge: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.cta,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    brand: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      marginBottom: 2,
    },

    title: { ...typography.title, color: colors.textPrimary },

    subtitle: { marginTop: 8, color: colors.textSecondary, ...typography.body },

    alert: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.cta,
    },

    alertText: {
      flex: 1,
      color: colors.onCta,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      lineHeight: 16,
    },
  });
}
