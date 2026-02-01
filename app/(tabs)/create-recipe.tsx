// app/(tabs)/create-recipe.tsx
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import { userFoodsRepository } from "@/data/food/userFoodsRepository";
import { openFoodFactsService } from "@/data/openfoodfacts/openFoodFactsService";
import {
  mapGenericFoodDbArrayToSearchItems,
  mapUserFoodDbArrayToSearchItems,
  type FoodSearchItem,
} from "@/domain/mappers/foodMappers";
import type { OffProduct } from "@/domain/models/offProduct";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

type ExtendedFoodSearchItem = FoodSearchItem & {
  off?: OffProduct | null;
  /** Cuando source es "off": 'gr' | 'ml'. Usado para sufijo y etiquetas (g vs ml). */
  unitType?: "gr" | "ml";
};

type RecipeIngredient = {
  id: string;
  food: ExtendedFoodSearchItem;
  grams: number;
  units?: number; // Cantidad de unidades (si aplica)
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
  const kcal = (macros.kcal_100g ?? 0) * factor;
  const protein = (macros.protein_100g ?? 0) * factor;
  const carbs = (macros.carbs_100g ?? 0) * factor;
  const fat = (macros.fat_100g ?? 0) * factor;
  return { kcal, protein, carbs, fat };
}

