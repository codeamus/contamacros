import {
  type ChatMessage,
  type SmartCoachDayPlan,
  type SmartCoachMeal,
  type SmartCoachMealPlan,
  type SmartCoachRecipe,
} from "@/data/ai/geminiService";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { DietaryPreferenceDb } from "@/domain/models/profileDb";
import { MacrosHeader } from "@/presentation/components/smartCoach/MacrosHeader";
import { MealPlanCard } from "@/presentation/components/smartCoach/MealPlanCard";
import { RecipeCard } from "@/presentation/components/smartCoach/RecipeCard";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTodaySummary } from "@/presentation/hooks/diary/useTodaySummary";
import { useHealthSync } from "@/presentation/hooks/health/useHealthSync";
import { useSmartCoachPro } from "@/presentation/hooks/smartCoach/useSmartCoachPro";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DIETARY_OPTIONS: Array<{
  value: DietaryPreferenceDb;
  label: string;
  emoji: string;
}> = [
  { value: "omnivore", label: "Omnívoro", emoji: "🥩" },
  { value: "flexitarian", label: "Flexi", emoji: "🥗" },
  { value: "pescatarian", label: "Pescados", emoji: "🐟" },
  { value: "vegetarian", label: "Vegetariano", emoji: "🥬" },
  { value: "vegan", label: "Vegano", emoji: "🌱" },
  { value: "paleo", label: "Paleo", emoji: "🥑" },
  { value: "keto", label: "Keto", emoji: "🧈" },
  { value: "gluten_free", label: "Sin gluten", emoji: "🌾✖" },
];

