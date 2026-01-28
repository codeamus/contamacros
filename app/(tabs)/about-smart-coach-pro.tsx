// app/(tabs)/about-smart-coach-pro.tsx
// Landing premium de Smart Coach Pro
import type { DietaryPreferenceDb } from "@/domain/models/profileDb";
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SECTION_PADDING = 20;

const DIETARY_OPTIONS: {
  value: DietaryPreferenceDb;
  label: string;
  icon: "food-steak" | "leaf" | "sprout" | "fish";
}[] = [
  { value: "omnivore", label: "Omnívoro", icon: "food-steak" },
  { value: "vegetarian", label: "Vegetariano", icon: "leaf" },
  { value: "vegan", label: "Vegano", icon: "sprout" },
  { value: "pescatarian", label: "Pescetariano", icon: "fish" },
];

const PILLARS: {
  icon: "brain" | "history" | "robot-confused-outline";
  title: string;
  body: string;
}[] = [
  {
    icon: "brain",
    title: "Inteligencia Contextual",
    body: "No son recetas al azar; es lo que tu cuerpo necesita según lo que ya comiste hoy.",
  },
  {
    icon: "history",
    title: "Tu Historial Primero",
    body: "Priorizamos los alimentos que ya tienes en casa y que te gustan.",
  },
  {
    icon: "robot-confused-outline",
    title: "Ajuste por Chat",
    body: "¿No tienes el ingrediente? ¿Estás en un restaurante? Chatea con la IA y obtén una alternativa al instante.",
  },
];

