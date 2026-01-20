// app/(tabs)/my-foods.tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { userFoodsRepository, type UserFoodDb } from "@/data/food/userFoodsRepository";
import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import { foodsRepository } from "@/data/food/foodsRepository";
import { openFoodFactsService } from "@/data/openfoodfacts/openFoodFactsService";
import {
  mapFoodDbArrayToSearchItems,
  mapGenericFoodDbArrayToSearchItems,
  mapUserFoodDbArrayToSearchItems,
  type FoodSearchItem,
} from "@/domain/mappers/foodMappers";
import type { OffProduct } from "@/domain/models/offProduct";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useStaggerAnimation } from "@/presentation/hooks/ui/useStaggerAnimation";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

type ExtendedFoodSearchItem = FoodSearchItem & {
  off?: OffProduct | null;
};

type RecipeIngredient = {
  id: string;
  food: ExtendedFoodSearchItem;
  grams: number;
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
  const [userFoodsRes, foodsRes, genericsRes] = await Promise.all([
    userFoodsRepository.search(q),
    foodsRepository.search(q),
    genericFoodsRepository.search(q),
  ]);

  const userFoods = userFoodsRes.ok
    ? mapUserFoodDbArrayToSearchItems(userFoodsRes.data)
    : [];
  const foods = foodsRes.ok ? mapFoodDbArrayToSearchItems(foodsRes.data) : [];
  const generics = genericsRes.ok
    ? mapGenericFoodDbArrayToSearchItems(genericsRes.data)
    : [];

  return [...userFoods, ...foods, ...generics];
}

