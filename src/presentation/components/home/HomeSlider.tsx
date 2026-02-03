import SmartCoachPro from "@/presentation/components/smartCoach/SmartCoachPro";
import React from "react";
import { Animated, View } from "react-native";
import { ActivityCard } from "./ActivityCard";

type HomeSliderProps = {
  slideAnimation: Animated.Value | null | undefined;
  isPremium: boolean;
  caloriesConsumed: number;
  caloriesTargetForCoach: number;
  onShowPaywall: () => void;
  /** Activity */
  caloriesBurned: number;
  isSyncing: boolean;
  syncCalories: () => Promise<void>;
  cancelSync: () => void;
  onOpenSettings: () => void;
};

export function HomeSlider({
  slideAnimation,
  isPremium,
  caloriesConsumed,
  caloriesTargetForCoach,
  onShowPaywall,
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
          isPremium={isPremium}
          caloriesConsumed={caloriesConsumed}
          caloriesTarget={caloriesTargetForCoach}
          onShowPaywall={onShowPaywall}
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
