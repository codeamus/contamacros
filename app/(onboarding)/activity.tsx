// app/(onboarding)/activity.tsx
import { ActivityLevel } from "@/domain/services/calorieGoals";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
     Animated,
     Easing,
     KeyboardAvoidingView,
     Platform,
     Pressable,
     StyleSheet,
     Text,
     View,
} from "react-native";

const activityMeta: Record<
  ActivityLevel,
  {
    title: string;
    desc: string;
    icon: React.ComponentProps<typeof Feather>["name"];
  }
> = {
  sedentary: {
    title: "Sedentario",
    desc: "Poco o nada de ejercicio",
    icon: "minus-circle",
  },
  light: {
    title: "Ligero",
    desc: "1–3 días por semana",
    icon: "activity",
  },
  moderate: {
    title: "Moderado",
    desc: "3–5 días por semana",
    icon: "trending-up",
  },
  high: {
    title: "Alto",
    desc: "6–7 días por semana",
    icon: "zap",
  },
  very_high: {
    title: "Muy alto",
    desc: "Entrenamiento intenso o físico diario",
    icon: "award",
  },
};

export default function ActivityScreen() {
  const { updateProfile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = useMemo(
    () => !!activity && !loading,
    [activity, loading],
  );

  async function onContinue() {
    if (!activity) return;

    setLoading(true);
    setError(null);

    // ⚠️ Requiere que ProfileDb / tabla tenga: activity_level
    const res = await updateProfile({ activity_level: activity } as any);

    if (!res.ok) {
      setError(res.message ?? "No pudimos guardar tu nivel de actividad.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/(onboarding)/profile");
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons
                name="run"
                size={22}
                color={colors.onCta}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>Onboarding</Text>
              <Text style={styles.title}>Actividad</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Esto ajusta tu gasto diario estimado (TDEE).
          </Text>

          <View style={{ gap: 12, marginTop: 18 }}>
            {(Object.keys(activityMeta) as ActivityLevel[]).map((k) => (
              <ActivityOption
                key={k}
                title={activityMeta[k].title}
                desc={activityMeta[k].desc}
                icon={activityMeta[k].icon}
                selected={activity === k}
                onPress={() => setActivity(k)}
                colors={colors}
                typography={typography}
              />
            ))}
          </View>

          {!!error && (
            <View style={styles.alert}>
              <Feather name="alert-triangle" size={16} color={colors.onCta} />
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
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ActivityOption({
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
          borderRadius: 16,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.95 : 1,
          transform: pressed ? [{ scale: 0.995 }] : [],
        },
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.brand : colors.cta,
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
      marginTop: 14,
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
