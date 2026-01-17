// app/(onboarding)/goal.tsx
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Goal = "deficit" | "maintain" | "surplus";

const goalMeta: Record<
  Goal,
  {
    title: string;
    desc: string;
    icon: React.ComponentProps<typeof Feather>["name"];
  }
> = {
  deficit: {
    title: "Bajar de peso",
    desc: "Déficit calórico",
    icon: "trending-down",
  },
  maintain: {
    title: "Mantener",
    desc: "Mantener tu peso actual",
    icon: "minus",
  },
  surplus: {
    title: "Subir masa muscular",
    desc: "Superávit calórico",
    icon: "trending-up",
  },
};

export default function GoalScreen() {
  const { updateProfile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = useMemo(() => !!goal && !loading, [goal, loading]);

  async function onContinue() {
    if (!goal) return;

    setLoading(true);
    setError(null);

    const res = await updateProfile({ goal });
    if (!res.ok) {
      setError(res.message ?? "No pudimos guardar tu objetivo.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/(onboarding)/about");
  }

  const styles = makeStyles(colors, typography);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        <View style={styles.screen}>
          {/* HERO ILUSTRACIÓN */}
          <View style={styles.heroFrame}>
            <View style={styles.heroHalo} />
            <View style={styles.heroCard}>
              <Image
                source={require("../../assets/images/onboarding/onboarding-1.png")}
                style={styles.heroImage}
                contentFit="contain"
              />
            </View>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
          >
            {/* SHEET CONTENIDO */}
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.logoBadge}>
                  <MaterialCommunityIcons
                    name="target"
                    size={22}
                    color={colors.onCta}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kicker}>Onboarding</Text>
                  <Text style={styles.title}>Elige tu objetivo</Text>
                </View>
              </View>

              <Text style={styles.subtitle}>
                Lo usaremos para calcular tu meta diaria. Podrás cambiarlo
                después.
              </Text>

              {/* Opciones */}
              <View style={{ gap: 12, marginTop: 16 }}>
                {(Object.keys(goalMeta) as Goal[]).map((k) => (
                  <GoalOption
                    key={k}
                    title={goalMeta[k].title}
                    desc={goalMeta[k].desc}
                    icon={goalMeta[k].icon}
                    selected={goal === k}
                    onPress={() => setGoal(k)}
                    colors={colors}
                    typography={typography}
                  />
                ))}
              </View>

              {!!error && (
                <View style={styles.alert}>
                  <Feather
                    name="alert-triangle"
                    size={16}
                    color={colors.onCta}
                  />
                  <Text style={styles.alertText}>{error}</Text>
                </View>
              )}

              <View style={{ marginTop: 18 }}>
                <PrimaryButton
                  title="Continuar"
                  onPress={onContinue}
                  loading={loading}
                  disabled={!canContinue}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalOption({
  title,
  desc,
  icon,
  selected,
  onPress,
  colors,
  typography,
}: {
  title: string;
  desc: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  selected: boolean;
  onPress: () => void;
  colors: any;
  typography: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderWidth: 1,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected ? "rgba(34,197,94,0.12)" : colors.surface,
          borderRadius: 20,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.96 : 1,
          transform: pressed ? [{ scale: 0.995 }] : [],
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.brand : colors.cta,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Feather name={icon} size={18} color={colors.onCta} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 16,
            color: colors.textPrimary,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: typography.body?.fontFamily,
            fontSize: 13,
            color: colors.textSecondary,
          }}
        >
          {desc}
        </Text>
      </View>

      {selected && <Feather name="check" size={18} color={colors.brand} />}
    </Pressable>
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

    /* HERO */
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

    /* SHEET */
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

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

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

    title: {
      ...typography.title,
      color: colors.textPrimary,
    },

    subtitle: {
      marginTop: 8,
      color: colors.textSecondary,
      ...typography.body,
    },

    alert: {
      marginTop: 14,
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