function calculateRecipeTotals(ingredients: RecipeIngredient[]) {
  return ingredients.reduce(
    (acc, ing) => {
      const macros = computeFrom100gMacros(
        {
          kcal_100g: ing.food.kcal_100g,
          protein_100g: ing.food.protein_100g,
          carbs_100g: ing.food.carbs_100g,
          fat_100g: ing.food.fat_100g,
        },
        ing.grams,
      );
      acc.calories += macros.kcal;
      acc.protein += macros.protein;
      acc.carbs += macros.carbs;
      acc.fat += macros.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

async function searchLocalFoods(q: string): Promise<ExtendedFoodSearchItem[]> {
  const [userFoodsRes, genericsRes] = await Promise.all([
    userFoodsRepository.search(q),
    genericFoodsRepository.search(q),
  ]);

  const userFoods = userFoodsRes.ok
    ? mapUserFoodDbArrayToSearchItems(userFoodsRes.data)
    : [];
  const generics = genericsRes.ok
    ? mapGenericFoodDbArrayToSearchItems(genericsRes.data)
    : [];

  return [...userFoods, ...generics];
}

export default function CreateRecipeScreen() {
  const params = useLocalSearchParams<{ barcode?: string; reset?: string }>();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const s = makeStyles(colors, typography, insets);

  const [recipeName, setRecipeName] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [saving, setSaving] = useState(false);

  // Búsqueda de ingredientes
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExtendedFoodSearchItem[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedIngredient, setSelectedIngredient] =
    useState<ExtendedFoodSearchItem | null>(null);
  const [ingredientGrams, setIngredientGrams] = useState("100");
  const [ingredientUnits, setIngredientUnits] = useState("1");
  const [ingredientInputMode, setIngredientInputMode] = useState<
    "grams" | "units"
  >("grams");
  
  const [err, setErr] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Barcode scan handling
  useEffect(() => {
    const barcode =
      typeof params.barcode === "string" ? params.barcode.trim() : "";
    if (!barcode) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const myReqId = ++reqIdRef.current;

    (async () => {
      setErr(null);
      setIsSearching(true);

      const res = await openFoodFactsService.getByBarcode(
        barcode,
        abortController.signal,
      );

      if (myReqId !== reqIdRef.current || abortController.signal.aborted) {
        return;
      }

      setIsSearching(false);

      if (!res.ok) {
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
        kcal_100g: res.data.kcal_100g ?? 0,
        protein_100g: res.data.protein_100g ?? 0,
        carbs_100g: res.data.carbs_100g ?? 0,
        fat_100g: res.data.fat_100g ?? 0,
        off: res.data,
        verified: false,
        base_unit: res.data.unitType === "ml" ? "ml" : "g",
        unitType: res.data.unitType,
      };

      setSelectedIngredient(it);
      setSearchQuery(res.data.name);
      setSearchResults([]);
      setShowSearch(false);
      // Si tiene unidades, cambiar a modo unidades por defecto
      if (it.grams_per_unit && it.grams_per_unit > 0) {
        setIngredientInputMode("units");
        setIngredientUnits("1");
      } else {
        setIngredientInputMode("grams");
        const suggested = it.off?.servingQuantity;
        if (suggested && suggested > 0) {
          setIngredientGrams(String(suggested));
        } else {
          setIngredientGrams("100");
        }
      }
      
      // Limpiar params para evitar re-lectura
      setTimeout(() => router.setParams({ barcode: undefined }), 500);
    })();

    return () => {
      abortController.abort();
    };
  }, [params.barcode]);

  // Reset state if requested (new recipe flow)
  useEffect(() => {
    if (params.reset === "true") {
      setRecipeName("");
      setIngredients([]);
      setSaving(false);
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);
      setShowSearch(false);
      setSelectedIngredient(null);
      setIngredientGrams("100");
      setIngredientUnits("1");
      setIngredientInputMode("grams");
      setErr(null);

      // Clear reset param to avoid clearing on subsequent renders or back navigation
      router.setParams({ reset: undefined });
    }
  }, [params.reset]);

  // Búsqueda de ingredientes
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsSearching(true);
    const myReqId = ++reqIdRef.current;

    const t = setTimeout(async () => {
      try {
        const merged = await searchLocalFoods(q);
        if (myReqId !== reqIdRef.current) return;
        setSearchResults(merged);
        setIsSearching(false);
      } catch {
        if (myReqId !== reqIdRef.current) return;
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 320);

    return () => {
      clearTimeout(t);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchQuery]);

  const recipeTotals = useMemo(
    () => calculateRecipeTotals(ingredients),
    [ingredients],
  );

  const canSaveRecipe = useMemo(() => {
    return recipeName.trim().length >= 2 && ingredients.length > 0 && !saving;
  }, [recipeName, ingredients.length, saving]);

  const handleAddIngredient = useCallback(() => {
    if (!selectedIngredient) return;

    const hasUnits =
      selectedIngredient.grams_per_unit &&
      selectedIngredient.grams_per_unit > 0;
    let clampedGrams: number;
    let units: number | undefined;

    if (hasUnits && ingredientInputMode === "units") {
      // Si está en modo unidades, calcular gramos desde unidades
      const unitsNum = toFloatSafe(ingredientUnits);
      if (!Number.isFinite(unitsNum) || unitsNum <= 0) {
        showToast({
          message: "Ingresa una cantidad válida",
          type: "error",
        });
        return;
      }
      units = Math.round(clamp(unitsNum, 1, 1000));
      const factor = selectedIngredient.grams_per_unit ?? 1;
      clampedGrams = clamp(units * factor, 1, 2000);
    } else {
      // Modo gramos
      const gramsNum = toFloatSafe(ingredientGrams);
      if (!Number.isFinite(gramsNum) || gramsNum <= 0) {
        showToast({
          message: "Ingresa una cantidad válida",
          type: "error",
        });
        return;
      }
      clampedGrams = clamp(gramsNum, 1, 2000);
      const factor = selectedIngredient.grams_per_unit ?? 1;
      units = hasUnits
        ? Math.round(clampedGrams / factor)
        : undefined;
    }

    // Verificar si el ingrediente ya existe (por key del alimento)
    setIngredients((prev) => {
      const existingIndex = prev.findIndex(
        (ing) => ing.food.key === selectedIngredient.key,
      );

      if (existingIndex >= 0) {
        // Si existe, sumar las cantidades
        const updated = [...prev];
        const newGrams = clamp(
          updated[existingIndex]!.grams + clampedGrams,
          1,
          2000,
        );
        const newUnits =
          hasUnits && updated[existingIndex]!.units
            ? updated[existingIndex]!.units! + (units || 0)
            : units;

        updated[existingIndex] = {
          ...updated[existingIndex]!,
          grams: newGrams,
          units: newUnits,
        };
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return updated;
      } else {
        // Si no existe, agregar nuevo
        const newIngredient: RecipeIngredient = {
          id: `${Date.now()}-${Math.random()}`,
          food: selectedIngredient,
          grams: clampedGrams,
          units: units,
        };
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return [...prev, newIngredient];
      }
    });

    setSelectedIngredient(null);
    setSearchQuery("");
    setIngredientGrams("100");
    setIngredientUnits("1");
    setIngredientInputMode("grams");
    setShowSearch(false);
  }, [
    selectedIngredient,
    ingredientGrams,
    ingredientUnits,
    ingredientInputMode,
    showToast,
  ]);

  const handleRemoveIngredient = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
  }, []);

  const handleUpdateIngredientGrams = useCallback(
    (id: string, newGrams: number) => {
      const clamped = clamp(newGrams, 1, 2000);
      setIngredients((prev) =>
        prev.map((ing) => {
          if (ing.id !== id) return ing;

          // Si tiene unidades, recalcular unidades basándose en gramos
          const hasUnits =
            ing.food.grams_per_unit && ing.food.grams_per_unit > 0;
          const newUnits = hasUnits
            ? Math.round(clamped / (ing.food.grams_per_unit ?? 1))
            : ing.units;

          return { ...ing, grams: clamped, units: newUnits };
        }),
      );
    },
    [],
  );

  const handleUpdateIngredientUnits = useCallback(
    (id: string, newUnits: number) => {
      const clamped = clamp(newUnits, 1, 1000);
      setIngredients((prev) =>
        prev.map((ing) => {
          if (ing.id !== id) return ing;

          // Calcular gramos basándose en unidades
          const hasUnits =
            ing.food.grams_per_unit && ing.food.grams_per_unit > 0;
          if (!hasUnits) return ing;

          const newGrams = clamp(clamped * (ing.food.grams_per_unit ?? 1), 1, 2000);
          return { ...ing, units: clamped, grams: newGrams };
        }),
      );
    },
    [],
  );

  const handleSaveRecipe = useCallback(async () => {
    if (!canSaveRecipe) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const totals = calculateRecipeTotals(ingredients);
    const totalGrams = ingredients.reduce((sum, ing) => sum + ing.grams, 0);

    const res = await userFoodsRepository.create({
      base_food_id: null,
      name: recipeName.trim(),
      category: "receta",
      portion_unit: "g",
      portion_base: totalGrams,
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    });

    setSaving(false);

    if (!res.ok) {
      showToast({
        message: res.message || "Error al guardar receta",
        type: "error",
      });
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({
      message: "Receta creada exitosamente",
      type: "success",
    });

    // Volver a la pantalla anterior
    router.back();
  }, [canSaveRecipe, recipeName, ingredients, showToast]);

  const handleOpenScanner = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/(tabs)/scan",
      params: { returnTo: "create-recipe" },
    });
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={s.header}>
            <Pressable
                onPress={() => router.back()}
                style={s.backButton}
            >
                <Feather name="arrow-left" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={s.title}>Nueva receta</Text>
            <View style={{ width: 40 }} />
        </View>

        <ScrollView
            contentContainerStyle={s.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {/* Nombre receta */}
            <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Nombre de la receta</Text>
            <TextInput
                style={s.input}
                value={recipeName}
                onChangeText={setRecipeName}
                placeholder="Ej: Arroz con Pollo"
                placeholderTextColor={colors.textSecondary}
            />
            </View>

            {/* Agregar ingrediente */}
            <View style={s.inputGroup}>
            <View style={s.inputLabelRow}>
                <Text style={s.inputLabel}>Agregar ingrediente</Text>
                <Pressable onPress={handleOpenScanner} style={s.scanBtn}>
                <Feather name="camera" size={16} color={colors.brand} />
                <Text style={s.scanBtnText}>Escanear</Text>
                </Pressable>
            </View>

            <TextInput
                style={s.input}
                value={searchQuery}
                onChangeText={(text) => {
                setSearchQuery(text);
                const shouldShow = text.length >= 2;
                setShowSearch(shouldShow);
                if (shouldShow) setIsSearching(true);
                }}
                placeholder="Buscar alimento..."
                placeholderTextColor={colors.textSecondary}
            />

            {/* Resultados búsqueda */}
            {showSearch && searchQuery.length >= 2 && (
                <View style={s.searchResults}>
                {isSearching ? (
                    <View style={s.searchLoading}>
                    <ActivityIndicator
                        size="small"
                        color={colors.brand}
                    />
                    </View>
                ) : searchResults.length === 0 ? (
                    <Text style={s.searchEmpty}>
                    No se encontraron resultados
                    </Text>
                ) : (
                    searchResults.map((item) => (
                    <Pressable
                        key={item.key}
                        onPress={() => {
                        Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                        );
                        setSelectedIngredient(item);
                        setShowSearch(false);
                        // Si tiene unidades, cambiar a modo unidades por defecto
                        if (
                            item.grams_per_unit &&
                            item.grams_per_unit > 0
                        ) {
                            setIngredientInputMode("units");
                            setIngredientUnits("1");
                        } else {
                            setIngredientInputMode("grams");
                            setIngredientGrams("100");
                        }
                        }}
                        style={({ pressed }) => [
                        s.searchItem,
                        pressed && { opacity: 0.7 },
                        ]}
                    >
                        <View style={{ flex: 1 }}>
                        <Text style={s.searchItemName}>
                            {item.name}
                        </Text>
                        <Text style={s.searchItemMeta}>
                            {item.meta}
                        </Text>
                        </View>
                        <Feather
                        name="chevron-right"
                        size={16}
                        color={colors.textSecondary}
                        />
                    </Pressable>
                    ))
                )}
                </View>
            )}

            {/* Error message */}
            {err && (
                <View style={{ padding: 10, backgroundColor: '#fee2e2', borderRadius: 8, marginBottom: 10 }}>
                    <Text style={{ color: '#ef4444' }}>{err}</Text>
                </View>
            )}

            {/* Ingrediente seleccionado */}
            {selectedIngredient &&
                (() => {
                const hasUnits =
                    selectedIngredient.grams_per_unit &&
                    selectedIngredient.grams_per_unit > 0;
                const unitLabel =
                    selectedIngredient.unit_label_es || "unidad";
                const isMl =
                    selectedIngredient.unitType === "ml" ||
                    selectedIngredient.base_unit === "ml";
                const unitSuffix = isMl ? "ml" : "g";
                const quantityLabel = isMl ? "mililitros" : "gramos";

                return (
                    <View style={s.selectedIngredient}>
                    {/* Texto completo arriba */}
                    <View style={s.selectedIngredientHeader}>
                        <Text style={s.selectedName}>
                        {selectedIngredient.name}
                        </Text>
                        {selectedIngredient.meta && (
                        <Text style={s.selectedMeta}>
                            {selectedIngredient.meta}
                        </Text>
                        )}
                    </View>

                    {/* Controles abajo */}
                    <View style={s.selectedIngredientControls}>
                        {hasUnits && (
                        <View style={s.inputModeToggle}>
                            <Pressable
                            onPress={() => {
                                setIngredientInputMode("units");
                                // Calcular unidades desde gramos actuales
                                const currentGrams =
                                toFloatSafe(ingredientGrams) || 100;
                                const factor = selectedIngredient.grams_per_unit ?? 1;
                                const calculatedUnits = Math.round(
                                currentGrams / factor,
                                );
                                setIngredientUnits(
                                calculatedUnits.toString(),
                                );
                            }}
                            style={({ pressed }) => [
                                s.inputModeBtn,
                                ingredientInputMode === "units" &&
                                s.inputModeBtnActive,
                                pressed && { opacity: 0.7 },
                            ]}
                            >
                            <Text
                                style={[
                                s.inputModeText,
                                ingredientInputMode === "units" &&
                                    s.inputModeTextActive,
                                ]}
                            >
                                {unitLabel}
                            </Text>
                            </Pressable>
                            <Pressable
                            onPress={() => {
                                setIngredientInputMode("grams");
                                // Calcular gramos desde unidades actuales
                                const currentUnits =
                                toFloatSafe(ingredientUnits) || 1;
                                const calculatedGrams = Math.round(
                                currentUnits *
                                    selectedIngredient.grams_per_unit!,
                                );
                                setIngredientGrams(
                                calculatedGrams.toString(),
                                );
                            }}
                            style={({ pressed }) => [
                                s.inputModeBtn,
                                ingredientInputMode === "grams" &&
                                s.inputModeBtnActive,
                                pressed && { opacity: 0.7 },
                            ]}
                            >
                            <Text
                                style={[
                                s.inputModeText,
                                ingredientInputMode === "grams" &&
                                    s.inputModeTextActive,
                                ]}
                            >
                                {quantityLabel}
                            </Text>
                            </Pressable>
                        </View>
                        )}

                        <View style={s.gramsInput}>
                        <TextInput
                            style={s.gramsInputText}
                            value={
                            ingredientInputMode === "units"
                                ? ingredientUnits
                                : ingredientGrams
                            }
                            onChangeText={
                            ingredientInputMode === "units"
                                ? setIngredientUnits
                                : setIngredientGrams
                            }
                            placeholder={
                            ingredientInputMode === "units"
                                ? "1"
                                : "100"
                            }
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="numeric"
                        />
                        <Text style={s.gramsLabel}>
                            {ingredientInputMode === "units"
                            ? unitLabel
                            : unitSuffix}
                        </Text>
                        </View>
                        <Pressable
                        onPress={handleAddIngredient}
                        style={s.addIngredientBtn}
                        >
                        <Feather
                            name="check"
                            size={16}
                            color={colors.onCta}
                        />
                        </Pressable>
                    </View>
                    </View>
                );
                })()}
            </View>

            {/* Ingredientes agregados */}
            {ingredients.length > 0 && (
            <View style={s.inputGroup}>
                <Text style={s.inputLabel}>
                Ingredientes ({ingredients.length})
                </Text>
                <View style={{ gap: 8 }}>
                {ingredients.map((ing) => {
                    const macros = computeFrom100gMacros(
                    {
                        kcal_100g: ing.food.kcal_100g,
                        protein_100g: ing.food.protein_100g,
                        carbs_100g: ing.food.carbs_100g,
                        fat_100g: ing.food.fat_100g,
                    },
                    ing.grams,
                    );
                    return (
                        <IngredientItem
                            key={ing.id}
                            ingredient={ing}
                            macros={macros}
                            colors={colors}
                            styles={s}
                            onUpdateGrams={(val) =>
                                handleUpdateIngredientGrams(ing.id, val)
                            }
                            onUpdateUnits={(val) =>
                                handleUpdateIngredientUnits(ing.id, val)
                            }
                            onRemove={() => handleRemoveIngredient(ing.id)}
                        />
                    );
                })}
                </View>
            </View>
            )}

            {ingredients.length > 0 && (
            <View style={s.totalsCard}>
                <Text style={s.totalsTitle}>Macros Totales</Text>
                <View style={s.macrosRow}>
                <View style={s.macroChip}>
                    <MaterialCommunityIcons
                    name="fire"
                    size={16}
                    color={colors.textSecondary}
                    />
                    <Text style={s.macroText}>
                    {Math.round(recipeTotals.calories)} kcal
                    </Text>
                </View>
                <View style={s.macroChip}>
                    <MaterialCommunityIcons
                    name="food-steak"
                    size={16}
                    color={colors.textSecondary}
                    />
                    <Text style={s.macroText}>
                    P {recipeTotals.protein.toFixed(1)}g
                    </Text>
                </View>
                <View style={s.macroChip}>
                    <MaterialCommunityIcons
                    name="bread-slice"
                    size={16}
                    color={colors.textSecondary}
                    />
                    <Text style={s.macroText}>
                    C {recipeTotals.carbs.toFixed(1)}g
                    </Text>
                </View>
                <View style={s.macroChip}>
                    <MaterialCommunityIcons
                    name="peanut"
                    size={16}
                    color={colors.textSecondary}
                    />
                    <Text style={s.macroText}>
                    F {recipeTotals.fat.toFixed(1)}g
                    </Text>
                </View>
                </View>
            </View>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
        {/* Footer flotante con botón guardar */}
        <View style={s.footer}>
            <Pressable
                onPress={handleSaveRecipe}
                style={({ pressed }) => [
                s.saveButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                !canSaveRecipe && s.saveButtonDisabled,
                ]}
                disabled={!canSaveRecipe}
            >
                {saving ? (
                <ActivityIndicator color={colors.onCta} />
                ) : (
                <Text style={s.saveButtonText}>Guardar Receta</Text>
                )}
            </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


function IngredientItem({
  ingredient,
  macros,
  colors,
  styles,
  onUpdateGrams,
  onUpdateUnits,
  onRemove,
}: {
  ingredient: RecipeIngredient;
  macros: { kcal: number; protein: number; carbs: number; fat: number };
  colors: any;
  styles: any;
  onUpdateGrams: (grams: number) => void;
  onUpdateUnits?: (units: number) => void;
  onRemove: () => void;
}) {
  const hasUnits =
    ingredient.food.grams_per_unit && ingredient.food.grams_per_unit > 0;
  const unitLabel = ingredient.food.unit_label_es || "unidad";
  const isMl =
    ingredient.food.unitType === "ml" || ingredient.food.base_unit === "ml";
  const unitSuffix = isMl ? "ml" : "g";
  const quantityLabel = isMl ? "mililitros" : "gramos";

  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<"grams" | "units">(
    hasUnits && ingredient.units ? "units" : "grams",
  );
  const [gramsStr, setGramsStr] = useState(ingredient.grams.toString());
  const [unitsStr, setUnitsStr] = useState(
    ingredient.units?.toString() ||
      (hasUnits
        ? Math.round(
            ingredient.grams / (ingredient.food.grams_per_unit ?? 1),
          ).toString()
        : "1"),
  );

  useEffect(() => {
    if (!isEditing) {
      setGramsStr(ingredient.grams.toString());
      if (hasUnits) {
        const calculatedUnits = Math.round(
          ingredient.grams / (ingredient.food.grams_per_unit ?? 1),
        );
        setUnitsStr(calculatedUnits.toString());
      }
    }
  }, [ingredient.grams, ingredient.units, isEditing, hasUnits]);

  const handleSave = useCallback(() => {
    if (editMode === "units" && hasUnits && onUpdateUnits) {
      const unitsNum = toFloatSafe(unitsStr);
      if (Number.isFinite(unitsNum) && unitsNum > 0) {
        onUpdateUnits(unitsNum);
        setIsEditing(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        setUnitsStr(ingredient.units?.toString() || "1");
        setIsEditing(false);
      }
    } else {
      const gramsNum = toFloatSafe(gramsStr);
      if (Number.isFinite(gramsNum) && gramsNum > 0) {
        onUpdateGrams(gramsNum);
        setIsEditing(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        setGramsStr(ingredient.grams.toString());
        setIsEditing(false);
      }
    }
  }, [
    gramsStr,
    unitsStr,
    editMode,
    hasUnits,
    ingredient.grams,
    ingredient.units,
    onUpdateGrams,
    onUpdateUnits,
  ]);

  const handleQuickAdjust = useCallback(
    (delta: number) => {
      if (hasUnits && editMode === "units" && onUpdateUnits) {
        // Ajustar por unidades
        const currentUnits =
          ingredient.units ||
          Math.round(ingredient.grams / (ingredient.food.grams_per_unit ?? 1));
        const newUnits = clamp(currentUnits + delta, 1, 1000);
        onUpdateUnits(newUnits);
      } else {
        // Ajustar por gramos
        const newGrams = clamp(ingredient.grams + delta, 1, 2000);
        onUpdateGrams(newGrams);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [
      ingredient.grams,
      ingredient.units,
      hasUnits,
      editMode,
      onUpdateGrams,
      onUpdateUnits,
    ],
  );

  const currentUnits = hasUnits
  ? ingredient.units ||
    Math.round(ingredient.grams / (ingredient.food.grams_per_unit ?? 1))
  : null;

  const renderRightActions = () => {
    return (
      <View style={styles.swipeActionContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.swipeDeleteButton,
            pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
          ]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onRemove();
          }}
        >
          <Feather name="trash-2" size={24} color={colors.onCta} />
        </Pressable>
      </View>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <View style={styles.ingredientItem}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ingredientName}>{ingredient.food.name}</Text>
          {isEditing ? (
            <View style={styles.ingredientEditContainer}>
              {hasUnits && (
                <View style={styles.ingredientEditModeToggle}>
                  <Pressable
                    onPress={() => setEditMode("units")}
                    style={({ pressed }) => [
                      styles.ingredientEditModeBtn,
                      editMode === "units" && styles.ingredientEditModeBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ingredientEditModeText,
                        editMode === "units" &&
                          styles.ingredientEditModeTextActive,
                      ]}
                    >
                      {unitLabel}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditMode("grams")}
                    style={({ pressed }) => [
                      styles.ingredientEditModeBtn,
                      editMode === "grams" && styles.ingredientEditModeBtnActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ingredientEditModeText,
                        editMode === "grams" &&
                          styles.ingredientEditModeTextActive,
                      ]}
                    >
                      {quantityLabel}
                    </Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.ingredientEditRow}>
                <TextInput
                  style={styles.ingredientGramsInput}
                  value={editMode === "units" ? unitsStr : gramsStr}
                  onChangeText={editMode === "units" ? setUnitsStr : setGramsStr}
                  keyboardType="numeric"
                  autoFocus
                  placeholderTextColor={colors.textSecondary}
                  onBlur={handleSave}
                  onSubmitEditing={handleSave}
                />
                <Text style={styles.ingredientGramsLabel}>
                  {editMode === "units" ? unitLabel : unitSuffix}
                </Text>
                <Pressable onPress={handleSave} style={styles.ingredientSaveBtn}>
                  <Feather name="check" size={14} color={colors.brand} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.ingredientGrams}>
              {hasUnits && currentUnits
                ? `${currentUnits} ${unitLabel}${currentUnits !== 1 ? "s" : ""}`
                : `${ingredient.grams}${unitSuffix}`}{" "}
              · {Math.round(macros.kcal)} kcal
            </Text>
          )}
        </View>

        {!isEditing && (
          <View style={styles.ingredientActions}>
            <Pressable
              onPress={() =>
                handleQuickAdjust(hasUnits && editMode === "units" ? -1 : -10)
              }
              style={({ pressed }) => [
                styles.ingredientAdjustBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="minus" size={16} color={colors.textPrimary} />
            </Pressable>

            {/* Contador de cantidad */}
            <View style={styles.ingredientCounter}>
              <Text style={styles.ingredientCounterText}>
                {hasUnits && currentUnits
                  ? `${currentUnits} ${currentUnits === 1 ? unitLabel : unitLabel + "s"}`
                  : `${ingredient.grams}g`}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                handleQuickAdjust(hasUnits && editMode === "units" ? 1 : 10)
              }
              style={({ pressed }) => [
                styles.ingredientAdjustBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="plus" size={16} color={colors.textPrimary} />
            </Pressable>

            <Pressable
              onPress={() => {
                setEditMode(hasUnits ? "units" : "grams");
                setIsEditing(true);
              }}
              style={({ pressed }) => [
                styles.ingredientEditBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="edit-2" size={14} color={colors.brand} />
            </Pressable>
          </View>
        )}
      </View>
    </Swipeable>
  );
}

function makeStyles(colors: any, typography: any, insets: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40, 
      height: 40,
      borderRadius: 20,
      alignItems: "center", 
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    title: {
      ...typography.h3,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    contentContainer: {
        padding: 20,
    },
    inputGroup: {
      marginBottom: 24,
    },
    inputLabel: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    inputLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.textPrimary,
      ...typography.body,
    },
    
    // Scanner Button
    scanBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: colors.brand + "15",
    },
    scanBtnText: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.brand,
    },

    // Search results
    searchResults: {
        marginTop: 8,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        maxHeight: 250,
    },
    searchItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border + "50",
    },
    searchItemName: {
        ...typography.body,
        fontSize: 14,
        fontWeight: "600",
        color: colors.textPrimary,
    },
    searchItemMeta: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    searchEmpty: {
        padding: 16,
        textAlign: "center",
        color: colors.textSecondary,
        fontSize: 14,
    },
    searchLoading: {
        padding: 16,
        alignItems: "center",
    },

    // Selected Ingredient
    selectedIngredient: {
        marginTop: 12,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.brand,
        padding: 14,
    },
    selectedIngredientHeader: {
        marginBottom: 12,
    },
    selectedName: {
        ...typography.subtitle,
        fontSize: 16,
        fontWeight: "700",
        color: colors.textPrimary,
    },
    selectedMeta: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    selectedIngredientControls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    inputModeToggle: {
        flexDirection: "row",
        backgroundColor: colors.background,
        borderRadius: 8,
        padding: 2,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputModeBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
    },
    inputModeBtnActive: {
        backgroundColor: colors.textPrimary,
    },
    inputModeText: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    inputModeTextActive: {
        color: colors.background,
    },
    gramsInput: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 10,
    },
    gramsInputText: {
        flex: 1,
        paddingVertical: 8,
        fontSize: 16,
        fontWeight: "600",
        color: colors.textPrimary,
        textAlign: "right",
    },
    gramsLabel: {
        marginLeft: 6,
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: "500",
    },
    addIngredientBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.brand,
        alignItems: "center",
        justifyContent: "center",
    },

    // Ingredient Item (List)
    ingredientItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: 12,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    ingredientName: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.textPrimary,
        marginBottom: 4,
    },
    ingredientGrams: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    ingredientActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    ingredientAdjustBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    ingredientCounter: {
        minWidth: 50,
        alignItems: "center",
    },
    ingredientCounterText: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textPrimary,
    },
    ingredientEditBtn: {
        marginLeft: 4,
        padding: 6,
    },
    removeIngredientBtn: {
        marginLeft: 2,
        padding: 6,
    },

    // Inline Edit
    ingredientEditContainer: {
        marginTop: 6,
        gap: 8,
    },
    ingredientEditModeToggle: {
        flexDirection: "row",
        alignSelf: "flex-start",
        backgroundColor: colors.background,
        borderRadius: 6,
        padding: 2,
        borderWidth: 1,
        borderColor: colors.border,
    },
    ingredientEditModeBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    ingredientEditModeBtnActive: {
        backgroundColor: colors.textPrimary,
    },
    ingredientEditModeText: {
        fontSize: 11,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    ingredientEditModeTextActive: {
        color: colors.background,
    },
    ingredientEditRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    ingredientGramsInput: {
        flex: 1,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.brand,
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        fontSize: 14,
        color: colors.textPrimary,
    },
    ingredientGramsLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        width: 40,
    },
    ingredientSaveBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.brand + "20",
        alignItems: "center",
        justifyContent: "center",
    },
    
    // Totals
    totalsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalsTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    macrosRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      justifyContent: "center",
    },
    macroChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.background,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
      width: "48%", // 2 columns
    },
    macroText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    
    // Footer
    footer: {
      padding: 20,
      paddingBottom: insets.bottom + 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    saveButton: {
      backgroundColor: colors.cta,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
      shadowColor: colors.cta,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    saveButtonDisabled: {
      backgroundColor: colors.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.onCta,
    },

    // Swipe Actions
    swipeActionContainer: {
      width: 90,
      justifyContent: "center",
      alignItems: "center",
      paddingLeft: 8,
    },
    swipeDeleteButton: {
      flex: 1,
      width: "100%",
      backgroundColor: colors.cta,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      height: "100%",
    },
  });
}
