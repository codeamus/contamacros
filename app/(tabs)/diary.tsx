// app/(tabs)/diary.tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { FoodLogDb, MealType } from "@/domain/models/foodLogDb";
import DateHeader from "@/presentation/components/ui/DateHeader";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useStaggerAnimation } from "@/presentation/hooks/ui/useStaggerAnimation";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MEAL_LABELS } from "@/presentation/utils/labels";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
type MealFilter = MealType | "all";

function isMealType(v: any): v is MealType {
  return v === "breakfast" || v === "lunch" || v === "dinner" || v === "snack";
}

function sumLogs(logs: FoodLogDb[]) {
  return logs.reduce(
    (acc, it) => {
      acc.calories += it.calories || 0;
      acc.protein += it.protein_g || 0;
      acc.carbs += it.carbs_g || 0;
      acc.fat += it.fat_g || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
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

function mealIcon(
  meal: MealType,
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

function filterLabel(k: MealFilter) {
  if (k === "all") return "Todas";
  return MEAL_LABELS[k];
}

/**
 * Barra de progreso animada para macros
 */
function AnimatedMacroProgress({
  label,
  value,
  target,
  icon,
  colors,
  typography,
  animation,
}: {
  label: string;
  value: number;
  target: number | null;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  colors: any;
  typography: any;
  animation: Animated.Value;
}) {
  const pct = useMemo(() => (target ? clamp01(value / target) : 0), [value, target]);
  const showTarget = useMemo(() => target && Number.isFinite(target), [target]);
  
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, progressAnim]);

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={{
        flex: 1,
        gap: 10,
        opacity,
        transform: [{ translateY }],
      }}
    >
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
        <Animated.View
          style={{
            height: "100%",
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
            backgroundColor: colors.brand,
          }}
        />
      </View>
    </Animated.View>
  );
}

const MacroProgress = React.memo(AnimatedMacroProgress);

/**
 * Componente de item de comida con animación
 */
function FoodItem({
  item,
  index,
  colors,
  typography,
  styles,
  onPress,
  onLongPress,
}: {
  item: FoodLogDb;
  index: number;
  colors: any;
  typography: any;
  styles: any;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const itemAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(itemAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 50,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [itemAnim, index]);

  return (
    <Animated.View
      style={{
        opacity: itemAnim,
        transform: [
          {
            translateX: itemAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }),
          },
        ],
      }}
    >
      <Pressable
        style={({ pressed }) => [
          styles.item,
          pressed && {
            opacity: 0.95,
            transform: [{ scale: 0.997 }],
          },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.itemMetaRow}>
            <View style={styles.metaChip}>
              <MaterialCommunityIcons
                name="fire"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.metaChipText}>
                {Math.round(item.calories || 0)} kcal
              </Text>
            </View>

            <View style={styles.metaChip}>
              <MaterialCommunityIcons
                name="food-steak"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.metaChipText}>
                P {Math.round(item.protein_g || 0)}
              </Text>
            </View>

            <View style={styles.metaChip}>
              <MaterialCommunityIcons
                name="bread-slice"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.metaChipText}>
                C {Math.round(item.carbs_g || 0)}
              </Text>
            </View>

            <View style={styles.metaChip}>
              <MaterialCommunityIcons
                name="peanut"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.metaChipText}>
                F {Math.round(item.fat_g || 0)}
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
    </Animated.View>
  );
}

