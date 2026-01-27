// app/(tabs)/about-smart-coach-pro.tsx
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { useStaggerAnimation } from "@/presentation/hooks/ui/useStaggerAnimation";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const FEATURES = [
  {
    icon: "lightbulb-on-outline" as const,
    title: "¿Qué hace el Smart Coach Pro?",
    body: "Analiza tu progreso del día (calorías y macros vs. tu meta) y te da una recomendación personalizada: qué comer para completar tu déficit o qué ejercicio hacer si te pasaste, usando tu historial y actividad física.",
  },
  {
    icon: "food-apple" as const,
    title: "Cuando te falta llegar a tu meta",
    body: "Prioriza el nutriente que más te falta y sugiere alimentos ideales (tu historial, recetas o base comunitaria), con cantidad sugerida en gramos o unidades.",
  },
  {
    icon: "run" as const,
    title: "Cuando te pasaste de calorías",
    body: "Te sugiere ejercicios concretos y cuántos minutos hacer. Si tienes Apple Health o Health Connect, los tiene en cuenta y te muestra solo el esfuerzo restante.",
  },
  {
    icon: "plus-circle" as const,
    title: "Un toque para agregar",
    body: "Cuando la recomendación es un alimento, lo agregas al diario con un solo toque en «Agregar», sin buscar ni editar porciones.",
  },
] as const;

export default function AboutSmartCoachProScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.85)).current;
  const staggerAnims = useStaggerAnimation(FEATURES.length + 1, 100, 200);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(heroScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
    ]).start();
  }, [heroOpacity, heroScale]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={s.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.title}>Cómo funciona</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          style={[
            s.hero,
            {
              opacity: heroOpacity,
              transform: [{ scale: heroScale }],
            },
          ]}
        >
          <View style={[s.heroIconWrap, { backgroundColor: colors.brand + "18" }]}>
            <MaterialCommunityIcons name="arm-flex" size={44} color={colors.brand} />
          </View>
          <Text style={s.heroTitle}>Smart Coach Pro</Text>
          <Text style={s.heroSubtitle}>
            Tu plan de acción del día, en una tarjeta
          </Text>
        </Animated.View>

        {/* Feature cards */}
        {FEATURES.map((item, index) => {
          const anim = staggerAnims[index];
          if (!anim) return null;
          return (
            <Animated.View
              key={item.title}
              style={[
                s.card,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[s.cardIconWrap, { backgroundColor: colors.brand + "15" }]}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={26}
                  color={colors.brand}
                />
              </View>
              <View style={s.cardText}>
                <Text style={s.cardTitle}>{item.title}</Text>
                <Text style={s.cardBody}>{item.body}</Text>
              </View>
            </Animated.View>
          );
        })}

        {/* CTA block */}
        <Animated.View
          style={[
            s.ctaBlock,
            {
              opacity: staggerAnims[FEATURES.length] ?? staggerAnims[0],
              transform: [
                {
                  translateY: (staggerAnims[FEATURES.length] ?? staggerAnims[0]!).interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[s.ctaCard, { backgroundColor: colors.brand + "12", borderColor: colors.brand + "30" }]}>
            <MaterialCommunityIcons name="crown" size={28} color={colors.brand} />
            <Text style={s.ctaTitle}>Desbloquea todo el potencial</Text>
            <Text style={s.ctaBody}>
              Con ContaMacros Pro ves tu recomendación cada día en Inicio.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPaywallVisible(true);
            }}
            style={({ pressed }) => [
              s.ctaButton,
              { backgroundColor: colors.brand },
              pressed && s.ctaButtonPressed,
            ]}
          >
            <Text style={s.ctaButtonText}>Ver planes Pro</Text>
            <MaterialCommunityIcons name="star" size={20} color={colors.onCta} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={({ pressed }) => [s.ctaButtonSecondary, pressed && { opacity: 0.7 }]}
          >
            <Text style={[s.ctaButtonSecondaryText, { color: colors.textSecondary }]}>Volver al Inicio</Text>
            <MaterialCommunityIcons name="home" size={18} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>
      </ScrollView>

      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => {
          setPaywallVisible(false);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...typography.title,
      fontSize: 20,
      lineHeight: 26,
      color: colors.textPrimary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 48,
    },
    hero: {
      alignItems: "center",
      marginBottom: 28,
    },
    heroIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    heroTitle: {
      ...typography.title,
      fontSize: 28,
      lineHeight: 34,
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 6,
    },
    heroSubtitle: {
      ...typography.body,
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 18,
      borderRadius: 18,
      borderWidth: 1,
      marginBottom: 14,
      gap: 16,
    },
    cardIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    cardText: {
      flex: 1,
      gap: 6,
    },
    cardTitle: {
      ...typography.title,
      fontSize: 17,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    cardBody: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    ctaBlock: {
      marginTop: 12,
      gap: 16,
    },
    ctaCard: {
      padding: 22,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: "center",
      gap: 12,
    },
    ctaTitle: {
      ...typography.title,
      fontSize: 20,
      lineHeight: 26,
      color: colors.textPrimary,
      textAlign: "center",
    },
    ctaBody: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: "center",
    },
    ctaButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
    },
    ctaButtonPressed: {
      opacity: 0.9,
    },
    ctaButtonText: {
      ...typography.subtitle,
      fontSize: 16,
      color: colors.onCta,
    },
    ctaButtonSecondary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
    },
    ctaButtonSecondaryText: {
      ...typography.body,
      fontSize: 15,
    },
  });
}
