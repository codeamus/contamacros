import {
  askSmartCoach,
  type ChatMessage,
  type SmartCoachDayPlan,
  type SmartCoachMeal,
  type SmartCoachMealPlan,
  type SmartCoachRecipe,
  type SmartCoachRefinementContext,
} from "@/data/ai/geminiService";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { MacrosHeader } from "@/presentation/components/smartCoach/MacrosHeader";
import { MealPlanCard } from "@/presentation/components/smartCoach/MealPlanCard";
import { RecipeCard } from "@/presentation/components/smartCoach/RecipeCard";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTodaySummary } from "@/presentation/hooks/diary/useTodaySummary";
import { useHealthSync } from "@/presentation/hooks/health/useHealthSync";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SmartCoachProScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { totals, reload: reloadSummary } = useTodaySummary();
  const { isPremium: revenueCatPremium } = useRevenueCat();
  const profilePremium = profile?.is_premium ?? false;
  const isPremium = revenueCatPremium || profilePremium;
  const { caloriesBurned } = useHealthSync(isPremium);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const caloriesTarget = profile?.daily_calorie_target ?? 0;
  const proteinTarget = profile?.protein_g ?? 0;
  const carbsTarget = profile?.carbs_g ?? 0;
  const fatTarget = profile?.fat_g ?? 0;
  const effectiveCaloriesTarget =
    caloriesTarget + (isPremium ? caloriesBurned : 0);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "¡Súper! Soy tu Smart Coach Pro. Estoy aquí para ayudarte a cumplir tus metas de hoy. ¿En qué te puedo ayudar? Si no sabes qué comer, ¡pídeme una recomendación!",
        },
      ]);
    }
    // Cleanup al desmontar: asegura que la siguiente sesión sea una "pizarra limpia"
    return () => {
      setMessages([]);
    };
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const handleSend = async () => {
    const text = chatText.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatText("");
    setLoading(true);

    const context: SmartCoachRefinementContext = {
      userMessage: text,
      calorieGap: effectiveCaloriesTarget - totals.calories,
      proteinGap: proteinTarget - totals.protein,
      carbsGap: carbsTarget - totals.carbs,
      fatGap: fatTarget - totals.fat,
      caloriesConsumed: totals.calories,
      proteinConsumed: totals.protein,
      carbsConsumed: totals.carbs,
      fatConsumed: totals.fat,
      dietaryPreference: profile?.dietary_preference ?? null,
      currentFoodName: "",
      currentMessage: "",
    };

    try {
      const response = await askSmartCoach(context, newMessages);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response.message,
        type: response.type !== "fallback" ? (response.type as any) : "text",
        data: (response as any).recipe || (response as any).plan || null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Lo siento, tuve un pequeño error. ¿Podrías repetirme eso?",
        },
      ]);
    } finally {
      setLoading(false);
    }
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
          Smart Coach Pro
        </Text>
        <View style={s.backBtn} />
      </View>

      <MacrosHeader
        protein={{ current: totals.protein, target: proteinTarget }}
        carbs={{ current: totals.carbs, target: carbsTarget }}
        fat={{ current: totals.fat, target: fatTarget }}
        calories={{ current: totals.calories, target: effectiveCaloriesTarget }}
      />

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
            disabled={loading || !chatText.trim()}
            style={[s.sendBtn, { backgroundColor: colors.brand }]}
          >
            {loading ? (
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
