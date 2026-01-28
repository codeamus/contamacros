// app/smart-coach-pro.tsx
// Pantalla Smart Coach Pro a pantalla completa (fuera de tabs: sin tab bar ni FAB)
import {
  askSmartCoach,
  type SmartCoachRefinementContext,
} from "@/data/ai/geminiService";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import {
  genericFoodsRepository,
  type GenericFoodDb,
} from "@/data/food/genericFoodsRepository";
import type {
  CalorieRecommendation,
  MacroRecommendation,
} from "@/domain/models/smartCoach";
import Skeleton from "@/presentation/components/ui/Skeleton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTodaySummary } from "@/presentation/hooks/diary/useTodaySummary";
import { useHealthSync } from "@/presentation/hooks/health/useHealthSync";
import { useSmartCoachPro } from "@/presentation/hooks/smartCoach/useSmartCoachPro";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useSmartCoachRecommendationStore } from "@/presentation/state/smartCoachRecommendationStore";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const PAGE_PADDING = 20;
/** Margen inferior cuando no hay tab bar (pantalla completa) */
const BOTTOM_MARGIN = 32;

/** Colores pastel para macros (P / C / G) */
const MACRO_PROTEIN = "#A7F3D0";
const MACRO_CARBS = "#BFDBFE";
const MACRO_FAT = "#FDE68A";

function getMomentOfDayLabel(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "DESAYUNO";
  if (hour >= 11 && hour < 15) return "ALMUERZO";
  if (hour >= 15 && hour < 19) return "MERIENDA";
  return "CENA";
}

function getMealByHour(): "breakfast" | "lunch" | "dinner" | "snack" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 19) return "snack";
  return "dinner";
}

function getValidExerciseIcon(
  iconName: string | null | undefined,
): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  if (!iconName) return "run";
  const iconMap: Record<
    string,
    React.ComponentProps<typeof MaterialCommunityIcons>["name"]
  > = {
    droplet: "water",
    zap: "lightning-bolt",
    walking: "walk",
    run: "run",
    activity: "dumbbell",
    flower: "flower",
    bike: "bike",
  };
  return iconMap[iconName.toLowerCase()] ?? "run";
}

