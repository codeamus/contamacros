// app/(onboarding)/profile.tsx
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useRef, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [height, setHeight] = useState(
    profile?.height_cm ? String(profile.height_cm) : "",
  );
  const [weight, setWeight] = useState(
    profile?.weight_kg ? String(profile.weight_kg) : "",
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Scroll suave para que los inputs queden visibles sobre el teclado
  const scrollToHeight = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 240, animated: true });
    }, 100);
  };
  const scrollToWeight = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 340, animated: true });
    }, 100);
  };

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
      const res = await updateProfile({
        height_cm: heightNum,
        weight_kg: weightNum,
      });

      if (!res.ok) {
        setErr(res.message ?? "No pudimos guardar tu perfil.");
        return;
      }

      router.push("/(onboarding)/result");
    } catch {
      setErr("No pudimos guardar tu perfil.");
    } finally {
      setLoading(false);
    }
  }

  const styles = makeStyles(colors, typography);

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          { top: insets.top + 8 },
          pressed && { opacity: 0.8 },
        ]}
        hitSlop={12}
      >
        <Feather name="arrow-left" size={26} color="#fff" />
      </Pressable>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.safe}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.screen}>
          {/* HERO (idéntico a goal/about/activity) */}
          <View style={styles.heroFrame}>
            <View style={styles.heroHalo} />
            <View style={styles.heroCard}>
              <Image
                source={require("../../assets/images/onboarding/onboarding-4.png")}
                style={styles.heroImage}
                contentFit="contain"
              />
            </View>
          </View>

          <View style={styles.sheetWrap}>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <View style={styles.logoBadge}>
                  <MaterialCommunityIcons
                    name="account"
                    size={22}
                    color={colors.onCta}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kicker}>Onboarding</Text>
                  <Text style={styles.title}>Tu perfil</Text>
                </View>
              </View>

              <Text style={styles.subtitle}>
                Solo necesitamos esto para estimar tus metas diarias.
              </Text>

              <View style={{ gap: 14, marginTop: 16 }}>
                <AuthTextField
                  label="Altura (cm)"
                  value={height}
                  onChangeText={setHeight}
                  placeholder="Ej: 175"
                  keyboardType="numeric"
                  error={heightError}
                  onFocus={scrollToHeight}
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
                  onFocus={scrollToWeight}
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
                    <Feather
                      name="alert-triangle"
                      size={16}
                      color={colors.onCta}
                    />
                    <Text style={styles.alertText}>{err}</Text>
                  </View>
                )}

                <PrimaryButton
                  title="Continuar"
                  onPress={onFinish}
                  loading={loading}
                  disabled={!canFinish}
                />
              </View>
            </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      paddingBottom: 120,
    },
    backButton: {
      position: "absolute",
      left: 16,
      zIndex: 999,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    screen: {
      flex: 1,
      backgroundColor:
        colors.background === "#22C55E"
          ? "rgba(34,197,94,0.95)"
          : colors.background,
    },

    // ✅ EXACTAMENTE igual a goal/about/activity
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

    // ✅ EXACTAMENTE igual a goal/about/activity
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

    alert: {
      marginTop: 10,
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
  });
}
