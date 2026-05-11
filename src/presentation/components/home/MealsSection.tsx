import type { MealType } from "@/domain/models/foodLogDb";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

type MealData = { count: number; calories: number };

type MealsSectionProps = {
  breakfast: MealData;
  lunch: MealData;
  dinner: MealData;
  snack: MealData;
  totalCalories: number;
  loading: boolean;
  cardAnimation: Animated.Value | null | undefined;
};

const MEAL_CONFIG: { key: MealType; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"] }[] = [
  { key: "breakfast", label: "Desayuno", icon: "coffee" },
  { key: "lunch",     label: "Almuerzo", icon: "food" },
  { key: "dinner",    label: "Cena",     icon: "food-variant" },
  { key: "snack",     label: "Snack",    icon: "cookie" },
];

export function MealsSection({
  breakfast,
  lunch,
  dinner,
  snack,
  loading,
  cardAnimation,
}: MealsSectionProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const dataMap: Record<MealType, MealData> = { breakfast, lunch, dinner, snack };
  const mealsWithFood = MEAL_CONFIG.filter((m) => dataMap[m.key].count > 0);

  if (loading || mealsWithFood.length === 0) return null;

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={colors.textPrimary} />
          <Text style={[styles.sectionTitle, { fontFamily: typography.subtitle?.fontFamily, color: colors.textPrimary }]}>
            Comidas de hoy
          </Text>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/diary")}>
          <Text style={[styles.sectionAction, { fontFamily: typography.body?.fontFamily, color: colors.brand }]}>
            Ver todo
          </Text>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          cardAnimation && {
            opacity: cardAnimation,
            transform: [{ translateY: cardAnimation.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          },
        ]}
      >
        {mealsWithFood.map((m, i) => {
          const data = dataMap[m.key];
          return (
            <React.Fragment key={m.key}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <Pressable
                onPress={() => router.push({ pathname: "/(tabs)/diary", params: { meal: m.key } })}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.iconWrap, { borderColor: colors.border }]}>
                  <MaterialCommunityIcons name={m.icon} size={18} color={colors.textPrimary} />
                </View>
                <Text style={[styles.mealLabel, { fontFamily: typography.subtitle?.fontFamily, color: colors.textPrimary }]}>
                  {m.label}
                </Text>
                <Text style={[styles.kcal, { fontFamily: typography.body?.fontFamily, color: colors.textSecondary }]}>
                  {Math.round(data.calories)} kcal
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textSecondary} />
              </Pressable>
            </React.Fragment>
          );
        })}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 14 },
  sectionAction: { fontSize: 13 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 0,
  },
  divider: { height: 1, opacity: 0.6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mealLabel: { flex: 1, fontSize: 14 },
  kcal: { fontSize: 13 },
});