export default function AboutSmartCoachProScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);
  const { profile, updateProfile } = useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ calorieGap?: string }>();
  const calorieGap =
    params.calorieGap != null
      ? Math.round(Number(params.calorieGap))
      : undefined;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const selectedPreference = (profile?.dietary_preference ??
    null) as DietaryPreferenceDb | null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)/home");
  };

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.background }]}>
        <Text style={s.headerTitle}>Smart Coach Pro</Text>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.7 }]}
          hitSlop={12}
        >
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={colors.textPrimary}
          />
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sección 1: El análisis en tiempo real (solo si hay calorieGap) */}
        {calorieGap != null && calorieGap > 0 && (
          <View style={s.section}>
            <View style={s.gradientCardWrap}>
              <LinearGradient
                colors={[colors.brand + "22", colors.brand + "08"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.gradientCard}
              >
                <View
                  style={[
                    s.gradientCardIconWrap,
                    { backgroundColor: colors.brand + "25" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="target"
                    size={32}
                    color={colors.brand}
                  />
                </View>
                <Text style={s.gradientCardTitle}>
                  Hoy tienes un margen de {calorieGap} kcal
                </Text>
                <Text style={s.gradientCardSubtext}>
                  Sin una estrategia, es fácil perder el progreso. Smart Coach
                  Pro diseña el cierre perfecto de tu día.
                </Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* Sección 2: Personalización - Preferencia alimentaria */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Tu Preferencia Alimentaria</Text>
          <View style={s.chipsRow}>
            {DIETARY_OPTIONS.map((opt) => {
              const isSelected = selectedPreference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={async () => {
                    if (savingPreference || isSelected) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSavingPreference(true);
                    const res = await updateProfile({
                      dietary_preference: opt.value,
                    });
                    setSavingPreference(false);
                    if (res.ok) {
                      showToast({
                        message: `Perfil ${opt.label} guardado. El Coach usará tu dieta para recomendaciones más personalizadas.`,
                        type: "success",
                      });
                    } else {
                      showToast({
                        message: res.message ?? "Error al guardar",
                        type: "error",
                      });
                    }
                  }}
                  disabled={savingPreference}
                  style={[
                    s.chip,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isSelected ? colors.brand : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                    savingPreference && s.chipDisabled,
                  ]}
                >
                  {savingPreference && isSelected ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={opt.icon}
                        size={20}
                        color={isSelected ? colors.brand : colors.textSecondary}
                        style={s.chipIcon}
                      />
                      <Text
                        style={[
                          s.chipLabel,
                          {
                            color: isSelected
                              ? colors.brand
                              : colors.textSecondary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sección 3: Los 3 pilares */}
        <View style={s.section}>
          {PILLARS.map((item) => (
            <View
              key={item.icon}
              style={[s.pillarRow, { borderColor: colors.border }]}
            >
              <View
                style={[
                  s.pillarIconWrap,
                  { backgroundColor: colors.brand + "18" },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={26}
                  color={colors.brand}
                />
              </View>
              <View style={s.pillarText}>
                <Text style={[s.pillarTitle, { color: colors.textPrimary }]}>
                  {item.title}
                </Text>
                <Text style={[s.pillarBody, { color: colors.textSecondary }]}>
                  {item.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Sección 4: Vista previa - Placeholder Pro */}
        <View style={s.section}>
          <View
            style={[
              s.previewCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[s.previewBadge, { backgroundColor: colors.brand + "20" }]}
            >
              <Text style={[s.previewBadgeText, { color: colors.brand }]}>
                EJEMPLO DE SUGERENCIA PRO
              </Text>
            </View>
            <Text style={[s.previewTitle, { color: colors.textPrimary }]}>
              Bowl de Quinoa y Atún
            </Text>
            <View style={s.previewMacros}>
              <Text style={[s.previewMacro, { color: colors.textSecondary }]}>
                P: 30g
              </Text>
              <Text style={[s.previewMacro, { color: colors.textSecondary }]}>
                C: 45g
              </Text>
              <Text style={[s.previewMacro, { color: colors.textSecondary }]}>
                G: 12g
              </Text>
            </View>
          </View>
        </View>

        {/* Footer CTA */}
        <View style={[s.section, s.footerSection]}>
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
            <Text style={[s.ctaButtonText, { color: colors.onCta }]}>
              Obtener Smart Coach Pro
            </Text>
            <MaterialCommunityIcons
              name="crown"
              size={22}
              color={colors.onCta}
            />
          </Pressable>
          <Text style={[s.ctaDisclaimer, { color: colors.textSecondary }]}>
            Cancela en cualquier momento desde tu perfil
          </Text>
        </View>
      </ScrollView>

      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => {
          setPaywallVisible(false);
          router.replace("/(tabs)/home");
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(
  colors: {
    border: string;
    textPrimary: string;
    textSecondary: string;
    surface: string;
    brand: string;
    onCta: string;
  },
  typography: { title: object; subtitle: object; body: object },
) {
  return StyleSheet.create({
    safe: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SECTION_PADDING,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      ...typography.title,
      fontSize: 22,
      lineHeight: 28,
      color: colors.textPrimary,
      flex: 1,
    },
    closeBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
      backgroundColor: "transparent",
    },
    scrollContent: {
      padding: SECTION_PADDING,
      paddingBottom: 48,
    },
    section: {
      marginBottom: SECTION_PADDING,
    },
    footerSection: {
      marginTop: 8,
      marginBottom: 32,
    },

    // Sección 1 - Tarjeta con gradiente
    gradientCardWrap: {
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.brand + "30",
    },
    gradientCard: {
      padding: SECTION_PADDING,
      borderRadius: 20,
    },
    gradientCardIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    gradientCardTitle: {
      ...typography.title,
      fontSize: 20,
      lineHeight: 26,
      color: colors.textPrimary,
      marginBottom: 8,
    },
    gradientCardSubtext: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },

    // Sección 2 - Chips
    sectionTitle: {
      ...typography.subtitle,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      minWidth: 0,
    },
    chipDisabled: {
      opacity: 0.7,
    },
    chipIcon: {
      marginRight: 4,
    },
    chipLabel: {
      ...typography.body,
      fontSize: 13,
      fontWeight: "600",
    },

    // Sección 3 - Pilares
    pillarRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: colors.surface,
      marginBottom: 12,
      gap: 14,
    },
    pillarIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    pillarText: {
      flex: 1,
    },
    pillarTitle: {
      ...typography.subtitle,
      fontSize: 15,
      lineHeight: 20,
      marginBottom: 4,
    },
    pillarBody: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
    },

    // Sección 4 - Vista previa
    previewCard: {
      padding: SECTION_PADDING,
      borderRadius: 18,
      borderWidth: 1,
      position: "relative",
    },
    previewBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 12,
    },
    previewBadgeText: {
      ...typography.subtitle,
      fontSize: 11,
      letterSpacing: 0.5,
    },
    previewTitle: {
      ...typography.title,
      fontSize: 18,
      lineHeight: 24,
      marginBottom: 8,
    },
    previewMacros: {
      flexDirection: "row",
      gap: 16,
    },
    previewMacro: {
      ...typography.body,
      fontSize: 14,
    },

    // Footer CTA
    ctaButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 18,
      paddingHorizontal: 24,
      borderRadius: 16,
    },
    ctaButtonPressed: {
      opacity: 0.9,
    },
    ctaButtonText: {
      ...typography.subtitle,
      fontSize: 17,
      color: colors.onCta,
    },
    ctaDisclaimer: {
      ...typography.body,
      fontSize: 12,
      textAlign: "center",
      marginTop: 12,
      lineHeight: 18,
    },
  });
}
