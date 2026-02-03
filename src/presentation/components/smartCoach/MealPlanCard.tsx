import { SmartCoachMeal, SmartCoachMealPlan } from "@/data/ai/geminiService";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface MealPlanCardProps {
  plan: SmartCoachMealPlan;
  onRegisterDay: (meals: SmartCoachMeal[]) => void;
  onRegisterWeek: (plan: SmartCoachMealPlan) => void;
  onViewRecipe: (meal: SmartCoachMeal) => void;
  loading?: boolean;
}

export const MealPlanCard: React.FC<MealPlanCardProps> = ({
  plan,
  onRegisterDay,
  onRegisterWeek,
  onViewRecipe,
  loading = false,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const currentDay = plan.days[selectedDayIdx] || plan.days[0];
  const meals = currentDay?.meals || [];

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, m) => ({
        kcal: acc.kcal + m.calories,
        p: acc.p + m.protein,
        c: acc.c + m.carbs,
        f: acc.f + m.fat,
      }),
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
  }, [meals]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.brand },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {plan.title}
          </Text>
          {plan.type === "weekly" && (
            <Pressable
              onPress={() => onRegisterWeek(plan)}
              disabled={loading}
              style={[
                styles.weekBtn,
                {
                  backgroundColor: colors.brand + "15",
                  borderColor: colors.brand,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="calendar-multiselect"
                size={14}
                color={colors.brand}
              />
              <Text style={[styles.weekBtnText, { color: colors.brand }]}>
                Semana
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.subtitleRow}>
          <View
            style={[styles.badge, { backgroundColor: colors.brand + "20" }]}
          >
            <Text style={[styles.badgeText, { color: colors.brand }]}>
              Optimizado por IA
            </Text>
          </View>
          <Text
            style={[styles.totalsSubtitle, { color: colors.textSecondary }]}
          >
            Día: {totals.kcal} kcal | P:{totals.p}g C:{totals.c}g G:{totals.f}g
          </Text>
        </View>
      </View>

      {plan.type === "weekly" && (
        <View style={styles.tabsContainer}>
          {plan.days.map((day, idx) => (
            <Pressable
              key={idx}
              onPress={() => setSelectedDayIdx(idx)}
              style={[
                styles.tab,
                selectedDayIdx === idx && {
                  backgroundColor: colors.brand,
                  borderColor: colors.brand,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      selectedDayIdx === idx
                        ? colors.onCta
                        : colors.textSecondary,
                  },
                ]}
              >
                {day.dayName.substring(0, 1).toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.timeline}>
        {meals.map((meal, idx) => (
          <View key={idx} style={styles.timelineItem}>
            <View style={styles.timelineIndicators}>
              <View style={[styles.dot, { backgroundColor: colors.brand }]} />
              {idx !== meals.length - 1 && (
                <View
                  style={[styles.line, { backgroundColor: colors.border }]}
                />
              )}
            </View>
            <Pressable
              onPress={() => onViewRecipe(meal)}
              style={styles.mealContent}
            >
              <View style={styles.mealHeader}>
                <Text style={[styles.mealTime, { color: colors.brand }]}>
                  {meal.timeSlot}
                </Text>
                <Text
                  style={[styles.mealMacros, { color: colors.textSecondary }]}
                >
                  {meal.calories} kcal
                </Text>
              </View>
              <Text style={[styles.mealName, { color: colors.textPrimary }]}>
                {meal.name}
              </Text>
              <Text style={[styles.mealDesc, { color: colors.textSecondary }]}>
                {meal.description}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => onRegisterDay(meals)}
        disabled={loading}
        style={[
          styles.registerBtn,
          { backgroundColor: colors.brand },
          loading && { opacity: 0.7 },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.onCta} />
        ) : (
          <>
            <MaterialCommunityIcons
              name="calendar-check"
              size={18}
              color={colors.onCta}
            />
            <Text style={[styles.registerText, { color: colors.onCta }]}>
              Agendar este día
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 8,
    gap: 16,
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },
  weekBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  weekBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  subtitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  totalsSubtitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  tab: {
    flex: 1,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E1E5D3",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "800",
  },
  timeline: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineIndicators: {
    alignItems: "center",
    width: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  mealContent: {
    flex: 1,
    paddingBottom: 20,
    gap: 2,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealTime: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  mealMacros: {
    fontSize: 11,
    fontWeight: "600",
  },
  mealName: {
    fontSize: 15,
    fontWeight: "700",
  },
  mealDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  registerText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
