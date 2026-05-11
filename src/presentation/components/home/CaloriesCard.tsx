import { AnimatedProgressBar } from "@/presentation/components/home/AnimatedProgressBar";
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
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: colors.cta, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="fire" size={18} color={colors.onCta} />
          </View>
          <Text style={[styles.cardTitle, { fontFamily: typography.subtitle?.fontFamily, color: colors.textSecondary }]}>
            Calorías
          </Text>
        </View>

        <View style={[styles.chip, { borderColor: colors.border }]}>
          <Feather name="flag" size={14} color={colors.textSecondary} />
          <Text style={[styles.chipText, { fontFamily: typography.body?.fontFamily, color: colors.textSecondary }]}>
            {caloriesTarget
              ? isPremium && caloriesBurned > 0
                ? `${caloriesTarget} + ${caloriesBurned} kcal`
                : `${caloriesTarget} kcal`
              : "Sin objetivo"}
          </Text>
        </View>
      </View>

      {/* Dos columnas: consumidas | restantes */}
      <View style={styles.statsRow}>
        {loading ? (
          <>
            <View style={styles.statCol}>
              <Skeleton height={28} width={80} radius={12} bg={colors.border} highlight={colors.border} />
              <Skeleton height={12} width={60} radius={8} bg={colors.border} highlight={colors.border} style={{ marginTop: 6 }} />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statCol}>
              <Skeleton height={28} width={80} radius={12} bg={colors.border} highlight={colors.border} />
              <Skeleton height={12} width={60} radius={8} bg={colors.border} highlight={colors.border} style={{ marginTop: 6 }} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { fontFamily: typography.title?.fontFamily, color: colors.textPrimary }]}>
                {Math.round(caloriesConsumed)}
                <Text style={[styles.statUnit, { fontFamily: typography.body?.fontFamily, color: colors.textSecondary }]}> kcal</Text>
              </Text>
              <Text style={[styles.statLabel, { fontFamily: typography.body?.fontFamily, color: colors.textSecondary }]}>
                consumidas
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.statCol}>
              <Text style={[styles.statValue, { fontFamily: typography.title?.fontFamily, color: colors.brand }]}>
                {Math.round(remaining)}
                <Text style={[styles.statUnit, { fontFamily: typography.body?.fontFamily, color: colors.textSecondary }]}> kcal</Text>
              </Text>
              <Text style={[styles.statLabel, { fontFamily: typography.body?.fontFamily, color: colors.textSecondary }]}>
                restantes
              </Text>
            </View>
          </>
        )}
      </View>

      <AnimatedProgressBar percentage={progressPct} loading={loading} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  divider: {
    width: 1,
    height: 44,
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 26,
  },
  statUnit: {
    fontSize: 13,
  },
  statLabel: {
    fontSize: 12,
  },
});
