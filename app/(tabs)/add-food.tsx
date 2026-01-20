// app/(tabs)/add-food.tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { foodLogRepository } from "@/data/food/foodLogRepository";
import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import { openFoodFactsService } from "@/data/openfoodfacts/openFoodFactsService";
import { supabase } from "@/data/supabase/supabaseClient";
import type { MealType } from "@/domain/models/foodLogDb";
import type { OffProduct } from "@/domain/models/offProduct";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MEAL_LABELS } from "@/presentation/utils/mealLabels";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

type FoodSource = "user_food" | "food" | "off";

type FoodSearchItem = {
  key: string;
  source: FoodSource;

  name: string;
  meta?: string;

  kcal_100g?: number | null;
  protein_100g?: number | null;
  carbs_100g?: number | null;
  fat_100g?: number | null;

  food_id?: string | null;
  user_food_id?: string | null;

  off?: OffProduct | null;

  verified?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toFloatSafe(s: string) {
  const normalized = s.replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function computeFrom100gMacros(
  macros: {
    kcal_100g?: number | null;
    protein_100g?: number | null;
    carbs_100g?: number | null;
    fat_100g?: number | null;
  },
  grams: number,
) {
  const factor = grams / 100;
  const kcal = Math.round((macros.kcal_100g ?? 0) * factor);
  const protein = Math.round((macros.protein_100g ?? 0) * factor);
  const carbs = Math.round((macros.carbs_100g ?? 0) * factor);
  const fat = Math.round((macros.fat_100g ?? 0) * factor);
  return { kcal, protein, carbs, fat };
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

function macroChipIcon(
  kind: "kcal" | "p" | "c" | "f",
): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  switch (kind) {
    case "kcal":
      return "fire";
    case "p":
      return "food-steak";
    case "c":
      return "bread-slice";
    case "f":
      return "peanut";
  }
}

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
function isMealType(x: unknown): x is MealType {
  return typeof x === "string" && (MEALS as string[]).includes(x);
}

async function getUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function searchLocalFoods(q: string): Promise<FoodSearchItem[]> {
  const uid = await getUid();

  const userFoodsPromise = uid
    ? supabase
        .from("user_foods")
        .select("id, name, calories, protein, carbs, fat")
        .eq("user_id", uid)
        .ilike("name", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(25)
    : Promise.resolve({ data: [], error: null } as any);

  const foodsPromise = supabase
    .from("foods")
    .select("id, name, calories, protein, carbs, fat, verified, source, brand")
    .ilike("name", `%${q}%`)
    .order("verified", { ascending: false })
    .limit(50);

  const genericPromise = genericFoodsRepository.search(q);

  const [ufRes, fRes, gRes] = await Promise.all([
    userFoodsPromise as any,
    foodsPromise,
    genericPromise,
  ]);

  // ✅ si hay error, explota (para no ocultar RLS)
  if (ufRes?.error) throw new Error(ufRes.error.message);
  if (fRes.error) throw new Error(fRes.error.message);
  if (!gRes.ok) throw new Error(gRes.message);

  const userFoods: FoodSearchItem[] = (ufRes.data ?? []).map((x: any) => ({
    key: `uf:${x.id}`,
    source: "user_food",
    name: x.name,
    meta: "Personalizado",
    kcal_100g: Number(x.calories ?? 0),
    protein_100g: Number(x.protein ?? 0),
    carbs_100g: Number(x.carbs ?? 0),
    fat_100g: Number(x.fat ?? 0),
    user_food_id: x.id,
    verified: true,
  }));

  const foods: FoodSearchItem[] = (fRes.data ?? []).map((x: any) => ({
    key: `f:${x.id}`,
    source: "food",
    name: x.name,
    meta: x.verified
      ? "Verificado"
      : x.source === "openfoodfacts"
        ? x.brand
          ? x.brand
          : "Estimado"
        : "Estimado",
    kcal_100g: Number(x.calories ?? 0),
    protein_100g: Number(x.protein ?? 0),
    carbs_100g: Number(x.carbs ?? 0),
    fat_100g: Number(x.fat ?? 0),
    food_id: x.id,
    verified: Boolean(x.verified),
  }));

  // generic_foods → lo mostramos como “Genérico” pero sin decir tabla
  const generics: FoodSearchItem[] = (gRes.data ?? []).map((x) => ({
    key: `g:${x.id}`,
    source: "food", // 👈 lo tratamos como “food” para UX simple
    name: x.name_es,
    meta: "Genérico",
    kcal_100g: x.kcal_100g ?? 0,
    protein_100g: x.protein_100g ?? 0,
    carbs_100g: x.carbs_100g ?? 0,
    fat_100g: x.fat_100g ?? 0,
    food_id: null, // no existe en foods
    verified: true,
    // marcamos internamente que viene de generic
    // (si quieres, agrega source: "generic_seed" al FoodSearchItem)
  }));

  return [...userFoods, ...foods, ...generics];
}

export default function AddFoodScreen() {
  const params = useLocalSearchParams<{ meal?: string; barcode?: string }>();

  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const day = todayStrLocal();

  const [query, setQuery] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [meal, setMeal] = useState<MealType>("snack");

  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
  const [isSearchingMore, setIsSearchingMore] = useState(false);

  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [selected, setSelected] = useState<FoodSearchItem | null>(null);

  const [gramsStr, setGramsStr] = useState("100");
  const gramsNum = useMemo(() => toFloatSafe(gramsStr), [gramsStr]);

  const reqIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      // ✅ cada vez que entras a AddFood, parte limpio
      setSelected(null);
      setQuery("");
      setResults([]);
      setErr(null);
      setGramsStr("100");
      setIsSearchingLocal(false);
      setIsSearchingMore(false);
      reqIdRef.current += 1; // ✅ invalida requests anteriores

      return () => {
        // (opcional) al salir también
        reqIdRef.current += 1;
      };
    }, []),
  );

  useEffect(() => {
    if (isMealType(params.meal)) setMeal(params.meal);
  }, [params.meal]);

  // Barcode -> OpenFoodFacts directo
  useEffect(() => {
    const barcode =
      typeof params.barcode === "string" ? params.barcode.trim() : "";
    if (!barcode) return;

    (async () => {
      setErr(null);
      setIsSearchingMore(true);

      const res = await openFoodFactsService.getByBarcode(barcode);

      setIsSearchingMore(false);

      if (!res.ok) {
        setErr(res.message);
        return;
      }

      const it: FoodSearchItem = {
        key: `off:${res.data.id}`,
        source: "off",
        name: res.data.name,
        meta: res.data.brand ? res.data.brand : "Sin marca",
        kcal_100g: res.data.kcal_100g ?? null,
        protein_100g: res.data.protein_100g ?? null,
        carbs_100g: res.data.carbs_100g ?? null,
        fat_100g: res.data.fat_100g ?? null,
        off: res.data,
        verified: false,
      };

      setSelected(it);
      setQuery(res.data.name);
      setResults([]);
    })();
  }, [params.barcode]);

  // Local-first debounce search
  useEffect(() => {
    setErr(null);
    const q = query.trim();

    if (q.length < 2) {
      setResults([]);
      setIsSearchingLocal(false);
      return;
    }

    setIsSearchingLocal(true);
    const myReqId = ++reqIdRef.current;

    const t = setTimeout(async () => {
      try {
        const merged = await searchLocalFoods(q);
        if (myReqId !== reqIdRef.current) return;
        setResults(merged);
        setIsSearchingLocal(false);
      } catch {
        if (myReqId !== reqIdRef.current) return;
        setResults([]);
        setIsSearchingLocal(false);
        setErr("No pudimos buscar. Intenta de nuevo.");
      }
    }, 320);

    return () => clearTimeout(t);
  }, [query]);

  const gramsError = useMemo(() => {
    if (!gramsStr.trim()) return "Ingresa gramos";
    if (!Number.isFinite(gramsNum)) return "Valor inválido";
    if (gramsNum <= 0) return "Debe ser > 0";
    if (gramsNum > 2000) return "Demasiado alto (máx 2000g)";
    return null;
  }, [gramsStr, gramsNum]);

  const preview = useMemo(() => {
    if (!selected) return null;
    const g = Number.isFinite(gramsNum) ? clamp(gramsNum, 1, 2000) : 100;
    return computeFrom100gMacros(
      {
        kcal_100g: selected.kcal_100g,
        protein_100g: selected.protein_100g,
        carbs_100g: selected.carbs_100g,
        fat_100g: selected.fat_100g,
      },
      g,
    );
  }, [selected, gramsNum]);

  const canShowSearchMore =
    !selected &&
    query.trim().length >= 2 &&
    !isSearchingLocal &&
    !isSearchingMore &&
    results.length < 6;

  async function onSearchMore() {
    const q = query.trim();
    if (q.length < 2) return;

    setErr(null);
    setIsSearchingMore(true);

    const myReqId = ++reqIdRef.current;

    const res = await openFoodFactsService.search({
      query: q,
      page: 1,
      pageSize: 15,
      cc: "cl",
      lc: "es",
    });

    if (myReqId !== reqIdRef.current) {
      setIsSearchingMore(false);
      return;
    }

    if (!res.ok) {
      setIsSearchingMore(false);
      setErr(res.message);
      return;
    }

    const offItems: FoodSearchItem[] = res.data.items.map((p) => ({
      key: `off:${p.id}`,
      source: "off",
      name: p.name,
      meta: p.brand ? p.brand : "Sin marca",
      kcal_100g: p.kcal_100g ?? null,
      protein_100g: p.protein_100g ?? null,
      carbs_100g: p.carbs_100g ?? null,
      fat_100g: p.fat_100g ?? null,
      off: p,
      verified: false,
    }));

    const existing = new Set(results.map((r) => r.key));
    const merged = [
      ...results,
      ...offItems.filter((x) => !existing.has(x.key)),
    ];

    setResults(merged);
    setIsSearchingMore(false);
  }

  function badgeText(it: FoodSearchItem) {
    if (it.source === "user_food") return "Personalizado";
    if (it.source === "food") return it.verified ? "Verificado" : "Estimado";
    return "Estimado";
  }

  function iconFor(
    it: FoodSearchItem,
  ): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
    if (it.source === "user_food") return "account-edit";
    if (it.source === "food") return "database";
    return "barcode-scan";
  }

  async function onAdd() {
    if (!selected) return;
    setErr(null);

    if (gramsError) {
      setErr(gramsError);
      return;
    }
    if (!preview) return;

    const g = Number.isFinite(gramsNum) ? clamp(gramsNum, 1, 2000) : 100;

    setSaveLoading(true);

    const res = await foodLogRepository.create({
      day,
      meal,
      name: selected.name,
      grams: Math.round(g),

      calories: preview.kcal,
      protein_g: preview.protein,
      carbs_g: preview.carbs,
      fat_g: preview.fat,

      source:
        selected.source === "off"
          ? "openfoodfacts"
          : selected.source === "food"
            ? "foods"
            : "user_foods",

      off_id: selected.source === "off" ? (selected.off?.id ?? null) : null,

      source_type:
        selected.source === "food" && selected.food_id
          ? "food"
          : selected.source === "user_food"
            ? "user_food"
            : "manual",

      food_id:
        selected.source === "food" && selected.food_id
          ? selected.food_id
          : null,

      user_food_id:
        selected.source === "user_food"
          ? (selected.user_food_id ?? null)
          : null,
    });

    setSaveLoading(false);

    if (!res.ok) {
      setErr(res.message ?? "No pudimos guardar el alimento.");
      return;
    }

    setSelected(null);
    setQuery("");
    setResults([]);
    setErr(null);
    setGramsStr("100");
    reqIdRef.current += 1;

    Alert.alert("Listo", "Se agregó al diario de hoy.", [
      { text: "OK", onPress: () => router.replace("/(tabs)/diary") },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable
            style={s.iconBtn}
            onPress={() => (selected ? setSelected(null) : router.back())}
          >
            <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>Diario</Text>
            <Text style={s.title}>
              {selected ? "Detalle" : "Agregar alimento"}
            </Text>
          </View>

          <Pressable
            style={s.iconBtn}
            onPress={() => router.replace("/(tabs)/diary")}
          >
            <Feather name="x" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {!selected && (
          <>
            <Text style={s.subtitle}>
              Busca alimentos y registra los gramos.
            </Text>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/scan",
                  params: { meal },
                })
              }
              style={({ pressed }) => [
                s.scanBtn,
                pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Feather name="camera" size={18} color="#111827" />
              <Text style={s.scanBtnText}>Escanear código</Text>
            </Pressable>

            {/* Search */}
            <View style={s.searchBox}>
              <Feather name="search" size={18} color={colors.textSecondary} />
              <TextInput
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setErr(null);
                }}
                placeholder="Ej: arroz, yogurt, pollo..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                style={s.searchInput}
              />
              {!!query && (
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setErr(null);
                    setResults([]);
                  }}
                  style={({ pressed }) => [
                    s.clearBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Feather name="x" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* Meal chips */}
            <View style={s.mealRow}>
              {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map(
                (m) => {
                  const active = meal === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMeal(m)}
                      style={({ pressed }) => [
                        s.mealChip,
                        active && s.mealChipActive,
                        pressed && {
                          opacity: 0.92,
                          transform: [{ scale: 0.99 }],
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={mealIcon(m)}
                        size={18}
                        color={active ? colors.brand : colors.textSecondary}
                      />
                      <Text
                        style={[s.mealChipText, active && s.mealChipTextActive]}
                      >
                        {MEAL_LABELS[m]}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            {(isSearchingLocal || isSearchingMore) && (
              <View style={s.loadingBox}>
                <ActivityIndicator />
                <Text style={s.loadingText}>
                  {isSearchingMore
                    ? "Buscando más resultados..."
                    : "Buscando..."}
                </Text>
              </View>
            )}

            {!!err && (
              <View style={s.alert}>
                <Feather name="alert-triangle" size={16} color={colors.onCta} />
                <Text style={s.alertText}>{err}</Text>
              </View>
            )}

            {canShowSearchMore && (
              <Pressable
                onPress={onSearchMore}
                style={({ pressed }) => [
                  s.moreBtn,
                  pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                ]}
              >
                <MaterialCommunityIcons
                  name="magnify-plus"
                  size={18}
                  color={colors.textPrimary}
                />
                <Text style={s.moreBtnText}>Buscar más resultados</Text>
              </Pressable>
            )}

            {/* Results */}
            <View style={{ marginTop: 10, gap: 10 }}>
              {results.map((it) => (
                <Pressable
                  key={it.key}
                  style={({ pressed }) => [
                    s.result,
                    pressed && { opacity: 0.95, transform: [{ scale: 0.997 }] },
                  ]}
                  onPress={() => setSelected(it)}
                >
                  <View style={s.resultIcon}>
                    <MaterialCommunityIcons
                      name={iconFor(it)}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.resultName} numberOfLines={1}>
                      {it.name}
                    </Text>

                    <Text style={s.resultMeta} numberOfLines={1}>
                      {it.meta ?? badgeText(it)}
                    </Text>

                    <View style={s.kcalBadge}>
                      <MaterialCommunityIcons
                        name="fire"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={s.kcalBadgeText}>
                        {it.kcal_100g ?? "?"} kcal / 100g · {badgeText(it)}
                      </Text>
                    </View>
                  </View>

                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              ))}

              {!isSearchingLocal &&
                !isSearchingMore &&
                query.trim().length >= 2 &&
                results.length === 0 && (
                  <View style={s.emptyCard}>
                    <View style={s.emptyIcon}>
                      <MaterialCommunityIcons
                        name="magnify"
                        size={22}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text style={s.emptyTitle}>Sin resultados</Text>
                    <Text style={s.emptyText}>
                      Prueba con otra palabra o busca más resultados.
                    </Text>
                  </View>
                )}
            </View>
          </>
        )}

        {selected && (
          <View style={s.card}>
            <View style={s.detailHeader}>
              <View style={s.detailIcon}>
                <MaterialCommunityIcons
                  name="food-apple"
                  size={20}
                  color={colors.textPrimary}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {selected.name}
                </Text>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {selected.meta ?? badgeText(selected)} · Base 100g
                </Text>
              </View>

              <View style={s.badgePill}>
                <Text style={s.badgePillText}>{badgeText(selected)}</Text>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={s.label}>Gramos consumidos</Text>
              <View style={s.gramsRow}>
                <MaterialCommunityIcons
                  name="scale"
                  size={18}
                  color={colors.textSecondary}
                />
                <TextInput
                  value={gramsStr}
                  onChangeText={setGramsStr}
                  keyboardType="numeric"
                  style={s.gramsInput}
                  placeholder="100"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={s.gramsUnit}>g</Text>
              </View>
              {!!gramsError && <Text style={s.errorSmall}>{gramsError}</Text>}
            </View>

            <View style={s.previewBox}>
              <View style={s.previewHeader}>
                <MaterialCommunityIcons
                  name="calculator-variant"
                  size={18}
                  color={colors.textPrimary}
                />
                <Text style={s.previewTitle}>Estimación</Text>
              </View>

              <View style={s.previewGrid}>
                <MacroChip
                  kind="kcal"
                  value={preview?.kcal ?? 0}
                  suffix="kcal"
                  colors={colors}
                  typography={typography}
                />
                <MacroChip
                  kind="p"
                  value={preview?.protein ?? 0}
                  suffix="g"
                  label="Proteína"
                  colors={colors}
                  typography={typography}
                />
                <MacroChip
                  kind="c"
                  value={preview?.carbs ?? 0}
                  suffix="g"
                  label="Carbs"
                  colors={colors}
                  typography={typography}
                />
                <MacroChip
                  kind="f"
                  value={preview?.fat ?? 0}
                  suffix="g"
                  label="Grasas"
                  colors={colors}
                  typography={typography}
                />
              </View>
            </View>

            {!!err && (
              <View style={s.alert}>
                <Feather name="alert-triangle" size={16} color={colors.onCta} />
                <Text style={s.alertText}>{err}</Text>
              </View>
            )}

            <PrimaryButton
              title={saveLoading ? "Agregando..." : "Agregar al diario"}
              onPress={onAdd}
              loading={saveLoading}
              disabled={saveLoading}
              icon={<Feather name="plus" size={18} color={colors.onCta} />}
            />

            <Pressable
              onPress={() => setSelected(null)}
              style={{ marginTop: 10 }}
            >
              {({ pressed }) => (
                <Text style={[s.backLink, pressed && { opacity: 0.75 }]}>
                  Volver a resultados
                </Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroChip({
  kind,
  value,
  suffix,
  label,
  colors,
  typography,
}: {
  kind: "kcal" | "p" | "c" | "f";
  value: number;
  suffix: string;
  label?: string;
  colors: any;
  typography: any;
}) {
  const name = macroChipIcon(kind);
  const title =
    kind === "kcal"
      ? "Calorías"
      : (label ??
        (kind === "p" ? "Proteína" : kind === "c" ? "Carbs" : "Grasas"));

  return (
    <View
      style={{
        flex: 1,
        minWidth: 140,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: "transparent",
        padding: 12,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <MaterialCommunityIcons
          name={name}
          size={18}
          color={colors.textSecondary}
        />
        <Text
          style={{
            fontFamily: typography.body?.fontFamily,
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          {title}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: typography.subtitle?.fontFamily,
          fontSize: 18,
          color: colors.textPrimary,
        }}
      >
        {Math.round(value)}
        <Text
          style={{
            fontFamily: typography.body?.fontFamily,
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          {" "}
          {suffix}
        </Text>
      </Text>
    </View>
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
    kicker: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    title: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 24,
      color: colors.textPrimary,
    },

    subtitle: {
      marginTop: 4,
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },

    searchBox: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: typography.body?.fontFamily,
      paddingVertical: 0,
    },
    clearBtn: {
      width: 34,
      height: 34,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    loadingBox: { marginTop: 10, alignItems: "center" },
    loadingText: {
      marginTop: 6,
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
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
      marginTop: 10,
    },
    alertText: {
      flex: 1,
      color: colors.onCta,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      lineHeight: 16,
    },

    moreBtn: {
      marginTop: 10,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    moreBtnText: {
      fontFamily: typography.subtitle?.fontFamily,
      color: colors.textPrimary,
      fontSize: 13,
    },

    mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
    mealChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    mealChipActive: {
      borderColor: colors.brand,
      backgroundColor: "rgba(34,197,94,0.10)",
    },
    mealChipText: {
      color: colors.textSecondary,
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 12,
    },
    mealChipTextActive: { color: colors.textPrimary },

    result: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    resultIcon: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    resultName: {
      fontFamily: typography.subtitle?.fontFamily,
      color: colors.textPrimary,
      fontSize: 14,
    },
    resultMeta: {
      fontFamily: typography.body?.fontFamily,
      color: colors.textSecondary,
      fontSize: 12,
    },

    kcalBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 6,
    },
    kcalBadgeText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    emptyCard: {
      marginTop: 8,
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

    card: {
      marginTop: 12,
      padding: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      gap: 10,
    },

    detailHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    detailIcon: {
      width: 44,
      height: 44,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    badgePill: {
      paddingHorizontal: 10,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    badgePillText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    cardTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      color: colors.textPrimary,
      fontSize: 16,
    },
    cardMeta: {
      fontFamily: typography.body?.fontFamily,
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 12,
    },

    label: {
      color: colors.textPrimary,
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 13,
    },

    gramsRow: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      height: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    gramsInput: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      paddingVertical: 0,
    },
    gramsUnit: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
    },

    errorSmall: {
      marginTop: 6,
      color: "#EF4444",
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
    },

    previewBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
      gap: 12,
    },
    previewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    previewTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      color: colors.textPrimary,
      fontSize: 14,
    },

    previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

    backLink: {
      color: colors.brand,
      textAlign: "center",
      fontFamily: typography.subtitle?.fontFamily,
    },
    scanBtn: {
      marginTop: 10,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      backgroundColor: "white",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    scanBtnText: { fontWeight: "800", color: "#111827" },
  });
}
