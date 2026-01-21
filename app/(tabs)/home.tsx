// app/(tabs)/home.tsx
import type { MealType } from "@/domain/models/foodLogDb";
import SmartCoachPro from "@/presentation/components/smartCoach/SmartCoachPro";
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import DonutRing from "@/presentation/components/ui/DonutRing";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import Skeleton from "@/presentation/components/ui/Skeleton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTodayMeals } from "@/presentation/hooks/diary/useTodayMeals";
import { useTodaySummary } from "@/presentation/hooks/diary/useTodaySummary";
import { useSmartCoachPro } from "@/presentation/hooks/smartCoach/useSmartCoachPro";
import { useHealthSync } from "@/presentation/hooks/health/useHealthSync";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useStaggerAnimation } from "@/presentation/hooks/ui/useStaggerAnimation";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { formatDateToSpanish } from "@/presentation/utils/date";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Componente de barra de progreso animada
 */
function AnimatedProgressBar({
  percentage,
  colors,
  loading,
}: {
  percentage: number;
  colors: any;
  loading: boolean;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(widthAnim, {
        toValue: percentage,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [percentage, loading, widthAnim]);

  return (
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
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
          backgroundColor: colors.brand,
        }}
      />
    </View>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const { profile } = useAuth();
  const { day, totals, loading, reload: reloadSummary } = useTodaySummary();
  const { meals, loading: mealsLoading, reload: reloadMeals } = useTodayMeals(day);

  // Targets
  const caloriesTarget = profile?.daily_calorie_target ?? 0;
  const proteinTarget = profile?.protein_g ?? 0;
  const carbsTarget = profile?.carbs_g ?? 0;
  const fatTarget = profile?.fat_g ?? 0;

  // Smart Coach Pro - Usar RevenueCat como fuente de verdad para premium
  const { isPremium: revenueCatPremium } = useRevenueCat();
  const profilePremium = profile?.is_premium ?? false;
  const isPremium = revenueCatPremium || profilePremium; // RevenueCat tiene prioridad
  
  // Calcular target efectivo para Smart Coach (incluye calorías quemadas si es premium)
  const effectiveTargetForCoach = useMemo(() => {
    if (caloriesTarget <= 0) return caloriesTarget;
    if (isPremium && caloriesBurned > 0) {
      return caloriesTarget + caloriesBurned;
    }
    return caloriesTarget;
  }, [caloriesTarget, isPremium, caloriesBurned]);
  
  const smartCoach = useSmartCoachPro(
    profile,
    effectiveTargetForCoach,
    totals.calories,
    totals.protein,
    totals.carbs,
    totals.fat,
    isPremium,
  );

  // Health Sync (Premium)
  const { caloriesBurned, isSyncing, syncCalories, reload: reloadHealth } = useHealthSync(isPremium);

  const hasTargets =
    caloriesTarget > 0 && proteinTarget > 0 && carbsTarget > 0 && fatTarget > 0;

  // Summary
  const caloriesConsumed = totals.calories;
  
  // Calcular target efectivo: target base + calorías quemadas (solo para premium)
  const effectiveCaloriesTarget = useMemo(() => {
    if (caloriesTarget <= 0) return 0;
    // Si es premium y tiene actividad registrada, agregar las calorías quemadas como margen
    if (isPremium && caloriesBurned > 0) {
      return caloriesTarget + caloriesBurned;
    }
    return caloriesTarget;
  }, [caloriesTarget, isPremium, caloriesBurned]);
  
  const remaining = useMemo(() => {
    if (effectiveCaloriesTarget <= 0) return 0;
    return Math.max(effectiveCaloriesTarget - caloriesConsumed, 0);
  }, [effectiveCaloriesTarget, caloriesConsumed]);

  const caloriesPct = useMemo(() => {
    if (!effectiveCaloriesTarget || effectiveCaloriesTarget <= 0) return 0;
    return Math.min((caloriesConsumed / effectiveCaloriesTarget) * 100, 100);
  }, [caloriesConsumed, effectiveCaloriesTarget]);

  const caloriesProgress = useMemo(() => {
    if (!effectiveCaloriesTarget || effectiveCaloriesTarget <= 0) return 0;
    return clamp01(caloriesConsumed / effectiveCaloriesTarget);
  }, [caloriesConsumed, effectiveCaloriesTarget]);

  const protein = { value: totals.protein, target: proteinTarget };
  const carbs = { value: totals.carbs, target: carbsTarget };
  const fat = { value: totals.fat, target: fatTarget };

  // Bottom sheet "Agregar comida"
  const [sheetOpen, setSheetOpen] = useState(false);

  // Pull to refresh
  const [refreshing, setRefreshing] = useState(false);

  // Premium Paywall
  const [paywallVisible, setPaywallVisible] = useState(false);

  // Animaciones de entrada escalonadas para las cards
  // 7 animaciones: SmartCoachPro[0], Activity[1], Restantes[2], Consumidas[3], MainCard[4], Macros[5], Meals[6]
  const cardAnimations = useStaggerAnimation(7, 80, 100);

  // Animación del FAB
  const fabScale = useRef(new Animated.Value(0)).current;
  const fabOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animar FAB cuando la pantalla está lista
    if (!loading) {
      Animated.parallel([
        Animated.spring(fabScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(fabOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, fabScale, fabOpacity]);

  // Función para refrescar todo el contenido
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Refrescar ambos hooks en paralelo
    // El Smart Coach se actualizará automáticamente cuando cambien los totals
    const refreshPromises = [reloadSummary(), reloadMeals()];
    if (isPremium) {
      refreshPromises.push(reloadHealth());
    }
    await Promise.all(refreshPromises);

    setRefreshing(false);
  }, [reloadSummary, reloadMeals, isPremium, reloadHealth]);

  // Función para refrescar después de agregar comida desde Smart Coach
  // Debe funcionar exactamente igual que pull to refresh
  const handleFoodAdded = useCallback(async () => {
    console.log("[Home] ========== INICIO handleFoodAdded ==========");
    
    // Refrescar ambos hooks en paralelo (igual que pull to refresh)
    // El Smart Coach se actualizará automáticamente cuando cambien los totals
    console.log("[Home] Ejecutando reloadSummary() y reloadMeals()...");
    await Promise.all([reloadSummary(), reloadMeals()]);
    console.log("[Home] Hooks refrescados correctamente");
    
    // No necesitamos hacer nada más - el Smart Coach se actualizará automáticamente
    // cuando los totals cambien debido a las dependencias en useSmartCoachPro
    console.log("[Home] ========== FIN handleFoodAdded ==========");
  }, [reloadSummary, reloadMeals]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerKicker}>Diario</Text>
            <Text style={s.headerTitle} numberOfLines={1}>
              {formatDateToSpanish(day)}
            </Text>
          </View>

          <Pressable
            style={s.headerIconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/calendar");
            }}
            disabled={loading}
          >
            <Feather name="calendar" size={18} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            style={s.headerIconBtn}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <Feather name="settings" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Smart Coach Pro Card */}
        {hasTargets && (
          <Animated.View
            style={{
              marginBottom: 8,
              opacity: cardAnimations[0] || 1,
              transform: cardAnimations[0]
                ? [
                    {
                      translateY: cardAnimations[0].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: cardAnimations[0],
                    },
                  ]
                : [],
            }}
          >
            <SmartCoachPro
              recommendation={smartCoach.recommendation}
              loading={smartCoach.loading}
              isPremium={isPremium}
              onFoodAdded={handleFoodAdded}
              onShowPaywall={() => setPaywallVisible(true)}
            />
          </Animated.View>
        )}

        {/* Activity Card (Premium) */}
        {isPremium && hasTargets && (
          <Animated.View
            style={{
              opacity: cardAnimations[1] || 1,
              transform: cardAnimations[1]
                ? [
                    {
                      translateY: cardAnimations[1].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: cardAnimations[1],
                    },
                  ]
                : [],
            }}
          >
            <View style={s.activityCard}>
              <View style={s.activityCardHeader}>
                <View style={s.activityIconContainer}>
                  <MaterialCommunityIcons
                    name="heart-pulse"
                    size={20}
                    color={colors.brand}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.activityTitle}>Actividad Física</Text>
                  <Text style={s.activitySubtitle}>
                    {Platform.OS === "ios" ? "Apple Health" : "Health Connect"}
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    try {
                      await syncCalories();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (error) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    }
                  }}
                  disabled={isSyncing}
                  style={({ pressed }) => [
                    s.activitySyncButton,
                    (pressed || isSyncing) && s.activitySyncButtonPressed,
                  ]}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <MaterialCommunityIcons
                      name="sync"
                      size={18}
                      color={colors.brand}
                    />
                  )}
                </Pressable>
              </View>

              <View style={s.activityContent}>
                <View style={s.activityValueContainer}>
                  <Text style={s.activityValue}>
                    {caloriesBurned > 0 ? caloriesBurned.toLocaleString() : "—"}
                  </Text>
                  <Text style={s.activityUnit}>kcal quemadas</Text>
                </View>
                {caloriesBurned > 0 && (
                  <View style={s.activityBadge}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={14}
                      color="#10B981"
                    />
                    <Text style={s.activityBadgeText}>Sincronizado</Text>
                  </View>
                )}
              </View>

              {caloriesBurned === 0 && (
                <View style={s.activityEmptyState}>
                  <Text style={s.activityEmptyText}>
                    Toca el botón de sincronizar para conectar con{" "}
                    {Platform.OS === "ios" ? "Apple Health" : "Health Connect"}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Missing targets card */}
        {!hasTargets && (
          <View style={s.noticeCard}>
            <View style={s.noticeIcon}>
              <MaterialCommunityIcons
                name="account-edit"
                size={18}
                color={colors.onCta}
              />
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.noticeTitle}>Completa tu perfil</Text>
              <Text style={s.noticeBody}>
                Define tu objetivo y tus macros para que el diario sea exacto.
              </Text>
            </View>

            <Pressable
              onPress={() => {
                if (!profile?.onboarding_completed) {
                  router.push("/(onboarding)/goal");
                } else {
                  router.push("/(tabs)/settings");
                }
              }}
              style={({ pressed }) => [
                s.noticeCta,
                pressed && s.noticeCtaPressed,
              ]}
            >
              <Text style={s.noticeCtaText}>Configurar</Text>
              <Feather name="chevron-right" size={16} color={colors.brand} />
            </Pressable>
          </View>
        )}

        {/* Summary Cards */}
        <View style={s.summaryRow}>
          {cardAnimations[2] && (
            <Animated.View
              style={{
                flex: 1,
                opacity: cardAnimations[2],
                transform: [
                  {
                    translateY: cardAnimations[2].interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                  {
                    scale: cardAnimations[2],
                  },
                ],
              }}
            >
              <MiniStat
                title="Restantes"
                value={loading ? null : `${remaining}`}
                unit="kcal"
                icon={
                  <MaterialCommunityIcons
                    name="target"
                    size={18}
                    color={colors.brand}
                  />
                }
                colors={colors}
                typography={typography}
              />
            </Animated.View>
          )}
          {cardAnimations[3] && (
            <Animated.View
              style={{
                flex: 1,
                opacity: cardAnimations[3],
                transform: [
                  {
                    translateY: cardAnimations[3].interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                  {
                    scale: cardAnimations[3] || new Animated.Value(1),
                  },
                ],
              }}
            >
              <MiniStat
                title="Consumidas"
                value={loading ? null : `${caloriesConsumed}`}
                unit="kcal"
                icon={
                  <MaterialCommunityIcons
                    name="fire"
                    size={18}
                    color={colors.cta}
                  />
                }
                colors={colors}
                typography={typography}
              />
            </Animated.View>
          )}
        </View>

        {/* Main Calories Card (Donut + skeleton) */}
        <Animated.View
          style={[
            s.card,
            cardAnimations[6] && {
              opacity: cardAnimations[6],
              transform: [
                {
                  translateY: cardAnimations[6].interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
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
              <Text style={s.cardTitle}>Calorías</Text>
            </View>

            <View style={s.chip}>
              <Feather name="flag" size={14} color={colors.textSecondary} />
              <Text style={s.chipText}>
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
              progress={loading ? 0 : caloriesProgress}
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
                  <Text style={s.bigValue}>
                    {caloriesConsumed}
                    <Text style={s.bigUnit}> kcal</Text>
                  </Text>

                  <View style={s.hintRow}>
                    <Feather
                      name="info"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={s.hintText}>
                      {caloriesTarget
                        ? `${remaining} kcal para llegar a tu objetivo`
                        : "Define tu objetivo para ver restantes"}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Barra de progreso animada */}
          <AnimatedProgressBar
            percentage={caloriesPct}
            colors={colors}
            loading={loading}
          />
        </Animated.View>

        {/* Macros */}
        <View style={s.sectionHeader}>
          <View style={s.sectionTitleRow}>
            <MaterialCommunityIcons
              name="chart-donut"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={s.sectionTitle}>Macros</Text>
          </View>
          <Pressable onPress={() => {}}>
            <Text style={s.sectionAction}>Ver detalle</Text>
          </Pressable>
        </View>

        <View style={s.macrosRow}>
          {cardAnimations[5] && (
            <>
              <Animated.View
                style={{
                  flex: 1,
                  opacity: cardAnimations[5],
                  transform: [
                    {
                      translateY: cardAnimations[5].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                }}
              >
                <MacroCard
                  label="Proteína"
                  icon="food-steak"
                  value={protein.value}
                  target={protein.target}
                  loading={loading}
                  colors={colors}
                  typography={typography}
                />
              </Animated.View>
              <Animated.View
                style={{
                  flex: 1,
                  opacity: cardAnimations[5],
                  transform: [
                    {
                      translateY: cardAnimations[5].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                }}
              >
                <MacroCard
                  label="Carbs"
                  icon="bread-slice"
                  value={carbs.value}
                  target={carbs.target}
                  loading={loading}
                  colors={colors}
                  typography={typography}
                />
              </Animated.View>
              <Animated.View
                style={{
                  flex: 1,
                  opacity: cardAnimations[5],
                  transform: [
                    {
                      translateY: cardAnimations[5].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                }}
              >
                <MacroCard
                  label="Grasas"
                  icon="peanut"
                  value={fat.value}
                  target={fat.target}
                  loading={loading}
                  colors={colors}
                  typography={typography}
                />
              </Animated.View>
            </>
          )}
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
          <Pressable onPress={() => router.push("/(tabs)/diary")}>
            <Text style={s.sectionAction}>Ver todo</Text>
          </Pressable>
        </View>

        <Animated.View
          style={[
            s.card,
            cardAnimations[6] && {
              opacity: cardAnimations[6],
              transform: [
                {
                  translateY: cardAnimations[6].interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <MealRow
            title="Desayuno"
            icon="coffee"
            count={meals.breakfast.count}
            kcal={meals.breakfast.calories}
            totalKcal={caloriesConsumed}
            loading={mealsLoading || loading}
            colors={colors}
            typography={typography}
            onOpen={() =>
              router.push({
                pathname: "/(tabs)/diary",
                params: { meal: "breakfast" },
              })
            }
            onAdd={() =>
              router.push({
                pathname: "/(tabs)/add-food",
                params: { meal: "breakfast" },
              })
            }
          />
          <View style={s.divider} />

          <MealRow
            title="Almuerzo"
            icon="food"
            count={meals.lunch.count}
            kcal={meals.lunch.calories}
            totalKcal={caloriesConsumed}
            loading={mealsLoading || loading}
            colors={colors}
            typography={typography}
            onOpen={() =>
              router.push({
                pathname: "/(tabs)/diary",
                params: { meal: "lunch" },
              })
            }
            onAdd={() =>
              router.push({
                pathname: "/(tabs)/add-food",
                params: { meal: "lunch" },
              })
            }
          />

          <View style={s.divider} />

          <MealRow
            title="Cena"
            icon="food-variant"
            count={meals.dinner.count}
            kcal={meals.dinner.calories}
            totalKcal={caloriesConsumed}
            loading={mealsLoading || loading}
            colors={colors}
            typography={typography}
            onOpen={() =>
              router.push({
                pathname: "/(tabs)/diary",
                params: { meal: "dinner" },
              })
            }
            onAdd={() =>
              router.push({
                pathname: "/(tabs)/add-food",
                params: { meal: "dinner" },
              })
            }
          />

          <View style={s.divider} />

          <MealRow
            title="Snack"
            icon="food-apple"
            count={meals.snack.count}
            kcal={meals.snack.calories}
            totalKcal={caloriesConsumed}
            loading={mealsLoading || loading}
            colors={colors}
            typography={typography}
            onOpen={() =>
              router.push({
                pathname: "/(tabs)/diary",
                params: { meal: "snack" },
              })
            }
            onAdd={() =>
              router.push({
                pathname: "/(tabs)/add-food",
                params: { meal: "snack" }, // ✅ FIX
              })
            }
          />
        </Animated.View>

        {/* bottom spacer for FAB */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Premium Paywall Modal */}
      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => {
          // El perfil se actualiza automáticamente vía refreshProfile
          // El Smart Coach se actualizará automáticamente cuando cambie isPremium
        }}
      />

      {/* Bottom CTA -> sheet con animación */}
      <Animated.View
        style={[
          s.fab,
          {
            opacity: fabOpacity,
            transform: [{ scale: fabScale }],
          },
        ]}
      >
        <PrimaryButton
          title="Agregar comida"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSheetOpen(true);
          }}
          icon={<Feather name="plus" size={18} color={colors.onCta} />}
        />
      </Animated.View>

      <MealPickerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        colors={colors}
        typography={typography}
        onPick={(meal) => {
          setSheetOpen(false);
          requestAnimationFrame(() => goAddFood(meal));
        }}
      />
    </SafeAreaView>
  );

  function goAddFood(meal: MealType) {
    router.push({
      pathname: "/(tabs)/add-food",
      params: { meal },
    });
  }
}

function MealPickerSheet({
  open,
  onClose,
  onPick,
  colors,
  typography,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (meal: MealType) => void;
  colors: any;
  typography: any;
}) {
  const translateY = useRef(new Animated.Value(420)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 420,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [open, backdrop, translateY]);

  if (!open) return null;

  return (
    <View style={sheet.wrap} pointerEvents="box-none">
      <Animated.View style={[sheet.backdrop, { opacity: backdrop }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          sheet.panel,
          {
            transform: [{ translateY }],
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[sheet.handle, { backgroundColor: colors.border }]} />

        <View style={sheet.headRow}>
          <Text
            style={{
              fontFamily: typography.subtitle?.fontFamily,
              fontSize: 16,
              color: colors.textPrimary,
            }}
          >
            Agregar comida
          </Text>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            style={sheet.closeBtn}
          >
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={{ gap: 10, marginTop: 8 }}>
          <SheetOption
            title="Desayuno"
            subtitle="Café, pan, avena…"
            icon="coffee"
            colors={colors}
            typography={typography}
            onPress={() => onPick("breakfast")}
          />
          <SheetOption
            title="Almuerzo"
            subtitle="Plato principal…"
            icon="food"
            colors={colors}
            typography={typography}
            onPress={() => onPick("lunch")}
          />
          <SheetOption
            title="Cena"
            subtitle="Liviano o completo…"
            icon="food-variant"
            colors={colors}
            typography={typography}
            onPress={() => onPick("dinner")}
          />
          <SheetOption
            title="Snack"
            subtitle="Colación / picoteo…"
            icon="food-apple"
            colors={colors}
            typography={typography}
            onPress={() => onPick("snack")}
          />
        </View>
      </Animated.View>
    </View>
  );
}

function SheetOption({
  title,
  subtitle,
  icon,
  colors,
  typography,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  colors: any;
  typography: any;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? "rgba(34,197,94,0.10)" : "transparent",
          borderRadius: 18,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
      ]}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flex: 1,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
          }}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={colors.textPrimary}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: typography.subtitle?.fontFamily,
              fontSize: 15,
              color: colors.textPrimary,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: typography.body?.fontFamily,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}

function MiniStat({
  title,
  value,
  unit,
  icon,
  colors,
  typography,
}: {
  title: string;
  value: string | null; // null => skeleton
  unit: string;
  icon: React.ReactNode;
  colors: any;
  typography: any;
}) {
  return (
    <View
      style={[
        mini.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={mini.row}>
        <View style={[mini.iconWrap, { borderColor: colors.border }]}>
          {icon}
        </View>
        <Text
          style={[
            mini.title,
            {
              color: colors.textSecondary,
              fontFamily: typography.body?.fontFamily,
            },
          ]}
        >
          {title}
        </Text>
      </View>

      {value === null ? (
        <Skeleton
          height={20}
          width="55%"
          radius={10}
          bg={colors.border}
          highlight={colors.border}
        />
      ) : (
        <Text
          style={[
            mini.value,
            {
              color: colors.textPrimary,
              fontFamily: typography.subtitle?.fontFamily,
            },
          ]}
        >
          {value}{" "}
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.body?.fontFamily,
              fontSize: 12,
            }}
          >
            {unit}
          </Text>
        </Text>
      )}
    </View>
  );
}

const mini = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  title: { fontSize: 13 },
  value: { fontSize: 18 },
});

const MacroCard = React.memo(function MacroCard({
  label,
  icon,
  value,
  target,
  loading,
  colors,
  typography,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  value: number;
  target: number;
  loading: boolean;
  colors: any;
  typography: any;
}) {
  const pct = useMemo(() => {
    if (!target || target <= 0) return 0;
    return Math.min(value / target, 1);
  }, [value, target]);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(progressAnim, {
        toValue: pct,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [pct, loading, progressAnim]);

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 12,
        gap: 10,
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

      {loading ? (
        <Skeleton
          height={20}
          width="50%"
          radius={10}
          bg={colors.border}
          highlight={colors.border}
        />
      ) : (
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 18,
            color: colors.textPrimary,
          }}
        >
          {value}
          <Text
            style={{
              fontFamily: typography.body?.fontFamily,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {" "}
            g
          </Text>
        </Text>
      )}

      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.border,
          overflow: "hidden",
          opacity: loading ? 0.6 : 1,
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

      <Text
        style={{
          fontFamily: typography.body?.fontFamily,
          fontSize: 12,
          color: colors.textSecondary,
        }}
      >
        {target ? `de ${target} g` : "Sin objetivo"}
      </Text>
    </View>
  );
});

/**
 * MealRow premium:
 * - subtitle (items + kcal)
 * - chip kcal
 * - mini progress kcal_meal / kcal_total_dia
 */
const MealRow = React.memo(function MealRow({
  title,
  icon,
  count,
  kcal,
  totalKcal,
  loading,
  colors,
  typography,
  onOpen,
  onAdd,
}: {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  count: number;
  kcal: number;
  totalKcal: number;
  loading: boolean;
  colors: any;
  typography: any;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const pct = useMemo(() => {
    if (!totalKcal || totalKcal <= 0) return 0;
    return Math.min(kcal / totalKcal, 1);
  }, [kcal, totalKcal]);

  const subtitle = useMemo(() => {
    if (loading) return "Cargando…";
    if (count === 0) return "Sin registros";
    if (count === 1) return `1 item · ${kcal} kcal`;
    return `${count} items · ${kcal} kcal`;
  }, [loading, count, kcal]);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onOpen();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 8,
      }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flex: 1,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={colors.textPrimary}
          />
        </View>

        <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              flex: 1,
              fontFamily: typography.subtitle?.fontFamily,
              fontSize: 15,
              color: colors.textPrimary,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>

          <View
            style={{
              height: 26,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: typography.body?.fontFamily,
                fontSize: 12,
                color: colors.textSecondary,
              }}
            >
              {loading ? "—" : `${kcal} kcal`}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontFamily: typography.body?.fontFamily,
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          {subtitle}
        </Text>

          <AnimatedProgressBar
            percentage={pct * 100}
            colors={colors}
            loading={loading}
          />
        </View>
      </Animated.View>

      {/* Evita que el tap del botón dispare onOpen */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onAdd();
        }}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            height: 36,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? "rgba(34,197,94,0.10)" : "transparent",
          },
        ]}
      >
        <Feather name="plus" size={16} color={colors.brand} />
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 13,
            color: colors.brand,
          }}
        >
          Añadir
        </Text>
      </Pressable>
    </Pressable>
  );
});

const sheet = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 18,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});

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
    headerKicker: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    headerTitle: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 28,
      color: colors.textPrimary,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    summaryRow: { flexDirection: "row", gap: 10 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },

    noticeCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
    },
    noticeIcon: {
      width: 38,
      height: 38,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cta,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noticeTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    noticeBody: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
    noticeCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      height: 36,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    noticeCtaPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
    noticeCtaText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 13,
      color: colors.brand,
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

    macrosRow: { flexDirection: "row", gap: 10 },

    divider: { height: 1, backgroundColor: colors.border, opacity: 0.7 },

    fab: { position: "absolute", left: 18, right: 18, bottom: 18 },

    // Activity Card Styles (Premium)
    activityCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    activityCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    activityIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.brand + "15",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.brand + "30",
    },
    activityTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    activitySubtitle: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    activitySyncButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    activitySyncButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.95 }],
    },
    activityContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    activityValueContainer: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
    },
    activityValue: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 28,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    activityUnit: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    activityBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "#10B98115",
      borderWidth: 1,
      borderColor: "#10B98130",
    },
    activityBadgeText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 11,
      fontWeight: "600",
      color: "#10B981",
    },
    activityEmptyState: {
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    activityEmptyText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
}