export default function SmartCoachProScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);
  const { profile, updateProfile } = useAuth();
  const { showToast } = useToast();
  const { totals, reload: reloadSummary } = useTodaySummary();
  const { isPremium: revenueCatPremium } = useRevenueCat();
  const profilePremium = profile?.is_premium ?? false;
  const isPremium = revenueCatPremium || profilePremium;
  const { caloriesBurned } = useHealthSync(isPremium);

  const caloriesTarget = profile?.daily_calorie_target ?? 0;
  const proteinTarget = profile?.protein_g ?? 0;
  const carbsTarget = profile?.carbs_g ?? 0;
  const fatTarget = profile?.fat_g ?? 0;
  const effectiveCaloriesTarget =
    caloriesTarget + (isPremium ? caloriesBurned : 0);

  // Hook con lógica de recomendaciones + chat v2
  const {
    messages: hookMessages,
    chatLoading,
    sendMessage,
    clearChat,
  } = useSmartCoachPro(
    profile,
    effectiveCaloriesTarget,
    totals.calories,
    totals.protein,
    totals.carbs,
    totals.fat,
    isPremium,
  );

  const [chatText, setChatText] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [savingDiet, setSavingDiet] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Mensaje de bienvenida inicial (solo si no hay mensajes del hook)
  const [welcomeShown, setWelcomeShown] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  // Combinar mensaje de bienvenida local con mensajes del hook
  const messages = localMessages.length > 0 || hookMessages.length > 0
    ? [...localMessages, ...hookMessages]
    : [];

  const orderedDietOptions = useMemo(() => {
    const active = profile?.dietary_preference ?? null;
    if (!active) return DIETARY_OPTIONS;
    const activeOpt = DIETARY_OPTIONS.find((o) => o.value === active);
    if (!activeOpt) return DIETARY_OPTIONS;
    return [activeOpt, ...DIETARY_OPTIONS.filter((o) => o.value !== active)];
  }, [profile?.dietary_preference]);

  useEffect(() => {
    if (!welcomeShown) {
      setWelcomeShown(true);
      const hour = new Date().getHours();
      const greeting =
        hour < 12 ? "¡Buenos días" : hour < 20 ? "¡Buenas tardes" : "¡Buenas noches";
      setLocalMessages([
        {
          role: "assistant",
          content:
            `${greeting}! Soy tu Fitness Coach Pro. Tengo contexto de tus macros de hoy y tu historial de la semana. Puedo ayudarte con comidas, recetas, planes y rutinas de ejercicio. ¿En qué empezamos?`,
        },
      ]);
    }
    // Cleanup al desmontar
    return () => {
      setLocalMessages([]);
      clearChat();
    };
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const handleSend = async () => {
    const text = chatText.trim();
    if (!text || chatLoading) return;
    Keyboard.dismiss();
    setChatText("");
    await sendMessage(text);
  };

  const refreshAfterDietChange = async (
    _newDiet: DietaryPreferenceDb,
    dietLabel: string,
  ) => {
    if (chatLoading) return;
    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content;
    if (!lastUserMsg) return;

    const autoPrompt = `Cambié mi preferencia alimentaria a "${dietLabel}". Repite la última receta/recomendación adaptándola a esta dieta. Petición original: "${lastUserMsg}".`;
    await sendMessage(autoPrompt);
  };

  const handleQuickAdd = async (recipe: SmartCoachRecipe) => {
    const day = todayStrLocal();
    const amount = recipe.recommendedAmount || 100;
    const factor = amount / 100;
    try {
      const res = await foodLogRepository.create({
        day,
        meal: "lunch",
        name: recipe.name,
        grams: amount,
        calories: Math.round(recipe.kcal_100g * factor),
        protein_g: Math.round(recipe.protein_100g * factor),
        carbs_g: Math.round(recipe.carbs_100g * factor),
        fat_g: Math.round(recipe.fat_100g * factor),
        source: null,
        off_id: null,
        source_type: null,
        food_id: null,
        user_food_id: null,
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({ message: `¡${recipe.name} agregado!`, type: "success" });
        reloadSummary();
      }
    } catch (e) {
      showToast({ message: "Error al registrar", type: "error" });
    }
  };

  const mapTimeSlot = (
    slot: string,
  ): "breakfast" | "lunch" | "dinner" | "snack" => {
    switch (slot) {
      case "Desayuno":
        return "breakfast";
      case "Almuerzo":
        return "lunch";
      case "Cena":
        return "dinner";
      default:
        return "snack";
    }
  };

  const addDays = (dateStr: string, days: number): string => {
    const parts = dateStr.split("-").map(Number);
    const y = parts[0] || 2024;
    const m = parts[1] || 1;
    const d = parts[2] || 1;
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const ny = date.getFullYear();
    const nm = String(date.getMonth() + 1).padStart(2, "0");
    const nd = String(date.getDate()).padStart(2, "0");
    return `${ny}-${nm}-${nd}`;
  };

  const handleRegisterDay = async (
    meals: SmartCoachMeal[],
    targetDay?: string,
  ) => {
    if (planLoading) return;
    setPlanLoading(true);
    const day = targetDay || todayStrLocal();
    const logs = meals.map((meal) => ({
      day,
      meal: mapTimeSlot(meal.timeSlot),
      name: meal.name,
      grams: 0,
      calories: meal.calories,
      protein_g: meal.protein,
      carbs_g: meal.carbs,
      fat_g: meal.fat,
      source: "smart_coach",
      source_type: "manual" as const,
    }));

    try {
      const res = await foodLogRepository.createMany(logs);
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({
          message: `¡Día planificado! Se han añadido ${meals.length} alimentos`,
          type: "success",
        });
        reloadSummary();
      } else {
        showToast({ message: res.message, type: "error" });
      }
    } catch (e) {
      showToast({ message: "Error al registrar el plan", type: "error" });
    } finally {
      setPlanLoading(false);
    }
  };

  const handleRegisterWeek = async (plan: SmartCoachMealPlan) => {
    const totalMeals = plan.days.reduce(
      (acc: number, d: SmartCoachDayPlan) => acc + (d.meals?.length || 0),
      0,
    );

    Alert.alert(
      "Confirmar Registro",
      `Voy a agendar ${totalMeals} comidas (toda la semana). ¿Estás seguro?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Agendar",
          onPress: async () => {
            setPlanLoading(true);
            const today = todayStrLocal();
            try {
              let dayCount = 0;
              for (const day of plan.days) {
                if (!day) continue;
                const dayStr = addDays(today, dayCount++);
                const logs = day.meals.map((m: SmartCoachMeal) => ({
                  day: dayStr,
                  meal: mapTimeSlot(m.timeSlot),
                  name: m.name,
                  grams: 0,
                  calories: m.calories,
                  protein_g: m.protein,
                  carbs_g: m.carbs,
                  fat_g: m.fat,
                  source: "smart_coach",
                  source_type: "manual" as const,
                }));
                await foodLogRepository.createMany(logs);
              }
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              showToast({
                message: "¡Semana planificada con éxito!",
                type: "success",
              });
              reloadSummary();
              setTimeout(() => router.replace("/(tabs)/home"), 1500);
            } catch (e) {
              showToast({
                message: "Error al registrar la semana",
                type: "error",
              });
            } finally {
              setPlanLoading(false);
            }
          },
        },
      ],
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[s.messageRow, isUser ? s.userRow : s.assistantRow]}>
        {!isUser && (
          <View style={[s.avatar, { backgroundColor: colors.brand + "20" }]}>
            <MaterialCommunityIcons
              name="robot"
              size={20}
              color={colors.brand}
            />
          </View>
        )}
        <View
          style={[
            s.bubble,
            isUser
              ? { backgroundColor: colors.brand }
              : {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
          ]}
        >
          <Text
            style={[
              s.messageText,
              { color: isUser ? colors.onCta : colors.textPrimary },
            ]}
          >
            {item.content}
          </Text>
          {item.type === "recipe" && item.data && (
            <RecipeCard
              recipe={item.data}
              onAdd={() => handleQuickAdd(item.data)}
              onView={() =>
                router.push({
                  pathname: "/recipe-detail",
                  params: {
                    ...item.data,
                    ingredients: JSON.stringify(item.data.ingredients),
                    instructions: JSON.stringify(item.data.instructions),
                  } as any,
                })
              }
            />
          )}
          {item.type === "plan" && item.data && (
            <MealPlanCard
              plan={item.data}
              loading={planLoading}
              onRegisterDay={handleRegisterDay}
              onRegisterWeek={handleRegisterWeek}
              onViewRecipe={(meal) =>
                router.push({
                  pathname: "/recipe-detail",
                  params: {
                    name: meal.name,
                    protein_100g: String(meal.protein),
                    carbs_100g: String(meal.carbs),
                    fat_100g: String(meal.fat),
                    kcal_100g: String(meal.calories),
                    message: meal.description,
                    ingredients: JSON.stringify([]),
                    instructions: JSON.stringify([]),
                  } as any,
                })
              }
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <View style={s.header}>
        <Pressable onPress={handleBack} style={s.backBtn}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.textPrimary}
          />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>
          Fitness Coach Pro
        </Text>
        <View style={s.backBtn} />
      </View>

      <MacrosHeader
        protein={{ current: totals.protein, target: proteinTarget }}
        carbs={{ current: totals.carbs, target: carbsTarget }}
        fat={{ current: totals.fat, target: fatTarget }}
        calories={{ current: totals.calories, target: effectiveCaloriesTarget }}
      />

      <View style={s.dietBar}>
        <Text style={[s.dietTitle, { color: colors.textSecondary }]}>
          Preferencia alimentaria
        </Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={orderedDietOptions}
          keyExtractor={(item) => item.value}
          contentContainerStyle={s.dietList}
          renderItem={({ item }) => {
            const selected =
              (profile?.dietary_preference ?? null) === item.value;
            return (
              <Pressable
                onPress={async () => {
                  if (savingDiet || selected) return;
                  setSavingDiet(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const res = await updateProfile({
                    dietary_preference: item.value,
                  } as any);
                  setSavingDiet(false);

                  if (res.ok) {
                    refreshAfterDietChange(item.value, item.label);
                  } else {
                    showToast({
                      message: res.message ?? "Error al guardar tu dieta",
                      type: "error",
                    });
                  }
                }}
                disabled={savingDiet || chatLoading}
                style={({ pressed }) => [
                  s.dietChip,
                  {
                    backgroundColor: selected
                      ? colors.brand + "14"
                      : colors.surface,
                    borderColor: selected ? colors.brand : colors.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Text style={s.dietEmoji}>{item.emoji}</Text>
                <Text
                  style={[
                    s.dietLabel,
                    { color: selected ? colors.brand : colors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={s.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View
          style={[
            s.inputArea,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <TextInput
            style={[
              s.input,
              {
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            placeholder="Escribe aquí..."
            placeholderTextColor={colors.textSecondary}
            value={chatText}
            onChangeText={setChatText}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={chatLoading || !chatText.trim()}
            style={[s.sendBtn, { backgroundColor: colors.brand }]}
          >
            {chatLoading ? (
              <ActivityIndicator size="small" color={colors.onCta} />
            ) : (
              <MaterialCommunityIcons
                name="send"
                size={20}
                color={colors.onCta}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { ...typography.title, fontSize: 18 },
    dietBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 10 },
    dietTitle: { ...typography.caption, fontSize: 12, fontWeight: "700" },
    dietList: { paddingRight: 8, gap: 10 },
    dietChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      minHeight: 38,
    },
    dietEmoji: { fontSize: 14 },
    dietLabel: { ...typography.body, fontSize: 13, fontWeight: "700" },
    chatList: { padding: 16, gap: 16 },
    messageRow: { flexDirection: "row", gap: 8, maxWidth: "85%" },
    userRow: { alignSelf: "flex-end", flexDirection: "row-reverse" },
    assistantRow: { alignSelf: "flex-start" },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    bubble: { padding: 12, borderRadius: 18, gap: 8 },
    messageText: { ...typography.body, fontSize: 15 },
    inputArea: {
      flexDirection: "row",
      padding: 12,
      gap: 12,
      alignItems: "flex-end",
      borderTopWidth: 1,
    },
    input: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxHeight: 100,
      ...typography.body,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
