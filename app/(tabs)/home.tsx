// app/(tabs)/home.tsx
import {
  CaloriesCard,
  HomeHeader,
  HomeSlider,
  MacrosSection,
  MealsSection,
  MissingTargetsNotice,
} from "@/presentation/components/home";
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTodayMeals } from "@/presentation/hooks/diary/useTodayMeals";
import { useTodaySummary } from "@/presentation/hooks/diary/useTodaySummary";
import { useHealthSync } from "@/presentation/hooks/health/useHealthSync";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useStaggerAnimation } from "@/presentation/hooks/ui/useStaggerAnimation";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const { profile } = useAuth();
  const { day, totals, loading, reload: reloadSummary } = useTodaySummary();
  const { meals, loading: mealsLoading, reload: reloadMeals } = useTodayMeals(day);

  const caloriesTarget = profile?.daily_calorie_target ?? 0;
  const proteinTarget = profile?.protein_g ?? 0;
  const carbsTarget = profile?.carbs_g ?? 0;
  const fatTarget = profile?.fat_g ?? 0;

  const { isPremium: revenueCatPremium } = useRevenueCat();
  const profilePremium = profile?.is_premium ?? false;
  const isPremium = revenueCatPremium || profilePremium;

  const { caloriesBurned, isSyncing, syncCalories, cancelSync, reload: reloadHealth } = useHealthSync(isPremium);

  const effectiveTargetForCoach = useMemo(() => {
    if (caloriesTarget <= 0) return caloriesTarget;
    if (isPremium && caloriesBurned > 0) return caloriesTarget + caloriesBurned;
    return caloriesTarget;
  }, [caloriesTarget, isPremium, caloriesBurned]);

  const hasTargets = caloriesTarget > 0 && proteinTarget > 0 && carbsTarget > 0 && fatTarget > 0;
  const caloriesConsumed = totals.calories;

  const effectiveCaloriesTarget = useMemo(() => {
    if (caloriesTarget <= 0) return 0;
    if (isPremium && caloriesBurned > 0) return caloriesTarget + caloriesBurned;
    return caloriesTarget;
  }, [caloriesTarget, isPremium, caloriesBurned]);

  const remaining = useMemo(() => {
    if (effectiveCaloriesTarget <= 0) return 0;
    return Math.max(effectiveCaloriesTarget - caloriesConsumed, 0);
  }, [effectiveCaloriesTarget, caloriesConsumed]);

  const caloriesPct = useMemo(() => {
    if (!effectiveCaloriesTarget) return 0;
    return Math.min((caloriesConsumed / effectiveCaloriesTarget) * 100, 100);
  }, [caloriesConsumed, effectiveCaloriesTarget]);

  const caloriesProgress = useMemo(() => {
    if (!effectiveCaloriesTarget) return 0;
    return clamp01(caloriesConsumed / effectiveCaloriesTarget);
  }, [caloriesConsumed, effectiveCaloriesTarget]);

  const protein = { value: totals.protein, target: proteinTarget };
  const carbs = { value: totals.carbs, target: carbsTarget };
  const fat = { value: totals.fat, target: fatTarget };

  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const cardAnimations = useStaggerAnimation(6, 80, 100);
  const fabScale = useRef(new Animated.Value(1)).current;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([reloadSummary(), reloadMeals()]);
    setRefreshing(false);
    if (isPremium) reloadHealth().catch(() => {});
  }, [reloadSummary, reloadMeals, isPremium, reloadHealth]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        <HomeHeader day={day} loading={loading} />

        <HomeSlider
          slideAnimation={cardAnimations[0]}
          isPremium={isPremium}
          caloriesConsumed={totals.calories}
          caloriesTargetForCoach={effectiveTargetForCoach}
          onShowPaywall={() => setPaywallVisible(true)}
          caloriesBurned={caloriesBurned}
          isSyncing={isSyncing}
          syncCalories={syncCalories}
          cancelSync={cancelSync}
        />

        {!hasTargets && (
          <MissingTargetsNotice profileOnboardingCompleted={profile?.onboarding_completed} />
        )}

        <CaloriesCard
          caloriesConsumed={caloriesConsumed}
          remaining={remaining}
          caloriesTarget={caloriesTarget}
          caloriesBurned={caloriesBurned}
          isPremium={isPremium}
          loading={loading}
          progress={caloriesProgress}
          progressPct={caloriesPct}
          cardAnimation={cardAnimations[1]}
        />

        <MacrosSection
          protein={protein}
          carbs={carbs}
          fat={fat}
          loading={loading}
          cardAnimation={cardAnimations[2]}
        />

        <MealsSection
          breakfast={meals.breakfast}
          lunch={meals.lunch}
          dinner={meals.dinner}
          snack={meals.snack}
          totalCalories={caloriesConsumed}
          loading={mealsLoading || loading}
          cardAnimation={cardAnimations[3]}
        />

        {/* Botón único añadir comida */}
        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(tabs)/add-food");
            }}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.brand },
              pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Feather name="plus" size={20} color="#fff" />
            <Text style={[styles.addBtnText, { fontFamily: typography.subtitle?.fontFamily }]}>
              Añadir comida
            </Text>
          </Pressable>
        </Animated.View>

        <View style={{ height: 8 }} />
      </ScrollView>

      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => {}}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { padding: 18, gap: 14 },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 54,
      borderRadius: 18,
      marginTop: 4,
    },
    addBtnText: {
      fontSize: 16,
      color: "#fff",
      fontWeight: "700",
    },
  });
}