export default function SmartCoachProScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);
  const scrollBottomPadding = insets.bottom + BOTTOM_MARGIN;
  const recommendation = useSmartCoachRecommendationStore(
    (state) => state.recommendation,
  );
  const successCaloriesBurned = useSmartCoachRecommendationStore(
    (state) => state.successCaloriesBurned,
  );
  const clearRecommendation = useSmartCoachRecommendationStore(
    (state) => state.clearRecommendation,
  );
  const setRecommendation = useSmartCoachRecommendationStore(
    (state) => state.setRecommendation,
  );
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { totals } = useTodaySummary();
  const { isPremium: revenueCatPremium } = useRevenueCat();
  const profilePremium = profile?.is_premium ?? false;
  const isPremium = revenueCatPremium || profilePremium;
  const { caloriesBurned } = useHealthSync(isPremium);

  const caloriesTarget = profile?.daily_calorie_target ?? 0;
  const proteinTarget = profile?.protein_g ?? 0;
  const carbsTarget = profile?.carbs_g ?? 0;
  const fatTarget = profile?.fat_g ?? 0;
  const effectiveTargetForCoach =
    caloriesTarget <= 0
      ? caloriesTarget
      : isPremium && caloriesBurned > 0
        ? caloriesTarget + caloriesBurned
        : caloriesTarget;

  const smartCoach = useSmartCoachPro(
    profile,
    effectiveTargetForCoach,
    totals.calories,
    totals.protein,
    totals.carbs,
    totals.fat,
    isPremium,
  );

  /** Gaps calculados desde resumen del día (para KPIs y prioridad de vista éxito) */
  const summaryGaps = {
    calorie: Math.max(0, effectiveTargetForCoach - totals.calories),
    protein: Math.max(0, proteinTarget - totals.protein),
    carbs: Math.max(0, carbsTarget - totals.carbs),
    fat: Math.max(0, fatTarget - totals.fat),
  };
  const hasSignificantDeficit =
    summaryGaps.protein > 10 ||
    summaryGaps.carbs > 10 ||
    summaryGaps.fat > 10 ||
    summaryGaps.calorie > 10;

  const hasTargets =
    caloriesTarget > 0 && proteinTarget > 0 && carbsTarget > 0 && fatTarget > 0;

  /** Usuario sin registros hoy: KPIs muestran meta total y mensaje de bienvenida */
  const isBlankDay =
    totals.calories < 20 &&
    totals.protein < 5 &&
    totals.carbs < 5 &&
    totals.fat < 5;

  const prevDietaryPref = useRef(profile?.dietary_preference ?? null);

  const [refining, setRefining] = useState(false);
  const [chatText, setChatText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  /** Mensaje de fallback de Gemini cuando no encuentra alimento exacto */
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const coldStartAttemptedRef = useRef(false);
  const chatScrollRef = useRef<ScrollView>(null);

  const hookRecommendation = smartCoach.recommendation;
  useEffect(() => {
    if (recommendation !== null) return;
    if (hookRecommendation != null) setRecommendation(hookRecommendation);
  }, [recommendation, hookRecommendation, setRecommendation]);

  // Al cambiar preferencia alimentaria: limpiar recomendación actual y forzar nueva búsqueda
  const reloadCoach = smartCoach.reload;
  useEffect(() => {
    const current = profile?.dietary_preference ?? null;
    if (prevDietaryPref.current !== current) {
      prevDietaryPref.current = current;
      clearRecommendation();
      reloadCoach();
    }
  }, [profile?.dietary_preference, clearRecommendation, reloadCoach]);

  useFocusEffect(
    useCallback(() => {
      if (recommendation != null || successCaloriesBurned != null) return;
      if (!isPremium) router.replace("/(tabs)/home");
    }, [recommendation, successCaloriesBurned, isPremium]),
  );

  // Fallback de arranque en frío: Premium sin recomendación -> buscar en generic_foods y forzar una
  useEffect(() => {
    if (recommendation != null || !isPremium || smartCoach.loading) return;
    if (coldStartAttemptedRef.current) return;

    coldStartAttemptedRef.current = true;

    const moment = getMomentOfDayLabel();
    const dietary = profile?.dietary_preference ?? null;

    const tagsByContext: string[] =
      moment === "DESAYUNO"
        ? dietary === "vegan" || dietary === "vegetarian"
          ? ["fruit", "carb", "carbohidrato"]
          : ["protein", "proteina", "fruit"]
        : moment === "ALMUERZO"
          ? dietary === "vegan"
            ? ["carb", "carbohidrato", "protein"]
            : ["protein", "proteina"]
          : moment === "MERIENDA"
            ? ["fruit", "carb", "snack"]
            : ["protein", "proteina"];

    (async () => {
      try {
        let list: GenericFoodDb[] = [];
        const byTags = await genericFoodsRepository.searchByTags(
          tagsByContext,
          15,
        );
        if (byTags.ok && byTags.data.length > 0) list = byTags.data;
        if (list.length === 0) {
          const all = await genericFoodsRepository.getAllForSmartSearch();
          if (all.ok && all.data.length > 0) list = all.data;
        }
        const food =
          list.find(
            (f: GenericFoodDb) =>
              f.kcal_100g != null &&
              f.kcal_100g > 0 &&
              f.protein_100g != null &&
              f.carbs_100g != null &&
              f.fat_100g != null,
          ) ?? list[0];
        if (!food?.kcal_100g || food.kcal_100g <= 0) return;
        const targetKcal = Math.max(
          200,
          Math.min(600, effectiveTargetForCoach / 4),
        );
        let amount = Math.round((targetKcal * 100) / food.kcal_100g);
        amount = Math.max(50, Math.min(500, amount));
        const rec: CalorieRecommendation = {
          type: "calorie",
          message:
            "¡Bienvenido a Pro! Como es tu primer día, he seleccionado esta opción balanceada para empezar.",
          recommendedFood: {
            name: food.name_es,
            source: "generic",
            protein_100g: food.protein_100g ?? 0,
            carbs_100g: food.carbs_100g ?? 0,
            fat_100g: food.fat_100g ?? 0,
            kcal_100g: food.kcal_100g,
            recommendedAmount: amount,
            unitLabel: food.unit_label_es ?? undefined,
          },
          calorieGap: Math.round(effectiveTargetForCoach),
        };
        setRecommendation(rec);
      } catch (e) {
        console.warn("[SmartCoachPro] Cold start fallback error:", e);
        coldStartAttemptedRef.current = false;
      }
    })();
  }, [
    recommendation,
    isPremium,
    smartCoach.loading,
    profile?.dietary_preference,
    effectiveTargetForCoach,
    setRecommendation,
  ]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearRecommendation();
    router.replace("/(tabs)/home");
  }, [clearRecommendation]);

  const handleQuickAdd = useCallback(async () => {
    if (!recommendation || recommendation.type === "exercise") return;
    const food = recommendation.recommendedFood;
    const day = todayStrLocal();
    const meal = getMealByHour();
    const grams = food.recommendedAmount;
    const factor = grams / 100;
    const calories = Math.round(food.kcal_100g * factor);
    const protein = Math.round(food.protein_100g * factor);
    const carbs = Math.round(food.carbs_100g * factor);
    const fat = Math.round(food.fat_100g * factor);

    setIsAdding(true);
    try {
      const res = await foodLogRepository.create({
        day,
        meal,
        name: food.name,
        grams,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        source: null,
        off_id: null,
        source_type: null,
        food_id: null,
        user_food_id: null,
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({ message: `¡${food.name} agregado!`, type: "success" });
        await new Promise((r) => setTimeout(r, 300));
        clearRecommendation();
        router.replace("/(tabs)/home");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast({
          message: res.message ?? "Error al guardar",
          type: "error",
        });
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({ message: "Error al agregar la comida", type: "error" });
    } finally {
      setIsAdding(false);
    }
  }, [recommendation, clearRecommendation, showToast]);

  const handleSendRefinement = useCallback(async () => {
    const trimmed = chatText.trim();
    if (!trimmed || refining) return;
    const rec = recommendation;
    if (!rec || rec.type === "exercise" || !("recommendedFood" in rec)) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFallbackMessage(null);
    setRefining(true);
    setChatText("");

    const food = rec.recommendedFood;
    const calorieGap =
      rec.type === "macro"
        ? rec.macroGaps.calories.gap
        : rec.type === "calorie"
          ? rec.calorieGap
          : 0;
    const proteinGap = rec.type === "macro" ? rec.macroGaps.protein.gap : 0;
    const carbsGap = rec.type === "macro" ? rec.macroGaps.carbs.gap : 0;
    const fatGap = rec.type === "macro" ? rec.macroGaps.fat.gap : 0;

    const context: SmartCoachRefinementContext = {
      calorieGap,
      proteinGap,
      carbsGap,
      fatGap,
      currentFoodName: food.name,
      currentMessage: rec.message,
      userMessage: trimmed,
      dietaryPreference: profile?.dietary_preference ?? null,
    };

    try {
      const result = await askSmartCoach(context);

      if (result.type === "food") {
        setFallbackMessage(null);
        const recommendedFood = {
          name: result.name,
          source: "generic" as const,
          protein_100g: result.protein_100g,
          carbs_100g: result.carbs_100g,
          fat_100g: result.fat_100g,
          kcal_100g: result.kcal_100g,
          recommendedAmount: result.recommendedAmount,
          unitLabel: result.unitLabel,
          ingredients: result.ingredients?.length
            ? result.ingredients
            : undefined,
          instructions: result.instructions?.length
            ? result.instructions
            : undefined,
          image_description: result.image_description,
          image_search_term: result.image_search_term,
        };
        const newRec: MacroRecommendation | CalorieRecommendation =
          rec.type === "macro"
            ? {
                type: "macro",
                priorityMacro: rec.priorityMacro,
                message: result.message || `Alternativa: ${result.name}.`,
                recommendedFood,
                macroGaps: rec.macroGaps,
              }
            : {
                type: "calorie",
                message: result.message || `Alternativa: ${result.name}.`,
                recommendedFood,
                calorieGap,
              };
        setRecommendation(newRec);
      } else {
        setFallbackMessage(
          result.message ||
            "No encontré algo exacto en tu historial, pero basándome en tus metas, ¿qué te parece intentar otra opción que se ajuste a lo que tienes?",
        );
      }
    } catch (error) {
      console.error(error);
      setFallbackMessage(
        "No encontré algo exacto en tu historial, pero basándome en tus metas, ¿qué te parece intentar otra opción que se ajuste a lo que tienes?",
      );
    } finally {
      setRefining(false);
    }
  }, [
    chatText,
    refining,
    recommendation,
    profile?.dietary_preference,
    setRecommendation,
  ]);

  const bgColor = colors.background;

  // Vista "éxito": solo si NO hay recomendación activa y NO hay déficit significativo (prioridad a comida)
  const showSuccessView =
    !recommendation &&
    successCaloriesBurned != null &&
    successCaloriesBurned > 0 &&
    !hasSignificantDeficit;

  if (showSuccessView) {
    return (
      <SafeAreaView
        style={[s.safe, { backgroundColor: bgColor }]}
        edges={["top", "bottom"]}
      >
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>
            Smart Coach Pro
          </Text>
          <View style={s.backBtn} />
        </View>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: scrollBottomPadding, flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <View
            style={[
              s.card,
              s.successCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={s.successIconWrap}>
              <MaterialCommunityIcons
                name="check-circle"
                size={40}
                color="#10B981"
              />
            </View>
            <Text style={[s.successTitle, { color: colors.textPrimary }]}>
              Coach Pro
            </Text>
            <Text style={[s.whyBody, { color: colors.textPrimary }]}>
              ¡Excelente! Tu actividad física de hoy (
              {successCaloriesBurned.toLocaleString()} kcal quemadas) ha
              compensado tu balance calórico. Mantén este ritmo.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              clearRecommendation();
              router.replace("/(tabs)/home");
            }}
            style={({ pressed }) => [
              s.quickAddButton,
              { backgroundColor: colors.brand },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={[s.quickAddText, { color: colors.onCta }]}>
              Volver al Inicio
            </Text>
          </Pressable>
          <View style={{ height: scrollBottomPadding }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Sin recomendación: Premium siempre ve spinner (nunca pantalla vacía); no premium redirect
  if (!recommendation) {
    if (isPremium) {
      return (
        <SafeAreaView
          style={[s.safe, { backgroundColor: bgColor }]}
          edges={["top", "bottom"]}
        >
          <View style={[s.header, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.textPrimary}
              />
            </Pressable>
            <Text style={[s.headerTitle, { color: colors.textPrimary }]}>
              Smart Coach Pro
            </Text>
            <View style={s.backBtn} />
          </View>
          <Text style={[s.planLabel, { color: colors.textSecondary }]}>
            PLAN PARA TU {getMomentOfDayLabel()}
          </Text>
          {hasTargets && (
            <View style={s.kpiRow}>
              <View
                style={[
                  s.kpiCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="fire"
                  size={16}
                  color={colors.brand}
                />
                <Text
                  style={[
                    s.kpiValue,
                    s.kpiValueSmall,
                    { color: colors.textPrimary },
                  ]}
                >
                  {summaryGaps.calorie}
                </Text>
                <Text style={[s.kpiLabel, { color: colors.textSecondary }]}>
                  {isBlankDay ? "meta kcal" : "kcal rest."}
                </Text>
              </View>
              <View
                style={[
                  s.kpiCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="arm-flex"
                  size={16}
                  color={colors.brand}
                />
                <Text
                  style={[
                    s.kpiValue,
                    s.kpiValueSmall,
                    { color: colors.textPrimary },
                  ]}
                >
                  {summaryGaps.protein}
                </Text>
                <Text style={[s.kpiLabel, { color: colors.textSecondary }]}>
                  {isBlankDay ? "meta prot." : "prot. falt."}
                </Text>
              </View>
              <View
                style={[
                  s.kpiCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="water-percent"
                  size={16}
                  color={colors.brand}
                />
                <Text
                  style={[
                    s.kpiValue,
                    s.kpiValueSmall,
                    { color: colors.textPrimary },
                  ]}
                >
                  {summaryGaps.fat}
                </Text>
                <Text style={[s.kpiLabel, { color: colors.textSecondary }]}>
                  g Grasas
                </Text>
              </View>
            </View>
          )}
          <View
            style={[
              s.scrollContent,
              {
                padding: PAGE_PADDING,
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <ActivityIndicator size="large" color={colors.brand} />
            <Text
              style={[
                s.optimizingLabel,
                { color: colors.textSecondary, marginTop: 16 },
              ]}
            >
              Calculando tu recomendación...
            </Text>
          </View>
        </SafeAreaView>
      );
    }
    return null;
  }

  if (recommendation.type === "exercise") {
    const firstExercise = recommendation.exercises[0];
    return (
      <SafeAreaView
        style={[s.safe, { backgroundColor: bgColor }]}
        edges={["top", "bottom"]}
      >
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>
            Smart Coach Pro
          </Text>
          <View style={s.backBtn} />
        </View>
        <Text style={[s.planLabel, { color: colors.textSecondary }]}>
          PLAN DE EJERCICIO
        </Text>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: scrollBottomPadding, flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <View
            style={[
              s.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={s.exerciseIconWrap}>
              <MaterialCommunityIcons
                name={getValidExerciseIcon(firstExercise?.exercise?.icon_name)}
                size={32}
                color={colors.cta}
              />
            </View>
            <Text
              style={[
                s.whyBody,
                { color: colors.textPrimary, marginBottom: 16 },
              ]}
            >
              {recommendation.message}
            </Text>
            {recommendation.activityCaloriesBurned != null &&
              recommendation.activityCaloriesBurned > 0 && (
                <View style={s.activityRow}>
                  <MaterialCommunityIcons
                    name="heart-pulse"
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      s.whyBody,
                      { color: colors.textSecondary, marginBottom: 0 },
                    ]}
                  >
                    Ya quemaste {recommendation.activityCaloriesBurned} kcal hoy
                    con actividad física
                  </Text>
                </View>
              )}
            <View style={s.exerciseList}>
              {recommendation.exercises.map(({ exercise, minutesNeeded }) => (
                <View
                  key={exercise.id}
                  style={[s.exerciseItem, { borderColor: colors.border }]}
                >
                  <MaterialCommunityIcons
                    name={getValidExerciseIcon(exercise.icon_name)}
                    size={22}
                    color={colors.brand}
                  />
                  <Text
                    style={[s.exerciseItemText, { color: colors.textPrimary }]}
                  >
                    {exercise.name_es}: {Math.round(minutesNeeded)} min
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              clearRecommendation();
              router.replace("/(tabs)/home");
            }}
            style={({ pressed }) => [
              s.quickAddButton,
              { backgroundColor: colors.brand },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={[s.quickAddText, { color: colors.onCta }]}>
              Entendido
            </Text>
          </Pressable>
          <View style={{ height: scrollBottomPadding }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const food = recommendation.recommendedFood;
  const factor = food.recommendedAmount / 100;
  const caloriesPill = Math.round(food.kcal_100g * factor);
  const proteinG = Math.round(food.protein_100g * factor);
  const carbsG = Math.round(food.carbs_100g * factor);
  const fatG = Math.round(food.fat_100g * factor);
  const momentLabel = getMomentOfDayLabel();

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: bgColor }]}
      edges={["top", "bottom"]}
    >
      <View style={s.mainContainer}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>
            Smart Coach Pro
          </Text>
          <View style={s.backBtn} />
        </View>
        <ScrollView
          ref={chatScrollRef}
          style={s.scroll}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: scrollBottomPadding, flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={true}
        >
          <Text style={[s.planLabel, { color: colors.textSecondary }]}>
            PLAN PARA TU {momentLabel}
          </Text>

          {/* KPIs: meta del día (sin registros) o restantes (con registros) */}
          <View style={s.kpiRow}>
            <View
              style={[
                s.kpiCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="fire"
                size={16}
                color={colors.brand}
              />
              <Text
                style={[
                  s.kpiValue,
                  s.kpiValueSmall,
                  { color: colors.textPrimary },
                ]}
              >
                {(() => {
                  const valor = isBlankDay
                    ? effectiveTargetForCoach
                    : recommendation.type === "macro"
                      ? recommendation.macroGaps.calories.gap
                      : recommendation.calorieGap;
                  return valor || (hasTargets ? effectiveTargetForCoach : 0);
                })()}
              </Text>
              <Text style={[s.kpiLabel, { color: colors.textSecondary }]}>
                {isBlankDay ? "meta kcal" : "kcal rest."}
              </Text>
            </View>
            <View
              style={[
                s.kpiCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="arm-flex"
                size={16}
                color={colors.brand}
              />
              <Text
                style={[
                  s.kpiValue,
                  s.kpiValueSmall,
                  { color: colors.textPrimary },
                ]}
              >
                {(() => {
                  const valor = isBlankDay
                    ? proteinTarget
                    : recommendation.type === "macro"
                      ? recommendation.macroGaps.protein.gap
                      : 0;
                  return valor || (hasTargets ? proteinTarget : 0);
                })()}
              </Text>
              <Text style={[s.kpiLabel, { color: colors.textSecondary }]}>
                {isBlankDay ? "meta prot." : "prot. falt."}
              </Text>
            </View>
            <View
              style={[
                s.kpiCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="water-percent"
                size={16}
                color={colors.brand}
              />
              <Text
                style={[
                  s.kpiValue,
                  s.kpiValueSmall,
                  { color: colors.textPrimary },
                ]}
              >
                {(() => {
                  if (isBlankDay) return fatTarget;
                  if (recommendation.type !== "macro") return "—";
                  return (
                    recommendation.macroGaps.fat.gap ||
                    (hasTargets ? fatTarget : 0)
                  );
                })()}
              </Text>
              <Text style={[s.kpiLabel, { color: colors.textSecondary }]}>
                g Grasas
              </Text>
            </View>
          </View>

          {/* Tarjeta de comida */}
          <View
            style={[
              s.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: refining ? 0.5 : 1,
              },
            ]}
          >
            {refining ? (
              <View style={s.skeletonCardInner}>
                <Skeleton
                  width="70%"
                  height={22}
                  radius={6}
                  bg={colors.border}
                />
                <View style={s.macroPills}>
                  <Skeleton
                    width={100}
                    height={36}
                    radius={14}
                    bg={colors.border}
                  />
                  <Skeleton
                    width={90}
                    height={36}
                    radius={14}
                    bg={colors.border}
                  />
                  <Skeleton
                    width={95}
                    height={36}
                    radius={14}
                    bg={colors.border}
                  />
                </View>
                <Skeleton
                  width="30%"
                  height={14}
                  radius={4}
                  bg={colors.border}
                />
                <Skeleton
                  width="100%"
                  height={14}
                  radius={4}
                  bg={colors.border}
                  style={{ marginTop: 8 }}
                />
                <Skeleton
                  width="85%"
                  height={14}
                  radius={4}
                  bg={colors.border}
                  style={{ marginTop: 4 }}
                />
                <Text
                  style={[s.optimizingLabel, { color: colors.textSecondary }]}
                >
                  Optimizando tu sugerencia...
                </Text>
              </View>
            ) : (
              <>
                <Text style={[s.dishName, { color: colors.textPrimary }]}>
                  {food.name}
                </Text>
                <View style={s.macroPills}>
                  <View style={[s.pill, { backgroundColor: "#FEE2E2" }]}>
                    <MaterialCommunityIcons
                      name="fire"
                      size={18}
                      color="#B91C1C"
                    />
                    <Text style={s.pillText}>{caloriesPill} kcal</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: MACRO_PROTEIN }]}>
                    <MaterialCommunityIcons
                      name="arm-flex"
                      size={18}
                      color="#047857"
                    />
                    <Text style={s.pillText}>{proteinG}g Prot.</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: MACRO_CARBS }]}>
                    <MaterialCommunityIcons
                      name="chart-donut-variant"
                      size={18}
                      color="#1D4ED8"
                    />
                    <Text style={s.pillText}>{carbsG}g Carb.</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: MACRO_FAT }]}>
                    <MaterialCommunityIcons
                      name="water-percent"
                      size={18}
                      color="#92400E"
                    />
                    <Text style={s.pillText}>{fatG}g Gras.</Text>
                  </View>
                </View>
                <View style={s.whySection}>
                  <Text style={[s.whyLabel, { color: colors.textSecondary }]}>
                    Por qué esto?
                  </Text>
                  <View style={s.whyMessageWrap}>
                    <Text
                      style={[s.whyBody, { color: colors.textPrimary }]}
                      numberOfLines={4}
                    >
                      {recommendation.message}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const f = recommendation.recommendedFood;
                    router.push({
                      pathname: "/recipe-detail",
                      params: {
                        name: f.name,
                        protein_100g: String(f.protein_100g),
                        carbs_100g: String(f.carbs_100g),
                        fat_100g: String(f.fat_100g),
                        kcal_100g: String(f.kcal_100g),
                        recommendedAmount: String(f.recommendedAmount),
                        message: recommendation.message,
                        ingredients: JSON.stringify(f.ingredients ?? []),
                        instructions: JSON.stringify(f.instructions ?? []),
                        image_description: f.image_description ?? "",
                        image_search_term: f.image_search_term ?? "",
                      },
                    });
                  }}
                  style={({ pressed }) => [
                    s.verRecetaBtn,
                    { borderColor: colors.border },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chef-hat"
                    size={20}
                    color={colors.brand}
                  />
                  <Text style={[s.verRecetaText, { color: colors.brand }]}>
                    Ver Receta
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Sección de refinamiento (chat) debajo de la tarjeta */}
          {/* Sección de refinamiento (chat) debajo de la tarjeta */}
          <View style={s.refineSection}>
            <Text style={[s.refineTitle, { color: colors.textSecondary }]}>
              ¿Quieres ajustar algo?
            </Text>
            {fallbackMessage ? (
              <View
                style={[
                  s.fallbackBubble,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[s.fallbackText, { color: colors.textPrimary }]}>
                  {fallbackMessage}
                </Text>
              </View>
            ) : null}
            {refining ? (
              <View
                style={[
                  s.optimizingCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Skeleton
                  width="80%"
                  height={14}
                  radius={8}
                  bg={colors.border}
                />
                <Skeleton
                  width="60%"
                  height={14}
                  radius={8}
                  bg={colors.border}
                  style={{ marginTop: 8 }}
                />
                <Text
                  style={[s.optimizingLabel, { color: colors.textSecondary }]}
                >
                  Optimizando tu sugerencia...
                </Text>
              </View>
            ) : (
              <View style={s.chatRow}>
                <TextInput
                  style={[
                    s.chatInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="No tengo este ingrediente... o algo más rápido"
                  placeholderTextColor={colors.textSecondary}
                  value={chatText}
                  onChangeText={setChatText}
                  multiline
                  maxLength={500}
                  editable={!refining}
                  onFocus={() => {
                    setInputFocused(true);
                    setTimeout(() => {
                      chatScrollRef.current?.scrollToEnd({
                        animated: true,
                      });
                    }, 350);
                  }}
                  onBlur={() => {
                    setInputFocused(false);
                  }}
                />
                <Pressable
                  onPress={handleSendRefinement}
                  disabled={!chatText.trim() || refining}
                  style={[
                    s.sendBtn,
                    { backgroundColor: colors.brand },
                    (!chatText.trim() || refining) && s.sendBtnDisabled,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="creation"
                    size={22}
                    color={colors.onCta}
                  />
                </Pressable>
              </View>
            )}
          </View>

          <Pressable
            onPress={handleQuickAdd}
            disabled={isAdding || refining}
            style={({ pressed }) => [
              s.quickAddWrap,
              refining
                ? { opacity: 0.6 }
                : (pressed || isAdding) && { opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={[colors.brand, colors.brand + "DD"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.quickAddButton}
            >
              {isAdding || refining ? (
                <ActivityIndicator size="small" color={colors.onCta} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={22}
                    color={colors.onCta}
                  />
                  <Text style={[s.quickAddText, { color: colors.onCta }]}>
                    Agregar {food.name} ahora
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
          {/* Espacio extra dinámico para que el input y el botón queden visibles sobre el teclado */}
          <View
            style={{
              height: scrollBottomPadding + (inputFocused ? 80 : 30),
            }}
          />
        </ScrollView>
      </View>
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
    cta: string;
  },
  typography: { title: object; subtitle: object; body: object },
) {
  return StyleSheet.create({
    safe: { flex: 1 },
    mainContainer: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: PAGE_PADDING,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      ...typography.title,
      fontSize: 18,
      lineHeight: 24,
    },
    planLabel: {
      ...typography.body,
      fontSize: 11,
      letterSpacing: 1,
      marginTop: 8,
      marginHorizontal: PAGE_PADDING,
    },
    kpiRow: {
      flexDirection: "row",
      gap: 10,
      marginHorizontal: PAGE_PADDING,
      marginBottom: 16,
    },
    kpiCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      alignItems: "center",
      gap: 4,
    },
    kpiValue: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
    },
    kpiValueSmall: {
      fontSize: 13,
    },
    kpiLabel: {
      ...typography.body,
      fontSize: 10,
    },
    scroll: { flex: 1 },
    scrollContent: {
      padding: PAGE_PADDING,
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      padding: PAGE_PADDING,
      marginBottom: 24,
      ...(Platform.OS === "android" ? { elevation: 2 } : {}),
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    successCard: { alignItems: "center" },
    skeletonCardInner: { gap: 12 },
    successIconWrap: { marginBottom: 12 },
    successTitle: {
      ...typography.title,
      fontSize: 20,
      lineHeight: 26,
      marginBottom: 12,
    },
    dishName: {
      ...typography.title,
      fontSize: 22,
      lineHeight: 28,
      marginBottom: 16,
    },
    macroPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 16,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    pillText: {
      ...typography.body,
      fontSize: 13,
      fontWeight: "600",
      color: "#1F2937",
    },
    whySection: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.04)",
      marginTop: 4,
    },
    whyLabel: {
      ...typography.body,
      fontSize: 12,
      marginBottom: 6,
    },
    whyMessageWrap: {
      maxHeight: 72,
      overflow: "hidden",
    },
    whyBody: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "500",
    },
    verRecetaBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 14,
    },
    verRecetaText: {
      ...typography.body,
      fontSize: 15,
      fontWeight: "600",
    },
    exerciseIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brand + "20",
      marginBottom: 12,
    },
    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    exerciseList: { gap: 10 },
    exerciseItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
    },
    exerciseItemText: {
      ...typography.body,
      fontSize: 15,
      fontWeight: "600",
    },
    quickAddWrap: {
      marginBottom: 28,
      borderRadius: 16,
      overflow: "hidden",
    },
    quickAddButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 18,
      paddingHorizontal: 24,
      borderRadius: 16,
    },
    quickAddText: {
      ...typography.subtitle,
      fontSize: 16,
    },
    refineSection: { marginBottom: 28 },
    fallbackBubble: {
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 12,
    },
    fallbackText: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "500",
    },
    refineTitle: {
      ...typography.body,
      fontSize: 13,
      marginBottom: 10,
    },
    optimizingCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 20,
    },
    optimizingLabel: {
      ...typography.body,
      fontSize: 13,
      marginTop: 12,
    },
    chatRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
    },
    chatInput: {
      flex: 1,
      borderRadius: 25,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 14,
      minHeight: 48,
      maxHeight: 100,
      ...typography.body,
      fontSize: 15,
    },
    sendBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.5 },
  });
}