export default function DiaryScreen() {
  const params = useLocalSearchParams<{ meal?: string; day?: string }>();

  const { profile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  // Si hay un parámetro 'day' explícito en la navegación, usarlo
  // Si no, siempre usar el día de hoy (no persistir días anteriores)
  const day = params.day && params.day !== "" ? params.day : todayStrLocal();

  const [logs, setLogs] = useState<FoodLogDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [filterMeal, setFilterMeal] = useState<MealFilter>("all");

  useEffect(() => {
    const m = params.meal;
    if (isMealType(m)) setFilterMeal(m);
    else setFilterMeal("all");
  }, [params.meal]);

  const totals = useMemo(() => sumLogs(logs), [logs]);
  const grouped = useMemo(() => groupByMeal(logs), [logs]);

  const load = useCallback(
    async (mode: "normal" | "refresh" = "normal") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);

      setErr(null);

      const res = await foodLogRepository.listByDay(day);
      if (!res.ok) {
        setErr(res.message);
        setLogs([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setLogs(res.data);
      setLoading(false);
      setRefreshing(false);
    },
    [day],
  );

  // Función para volver al día de hoy
  const goToToday = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Limpiar el parámetro day navegando sin parámetros
    router.replace({
      pathname: "/(tabs)/diary",
      params: {},
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Cuando se enfoca desde el tab (sin parámetros explícitos), 
      // limpiar cualquier parámetro day persistente para mostrar siempre el día de hoy
      if (!params.day || params.day === "") {
        // No hay parámetro, usar día de hoy (ya está configurado arriba)
        load("normal");
      } else {
        // Hay un parámetro explícito (viene del calendario), usarlo
        load("normal");
      }
    }, [load, params.day]),
  );

  async function onDelete(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Eliminar", "¿Eliminar este item del diario?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  function onOpenItemActions(it: FoodLogDb) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(it.name, "¿Qué deseas hacer?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Editar",
        onPress: () => {
          router.push({
            pathname: "/(tabs)/add-food",
            params: { logId: it.id },
          });
        },
      },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => onDelete(it.id),
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

  const visibleMeals: MealType[] =
    filterMeal === "all" ? MEAL_ORDER : [filterMeal];

  const addMealParam: MealType | undefined =
    filterMeal === "all" ? undefined : filterMeal;

  // Animaciones escalonadas
  const summaryAnimations = useStaggerAnimation(4, 80, 100);
  const mealAnimations = useStaggerAnimation(visibleMeals.length, 100, 300);
  
  // Animación de la barra de calorías
  const caloriesProgressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(caloriesProgressAnim, {
        toValue: kcalPct,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [kcalPct, loading, caloriesProgressAnim]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              goToToday();
            }}
            tintColor={colors.textSecondary}
          />
        }
      >
        {/* Header con componente reutilizable */}
        <DateHeader
          dateStr={day}
          kicker="Diario"
          onRefresh={goToToday}
          loading={loading}
          rightAction={{
            icon: "plus",
            onPress: () => {
              router.push({
                pathname: "/(tabs)/add-food",
                params: addMealParam ? { meal: addMealParam } : undefined,
              });
            },
          }}
        />

        {/* Filter chips con animación */}
        <Animated.View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 2,
            opacity: summaryAnimations[0],
            transform: [
              {
                translateY: summaryAnimations[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          }}
        >
          {(["all", "breakfast", "lunch", "dinner", "snack"] as const).map(
            (k, index) => {
              const active = filterMeal === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFilterMeal(k);
                  }}
                  style={({ pressed }) => [
                    s.chipPill,
                    {
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active
                        ? `${colors.brand}15`
                        : colors.surface,
                      opacity: pressed ? 0.8 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      k === "all" ? "filter-variant" : mealIcon(k as MealType)
                    }
                    size={16}
                    color={active ? colors.brand : colors.textSecondary}
                  />
                  <Text
                    style={[
                      s.chipPillText,
                      {
                        color: active
                          ? colors.brand
                          : colors.textSecondary,
                        fontFamily: typography.subtitle?.fontFamily,
                        fontWeight: active ? "600" : "400",
                      },
                    ]}
                  >
                    {filterLabel(k)}
                  </Text>
                </Pressable>
              );
            },
          )}
        </Animated.View>

        {!!err && (
          <Animated.View
            style={[
              s.alert,
              {
                opacity: summaryAnimations[0],
                transform: [
                  {
                    translateY: summaryAnimations[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Feather name="alert-triangle" size={16} color={colors.onCta} />
            <Text style={s.alertText}>{err}</Text>
          </Animated.View>
        )}

        {/* Summary Card con animaciones */}
        <Animated.View
          style={[
            s.card,
            {
              opacity: summaryAnimations[0],
              transform: [
                {
                  translateY: summaryAnimations[0].interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
                {
                  scale: summaryAnimations[0].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={s.cardHeaderRow}>
            <View style={s.cardHeaderLeft}>
              <View style={s.badge}>
                <MaterialCommunityIcons
                  name="fire"
                  size={18}
                  color={colors.onCta}
                />
              </View>
              <Text style={s.cardTitle}>
                {day === todayStrLocal() ? "Resumen de hoy" : "Resumen del día"}
              </Text>
            </View>

            {targetKcal && (
              <View style={s.smallChip}>
                <Feather name="flag" size={14} color={colors.textSecondary} />
                <Text style={s.smallChipText}>{targetKcal} kcal</Text>
              </View>
            )}
          </View>

          <Text style={s.bigValue}>
            {Math.round(totals.calories)}
            <Text style={s.bigUnit}> kcal</Text>
          </Text>

          <View style={s.progressTrack}>
            <Animated.View
              style={[
                s.progressFill,
                {
                  width: caloriesProgressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
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
              animation={summaryAnimations[1]}
            />
            <MacroProgress
              label="Carbs"
              value={totals.carbs}
              target={targetC}
              icon="bread-slice"
              colors={colors}
              typography={typography}
              animation={summaryAnimations[2]}
            />
            <MacroProgress
              label="Grasas"
              value={totals.fat}
              target={targetF}
              icon="peanut"
              colors={colors}
              typography={typography}
              animation={summaryAnimations[3]}
            />
          </View>
        </Animated.View>

        {/* Meals Section */}
        <Animated.View
          style={[
            s.sectionHeader,
            {
              opacity: summaryAnimations[0],
              transform: [
                {
                  translateY: summaryAnimations[0].interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={s.sectionTitleRow}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={s.sectionTitle}>
              {filterMeal === "all" ? "Comidas" : filterLabel(filterMeal)}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: "/(tabs)/add-food",
                params: addMealParam ? { meal: addMealParam } : undefined,
              });
            }}
          >
            <Text style={s.sectionAction}>Añadir</Text>
          </Pressable>
        </Animated.View>

        <View style={{ gap: 12 }}>
          {visibleMeals.map((m, mealIndex) => {
            const items = grouped[m];
            const isEmpty = !items.length;
            if (filterMeal === "all" && isEmpty) return null;

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
                  { kcal: 0, p: 0, c: 0, f: 0 },
                );

            const mealAnim = mealAnimations[mealIndex] || mealAnimations[0];

            return (
              <Animated.View
                key={m}
                style={[
                  s.mealCard,
                  {
                    opacity: mealAnim,
                    transform: [
                      {
                        translateY: mealAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        }),
                      },
                      {
                        scale: mealAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.96, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={s.mealHeader}>
                  <View style={s.mealHeaderLeft}>
                    <View style={s.mealIconWrap}>
                      <MaterialCommunityIcons
                        name={mealIcon(m)}
                        size={20}
                        color={colors.textPrimary}
                      />
                    </View>

                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={s.mealTitle}>{MEAL_LABELS[m]}</Text>
                      <Text style={s.mealSub} numberOfLines={1}>
                        {isEmpty
                          ? "Sin registros"
                          : `${Math.round(mealTotals.kcal)} kcal · P ${Math.round(
                              mealTotals.p,
                            )} · C ${Math.round(mealTotals.c)} · F ${Math.round(
                              mealTotals.f,
                            )}`}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({
                        pathname: "/(tabs)/add-food",
                        params: { meal: m },
                      });
                    }}
                    style={({ pressed }) => [
                      s.mealAddBtn,
                      pressed && {
                        opacity: 0.92,
                        transform: [{ scale: 0.98 }],
                      },
                    ]}
                  >
                    <Feather name="plus" size={16} color={colors.brand} />
                    <Text style={s.mealAddText}>Añadir</Text>
                  </Pressable>
                </View>

                {isEmpty ? (
                  <View style={s.mealEmpty}>
                    <MaterialCommunityIcons
                      name="clipboard-text-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text style={s.mealEmptyText}>
                      Aún no registras {MEAL_LABELS[m].toLowerCase()}.
                    </Text>

                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push({
                          pathname: "/(tabs)/add-food",
                          params: { meal: m },
                        });
                      }}
                      style={({ pressed }) => [
                        s.mealEmptyBtn,
                        pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
                      ]}
                    >
                      <Feather name="plus" size={14} color={colors.brand} />
                      <Text style={s.mealEmptyBtnText}>Agregar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {items.map((it, itemIndex) => (
                      <FoodItem
                        key={it.id}
                        item={it}
                        index={itemIndex}
                        colors={colors}
                        typography={typography}
                        styles={s}
                        onPress={() => onOpenItemActions(it)}
                        onLongPress={() => onDelete(it.id)}
                      />
                    ))}
                  </View>
                )}
              </Animated.View>
            );
          })}

          {filterMeal === "all" && !loading && logs.length === 0 && (
            <Animated.View
              style={[
                s.emptyCard,
                {
                  opacity: summaryAnimations[0],
                  transform: [
                    {
                      translateY: summaryAnimations[0].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: summaryAnimations[0].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
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

              <View style={{ marginTop: 12, width: "100%" }}>
                <PrimaryButton
                  title="Agregar comida"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push("/(tabs)/add-food");
                  }}
                  disabled={loading}
                  icon={<Feather name="plus" size={18} color={colors.onCta} />}
                />
              </View>
            </Animated.View>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { padding: 18, gap: 14 },

    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 2,
    },
    chipPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      height: 36,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipPillText: { fontSize: 13 },

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

    smallChip: {
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
    smallChipText: {
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

    mealEmpty: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    mealEmptyText: {
      flex: 1,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
    mealEmptyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mealEmptyBtnText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 12,
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
  });
}
