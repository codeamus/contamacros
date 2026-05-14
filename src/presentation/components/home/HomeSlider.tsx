import SmartCoachPro from "@/presentation/components/smartCoach/SmartCoachPro";
import React from "react";
import { Animated, View } from "react-native";
import { ActivityCard } from "./ActivityCard";

type HomeSliderProps = {
  slideAnimation: Animated.Value | null | undefined;
  isPremium: boolean;
  isLoadingPremium?: boolean;
  caloriesConsumed: number;
  caloriesTargetForCoach: number;
  onShowPaywall: () => void;
  /** Activity */
  caloriesBurned: number;
  isSyncing: boolean;
  syncCalories: () => Promise<void>;
  cancelSync: () => void;
};

export function HomeSlider({
  slideAnimation,
  isPremium,
  isLoadingPremium = false,
  caloriesConsumed,
  caloriesTargetForCoach,
  onShowPaywall,
  caloriesBurned,
  isSyncing,
  syncCalories,
  cancelSync,
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
          isPremium={isPremium}
          caloriesConsumed={caloriesConsumed}
          caloriesTarget={caloriesTargetForCoach}
          onShowPaywall={onShowPaywall}
        />

        <ActivityCard
          isPremium={isPremium}
          isLoading={isLoadingPremium}
          caloriesBurned={caloriesBurned}
          isSyncing={isSyncing}
          syncCalories={syncCalories}
          cancelSync={cancelSync}
          onShowPaywall={onShowPaywall}
        />
      </View>
    </Animated.View>
  );
}
