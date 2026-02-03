// app/(tabs)/home.tsx
import type { MealType } from "@/domain/models/foodLogDb";
import {
  CaloriesCard,
  HomeHeader,
  HomeSlider,
  MacrosSection,
  MealPickerSheet,
  MealsSection,
  MissingTargetsNotice,
  SummaryCards,
} from "@/presentation/components/home";
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTodayMeals } from "@/presentation/hooks/diary/useTodayMeals";
import { useTodaySummary } from "@/presentation/hooks/diary/useTodaySummary";
import { useHealthSync } from "@/presentation/hooks/health/useHealthSync";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useStaggerAnimation } from "@/presentation/hooks/ui/useStaggerAnimation";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { profile } = useAuth();
  const { day, totals, loading, reload: reloadSummary } = useTodaySummary();
  const {
    meals,
    loading: mealsLoading,
    reload: reloadMeals,
  } = useTodayMeals(day);

  const caloriesTarget = profile?.daily_calorie_target ?? 0;
  const proteinTarget = profile?.protein_g ?? 0;
  const carbsTarget = profile?.carbs_g ?? 0;
  const fatTarget = profile?.fat_g ?? 0;

  const { isPremium: revenueCatPremium } = useRevenueCat();
  const profilePremium = profile?.is_premium ?? false;
  const isPremium = revenueCatPremium || profilePremium;

  const {
    caloriesBurned,
    isSyncing,
    syncCalories,
    cancelSync,
    reload: reloadHealth,
  } = useHealthSync(isPremium);

  const effectiveTargetForCoach = useMemo(() => {
    if (caloriesTarget <= 0) return caloriesTarget;
    if (isPremium && caloriesBurned > 0) {
      return caloriesTarget + caloriesBurned;
    }
    return caloriesTarget;
  }, [caloriesTarget, isPremium, caloriesBurned]);

  /* useSmartCoachPro removed as it's not needed for the new Greeting Card layout */

  const hasTargets =
    caloriesTarget > 0 && proteinTarget > 0 && carbsTarget > 0 && fatTarget > 0;

  const caloriesConsumed = totals.calories;

  const effectiveCaloriesTarget = useMemo(() => {
    if (caloriesTarget <= 0) return 0;
    if (isPremium && caloriesBurned > 0) {
      return caloriesTarget + caloriesBurned;
    }
    return caloriesTarget;
  }, [caloriesTarget, isPremium, caloriesBurned]);

  const remaining = useMemo(() => {
    if (effectiveCaloriesTarget <= 0) return 0;
    return Math.max(effectiveCaloriesTarget - caloriesConsumed, 0);
  }, [effectiveCaloriesTarget, caloriesConsumed]);

  const caloriesPct = useMemo(() => {
    if (!effectiveCaloriesTarget || effectiveCaloriesTarget <= 0) return 0;
    return Math.min((caloriesConsumed / effectiveCaloriesTarget) * 100, 100);
  }, [caloriesConsumed, effectiveCaloriesTarget]);

  const caloriesProgress = useMemo(() => {
    if (!effectiveCaloriesTarget || effectiveCaloriesTarget <= 0) return 0;
    return clamp01(caloriesConsumed / effectiveCaloriesTarget);
  }, [caloriesConsumed, effectiveCaloriesTarget]);

  const protein = { value: totals.protein, target: proteinTarget };
  const carbs = { value: totals.carbs, target: carbsTarget };
  const fat = { value: totals.fat, target: fatTarget };

  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const cardAnimations = useStaggerAnimation(6, 80, 100);
  const fabScale = useRef(new Animated.Value(0)).current;
  const fabOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.spring(fabScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(fabOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, fabScale, fabOpacity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([reloadSummary(), reloadMeals()]);
    setRefreshing(false);
    if (isPremium) {
      reloadHealth().catch(() => {});
    }
  }, [reloadSummary, reloadMeals, isPremium, reloadHealth]);

  const handleOpenSettings = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (Platform.OS === "ios") {
        await Linking.openURL("app-settings:");
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error("[Home] Error al abrir ajustes:", error);
    }
  }, []);

  function goAddFood(meal: MealType) {
    router.push({
      pathname: "/(tabs)/add-food",
      params: { meal },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
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
          onOpenSettings={handleOpenSettings}
        />

        {!hasTargets && (
          <MissingTargetsNotice
            profileOnboardingCompleted={profile?.onboarding_completed}
          />
        )}

        <SummaryCards
          remaining={remaining}
          caloriesConsumed={caloriesConsumed}
          loading={loading}
          restantesAnimation={cardAnimations[1]}
          consumidasAnimation={cardAnimations[2]}
        />

        <CaloriesCard
          caloriesConsumed={caloriesConsumed}
          remaining={remaining}
          caloriesTarget={caloriesTarget}
          caloriesBurned={caloriesBurned}
          isPremium={isPremium}
          loading={loading}
          progress={caloriesProgress}
          progressPct={caloriesPct}
          cardAnimation={cardAnimations[4]}
        />

        <MacrosSection
          protein={protein}
          carbs={carbs}
          fat={fat}
          loading={loading}
          cardAnimation={cardAnimations[4]}
        />

        <MealsSection
          breakfast={meals.breakfast}
          lunch={meals.lunch}
          dinner={meals.dinner}
          snack={meals.snack}
          totalCalories={caloriesConsumed}
          loading={mealsLoading || loading}
          cardAnimation={cardAnimations[4]}
        />

        <View style={{ height: 96 }} />
      </ScrollView>

      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => {}}
      />

      <Animated.View
        style={[
          styles.fab,
          {
            opacity: fabOpacity,
            transform: [{ scale: fabScale }],
          },
        ]}
      />

      <MealPickerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={(meal) => {
          setSheetOpen(false);
          requestAnimationFrame(() => goAddFood(meal));
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: { background: string }) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { padding: 18, gap: 14 },
    fab: { position: "absolute", left: 18, right: 18, bottom: 18 },
  });
}