export default function MyFoodsScreen() {
  const params = useLocalSearchParams<{ barcode?: string }>();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const s = makeStyles(colors, typography, insets);

  const [myFoods, setMyFoods] = useState<UserFoodDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Crear receta
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [saving, setSaving] = useState(false);

  // Búsqueda de ingredientes
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExtendedFoodSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedIngredient, setSelectedIngredient] =
    useState<ExtendedFoodSearchItem | null>(null);
  const [ingredientGrams, setIngredientGrams] = useState("100");

  const reqIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadMyFoods = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const res = await userFoodsRepository.listAll();
    if (!res.ok) {
      setErr(res.message);
      setMyFoods([]);
    } else {
      setMyFoods(res.data);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyFoods();
    }, [loadMyFoods]),
  );

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

  // Barcode scan
  useEffect(() => {
    const barcode =
      typeof params.barcode === "string" ? params.barcode.trim() : "";
    if (!barcode || !showCreateModal) return;

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
        kcal_100g: res.data.kcal_100g ?? null,
        protein_100g: res.data.protein_100g ?? null,
        carbs_100g: res.data.carbs_100g ?? null,
        fat_100g: res.data.fat_100g ?? null,
        off: res.data,
        verified: false,
      };

      setSelectedIngredient(it);
      setSearchQuery(res.data.name);
      setSearchResults([]);
      setShowSearch(true);
    })();

    return () => {
      abortController.abort();
    };
  }, [params.barcode, showCreateModal]);

  const recipeTotals = useMemo(
    () => calculateRecipeTotals(ingredients),
    [ingredients],
  );

  const canSaveRecipe = useMemo(() => {
    return (
      recipeName.trim().length >= 2 &&
      ingredients.length > 0 &&
      !saving
    );
  }, [recipeName, ingredients.length, saving]);

  const handleAddIngredient = useCallback(() => {
    if (!selectedIngredient) return;

    const gramsNum = toFloatSafe(ingredientGrams);
    if (!Number.isFinite(gramsNum) || gramsNum <= 0) {
      showToast("Ingresa una cantidad válida", "error");
      return;
    }

    const newIngredient: RecipeIngredient = {
      id: `${Date.now()}-${Math.random()}`,
      food: selectedIngredient,
      grams: clamp(gramsNum, 1, 2000),
    };

    setIngredients((prev) => [...prev, newIngredient]);
    setSelectedIngredient(null);
    setSearchQuery("");
    setIngredientGrams("100");
    setShowSearch(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [selectedIngredient, ingredientGrams, showToast]);

  const handleRemoveIngredient = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
  }, []);

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
      showToast(res.message, "error");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Receta creada exitosamente", "success");

    // Reset
    setRecipeName("");
    setIngredients([]);
    setShowCreateModal(false);
    setSelectedIngredient(null);
    setSearchQuery("");
    setIngredientGrams("100");
    setShowSearch(false);

    // Reload
    await loadMyFoods();
  }, [canSaveRecipe, recipeName, ingredients, showToast, loadMyFoods]);

  const handleDeleteFood = useCallback(
    async (id: string, name: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert("Eliminar", `¿Eliminar "${name}"?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const res = await userFoodsRepository.remove(id);
            if (!res.ok) {
              showToast(res.message, "error");
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast("Comida eliminada", "success");
            await loadMyFoods();
          },
        },
      ]);
    },
    [showToast, loadMyFoods],
  );

  const handleOpenScanner = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/(tabs)/scan",
      params: { returnTo: "my-foods" },
    });
  }, []);

  const animations = useStaggerAnimation(myFoods.length, 50, 100);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>Mis comidas</Text>
            <Text style={s.title}>Recetas personalizadas</Text>
          </View>

          <Pressable
            style={s.iconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCreateModal(true);
            }}
          >
            <Feather name="plus" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {!!err && (
          <View style={s.alert}>
            <Feather name="alert-triangle" size={16} color={colors.onCta} />
            <Text style={s.alertText}>{err}</Text>
          </View>
        )}

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : myFoods.length === 0 ? (
          <View style={s.emptyCard}>
            <View style={s.emptyIcon}>
              <MaterialCommunityIcons
                name="chef-hat"
                size={24}
                color={colors.textSecondary}
              />
            </View>
            <Text style={s.emptyTitle}>Aún no tienes recetas</Text>
            <Text style={s.emptyText}>
              Crea tu primera receta personalizada combinando ingredientes.
            </Text>
            <View style={{ marginTop: 16, width: "100%" }}>
              <PrimaryButton
                title="Crear receta"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowCreateModal(true);
                }}
                icon={<Feather name="plus" size={18} color={colors.onCta} />}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {myFoods.map((food, index) => (
              <Animated.View
                key={food.id}
                style={[
                  s.foodCard,
                  {
                    opacity: animations[index] || new Animated.Value(1),
                    transform: [
                      {
                        translateY: (animations[index] || new Animated.Value(1)).interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={s.foodHeader}>
                    <Text style={s.foodName}>{food.name}</Text>
                    <Pressable
                      onPress={() => handleDeleteFood(food.id, food.name)}
                      style={({ pressed }) => [
                        s.deleteBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Feather name="trash-2" size={16} color={colors.cta} />
                    </Pressable>
                  </View>

                  <View style={s.macrosRow}>
                    <View style={s.macroChip}>
                      <MaterialCommunityIcons
                        name="fire"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={s.macroText}>
                        {Math.round(food.calories)} kcal
                      </Text>
                    </View>
                    <View style={s.macroChip}>
                      <MaterialCommunityIcons
                        name="food-steak"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={s.macroText}>
                        P {food.protein.toFixed(1)}g
                      </Text>
                    </View>
                    <View style={s.macroChip}>
                      <MaterialCommunityIcons
                        name="bread-slice"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={s.macroText}>
                        C {food.carbs.toFixed(1)}g
                      </Text>
                    </View>
                    <View style={s.macroChip}>
                      <MaterialCommunityIcons
                        name="peanut"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={s.macroText}>F {food.fat.toFixed(1)}g</Text>
                    </View>
                  </View>

                  <Text style={s.portionText}>
                    Porción: {food.portion_base} {food.portion_unit}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Modal crear receta */}
      {showCreateModal && (
        <Pressable
          style={s.modalOverlay}
          onPress={() => {
            // Cerrar modal al tocar fuera (opcional)
            // setShowCreateModal(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "flex-end" }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.modalContent}>
                <ScrollView
                  contentContainerStyle={s.modalScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                >
              {/* Header modal */}
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Nueva receta</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowCreateModal(false);
                    setRecipeName("");
                    setIngredients([]);
                    setSelectedIngredient(null);
                    setSearchQuery("");
                    setIngredientGrams("100");
                    setShowSearch(false);
                  }}
                >
                  <Feather name="x" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

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
                  <Pressable
                    onPress={handleOpenScanner}
                    style={s.scanBtn}
                  >
                    <Feather name="camera" size={16} color={colors.brand} />
                    <Text style={s.scanBtnText}>Escanear</Text>
                  </Pressable>
                </View>

                <TextInput
                  style={s.input}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setShowSearch(text.length >= 2);
                  }}
                  placeholder="Buscar alimento..."
                  placeholderTextColor={colors.textSecondary}
                />

                {/* Resultados búsqueda */}
                {showSearch && searchQuery.length >= 2 && (
                  <View style={s.searchResults}>
                    {isSearching ? (
                      <View style={s.searchLoading}>
                        <ActivityIndicator size="small" color={colors.brand} />
                      </View>
                    ) : searchResults.length === 0 ? (
                      <Text style={s.searchEmpty}>No se encontraron resultados</Text>
                    ) : (
                      searchResults.map((item) => (
                        <Pressable
                          key={item.key}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedIngredient(item);
                            setShowSearch(false);
                          }}
                          style={({ pressed }) => [
                            s.searchItem,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.searchItemName}>{item.name}</Text>
                            <Text style={s.searchItemMeta}>{item.meta}</Text>
                          </View>
                          <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                        </Pressable>
                      ))
                    )}
                  </View>
                )}

                {/* Ingrediente seleccionado */}
                {selectedIngredient && (
                  <View style={s.selectedIngredient}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.selectedName}>
                        {selectedIngredient.name}
                      </Text>
                      <Text style={s.selectedMeta}>
                        {selectedIngredient.meta}
                      </Text>
                    </View>
                    <View style={s.gramsInput}>
                      <TextInput
                        style={s.gramsInputText}
                        value={ingredientGrams}
                        onChangeText={setIngredientGrams}
                        placeholder="100"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                      />
                      <Text style={s.gramsLabel}>g</Text>
                    </View>
                    <Pressable
                      onPress={handleAddIngredient}
                      style={s.addIngredientBtn}
                    >
                      <Feather name="check" size={16} color={colors.onCta} />
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Ingredientes agregados */}
              {ingredients.length > 0 && (
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>Ingredientes ({ingredients.length})</Text>
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
                        <View key={ing.id} style={s.ingredientItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.ingredientName}>{ing.food.name}</Text>
                            <Text style={s.ingredientGrams}>
                              {ing.grams}g · {Math.round(macros.kcal)} kcal
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => handleRemoveIngredient(ing.id)}
                            style={({ pressed }) => [
                              s.removeIngredientBtn,
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Feather name="x" size={14} color={colors.cta} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Totales */}
              {ingredients.length > 0 && (
                <View style={s.totalsCard}>
                  <Text style={s.totalsTitle}>Totales de la receta</Text>
                  <View style={s.totalsRow}>
                    <View style={s.totalItem}>
                      <MaterialCommunityIcons
                        name="fire"
                        size={18}
                        color={colors.brand}
                      />
                      <Text style={s.totalValue}>
                        {Math.round(recipeTotals.calories)}
                      </Text>
                      <Text style={s.totalLabel}>kcal</Text>
                    </View>
                    <View style={s.totalItem}>
                      <MaterialCommunityIcons
                        name="food-steak"
                        size={18}
                        color={colors.brand}
                      />
                      <Text style={s.totalValue}>
                        {recipeTotals.protein.toFixed(1)}
                      </Text>
                      <Text style={s.totalLabel}>P</Text>
                    </View>
                    <View style={s.totalItem}>
                      <MaterialCommunityIcons
                        name="bread-slice"
                        size={18}
                        color={colors.brand}
                      />
                      <Text style={s.totalValue}>
                        {recipeTotals.carbs.toFixed(1)}
                      </Text>
                      <Text style={s.totalLabel}>C</Text>
                    </View>
                    <View style={s.totalItem}>
                      <MaterialCommunityIcons
                        name="peanut"
                        size={18}
                        color={colors.brand}
                      />
                      <Text style={s.totalValue}>
                        {recipeTotals.fat.toFixed(1)}
                      </Text>
                      <Text style={s.totalLabel}>F</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Botón guardar */}
              <View style={{ marginTop: 16 }}>
                <PrimaryButton
                  title="Guardar receta"
                  onPress={handleSaveRecipe}
                  disabled={!canSaveRecipe}
                  loading={saving}
                  icon={
                    <Feather name="check" size={18} color={colors.onCta} />
                  }
                />
              </View>
                </ScrollView>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any, insets: { bottom: number }) {
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
      fontSize: 28,
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

    loadingContainer: {
      padding: 40,
      alignItems: "center",
    },

    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      gap: 8,
      alignItems: "center",
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    emptyTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: 4,
    },
    emptyText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
    },

    foodCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    foodHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    foodName: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      color: colors.textPrimary,
      flex: 1,
    },
    deleteBtn: {
      padding: 8,
    },
    macrosRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    macroChip: {
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
    macroText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
    portionText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },

    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "90%",
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    },
    modalScroll: {
      padding: 18,
      paddingBottom: Math.max(insets.bottom + 18, 24),
      gap: 16,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modalTitle: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 22,
      color: colors.textPrimary,
    },

    inputGroup: {
      gap: 8,
    },
    inputLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    inputLabel: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: typography.body?.fontFamily,
      fontSize: 15,
      color: colors.textPrimary,
    },
    scanBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.brand,
      backgroundColor: "transparent",
    },
    scanBtnText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 12,
      color: colors.brand,
    },

    searchResults: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 200,
      overflow: "hidden",
    },
    searchLoading: {
      padding: 20,
      alignItems: "center",
    },
    searchEmpty: {
      padding: 16,
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
    },
    searchItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchItemName: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    searchItemMeta: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    selectedIngredient: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    selectedName: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    selectedMeta: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    gramsInput: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    gramsInputText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
      width: 50,
      textAlign: "right",
    },
    gramsLabel: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
    addIngredientBtn: {
      width: 32,
      height: 32,
      borderRadius: 12,
      backgroundColor: colors.cta,
      alignItems: "center",
      justifyContent: "center",
    },

    ingredientItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    ingredientName: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    ingredientGrams: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    removeIngredientBtn: {
      padding: 6,
    },

    totalsCard: {
      backgroundColor: colors.background,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    totalsTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    totalItem: {
      alignItems: "center",
      gap: 4,
    },
    totalValue: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 18,
      color: colors.textPrimary,
    },
    totalLabel: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
}
