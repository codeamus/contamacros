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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StorageKeys } from "@/core/storage/keys";
import { storage } from "@/core/storage/storage";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import { userFoodsRepository } from "@/data/food/userFoodsRepository";
import { openFoodFactsService } from "@/data/openfoodfacts/openFoodFactsService";
import { supabase } from "@/data/supabase/supabaseClient";
import {
  mapFoodDbArrayToSearchItems,
  mapGenericFoodDbArrayToSearchItems,
  mapUserFoodDbArrayToSearchItems,
  type FoodSearchItem,
} from "@/domain/mappers/foodMappers";
import type { MealType } from "@/domain/models/foodLogDb";
import type { OffProduct } from "@/domain/models/offProduct";
import CreateFoodModal from "@/presentation/components/nutrition/CreateFoodModal";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MEAL_LABELS } from "@/presentation/utils/labels";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// Extender FoodSearchItem para incluir off
type ExtendedFoodSearchItem = FoodSearchItem & {
  off?: OffProduct | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toFloatSafe(s: string) {
  const normalized = s.replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Calcula los macros totales basándose en los valores por 100g y la cantidad en gramos
 * Fórmula: (valor_macro_100g / 100) * cantidad_seleccionada_en_gramos
 */
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
  const kcal = Number(((macros.kcal_100g ?? 0) * factor).toFixed(1));
  const protein = Number(((macros.protein_100g ?? 0) * factor).toFixed(1));
  const carbs = Number(((macros.carbs_100g ?? 0) * factor).toFixed(1));
  const fat = Number(((macros.fat_100g ?? 0) * factor).toFixed(1));
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

// Función para normalizar texto eliminando tildes y caracteres especiales
function normalizeSearch(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchLocalFoods(q: string): Promise<ExtendedFoodSearchItem[]> {
  const uid = await getUid();

  // Normalizar query para búsqueda más flexible (sin tildes)
  const normalizedQ = normalizeSearch(q);
  const originalQ = q.trim().toLowerCase();

  // Para user_foods y foods, necesitamos filtrar después porque
  // las tablas no tienen campos normalizados como generic_foods
  // Obtenemos más resultados y filtramos por coincidencia normalizada
  const searchTerms = originalQ === normalizedQ 
    ? [originalQ] 
    : [originalQ, normalizedQ];

  // Construir condiciones para buscar ambas versiones (con y sin tildes)
  const orConditions = searchTerms.map(term => `name.ilike.%${term}%`).join(",");

  // Obtener resultados de user_foods y foods
  const userFoodsPromise = uid
    ? supabase
        .from("user_foods")
        .select("id, name, calories, protein, carbs, fat")
        .eq("user_id", uid)
        .or(orConditions)
        .order("created_at", { ascending: false })
        .limit(50) // Obtener más para filtrar después
    : Promise.resolve({ data: [], error: null } as any);

  const foodsPromise = supabase
    .from("foods")
    .select("id, name, calories, protein, carbs, fat, verified, source, brand")
    .or(orConditions)
    .order("verified", { ascending: false })
    .limit(100); // Obtener más para filtrar después

  // generic_foods ya normaliza internamente
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

  // Filtrar resultados normalizando nombres para permitir búsqueda sin tildes
  const normalizeForSearch = (text: string) => normalizeSearch(text);
  
  const filteredUserFoods = (ufRes.data ?? []).filter((item: any) => {
    const nameNorm = normalizeForSearch(item.name);
    return nameNorm.includes(normalizedQ) || 
           item.name.toLowerCase().includes(originalQ);
  }).slice(0, 25); // Limitar después del filtro

  const filteredFoods = (fRes.data ?? []).filter((item: any) => {
    const nameNorm = normalizeForSearch(item.name);
    return nameNorm.includes(normalizedQ) || 
           item.name.toLowerCase().includes(originalQ);
  }).slice(0, 50); // Limitar después del filtro

  // Usar mappers para transformar datos
  const userFoods = mapUserFoodDbArrayToSearchItems(filteredUserFoods);
  const foods = mapFoodDbArrayToSearchItems(filteredFoods);
  const generics = mapGenericFoodDbArrayToSearchItems(gRes.data ?? []);

  return [...userFoods, ...foods, ...generics];
}

// Funciones para manejar historial de búsqueda
const MAX_HISTORY_ITEMS = 10;

async function getSearchHistory(): Promise<string[]> {
  const history = await storage.getJson<string[]>(StorageKeys.SEARCH_HISTORY);
  return history || [];
}

async function addToSearchHistory(query: string): Promise<void> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return;

  const history = await getSearchHistory();
  // Remover si ya existe
  const filtered = history.filter((item) => item !== q);
  // Agregar al inicio
  const updated = [q, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  await storage.setJson(StorageKeys.SEARCH_HISTORY, updated);
}

async function removeFromSearchHistory(query: string): Promise<void> {
  const history = await getSearchHistory();
  const filtered = history.filter((item) => item !== query.toLowerCase());
  await storage.setJson(StorageKeys.SEARCH_HISTORY, filtered);
}

export default function AddFoodScreen() {
  const params = useLocalSearchParams<{ meal?: string; barcode?: string }>();

  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const s = makeStyles(colors, typography);

  const day = todayStrLocal();

  const [query, setQuery] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [meal, setMeal] = useState<MealType>("snack");

  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
  const [isSearchingMore, setIsSearchingMore] = useState(false);

  const [results, setResults] = useState<ExtendedFoodSearchItem[]>([]);
  const [selected, setSelected] = useState<ExtendedFoodSearchItem | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [myRecipes, setMyRecipes] = useState<ExtendedFoodSearchItem[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [showCreateFoodModal, setShowCreateFoodModal] = useState(false);

  const [gramsStr, setGramsStr] = useState("100");
  const [unitsStr, setUnitsStr] = useState("1");
  const [inputMode, setInputMode] = useState<"grams" | "units">("grams");
  const gramsNum = useMemo(() => toFloatSafe(gramsStr), [gramsStr]);
  const unitsNum = useMemo(() => toFloatSafe(unitsStr), [unitsStr]);

  const reqIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserInputRef = useRef<{ mode: "grams" | "units"; value: number } | null>(null);
  const isInitializingRef = useRef(false);

  // Cargar historial y recetas al montar
  useEffect(() => {
    (async () => {
      const history = await getSearchHistory();
      setSearchHistory(history);
      
      // Cargar recetas personalizadas
      setLoadingRecipes(true);
      const recipesRes = await userFoodsRepository.listAll();
      if (recipesRes.ok) {
        const recipes = mapUserFoodDbArrayToSearchItems(recipesRes.data);
        setMyRecipes(recipes);
      }
      setLoadingRecipes(false);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      // ✅ cada vez que entras a AddFood, parte limpio
      setSelected(null);
      setQuery("");
      setResults([]);
      setErr(null);
      setGramsStr("100");
      setUnitsStr("1");
      setInputMode("grams");
      setIsSearchingLocal(false);
      setIsSearchingMore(false);
      setIsInputFocused(false);
      reqIdRef.current += 1; // ✅ invalida requests anteriores

      // Cancelar cualquier búsqueda pendiente
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      return () => {
        // (opcional) al salir también
        reqIdRef.current += 1;
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
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

    // Cancelar búsqueda anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const myReqId = ++reqIdRef.current;

    (async () => {
      setErr(null);
      setIsSearchingMore(true);

      const res = await openFoodFactsService.getByBarcode(
        barcode,
        abortController.signal,
      );

      // Verificar si la request fue cancelada
      if (myReqId !== reqIdRef.current || abortController.signal.aborted) {
        return;
      }

      setIsSearchingMore(false);

      if (!res.ok) {
        // No mostrar error si fue cancelado
        if (res.message !== "Búsqueda cancelada.") {
          setErr(res.message);
        }
        return;
      }

      const it: ExtendedFoodSearchItem = {
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
      // La inicialización se hará automáticamente en useEffect
    })();

    return () => {
      abortController.abort();
    };
  }, [params.barcode]);

  // Local-first debounce search
  useEffect(() => {
    setErr(null);
    const q = query.trim();

    if (q.length < 2) {
      setResults([]);
      setIsSearchingLocal(false);
      // Si está vacío y tiene focus, mostrar historial y recetas
      return;
    }

    // Cancelar búsqueda anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsSearchingLocal(true);
    const myReqId = ++reqIdRef.current;

    const t = setTimeout(async () => {
      try {
        const merged = await searchLocalFoods(q);
        if (myReqId !== reqIdRef.current) return;
        setResults(merged);
        setIsSearchingLocal(false);
        // Guardar en historial si hay resultados
        if (merged.length > 0) {
          await addToSearchHistory(q);
          const updatedHistory = await getSearchHistory();
          setSearchHistory(updatedHistory);
        }
      } catch {
        if (myReqId !== reqIdRef.current) return;
        setResults([]);
        setIsSearchingLocal(false);
        setErr("No pudimos buscar. Intenta de nuevo.");
      }
    }, 320);

    return () => {
      clearTimeout(t);
      // Cancelar si el componente se desmonta o cambia la query
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query]);

  // Detectar si el alimento tiene unidades disponibles
  const hasUnits = useMemo(() => {
    return selected?.grams_per_unit && selected.grams_per_unit > 0;
  }, [selected]);

  // Detectar si es fast food
  const isFastFood = useMemo(() => {
    return selected?.tags?.some(tag => 
      tag.toLowerCase().includes("fastfood") || 
      tag.toLowerCase().includes("fast_food") ||
      tag.toLowerCase().includes("fast-food")
    ) ?? false;
  }, [selected]);

  // Si es Fast Food, bloquear gramos (solo unidades permitidas)
  const isFastFoodLocked = useMemo(() => {
    return isFastFood && hasUnits;
  }, [isFastFood, hasUnits]);

  // Auto-seleccionar modo unidades si tiene grams_per_unit
  useEffect(() => {
    if (!selected) return;
    
    // Marcar que estamos inicializando para evitar que otros efectos interfieran
    isInitializingRef.current = true;
    
    if (hasUnits) {
      // Tiene unidades: priorizar modo unidades
      // Establecer primero el modo para evitar que el efecto de conversión interfiera
      setInputMode("units");
      setUnitsStr("1");
      // Establecer los gramos basados en 1 unidad desde el principio
      const gramsForOneUnit = selected.grams_per_unit!;
      setGramsStr(gramsForOneUnit.toFixed(1));
      lastUserInputRef.current = null; // Reset ref
    } else {
      // Sin unidades: modo gramos
      setInputMode("grams");
      setGramsStr("100");
      setUnitsStr("1");
      lastUserInputRef.current = null; // Reset ref
    }
    
    // Permitir que otros efectos se ejecuten después de que la inicialización termine
    setTimeout(() => {
      isInitializingRef.current = false;
    }, 0);
  }, [selected?.key, hasUnits]); // Solo cuando cambia el alimento o sus unidades

  // Sincronizar unidades y gramos cuando cambia el modo o el valor
  useEffect(() => {
    if (!selected || !hasUnits || !selected.grams_per_unit) return;
    
    // No ejecutar durante la inicialización
    if (isInitializingRef.current) return;

    if (inputMode === "units" && Number.isFinite(unitsNum) && unitsNum > 0) {
      // Convertir unidades a gramos
      const calculatedGrams = unitsNum * selected.grams_per_unit;
      const currentGrams = gramsNum;
      // Solo actualizar si hay diferencia significativa para evitar loops
      if (Math.abs(calculatedGrams - currentGrams) > 0.5) {
        setGramsStr(calculatedGrams.toFixed(1));
      }
    }
  }, [inputMode, unitsNum, selected, hasUnits]);

  useEffect(() => {
    if (!selected || !hasUnits || !selected.grams_per_unit) return;
    
    // No ejecutar durante la inicialización
    if (isInitializingRef.current) return;

    if (inputMode === "grams" && Number.isFinite(gramsNum) && gramsNum > 0) {
      // Convertir gramos a unidades
      const calculatedUnits = gramsNum / selected.grams_per_unit;
      const currentUnits = unitsNum;
      // Solo actualizar si hay diferencia significativa para evitar loops
      if (Math.abs(calculatedUnits - currentUnits) > 0.01) {
        setUnitsStr(calculatedUnits.toFixed(1));
      }
    }
  }, [inputMode, gramsNum, selected, hasUnits]);

  const gramsError = useMemo(() => {
    if (inputMode === "units") {
      if (!unitsStr.trim()) return "Ingresa cantidad";
      if (!Number.isFinite(unitsNum)) return "Valor inválido";
      if (unitsNum <= 0) return "Debe ser > 0";
      if (unitsNum > 100) return "Demasiado alto (máx 100 unidades)";
      return null;
    } else {
      if (!gramsStr.trim()) return "Ingresa gramos";
      if (!Number.isFinite(gramsNum)) return "Valor inválido";
      if (gramsNum <= 0) return "Debe ser > 0";
      if (gramsNum > 2000) return "Demasiado alto (máx 2000g)";
      return null;
    }
  }, [gramsStr, gramsNum, unitsStr, unitsNum, inputMode]);

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

  const canShowSearchMore = useMemo(
    () =>
      !selected &&
      query.trim().length >= 2 &&
      !isSearchingLocal &&
      !isSearchingMore &&
      results.length < 6,
    [selected, query, isSearchingLocal, isSearchingMore, results.length],
  );

  const onSearchMore = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;

    // Cancelar búsqueda anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const myReqId = ++reqIdRef.current;

    setErr(null);
    setIsSearchingMore(true);

    const res = await openFoodFactsService.search({
      query: q,
      page: 1,
      pageSize: 15,
      cc: "cl",
      lc: "es",
      signal: abortController.signal,
    });

    // Verificar si la request fue cancelada
    if (myReqId !== reqIdRef.current || abortController.signal.aborted) {
      setIsSearchingMore(false);
      return;
    }

    if (!res.ok) {
      setIsSearchingMore(false);
      // No mostrar error si fue cancelado
      if (res.message !== "Búsqueda cancelada.") {
        setErr(res.message);
      }
      return;
    }

    const offItems: ExtendedFoodSearchItem[] = res.data.items.map((p) => ({
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
  }, [query, results]);

  const badgeText = useCallback((it: ExtendedFoodSearchItem) => {
    if (it.source === "user_food") return "Personalizado";
    if (it.source === "food") return it.verified ? "Verificado" : "Estimado";
    return "Estimado";
  }, []);

  const iconFor = useCallback((
    it: ExtendedFoodSearchItem,
  ): React.ComponentProps<typeof MaterialCommunityIcons>["name"] => {
    if (it.source === "user_food") return "account-edit";
    if (it.source === "food") return "database";
    return "barcode-scan";
  }, []);

  const onAdd = useCallback(async () => {
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

      // Redondear a enteros porque la base de datos usa integer
      calories: Math.round(preview.kcal),
      protein_g: Math.round(preview.protein),
      carbs_g: Math.round(preview.carbs),
      fat_g: Math.round(preview.fat),

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

    // Guardar en historial
    await addToSearchHistory(selected.name);
    const updatedHistory = await getSearchHistory();
    setSearchHistory(updatedHistory);

    setSelected(null);
    setQuery("");
    setResults([]);
    setErr(null);
    setGramsStr("100");
    reqIdRef.current += 1;

    // Mostrar toast con animación bonita
    showToast({
      message: "Se agregó a tus alimentos del día.",
      type: "success",
      icon: "check-circle",
      duration: 2000,
    });

    // Redirigir después de un pequeño delay para que se vea el toast
    setTimeout(() => {
      router.replace("/(tabs)/diary");
    }, 2000);
  }, [selected, gramsError, preview, gramsNum, day, meal, showToast, router]);

  const handleSelectFromHistory = useCallback(
    async (historyItem: string) => {
      setQuery(historyItem);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  const handleRemoveHistoryItem = useCallback(
    async (historyItem: string, e: any) => {
      e.stopPropagation();
      await removeFromSearchHistory(historyItem);
      const updatedHistory = await getSearchHistory();
      setSearchHistory(updatedHistory);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

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
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
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

            {/* Mis Recetas - Siempre visible */}
            {myRecipes.length > 0 && (
              <View style={{ gap: 8, marginTop: 12 }}>
                <View style={s.sectionHeader}>
                  <MaterialCommunityIcons
                    name="chef-hat"
                    size={18}
                    color={colors.textPrimary}
                  />
                  <Text style={s.sectionTitle}>Mis recetas</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {myRecipes.map((recipe) => (
                    <Pressable
                      key={recipe.key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelected(recipe);
                        // La inicialización se hará automáticamente en useEffect
                      }}
                      style={({ pressed }) => [
                        s.historyItem,
                        pressed && { opacity: 0.95, transform: [{ scale: 0.997 }] },
                      ]}
                    >
                      <View style={s.historyIcon}>
                        <MaterialCommunityIcons
                          name="chef-hat"
                          size={16}
                          color={colors.brand}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.historyName}>{recipe.name}</Text>
                        <Text style={s.historyMeta}>
                          {recipe.kcal_100g ? `${recipe.kcal_100g} kcal / 100g` : "Receta personalizada"}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Historial de búsqueda - Solo cuando hay focus y el input está vacío */}
            {isInputFocused && !query.trim() && searchHistory.length > 0 && (
              <View style={{ gap: 8, marginTop: 12 }}>
                <View style={s.sectionHeader}>
                  <Feather name="clock" size={18} color={colors.textPrimary} />
                  <Text style={s.sectionTitle}>Búsquedas recientes</Text>
                </View>
                <View style={{ gap: 6 }}>
                  {searchHistory.map((historyItem) => (
                    <Pressable
                      key={historyItem}
                      onPress={() => handleSelectFromHistory(historyItem)}
                      style={({ pressed }) => [
                        s.historyItem,
                        pressed && { opacity: 0.95, transform: [{ scale: 0.997 }] },
                      ]}
                    >
                      <View style={s.historyIcon}>
                        <Feather name="clock" size={16} color={colors.textSecondary} />
                      </View>
                      <Text style={[s.historyName, { flex: 1 }]}>
                        {historyItem}
                      </Text>
                      <Pressable
                        onPress={(e) => handleRemoveHistoryItem(historyItem, e)}
                        style={({ pressed }) => [
                          s.historyRemoveBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Feather name="x" size={14} color={colors.textSecondary} />
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

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
                  onPress={() => {
                    setSelected(it);
                    // La inicialización se hará automáticamente en useEffect
                  }}
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
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowCreateFoodModal(true);
                    }}
                    style={({ pressed }) => [
                      s.createFoodCard,
                      pressed && s.createFoodCardPressed,
                    ]}
                  >
                    <View style={s.createFoodIcon}>
                      <MaterialCommunityIcons
                        name="plus-circle"
                        size={32}
                        color={colors.brand}
                      />
                    </View>
                    <View style={s.createFoodContent}>
                      <Text style={s.createFoodTitle}>
                        ¿No encuentras "{query}"?
                      </Text>
                      <Text style={s.createFoodSubtitle}>
                        ¡Agrégalo a la comunidad y gana +50 XP!
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={24}
                      color={colors.brand}
                    />
                  </Pressable>
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
              <View style={s.labelRow}>
                <Text style={s.label}>
                  {hasUnits ? "Cantidad" : "Gramos consumidos"}
                </Text>
                {hasUnits && (
                  <View style={s.modeToggle}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setInputMode("units");
                      }}
                      style={({ pressed }) => [
                        s.modeToggleBtn,
                        inputMode === "units" && s.modeToggleBtnActive,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={[
                          s.modeToggleText,
                          inputMode === "units" && s.modeToggleTextActive,
                        ]}
                      >
                        {selected.unit_label_es || "unidad"}
                      </Text>
                    </Pressable>
                    {!isFastFoodLocked && (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setInputMode("grams");
                        }}
                        style={({ pressed }) => [
                          s.modeToggleBtn,
                          inputMode === "grams" && s.modeToggleBtnActive,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text
                          style={[
                            s.modeToggleText,
                            inputMode === "grams" && s.modeToggleTextActive,
                          ]}
                        >
                          Gramos
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
              
              <View style={s.gramsRow}>
                <MaterialCommunityIcons
                  name={inputMode === "units" ? "package-variant" : "scale"}
                  size={18}
                  color={colors.textSecondary}
                />
                <TextInput
                  value={inputMode === "units" ? unitsStr : gramsStr}
                  onChangeText={(text) => {
                    if (inputMode === "units") {
                      setUnitsStr(text);
                      // Marcar que el usuario está editando unidades
                      const num = toFloatSafe(text);
                      if (Number.isFinite(num)) {
                        lastUserInputRef.current = { mode: "units", value: num };
                      }
                    } else {
                      setGramsStr(text);
                      // Marcar que el usuario está editando gramos
                      const num = toFloatSafe(text);
                      if (Number.isFinite(num)) {
                        lastUserInputRef.current = { mode: "grams", value: num };
                      }
                    }
                  }}
                  keyboardType="decimal-pad"
                  style={s.gramsInput}
                  placeholder={inputMode === "units" ? "1" : "100"}
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={s.gramsUnit}>
                  {inputMode === "units" 
                    ? (selected.unit_label_es || "unidad") 
                    : "g"}
                </Text>
              </View>
              
              {/* Mostrar peso total destacado si es fast food */}
              {isFastFood && (
                <View style={s.fastFoodBadge}>
                  <MaterialCommunityIcons
                    name="information"
                    size={14}
                    color={colors.cta}
                  />
                  <Text style={s.fastFoodBadgeText}>
                    {inputMode === "units" && hasUnits
                      ? `${unitsNum === 1 ? (selected.unit_label_es || "unidad") : (selected.unit_label_es || "unidad") + "s"} = ${Math.round(gramsNum)}g`
                      : `Peso total: ${Math.round(gramsNum)}g`}
                  </Text>
                </View>
              )}
              
              {/* Información de la porción para ingredientes base */}
              {hasUnits && !isFastFood && (
                <View style={s.portionHint}>
                  <Text style={s.portionHintText}>
                    {inputMode === "units"
                      ? `1 ${selected.unit_label_es || "unidad"} = ${selected.grams_per_unit}g`
                      : `${Math.round(unitsNum * 10) / 10} ${(selected.unit_label_es || "unidad") + (unitsNum !== 1 ? "s" : "")} = ${Math.round(gramsNum)}g`}
                  </Text>
                </View>
              )}
              
              {!!gramsError && <Text style={s.errorSmall}>{gramsError}</Text>}
            </View>

            <View style={s.previewBox}>
              <View style={s.previewHeader}>
                <MaterialCommunityIcons
                  name="calculator-variant"
                  size={18}
                  color={colors.textPrimary}
                />
                <Text style={s.previewTitle}>Resumen nutricional</Text>
              </View>

              <View style={s.previewGrid}>
                <MacroChip
                  kind="kcal"
                  value={Math.round(preview?.kcal ?? 0)}
                  suffix="kcal"
                  colors={colors}
                  typography={typography}
                />
                <MacroChip
                  kind="p"
                  value={Number((preview?.protein ?? 0).toFixed(1))}
                  suffix="g"
                  label="Proteína"
                  colors={colors}
                  typography={typography}
                />
                <MacroChip
                  kind="c"
                  value={Number((preview?.carbs ?? 0).toFixed(1))}
                  suffix="g"
                  label="Carbs"
                  colors={colors}
                  typography={typography}
                />
                <MacroChip
                  kind="f"
                  value={Number((preview?.fat ?? 0).toFixed(1))}
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

      {/* Modal para crear alimento */}
      <CreateFoodModal
        visible={showCreateFoodModal}
        onClose={() => setShowCreateFoodModal(false)}
        onSuccess={() => {
          // Refrescar búsqueda después de crear
          if (query.trim().length >= 2) {
            searchLocalFoods(query).then((merged) => {
              setResults(merged);
            });
          }
        }}
        initialName={query.trim()}
      />
    </SafeAreaView>
  );
}

const MacroChip = React.memo(function MacroChip({
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
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    sectionTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    historyItem: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    historyIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    historyName: {
      fontFamily: typography.subtitle?.fontFamily,
      color: colors.textPrimary,
      fontSize: 14,
    },
    historyMeta: {
      fontFamily: typography.body?.fontFamily,
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    historyRemoveBtn: {
      width: 28,
      height: 28,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
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
    createFoodCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      borderRadius: 16,
      backgroundColor: colors.brand + "10",
      borderWidth: 2,
      borderColor: colors.brand + "40",
      gap: 16,
      marginTop: 8,
    },
    createFoodCardPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    createFoodIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.brand + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    createFoodContent: {
      flex: 1,
      gap: 4,
    },
    createFoodTitle: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    createFoodSubtitle: {
      ...typography.body,
      fontSize: 13,
      color: colors.textSecondary,
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
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modeToggle: {
      flexDirection: "row",
      gap: 6,
    },
    modeToggleBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    modeToggleBtnActive: {
      borderColor: colors.brand,
      backgroundColor: `${colors.brand}15`,
    },
    modeToggleText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 11,
      color: colors.textSecondary,
    },
    modeToggleTextActive: {
      color: colors.brand,
      fontWeight: "600",
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
    fastFoodBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: `${colors.cta}15`,
      borderWidth: 1,
      borderColor: `${colors.cta}30`,
    },
    fastFoodBadgeText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 13,
      color: colors.cta,
      fontWeight: "600",
    },
    portionInfo: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: "center",
    },
    portionInfoText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
    portionHint: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.background,
    },
    portionHintText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 11,
      color: colors.textSecondary,
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