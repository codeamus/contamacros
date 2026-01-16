import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { FoodLogDb, MealType } from "@/domain/models/foodLogDb";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MEAL_LABELS } from "@/presentation/utils/mealLabels";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function sumLogs(logs: FoodLogDb[]) {
  return logs.reduce(
    (acc, it) => {
      acc.calories += it.calories || 0;
      acc.protein += it.protein_g || 0;
      acc.carbs += it.carbs_g || 0;
      acc.fat += it.fat_g || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function groupByMeal(logs: FoodLogDb[]) {
  const map: Record<MealType, FoodLogDb[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const it of logs) map[it.meal].push(it);
  return map;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function MacroProgress({
  label,
  value,
  target,
  icon,
  colors,
  typography,
}: {
  label: string;
  value: number;
  target: number | null;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  colors: any;
  typography: any;
}) {
  const pct = target ? clamp01(value / target) : 0;
  const showTarget = target && Number.isFinite(target);

  return (
    <View style={{ flex: 1, gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={colors.textSecondary}
          />
          <Text
            style={{
              fontFamily: typography.subtitle?.fontFamily,
              fontSize: 13,
              color: colors.textSecondary,
            }}
          >
            {label}
          </Text>
        </View>

        <Text
          style={{
            fontFamily: typography.body?.fontFamily,
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          {Math.round(value)}g
          {showTarget ? ` / ${Math.round(target as number)}g` : ""}
        </Text>
      </View>

      <View
        style={{
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            backgroundColor: colors.brand,
          }}
        />
      </View>
    </View>
  );
}

function mealIcon(
  meal: MealType
): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  switch (meal) {
    case "breakfast":
      return "coffee";
    case "lunch":
      return "food";
    case "dinner":
      return "food-variant";
    case "snack":
      return "cookie";
    default:
      return "silverware-fork-knife";
  }
}

export default function DiaryScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const day = todayStrLocal();

  const [logs, setLogs] = useState<FoodLogDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => sumLogs(logs), [logs]);
  const grouped = useMemo(() => groupByMeal(logs), [logs]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const res = await foodLogRepository.listByDay(day);
    if (!res.ok) {
      setErr(res.message);
      setLogs([]);
      setLoading(false);
      return;
    }

    setLogs(res.data);
    setLoading(false);
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onDelete(id: string) {
    Alert.alert("Eliminar", "¿Eliminar este item del diario?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const res = await foodLogRepository.remove(id);
          if (!res.ok) {
            setErr(res.message);
            return;
          }
          setLogs((prev) => prev.filter((x) => x.id !== id));
        },
      },
    ]);
  }

  const targetKcal = profile?.daily_calorie_target ?? null;
  const targetP = profile?.protein_g ?? null;
  const targetC = profile?.carbs_g ?? null;
  const targetF = profile?.fat_g ?? null;

  const kcalPct = targetKcal ? clamp01(totals.calories / targetKcal) : 0;
  const kcalRemaining = targetKcal
    ? Math.max(targetKcal - totals.calories, 0)
    : null;

  const s = makeStyles(colors, typography);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>Diario</Text>
            <Text style={s.title}>{day}</Text>
          </View>

          <Pressable style={s.iconBtn} onPress={load} disabled={loading}>
            <Feather name="refresh-cw" size={18} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            style={s.iconBtn}
            onPress={() => router.push("/(tabs)/add-food")}
          >
            <Feather name="plus" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Error */}
        {!!err && (
          <View style={s.alert}>
            <Feather name="alert-triangle" size={16} color={colors.onCta} />
            <Text style={s.alertText}>{err}</Text>
          </View>
        )}

        {/* Summary */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <View style={s.cardHeaderLeft}>
              <View style={s.badge}>
                <MaterialCommunityIcons
                  name="fire"
                  size={18}
                  color={colors.onCta}
                />
              </View>
              <Text style={s.cardTitle}>Resumen de hoy</Text>
            </View>

            {targetKcal && (
              <View style={s.chip}>
                <Feather name="flag" size={14} color={colors.textSecondary} />
                <Text style={s.chipText}>{targetKcal} kcal</Text>
              </View>
            )}
          </View>

          <Text style={s.bigValue}>
            {Math.round(totals.calories)}
            <Text style={s.bigUnit}> kcal</Text>
          </Text>

          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${kcalPct * 100}%` }]} />
          </View>

          <View style={s.hintRow}>
            <MaterialCommunityIcons
              name="target"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={s.hintText}>
              {kcalRemaining === null
                ? "Define tu objetivo para ver restantes"
                : `${Math.round(kcalRemaining)} kcal restantes`}
            </Text>
          </View>

          <View style={{ marginTop: 6, gap: 14 }}>
            <MacroProgress
              label="Proteína"
              value={totals.protein}
              target={targetP}
              icon="food-steak"
              colors={colors}
              typography={typography}
            />
            <MacroProgress
              label="Carbs"
              value={totals.carbs}
              target={targetC}
              icon="bread-slice"
              colors={colors}
              typography={typography}
            />
            <MacroProgress
              label="Grasas"
              value={totals.fat}
              target={targetF}
              icon="peanut"
              colors={colors}
              typography={typography}
            />
          </View>
        </View>

        {/* Meals */}
        <View style={s.sectionHeader}>
          <View style={s.sectionTitleRow}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={s.sectionTitle}>Comidas</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/add-food")}>
            <Text style={s.sectionAction}>Añadir</Text>
          </Pressable>
        </View>

        {/* Meal sections */}
        <View style={{ gap: 12 }}>
          {MEAL_ORDER.map((m) => {
            const items = grouped[m];
            const isEmpty = !items.length;

            const mealTotals = isEmpty
              ? { kcal: 0, p: 0, c: 0, f: 0 }
              : items.reduce(
                  (acc, it) => {
                    acc.kcal += it.calories || 0;
                    acc.p += it.protein_g || 0;
                    acc.c += it.carbs_g || 0;
                    acc.f += it.fat_g || 0;
                    return acc;
                  },
                  { kcal: 0, p: 0, c: 0, f: 0 }
                );

            return (
              <View key={m} style={s.mealCard}>
                <View style={s.mealHeader}>
                  <View style={s.mealHeaderLeft}>
                    <View style={s.mealIconWrap}>
                      <MaterialCommunityIcons
                        name={mealIcon(m)}
                        size={20}
                        color={colors.textPrimary}
                      />
                    </View>
                    <View style={{ gap: 2 }}>
                      <Text style={s.mealTitle}>{MEAL_LABELS[m]}</Text>
                      <Text style={s.mealSub}>
                        {isEmpty
                          ? "Sin registros"
                          : `${Math.round(
                              mealTotals.kcal
                            )} kcal · P ${Math.round(
                              mealTotals.p
                            )} · C ${Math.round(mealTotals.c)} · F ${Math.round(
                              mealTotals.f
                            )}`}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => router.push("/(tabs)/add-food")}
                    style={({ pressed }) => [
                      s.mealAddBtn,
                      pressed && {
                        opacity: 0.92,
                        transform: [{ scale: 0.99 }],
                      },
                    ]}
                  >
                    <Feather name="plus" size={16} color={colors.brand} />
                    <Text style={s.mealAddText}>Añadir</Text>
                  </Pressable>
                </View>

                {!isEmpty && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {items.map((it) => (
                      <Pressable
                        key={it.id}
                        style={({ pressed }) => [
                          s.item,
                          pressed && {
                            opacity: 0.95,
                            transform: [{ scale: 0.997 }],
                          },
                        ]}
                        onLongPress={() => onDelete(it.id)}
                      >
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={s.itemName} numberOfLines={1}>
                            {it.name}
                          </Text>
                          <View style={s.itemMetaRow}>
                            <View style={s.metaChip}>
                              <MaterialCommunityIcons
                                name="fire"
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text style={s.metaChipText}>
                                {Math.round(it.calories || 0)} kcal
                              </Text>
                            </View>

                            <View style={s.metaChip}>
                              <MaterialCommunityIcons
                                name="food-steak"
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text style={s.metaChipText}>
                                P {Math.round(it.protein_g || 0)}
                              </Text>
                            </View>

                            <View style={s.metaChip}>
                              <MaterialCommunityIcons
                                name="bread-slice"
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text style={s.metaChipText}>
                                C {Math.round(it.carbs_g || 0)}
                              </Text>
                            </View>

                            <View style={s.metaChip}>
                              <MaterialCommunityIcons
                                name="peanut"
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text style={s.metaChipText}>
                                F {Math.round(it.fat_g || 0)}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <MaterialCommunityIcons
                          name="dots-vertical"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {!loading && logs.length === 0 && (
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={22}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={s.emptyTitle}>Aún no registras comidas hoy</Text>
              <Text style={s.emptyText}>
                Empieza agregando tu primera comida para ver tus macros.
              </Text>

              <View style={{ marginTop: 12 }}>
                <PrimaryButton
                  title="Agregar comida"
                  onPress={() => router.push("/(tabs)/add-food")}
                  disabled={loading}
                  icon={<Feather name="plus" size={18} color={colors.onCta} />}
                />
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom CTA fijo (si ya tienes uno global, puedes quitar este) */}
      {logs.length > 0 && (
        <View style={s.fab}>
          <PrimaryButton
            title="Agregar comida"
            onPress={() => router.push("/(tabs)/add-food")}
            disabled={loading}
            icon={<Feather name="plus" size={18} color={colors.onCta} />}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { padding: 18, gap: 14 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 2,
    },
    kicker: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    title: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 26,
      color: colors.textPrimary,
    },

    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    alert: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.cta,
      borderWidth: 1,
      borderColor: colors.border,
    },
    alertText: {
      flex: 1,
      color: colors.onCta,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      lineHeight: 16,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.cta,
      borderWidth: 1,
      borderColor: colors.border,
    },

    cardTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },

    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      height: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    chipText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    bigValue: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 34,
      color: colors.textPrimary,
    },
    bigUnit: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },

    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressFill: { height: "100%", backgroundColor: colors.brand },

    hintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    hintText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    sectionAction: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.brand,
    },

    mealCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },

    mealHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    mealHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },

    mealIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },

    mealTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 15,
      color: colors.textPrimary,
    },
    mealSub: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    mealAddBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      height: 36,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    mealAddText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 13,
      color: colors.brand,
    },

    item: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    itemName: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },

    itemMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    metaChipText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 8,
      alignItems: "center",
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
      marginTop: 4,
    },
    emptyText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
    },

    fab: { position: "absolute", left: 18, right: 18, bottom: 18 },
  });
}
