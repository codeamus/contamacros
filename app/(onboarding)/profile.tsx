// app/(onboarding)/profile.tsx
import { computeMacroTargets } from "@/domain/services/macroTargets";
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
      // 1) Guarda peso/altura + completa onboarding
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
        return;
      }

      router.replace("/(tabs)");
    } catch {
      setErr("No pudimos guardar tu perfil.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Tu perfil</Text>
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
        />

        <AuthTextField
          label="Peso (kg)"
          value={weight}
          onChangeText={setWeight}
          placeholder="Ej: 80"
          keyboardType="numeric"
          error={weightError}
        />

        {!!err && <Text style={styles.error}>{err}</Text>}

        <PrimaryButton
          title="Finalizar"
          onPress={onFinish}
          loading={loading}
          disabled={!canFinish}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, backgroundColor: "#F9FAFB" },
  title: { fontSize: 28, fontWeight: "800", color: "#111827", marginTop: 12 },
  subtitle: { marginTop: 8, color: "#6B7280", fontSize: 14 },
  error: { color: "#EF4444", marginTop: 6 },
});
