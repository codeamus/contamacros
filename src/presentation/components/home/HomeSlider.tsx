import type { SmartCoachRecommendation } from "@/domain/models/smartCoach";
import SmartCoachPro from "@/presentation/components/smartCoach/SmartCoachPro";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React from "react";
import { Animated, Dimensions, ScrollView, StyleSheet, View } from "react-native";
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

const sliderWidth = Dimensions.get("window").width;

const styles = StyleSheet.create({
  sliderContent: { flexGrow: 0 },
  sliderSlide: {
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  sliderSlideInner: { width: "100%" },
  sliderDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  sliderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.4,
  },
  sliderDotActive: {
    opacity: 1,
    transform: [{ scale: 1.2 }],
  },
});

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
  const { theme } = useTheme();
  const { colors } = theme;
  const [sliderPage, setSliderPage] = React.useState(0);
  const sliderRef = React.useRef<ScrollView>(null);

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
      <ScrollView
        ref={sliderRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / sliderWidth);
          setSliderPage(index);
        }}
        style={{ marginHorizontal: -18 }}
        contentContainerStyle={styles.sliderContent}
      >
        <View style={[styles.sliderSlide, { width: sliderWidth }]}>
          <View style={styles.sliderSlideInner}>
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
          </View>
        </View>

        <View style={[styles.sliderSlide, { width: sliderWidth }]}>
          <View style={styles.sliderSlideInner}>
            <ActivityCard
              caloriesBurned={caloriesBurned}
              isSyncing={isSyncing}
              syncCalories={syncCalories}
              cancelSync={cancelSync}
              onOpenSettings={onOpenSettings}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.sliderDots}>
        <View
          style={[
            styles.sliderDot,
            sliderPage === 0 && styles.sliderDotActive,
            { backgroundColor: sliderPage === 0 ? colors.brand : colors.border },
          ]}
        />
        <View
          style={[
            styles.sliderDot,
            sliderPage === 1 && styles.sliderDotActive,
            { backgroundColor: sliderPage === 1 ? colors.brand : colors.border },
          ]}
        />
      </View>
    </Animated.View>
  );
}
