// app/(tabs)/add-food.tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { openFoodFactsService } from "@/data/openfoodfacts/openFoodFactsService";
import { supabase } from "@/data/supabase/supabaseClient";
import type { FoodLogDb, MealType } from "@/domain/models/foodLogDb";
import type { OffProduct } from "@/domain/models/offProduct";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MEAL_LABELS } from "@/presentation/utils/mealLabels";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toFloatSafe(s: string) {
  const normalized = s.replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function computeFrom100g(p: OffProduct, grams: number) {
  const factor = grams / 100;

  const kcal = Math.round((p.kcal_100g ?? 0) * factor);
  const protein = Math.round((p.protein_100g ?? 0) * factor);
  const carbs = Math.round((p.carbs_100g ?? 0) * factor);
  const fat = Math.round((p.fat_100g ?? 0) * factor);

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

type EditDraft = {
  name: string;
  gramsStr: string; // ✅ ahora sí editable/persistible
  caloriesStr: string;
  proteinStr: string;
  carbsStr: string;
  fatStr: string;
};

function numFromStrNonNeg(s: string) {
  const n = toFloatSafe(s);
  if (!Number.isFinite(n)) return NaN;
  if (n < 0) return 0;
  return n;
}

async function getAuthedUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { ok: false as const, message: error.message };
  const uid = data.session?.user?.id;
  if (!uid) return { ok: false as const, message: "No hay sesión activa." };
  return { ok: true as const, uid };
}

export default function AddFoodScreen() {
  const params = useLocalSearchParams<{
    meal?: string;
    barcode?: string;
    logId?: string;
  }>();

  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const day = todayStrLocal();

  // -------------------------
  // Mode detection
  // -------------------------
  const logId = typeof params.logId === "string" ? params.logId.trim() : "";
  const isEditMode = !!logId;

  // -------------------------
  // Common state
  // -------------------------
  const [loading, setLoading] = useState(false); // save button loading
  const [err, setErr] = useState<string | null>(null);

  const [meal, setMeal] = useState<MealType>("snack");
  useEffect(() => {
    if (isMealType(params.meal)) setMeal(params.meal);
  }, [params.meal]);

  // -------------------------
  // Create mode: OFF flow
  // -------------------------
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OffProduct[]>([]);
  const [selected, setSelected] = useState<OffProduct | null>(null);

  const [gramsStr, setGramsStr] = useState("100");
  const gramsNum = useMemo(() => toFloatSafe(gramsStr), [gramsStr]);
  const [isSearching, setIsSearching] = useState(false);

  // -------------------------
  // Edit mode: load + draft
  // -------------------------
  const [editingLog, setEditingLog] = useState<FoodLogDb | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    name: "",
    gramsStr: "100",
    caloriesStr: "",
    proteinStr: "",
    carbsStr: "",
    fatStr: "",
  });
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  // Load existing log (edit mode)
  useEffect(() => {
    if (!isEditMode) return;

    (async () => {
      setErr(null);
      setIsLoadingEdit(true);

      const auth = await getAuthedUserId();
      if (!auth.ok) {
        setErr(auth.message);
        setIsLoadingEdit(false);
        return;
      }

      const { data, error } = await supabase
        .from("food_logs")
        .select("*")
        .eq("id", logId)
        .eq("user_id", auth.uid)
        .maybeSingle();

      setIsLoadingEdit(false);

      if (error) {
        setErr(error.message);
        return;
      }
      if (!data) {
        setErr("No encontramos este registro.");
        return;
      }

      const log = data as FoodLogDb;
      setEditingLog(log);
      setMeal(log.meal);

      setEditDraft({
        name: log.name ?? "",
        gramsStr:
          typeof (log as any).grams === "number"
            ? String((log as any).grams)
            : "100",
        caloriesStr: String(log.calories ?? 0),
        proteinStr: String(log.protein_g ?? 0),
        carbsStr: String(log.carbs_g ?? 0),
        fatStr: String(log.fat_g ?? 0),
      });
    })();
  }, [isEditMode, logId]);

  // Barcode -> select (create mode only)
  useEffect(() => {
    if (isEditMode) return;

    const barcode =
      typeof params.barcode === "string" ? params.barcode.trim() : "";
    if (!barcode) return;

    (async () => {
      setErr(null);
      setIsSearching(true);

      const res = await openFoodFactsService.getByBarcode(barcode);

      setIsSearching(false);

      if (!res.ok) {
        setErr(res.message);
        return;
      }

      setSelected(res.data);
      setQuery(res.data.name);
      setGramsStr("100");
    })();
  }, [params.barcode, isEditMode]);

  // Debounce search (create mode only)
  useEffect(() => {
    if (isEditMode) return;

    setErr(null);

    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const t = setTimeout(async () => {
      const res = await openFoodFactsService.search({
        query: q,
        page: 1,
        pageSize: 20,
      });

      if (!res.ok) {
        setErr(res.message);
        setResults([]);
        setIsSearching(false);
        return;
      }

      setResults(res.data.items);
      setIsSearching(false);
    }, 450);

    return () => clearTimeout(t);
  }, [query, isEditMode]);

  // -------------------------
  // Validations
  // -------------------------
  const gramsError = useMemo(() => {
    if (isEditMode) return null;
    if (!gramsStr.trim()) return "Ingresa gramos";
    if (!Number.isFinite(gramsNum)) return "Valor inválido";
    if (gramsNum <= 0) return "Debe ser > 0";
    if (gramsNum > 2000) return "Demasiado alto (máx 2000g)";
    return null;
  }, [gramsStr, gramsNum, isEditMode]);

  const preview = useMemo(() => {
    if (isEditMode) return null;
    if (!selected) return null;
    const g = Number.isFinite(gramsNum) ? clamp(gramsNum, 1, 2000) : 100;
    return computeFrom100g(selected, g);
  }, [selected, gramsNum, isEditMode]);

  const editErrors = useMemo(() => {
    if (!isEditMode) return null;

    const name = editDraft.name.trim();
    if (!name) return "Ingresa el nombre del alimento.";

    const g = numFromStrNonNeg(editDraft.gramsStr);
    if (!Number.isFinite(g)) return "Gramos inválidos.";
    if (g <= 0) return "Los gramos deben ser > 0.";
    if (g > 2000) return "Gramos demasiado altos (máx 2000g).";

    const kcal = numFromStrNonNeg(editDraft.caloriesStr);
    const p = numFromStrNonNeg(editDraft.proteinStr);
    const c = numFromStrNonNeg(editDraft.carbsStr);
    const f = numFromStrNonNeg(editDraft.fatStr);

    if (!Number.isFinite(kcal)) return "Calorías inválidas.";
    if (!Number.isFinite(p)) return "Proteína inválida.";
    if (!Number.isFinite(c)) return "Carbs inválidos.";
    if (!Number.isFinite(f)) return "Grasas inválidas.";

    if (kcal > 10000) return "Calorías demasiado altas (máx 10.000).";
    if (p > 2000 || c > 2000 || f > 2000)
      return "Macros demasiado altos (máx 2000g).";

    return null;
  }, [isEditMode, editDraft]);

  // -------------------------
  // Actions
  // -------------------------
  async function onAdd() {
    if (!selected) return;
    setErr(null);

    if (gramsError) {
      setErr(gramsError);
      return;
    }
    if (!preview) return;

    const g = Number.isFinite(gramsNum) ? clamp(gramsNum, 1, 2000) : 100;

    setLoading(true);
    const res = await foodLogRepository.create({
      day,
      meal,
      name: selected.name,
      grams: g, // ✅
      source: "off", // ✅
      off_id: selected.id, // ✅
      calories: preview.kcal,
      protein_g: preview.protein,
      carbs_g: preview.carbs,
      fat_g: preview.fat,
    });
    setLoading(false);

    if (!res.ok) {
      setErr(res.message ?? "No pudimos guardar el alimento.");
      return;
    }

    Alert.alert("Listo", "Se agregó al diario de hoy.", [
      { text: "OK", onPress: () => router.replace("/(tabs)/diary") },
    ]);
  }

  async function onSaveEdit() {
    if (!editingLog) return;
    setErr(null);

    if (editErrors) {
      setErr(editErrors);
      return;
    }

    const payload = {
      meal,
      name: editDraft.name.trim(),
      grams: clamp(numFromStrNonNeg(editDraft.gramsStr), 1, 2000),
      calories: Math.round(numFromStrNonNeg(editDraft.caloriesStr)),
      protein_g: Math.round(numFromStrNonNeg(editDraft.proteinStr)),
      carbs_g: Math.round(numFromStrNonNeg(editDraft.carbsStr)),
      fat_g: Math.round(numFromStrNonNeg(editDraft.fatStr)),
    };

    setLoading(true);

    const auth = await getAuthedUserId();
    if (!auth.ok) {
      setLoading(false);
      setErr(auth.message);
      return;
    }

    // ✅ Update directo (no dependemos de que exista foodLogRepository.update aún)
    const { error } = await supabase
      .from("food_logs")
      .update(payload as any)
      .eq("id", editingLog.id)
      .eq("user_id", auth.uid);

    setLoading(false);

    if (error) {
      setErr(error.message ?? "No pudimos guardar los cambios.");
      return;
    }

    Alert.alert("Listo", "Se actualizaron los datos.", [
      { text: "OK", onPress: () => router.replace("/(tabs)/diary") },
    ]);
  }

  const headerTitle = isEditMode
    ? "Editar alimento"
    : selected
      ? "Detalle"
      : "Agregar alimento";

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
            onPress={() => {
              if (isEditMode) return router.back();
              return selected ? setSelected(null) : router.back();
            }}
          >
            <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>Diario</Text>
            <Text style={s.title}>{headerTitle}</Text>
          </View>

          <Pressable
            style={s.iconBtn}
            onPress={() => router.replace("/(tabs)/diary")}
          >
            <Feather name="x" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* -------------------------
            EDIT MODE UI
            ------------------------- */}
        {isEditMode && (
          <>
            {(isLoadingEdit || !editingLog) && !err ? (
              <View style={s.loadingBox}>
                <ActivityIndicator />
                <Text style={s.loadingText}>Cargando registro...</Text>
              </View>
            ) : null}

            {!!err && (
              <View style={s.alert}>
                <Feather name="alert-triangle" size={16} color={colors.onCta} />
                <Text style={s.alertText}>{err}</Text>
              </View>
            )}

            {!!editingLog && (
              <View style={s.card}>
                {/* Meal chips */}
                <View style={s.mealRow}>
                  {(
                    ["breakfast", "lunch", "dinner", "snack"] as MealType[]
                  ).map((m) => {
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
                          style={[
                            s.mealChipText,
                            active && s.mealChipTextActive,
                          ]}
                        >
                          {MEAL_LABELS[m]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Name */}
                <View style={{ marginTop: 12 }}>
                  <Text style={s.label}>Nombre</Text>
                  <View style={s.searchBox}>
                    <MaterialCommunityIcons
                      name="food-apple"
                      size={18}
                      color={colors.textSecondary}
                    />
                    <TextInput
                      value={editDraft.name}
                      onChangeText={(t) =>
                        setEditDraft((d) => ({ ...d, name: t }))
                      }
                      placeholder="Ej: Arroz cocido"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="sentences"
                      style={s.searchInput}
                    />
                  </View>
                </View>

                {/* Grams */}
                <View style={{ marginTop: 12 }}>
                  <Text style={s.label}>Gramos consumidos</Text>
                  <View style={s.gramsRow}>
                    <MaterialCommunityIcons
                      name="scale"
                      size={18}
                      color={colors.textSecondary}
                    />
                    <TextInput
                      value={editDraft.gramsStr}
                      onChangeText={(t) =>
                        setEditDraft((d) => ({ ...d, gramsStr: t }))
                      }
                      keyboardType="numeric"
                      style={s.gramsInput}
                      placeholder="100"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <Text style={s.gramsUnit}>g</Text>
                  </View>
                </View>

                {/* Macros grid */}
                <View style={s.editGrid}>
                  <EditNumberField
                    label="Calorías"
                    icon="fire"
                    value={editDraft.caloriesStr}
                    onChange={(t) =>
                      setEditDraft((d) => ({ ...d, caloriesStr: t }))
                    }
                    colors={colors}
                    typography={typography}
                  />
                  <EditNumberField
                    label="Proteína (g)"
                    icon="food-steak"
                    value={editDraft.proteinStr}
                    onChange={(t) =>
                      setEditDraft((d) => ({ ...d, proteinStr: t }))
                    }
                    colors={colors}
                    typography={typography}
                  />
                  <EditNumberField
                    label="Carbs (g)"
                    icon="bread-slice"
                    value={editDraft.carbsStr}
                    onChange={(t) =>
                      setEditDraft((d) => ({ ...d, carbsStr: t }))
                    }
                    colors={colors}
                    typography={typography}
                  />
                  <EditNumberField
                    label="Grasas (g)"
                    icon="peanut"
                    value={editDraft.fatStr}
                    onChange={(t) => setEditDraft((d) => ({ ...d, fatStr: t }))}
                    colors={colors}
                    typography={typography}
                  />
                </View>

                {!!editErrors && (
                  <View style={s.alert}>
                    <Feather
                      name="alert-triangle"
                      size={16}
                      color={colors.onCta}
                    />
                    <Text style={s.alertText}>{editErrors}</Text>
                  </View>
                )}

                <PrimaryButton
                  title={loading ? "Guardando..." : "Guardar cambios"}
                  onPress={onSaveEdit}
                  loading={loading}
                  disabled={loading}
                  icon={<Feather name="save" size={18} color={colors.onCta} />}
                />
              </View>
            )}
          </>
        )}

        {/* -------------------------
            CREATE MODE UI
            ------------------------- */}
        {!isEditMode && !selected && (
          <>
            <Text style={s.subtitle}>
              Busca en OpenFoodFacts y registra los gramos.
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
                  if (selected) setSelected(null);
                }}
                placeholder="Ej: yogurt, arroz, leche..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                style={s.searchInput}
              />
              {!!query && (
                <Pressable
                  onPress={() => {
                    setQuery("");
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

            {/* State */}
            {isSearching && (
              <View style={s.loadingBox}>
                <ActivityIndicator />
                <Text style={s.loadingText}>Buscando...</Text>
              </View>
            )}

            {!!err && (
              <View style={s.alert}>
                <Feather name="alert-triangle" size={16} color={colors.onCta} />
                <Text style={s.alertText}>{err}</Text>
              </View>
            )}

            {/* Results */}
            <View style={{ marginTop: 10, gap: 10 }}>
              {results.map((it) => (
                <Pressable
                  key={it.id}
                  style={({ pressed }) => [
                    s.result,
                    pressed && { opacity: 0.95, transform: [{ scale: 0.997 }] },
                  ]}
                  onPress={() => {
                    setSelected(it);
                    setGramsStr("100");
                  }}
                >
                  <View style={s.resultIcon}>
                    <MaterialCommunityIcons
                      name="barcode-scan"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.resultName} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={s.resultMeta} numberOfLines={1}>
                      {it.brand ? it.brand : "Sin marca"}
                    </Text>

                    <View style={s.kcalBadge}>
                      <MaterialCommunityIcons
                        name="fire"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={s.kcalBadgeText}>
                        {it.kcal_100g ?? "?"} kcal / 100g
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

              {!isSearching &&
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
                      Prueba con otra palabra, marca o nombre más simple.
                    </Text>
                  </View>
                )}
            </View>
          </>
        )}

        {/* Selected detail (create mode) */}
        {!isEditMode && selected && (
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
                  {selected.brand ? selected.brand : "Sin marca"} · Base 100g
                </Text>
              </View>
            </View>

            {/* Grams */}
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

            {/* Preview chips */}
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
              title={loading ? "Agregando..." : "Agregar al diario"}
              onPress={onAdd}
              loading={loading}
              disabled={loading}
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

function EditNumberField({
  label,
  icon,
  value,
  onChange,
  colors,
  typography,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  value: string;
  onChange: (t: string) => void;
  colors: any;
  typography: any;
}) {
  return (
    <View style={{ flex: 1, minWidth: 150 }}>
      <Text
        style={{
          fontFamily: typography.body?.fontFamily,
          fontSize: 12,
          color: colors.textSecondary,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          backgroundColor: colors.surface,
          paddingHorizontal: 12,
          height: 50,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={colors.textSecondary}
        />
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 16,
            paddingVertical: 0,
          }}
        />
      </View>
    </View>
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

    editGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 14,
    },

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
