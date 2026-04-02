// app/(tabs)/reports.tsx
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { CaloriesChart, type DailyCalories } from "@/presentation/components/reports/CaloriesChart";
import { ConsistencyCard } from "@/presentation/components/reports/ConsistencyCard";
import { MacrosChart, type DailyMacros } from "@/presentation/components/reports/MacrosChart";
import { ReportsPaywall } from "@/presentation/components/reports/ReportsPaywall";
import { WeightCard } from "@/presentation/components/reports/WeightCard";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { usePremium } from "@/presentation/hooks/subscriptions/usePremium";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_PADDING = 16;
const CHART_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2 - 32; // card padding x2

type Range = "7D" | "1M" | "1A";

const RANGE_LABELS: { key: Range; label: string; days: number }[] = [
  { key: "7D", label: "7 días", days: 7 },
  { key: "1M", label: "1 mes", days: 30 },
  { key: "1A", label: "1 año", days: 365 },
];

function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return {
    startDate: start.toISOString().split("T")[0]!,
    endDate: end.toISOString().split("T")[0]!,
  };
}

/** Calcula racha actual hacia atrás desde hoy */
function calcCurrentStreak(loggedSet: Set<string>): number {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const str = d.toISOString().split("T")[0]!;
    if (loggedSet.has(str)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Calcula la mejor racha histórica del set de días */
function calcBestStreak(loggedSet: Set<string>): number {
  const sorted = Array.from(loggedSet).sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

type ReportData = {
  dailyCalories: DailyCalories[];
  dailyMacros: DailyMacros[];
  loggedDays: Set<string>;
  currentStreak: number;
  bestStreak: number;
};

export default function ReportsScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { isPremium } = usePremium();
  const { profile } = useAuth();

  const scrollRef = useRef<ScrollView>(null);

  const [range, setRange] = useState<Range>("7D");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleWeightInputFocus = useCallback(() => {
    // Pequeño delay para que el teclado termine de abrirse antes de hacer scroll
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 350);
  }, []);

  const calorieGoal = profile?.daily_calorie_target ?? 0;

  const { startDate, endDate } = useMemo(() => {
    const days = RANGE_LABELS.find((r) => r.key === range)?.days ?? 7;
    return getDateRange(days);
  }, [range]);

  const loadData = useCallback(async () => {
    try {
      const [calRes, macroRes] = await Promise.all([
        foodLogRepository.getBentoStats(startDate, endDate),
        foodLogRepository.getDailyMacroBreakdown(startDate, endDate),
      ]);

      const dailyCalories: DailyCalories[] =
        calRes.ok && calRes.data ? calRes.data.dailyCalories : [];

      const dailyMacros: DailyMacros[] =
        macroRes.ok && macroRes.data ? macroRes.data : [];

      // Todos los días registrados (para heatmap y rachas)
      const allLogged = calRes.ok && calRes.data
        ? new Set(calRes.data.dailyCalories.map((d) => d.day))
        : new Set<string>();

      const currentStreak = calcCurrentStreak(allLogged);
      const bestStreak = calcBestStreak(allLogged);

      setData({ dailyCalories, dailyMacros, loggedDays: allLogged, currentStreak, bestStreak });
    } catch (err) {
      console.error("[Reports] Error loading:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData();
  }, [loadData]);

  const onRangeChange = useCallback((r: Range) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRange(r);
  }, []);

  // ── Pantalla de carga inicial ──────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Contenido real de reportes ─────────────────────────────────────────
  const content = (
    <ScrollView
      ref={scrollRef}
      style={s.flex}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.brand}
        />
      }
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
          Reportes
        </Text>
        {isPremium && (
          <View style={[s.premiumBadge, { backgroundColor: `${colors.brand}20`, borderColor: `${colors.brand}40` }]}>
            <Text style={[s.premiumBadgeText, { color: colors.brand, fontFamily: typography.body?.fontFamily }]}>
              Premium
            </Text>
          </View>
        )}
      </View>

      {/* Selector de rango */}
      <View style={[s.rangeSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {RANGE_LABELS.map((r) => {
          const active = range === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => onRangeChange(r.key)}
              style={[
                s.rangeTab,
                active && { backgroundColor: colors.brand },
              ]}
            >
              <Text
                style={[
                  s.rangeTabText,
                  {
                    color: active ? colors.background : colors.textSecondary,
                    fontFamily: typography.subtitle?.fontFamily,
                  },
                ]}
              >
                {r.key}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Card: Calorías ───────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
            Calorías diarias
          </Text>
          <Text style={[s.cardSubtitle, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            {RANGE_LABELS.find((r) => r.key === range)?.label}
          </Text>
        </View>
        <CaloriesChart
          data={data?.dailyCalories ?? []}
          calorieGoal={calorieGoal}
          width={CHART_WIDTH}
        />
      </View>

      {/* ── Card: Macros ────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
            Evolución de macros
          </Text>
          <Text style={[s.cardSubtitle, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Promedio del período
          </Text>
        </View>
        <MacrosChart
          data={data?.dailyMacros ?? []}
          width={CHART_WIDTH}
        />
      </View>

      {/* ── Card: Consistencia ──────────────────────────────── */}
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
            Consistencia
          </Text>
          <Text style={[s.cardSubtitle, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Últimas 5 semanas
          </Text>
        </View>
        <ConsistencyCard
          loggedDays={data?.loggedDays ?? new Set()}
          currentStreak={data?.currentStreak ?? 0}
          bestStreak={data?.bestStreak ?? 0}
        />
      </View>

      {/* ── Card: Peso ──────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
            Peso corporal
          </Text>
          <Text style={[s.cardSubtitle, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Registro manual
          </Text>
        </View>
        <WeightCard
          startDate={startDate}
          endDate={endDate}
          onInputFocus={handleWeightInputFocus}
        />
      </View>

      <View style={s.bottomPad} />
    </ScrollView>
  );

  // ── Paywall para usuarios free (blur sobre el contenido) ───────────────
  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {isPremium ? (
          content
        ) : (
          <ReportsPaywall>
            {content}
          </ReportsPaywall>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: CARD_PADDING,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 26,
  },
  premiumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  premiumBadgeText: {
    fontSize: 12,
  },
  rangeSelector: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeTabText: {
    fontSize: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: CARD_PADDING,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
  },
  cardSubtitle: {
    fontSize: 12,
  },
  bottomPad: {
    height: 32,
  },
});
