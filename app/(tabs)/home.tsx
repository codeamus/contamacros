// app/(tabs)/home.tsx
import type { MealType } from "@/domain/models/foodLogDb";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTodayMeals } from "@/presentation/hooks/diary/useTodayMeals";
import { useTodaySummary } from "@/presentation/hooks/diary/useTodaySummary";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const { profile } = useAuth();
  const { day, totals, loading } = useTodaySummary();
  const { meals, loading: mealsLoading } = useTodayMeals(day);

  // Targets
  const caloriesTarget = profile?.daily_calorie_target ?? 0;
  const proteinTarget = profile?.protein_g ?? 0;
  const carbsTarget = profile?.carbs_g ?? 0;
  const fatTarget = profile?.fat_g ?? 0;

  const hasTargets =
    caloriesTarget > 0 && proteinTarget > 0 && carbsTarget > 0 && fatTarget > 0;

  // Summary
  const caloriesConsumed = totals.calories;
  const remaining =
    caloriesTarget > 0 ? Math.max(caloriesTarget - caloriesConsumed, 0) : 0;

  const caloriesPct = useMemo(() => {
    if (!caloriesTarget || caloriesTarget <= 0) return 0;
    return Math.min((caloriesConsumed / caloriesTarget) * 100, 100);
  }, [caloriesConsumed, caloriesTarget]);

  const protein = { value: totals.protein, target: proteinTarget };
  const carbs = { value: totals.carbs, target: carbsTarget };
  const fat = { value: totals.fat, target: fatTarget };

  // Bottom sheet "Agregar comida"
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerKicker}>Diario</Text>
            <Text style={s.headerTitle}>
              {day === todayStrLocal() ? "Hoy" : day}
            </Text>
          </View>

          <Pressable style={s.headerIconBtn} onPress={() => {}}>
            <Feather name="calendar" size={18} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            style={s.headerIconBtn}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <Feather name="settings" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

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
          <MiniStat
            title="Restantes"
            value={loading ? "—" : `${remaining}`}
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
          <MiniStat
            title="Consumidas"
            value={loading ? "—" : `${caloriesConsumed}`}
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
        </View>

        {/* Main Calories Card */}
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
              <Text style={s.cardTitle}>Calorías</Text>
            </View>

            <View style={s.chip}>
              <Feather name="flag" size={14} color={colors.textSecondary} />
              <Text style={s.chipText}>
                {caloriesTarget ? `${caloriesTarget} kcal` : "Sin objetivo"}
              </Text>
            </View>
          </View>

          <Text style={s.bigValue}>
            {loading ? "—" : caloriesConsumed}
            <Text style={s.bigUnit}> kcal</Text>
          </Text>

          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${caloriesPct}%` }]} />
          </View>

          <View style={s.hintRow}>
            <Feather name="info" size={14} color={colors.textSecondary} />
            <Text style={s.hintText}>
              {caloriesTarget
                ? `${remaining} kcal para llegar a tu objetivo`
                : "Define tu objetivo para ver restantes"}
            </Text>
          </View>
        </View>

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
          <MacroCard
            label="Proteína"
            icon="food-steak"
            value={protein.value}
            target={protein.target}
            loading={loading}
            colors={colors}
            typography={typography}
          />
          <MacroCard
            label="Carbs"
            icon="bread-slice"
            value={carbs.value}
            target={carbs.target}
            loading={loading}
            colors={colors}
            typography={typography}
          />
          <MacroCard
            label="Grasas"
            icon="peanut"
            value={fat.value}
            target={fat.target}
            loading={loading}
            colors={colors}
            typography={typography}
          />
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

        <View style={s.card}>
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
                params: { meal: "lunch" },
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
                params: { meal: "dinner" },
              })
            }
          />
        </View>

        {/* bottom spacer for FAB */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Bottom CTA -> sheet */}
      <View style={s.fab}>
        <PrimaryButton
          title="Agregar comida"
          onPress={() => setSheetOpen(true)}
          icon={<Feather name="plus" size={18} color={colors.onCta} />}
        />
      </View>

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

          <Pressable onPress={onClose} style={sheet.closeBtn}>
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
  return (
    <Pressable
      onPress={onPress}
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
  value: string;
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

function MacroCard({
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

      <Text
        style={{
          fontFamily: typography.subtitle?.fontFamily,
          fontSize: 18,
          color: colors.textPrimary,
        }}
      >
        {loading ? "—" : value}
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

      <View
        style={{
          height: 8,
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
}

/**
 * ✅ NUEVO MealRow premium:
 * - subtitle (items + kcal)
 * - chip kcal
 * - mini progress kcal_meal / kcal_total_dia
 */
function MealRow({
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

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 8,
        },
        pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
      ]}
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

        <View
          style={{
            height: 6,
            borderRadius: 999,
            backgroundColor: colors.border,
            overflow: "hidden",
            opacity: loading ? 0.6 : 1,
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

      {/* ✅ Evita que el tap del botón dispare onOpen */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
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
}


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
  });
}
