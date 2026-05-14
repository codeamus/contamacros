// app/(tabs)/my-foods.tsx
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import {
  SafeAreaView,
} from "react-native-safe-area-context";

import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import {
  userFoodsRepository,
  type UserFoodDb,
} from "@/data/food/userFoodsRepository";
import { userFavoritesRepository } from "@/data/food/userFavoritesRepository";

import {
  mapGenericFoodDbArrayToSearchItems,
  type FoodSearchItem,
} from "@/domain/mappers/foodMappers";

import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useFavorites } from "@/presentation/hooks/food/useFavorites";
import { useStaggerAnimation } from "@/presentation/hooks/ui/useStaggerAnimation";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";





/**
 * Componente de item de favorito con swipe para eliminar
 */
function FavoriteFoodItem({
  food,
  index,
  colors,
  styles,
  animations,
  onPress,
  onRemoveFavorite,
}: {
  food: FoodSearchItem;
  index: number;
  colors: any;
  styles: any;
  animations: Animated.Value[];
  onPress: () => void;
  onRemoveFavorite: (foodId: string) => void;
}) {
  const swipeableRef = useRef<React.ComponentRef<typeof Swipeable>>(null);

  const renderRightActions = () => {
    // Obtener el ID correcto del alimento (food_id es el ID de generic_foods)
    const foodIdToRemove = food.food_id || food.key.split(":")[1] || food.key;
    
    return (
      <View style={styles.swipeActionContainer}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            swipeableRef.current?.close();
            onRemoveFavorite(foodIdToRemove);
          }}
          style={({ pressed }) => [
            styles.swipeDeleteButton,
            pressed && styles.swipeDeleteButtonPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="heart-off"
            size={22}
            color={colors.onCta}
          />
          <Text style={styles.swipeDeleteText}>Quitar</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        {
          opacity: animations[index] || new Animated.Value(1),
          transform: [
            {
              translateY: (
                animations[index] || new Animated.Value(1)
              ).interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        onSwipeableOpen={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.foodCard,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={{ flex: 1, gap: 8 }}>
            <View style={styles.foodHeader}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons
                  name="heart"
                  size={16}
                  color={colors.cta}
                />
                <Text style={styles.foodName} numberOfLines={1}>
                  {food.name}
                </Text>
              </View>
            </View>

            <View style={styles.macrosRow}>
              <View style={styles.macroChip}>
                <MaterialCommunityIcons
                  name="fire"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.macroText}>
                  {Math.round(food.kcal_100g || 0)} kcal
                </Text>
              </View>
              <View style={styles.macroChip}>
                <MaterialCommunityIcons
                  name="food-steak"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.macroText}>
                  P {food.protein_100g?.toFixed(1) || "0.0"}g
                </Text>
              </View>
              <View style={styles.macroChip}>
                <MaterialCommunityIcons
                  name="bread-slice"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.macroText}>
                  C {food.carbs_100g?.toFixed(1) || "0.0"}g
                </Text>
              </View>
              <View style={styles.macroChip}>
                <MaterialCommunityIcons
                  name="peanut"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.macroText}>
                  F {food.fat_100g?.toFixed(1) || "0.0"}g
                </Text>
              </View>
            </View>

            <Text style={styles.portionText}>
              Por 100g
            </Text>
          </View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

/**
 * Componente de item de comida con swipe para eliminar
 */
function SwipeableFoodItem({
  food,
  index,
  colors,
  styles,
  animations,
  onDelete,
  onEdit,
}: {
  food: UserFoodDb;
  index: number;
  colors: any;
  styles: any;
  animations: Animated.Value[];
  onDelete: (id: string, name: string, skipConfirm: boolean) => void;
  onEdit: (id: string) => void;
}) {
  const swipeableRef = useRef<React.ComponentRef<typeof Swipeable>>(null);

  const renderRightActions = () => {
    return (
      <View style={styles.swipeActionContainer}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            swipeableRef.current?.close();
            onDelete(food.id, food.name, true);
          }}
          style={({ pressed }) => [
            styles.swipeDeleteButton,
            pressed && styles.swipeDeleteButtonPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="delete"
            size={22}
            color={colors.onCta}
          />
          <Text style={styles.swipeDeleteText}>Eliminar</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        {
          opacity: animations[index] || new Animated.Value(1),
          transform: [
            {
              translateY: (
                animations[index] || new Animated.Value(1)
              ).interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        onSwipeableOpen={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
      >
        <View style={styles.foodCard}>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={styles.foodHeader}>
              <Text style={styles.foodName}>{food.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable
                  onPress={() => onEdit(food.id)}
                  style={({ pressed }) => [
                    styles.editBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="edit-2" size={16} color={colors.brand} />
                </Pressable>
                <Pressable
                  onPress={() => onDelete(food.id, food.name, false)}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="trash-2" size={16} color={colors.cta} />
                </Pressable>
              </View>
            </View>

            <View style={styles.macrosRow}>
              <View style={styles.macroChip}>
                <MaterialCommunityIcons
                  name="fire"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.macroText}>
                  {Math.round(food.calories)} kcal
                </Text>
              </View>
              <View style={styles.macroChip}>
                <MaterialCommunityIcons
                  name="food-steak"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.macroText}>
                  P {food.protein.toFixed(1)}g
                </Text>
              </View>
              <View style={styles.macroChip}>
                <MaterialCommunityIcons
                  name="bread-slice"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.macroText}>C {food.carbs.toFixed(1)}g</Text>
              </View>
              <View style={styles.macroChip}>
                <MaterialCommunityIcons
                  name="peanut"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.macroText}>F {food.fat.toFixed(1)}g</Text>
              </View>
            </View>

            <Text style={styles.portionText}>
              Porción: {food.portion_base} {food.portion_unit}
            </Text>
          </View>
        </View>
      </Swipeable>
    </Animated.View>
  );
}

/**
 * Componente de ingrediente editable
 */


export default function MyFoodsScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const { profile } = useAuth();
  const s = makeStyles(colors, typography);

  const [paywallVisible, setPaywallVisible] = useState(false);
  const [myFoods, setMyFoods] = useState<UserFoodDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Favoritos
  const { favorites, removeFavorite } = useFavorites();
  const [favoriteFoods, setFavoriteFoods] = useState<FoodSearchItem[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);



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

  // Cargar alimentos favoritos (soporta generic_foods + productos escaneados inline)
  const loadFavoriteFoods = useCallback(async () => {
    setLoadingFavorites(true);
    try {
      const allRes = await userFavoritesRepository.getAllWithData();
      if (!allRes.ok) return;

      const rows = allRes.data;
      const inlineItems: FoodSearchItem[] = [];
      const genericFoodIds: string[] = [];

      for (const row of rows) {
        if (row.food_id) {
          genericFoodIds.push(row.food_id);
        } else if (row.name) {
          // Producto escaneado con datos inline
          inlineItems.push({
            key: `scanned:${row.barcode ?? row.id}`,
            source: "off",
            name: row.name,
            kcal_100g: row.kcal_100g ?? 0,
            protein_100g: row.protein_100g ?? 0,
            carbs_100g: row.carbs_100g ?? 0,
            fat_100g: row.fat_100g ?? 0,
          });
        }
      }

      const genericItems: FoodSearchItem[] = [];
      if (genericFoodIds.length > 0) {
        const favoritesRes = await genericFoodsRepository.getByIds(genericFoodIds);
        if (favoritesRes.ok) {
          genericItems.push(...mapGenericFoodDbArrayToSearchItems(favoritesRes.data));
        }
      }

      setFavoriteFoods([...genericItems, ...inlineItems]);
    } catch (error) {
      console.error("[MyFoodsScreen] Error loading favorite foods:", error);
    } finally {
      setLoadingFavorites(false);
    }
  }, []);

  // Cargar favoritos al montar y cuando cambian
  useEffect(() => {
    loadFavoriteFoods();
  }, [favorites, loadFavoriteFoods]);

  useFocusEffect(
    useCallback(() => {
      loadMyFoods();
      loadFavoriteFoods();
    }, [loadMyFoods, loadFavoriteFoods]),
  );





  const performDeleteFood = useCallback(
    async (id: string, name: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const res = await userFoodsRepository.remove(id);
      if (!res.ok) {
        showToast({
          message: res.message,
          type: "error",
        });
        return;
      }
      showToast({
        message: `"${name}" eliminado exitosamente`,
        type: "success",
      });
      await loadMyFoods();
    },
    [showToast, loadMyFoods],
  );

  const handleDeleteFood = useCallback(
    async (id: string, name: string, skipConfirm = false) => {
      if (!skipConfirm) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert("Eliminar", `¿Eliminar "${name}"?`, [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              await performDeleteFood(id, name);
            },
          },
        ]);
      } else {
        await performDeleteFood(id, name);
      }
    },
    [performDeleteFood],
  );

  const handleEditFood = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/(tabs)/create-recipe",
      params: { recipeId: id },
    });
  }, []);


  const animations = useStaggerAnimation(myFoods.length, 50, 100);
  const favoriteAnimations = useStaggerAnimation(favoriteFoods.length, 50, 100);

  const handleFavoritePress = useCallback((food: FoodSearchItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/(tabs)/add-food",
      params: { 
        foodId: food.key,
        source: food.source,
      },
    });
  }, []);

  const handleRemoveFavorite = useCallback(
    async (foodId: string) => {
      try {
        await removeFavorite(foodId);
        showToast({
          message: "Producto eliminado de favoritos",
          type: "success",
        });
      } catch {
        showToast({
          message: "Error al eliminar de favoritos",
          type: "error",
        });
      }
    },
    [removeFavorite, showToast],
  );

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
              router.push({
                pathname: "/(tabs)/create-recipe",
                params: { reset: "true" },
              });
            }}
          >
            <Feather name="plus" size={18} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            style={s.iconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/settings");
            }}
          >
            <Feather name="settings" size={18} color={colors.textPrimary} />
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
              Pedile al Fitness Coach que te arme una receta según tus macros del día, o créala vos combinando ingredientes.
            </Text>
            <View style={{ marginTop: 16, width: "100%", gap: 10 }}>
              <PrimaryButton
                title="Pedirle una receta al Coach"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (!profile?.is_premium) {
                    setPaywallVisible(true);
                  } else {
                    router.push("/smart-coach-pro" as any);
                  }
                }}
                icon={<MaterialCommunityIcons name="robot-happy-outline" size={18} color={colors.onCta} />}
              />
              <PrimaryButton
                title="Crear receta manualmente"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/(tabs)/create-recipe",
                    params: { reset: "true" },
                  });
                }}
                icon={<Feather name="plus" size={18} color={colors.onCta} />}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {myFoods.map((food, index) => (
              <SwipeableFoodItem
                key={food.id}
                food={food}
                index={index}
                colors={colors}
                styles={s}
                animations={animations}
                onDelete={handleDeleteFood}
                onEdit={handleEditFood}
              />
            ))}
          </View>
        )}

        {/* Sección de Favoritos */}
        {favoriteFoods.length > 0 && (
          <View style={{ marginTop: 32, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <MaterialCommunityIcons
                name="heart"
                size={20}
                color={colors.cta}
              />
              <Text style={s.kicker}>Mis Favoritos</Text>
            </View>
            <Text style={[s.title, { fontSize: 24, marginBottom: 8 }]}>
              Productos favoritos
            </Text>
            
            {loadingFavorites ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.brand} />
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {favoriteFoods.map((food, index) => (
                  <FavoriteFoodItem
                    key={food.key}
                    food={food}
                    index={index}
                    colors={colors}
                    styles={s}
                    animations={favoriteAnimations}
                    onPress={() => handleFavoritePress(food)}
                    onRemoveFavorite={handleRemoveFavorite}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {favoriteFoods.length === 0 && !loadingFavorites && favorites.length === 0 && (
          <View style={{ marginTop: 32, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <MaterialCommunityIcons
                name="heart-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={[s.kicker, { color: colors.textSecondary }]}>Mis Favoritos</Text>
            </View>
            <Text style={[s.title, { fontSize: 24, marginBottom: 8, color: colors.textSecondary }]}>
              Productos favoritos
            </Text>
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}>
                <MaterialCommunityIcons
                  name="heart-outline"
                  size={24}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={s.emptyTitle}>Aún no tienes favoritos</Text>
              <Text style={s.emptyText}>
                Cuando agregues un alimento, tocá la estrella para guardarlo acá y acceder rápido la próxima vez.
              </Text>
              <View style={{ marginTop: 16, width: "100%" }}>
                <PrimaryButton
                  title="Agregar un alimento"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/(tabs)/add-food" as any);
                  }}
                  icon={<Feather name="search" size={18} color={colors.onCta} />}
                />
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />

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
    editBtn: {
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



    swipeActionContainer: {
      width: 110,
      justifyContent: "center",
      alignItems: "flex-end",
      marginRight: 0,
      paddingRight: 8,
      overflow: "hidden",
    },
    swipeDeleteButton: {
      width: 90,
      height: "100%",
      backgroundColor: colors.cta,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginRight: 0,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    swipeDeleteButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.95 }],
    },
    swipeDeleteText: {
      color: colors.onCta,
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
