import { AnimatedProgressBar } from "@/presentation/components/home/AnimatedProgressBar";
import DonutRing from "@/presentation/components/ui/DonutRing";
import Skeleton from "@/presentation/components/ui/Skeleton";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type CaloriesCardProps = {
  caloriesConsumed: number;
  remaining: number;
  caloriesTarget: number;
  caloriesBurned: number;
  isPremium: boolean;
  loading: boolean;
  progress: number;
  progressPct: number;
  cardAnimation: Animated.Value | null | undefined;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cardTitle: { fontSize: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12 },
  bigValue: { fontSize: 34 },
  bigUnit: { fontSize: 14 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hintText: { fontSize: 12 },
});

export function CaloriesCard({
  caloriesConsumed,
  remaining,
  caloriesTarget,
  caloriesBurned,
  isPremium,
  loading,
  progress,
  progressPct,
  cardAnimation,
}: CaloriesCardProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        cardAnimation && {
          opacity: cardAnimation,
          transform: [
            {
              translateY: cardAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderLeft}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.cta,
                borderColor: colors.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="fire"
              size={18}
              color={colors.onCta}
            />
          </View>
          <Text
            style={[
              styles.cardTitle,
              {
                fontFamily: typography.subtitle?.fontFamily,
                color: colors.textSecondary,
              },
            ]}
          >
            Calorías
          </Text>
        </View>

        <View
          style={[
            styles.chip,
            {
              borderColor: colors.border,
              backgroundColor: "transparent",
            },
          ]}
        >
          <Feather name="flag" size={14} color={colors.textSecondary} />
          <Text
            style={[
              styles.chipText,
              {
                fontFamily: typography.body?.fontFamily,
                color: colors.textSecondary,
              },
            ]}
          >
            {caloriesTarget
              ? isPremium && caloriesBurned > 0
                ? `${caloriesTarget} + ${caloriesBurned} kcal`
                : `${caloriesTarget} kcal`
              : "Sin objetivo"}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <DonutRing
          progress={loading ? 0 : progress}
          trackColor={colors.border}
          fillColor={colors.brand}
          size={92}
          stroke={12}
        />

        <View style={{ flex: 1, gap: 8 }}>
          {loading ? (
            <>
              <Skeleton
                height={28}
                width="55%"
                radius={12}
                bg={colors.border}
                highlight={colors.border}
              />
              <Skeleton
                height={12}
                width="85%"
                radius={10}
                bg={colors.border}
                highlight={colors.border}
                style={{ opacity: 0.7 }}
              />
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.bigValue,
                  {
                    fontFamily: typography.title?.fontFamily,
                    color: colors.textPrimary,
                  },
                ]}
              >
                {caloriesConsumed}
                <Text
                  style={[
                    styles.bigUnit,
                    {
                      fontFamily: typography.body?.fontFamily,
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {" "}
                  kcal
                </Text>
              </Text>

              <View style={styles.hintRow}>
                <Feather
                  name="info"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.hintText,
                    {
                      fontFamily: typography.body?.fontFamily,
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {caloriesTarget
                    ? `${remaining} kcal para llegar a tu objetivo`
                    : "Define tu objetivo para ver restantes"}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      <AnimatedProgressBar
        percentage={progressPct}
        loading={loading}
      />
    </Animated.View>
  );
}
