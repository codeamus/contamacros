import type { SmartCoachRecommendation } from "@/domain/models/smartCoach";
import SmartCoachPro from "@/presentation/components/smartCoach/SmartCoachPro";
import React from "react";
import { Animated, View } from "react-native";
import { ActivityCard } from "./ActivityCard";

type HomeSliderProps = {
  slideAnimation: Animated.Value | null | undefined;
  /** Smart Coach */
  recommendation: SmartCoachRecommendation | null;
  smartCoachLoading: boolean;
  isPremium: boolean;
  caloriesConsumed: number;
  caloriesTargetForCoach: number;
  dietaryPreference?: string | null;
  onFoodAdded: () => void;
  onShowPaywall: () => void;
  onViewFullPlan: (() => void) | undefined;
  onViewSuccessPlan: (() => void) | undefined;
  /** Activity */
  caloriesBurned: number;
  isSyncing: boolean;
  syncCalories: () => Promise<void>;
  cancelSync: () => void;
  onOpenSettings: () => void;
};

export function HomeSlider({
  slideAnimation,
  recommendation,
  smartCoachLoading,
  isPremium,
  caloriesConsumed,
  caloriesTargetForCoach,
  dietaryPreference,
  onFoodAdded,
  onShowPaywall,
  onViewFullPlan,
  onViewSuccessPlan,
  caloriesBurned,
  isSyncing,
  syncCalories,
  cancelSync,
  onOpenSettings,
}: HomeSliderProps) {
  return (
    <Animated.View
      style={{
        marginBottom: 4,
        opacity: slideAnimation || 1,
        transform: slideAnimation
          ? [
              {
                translateY: slideAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
              { scale: slideAnimation },
            ]
          : [],
      }}
    >
      <View style={{ gap: 14 }}>
        <SmartCoachPro
          recommendation={recommendation}
          loading={smartCoachLoading}
          isPremium={isPremium}
          caloriesConsumed={caloriesConsumed}
          caloriesTarget={caloriesTargetForCoach}
          dietaryPreference={dietaryPreference ?? undefined}
          onFoodAdded={onFoodAdded}
          onShowPaywall={onShowPaywall}
          onViewFullPlan={onViewFullPlan}
          onViewSuccessPlan={onViewSuccessPlan}
        />

        <ActivityCard
          caloriesBurned={caloriesBurned}
          isSyncing={isSyncing}
          syncCalories={syncCalories}
          cancelSync={cancelSync}
          onOpenSettings={onOpenSettings}
        />
      </View>
    </Animated.View>
  );
}
