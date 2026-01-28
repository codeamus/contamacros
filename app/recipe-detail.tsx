// app/recipe-detail.tsx
// Pantalla de detalle de receta (Smart Coach Pro)
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_PADDING = 20;

function parseJsonArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export default function RecipeDetailScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const params = useLocalSearchParams<{
    name?: string;
    protein_100g?: string;
    carbs_100g?: string;
    fat_100g?: string;
    kcal_100g?: string;
    recommendedAmount?: string;
    message?: string;
    ingredients?: string;
    instructions?: string;
  }>();

  const name = params.name ?? "Receta";
  const recommendedAmount = Number(params.recommendedAmount) || 100;
  const factor = recommendedAmount / 100;
  const protein = Math.round((Number(params.protein_100g) || 0) * factor);
  const carbs = Math.round((Number(params.carbs_100g) || 0) * factor);
  const fat = Math.round((Number(params.fat_100g) || 0) * factor);
  const kcal = Math.round((Number(params.kcal_100g) || 0) * factor);
  const message = params.message ?? "";
  const ingredients = useMemo(
    () => parseJsonArray(params.ingredients),
    [params.ingredients],
  );
  const instructions = useMemo(
    () => parseJsonArray(params.instructions),
    [params.instructions],
  );

  const [checkedIngredients, setCheckedIngredients] = useState<
    Record<number, boolean>
  >({});

  const toggleIngredient = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCheckedIngredients((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const s = makeStyles(colors, typography);

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.textPrimary}
          />
        </Pressable>
        <Text
          style={[s.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          Receta
        </Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.dishName, { color: colors.textPrimary }]}>{name}</Text>
        {message ? (
          <View
            style={[
              s.messageWrap,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[s.messageText, { color: colors.textSecondary }]}>
              {message}
            </Text>
          </View>
        ) : null}

        {/* Macros */}
        <View style={s.macrosRow}>
          <View style={[s.macroChip, { backgroundColor: "#FEE2E2" }]}>
            <MaterialCommunityIcons name="fire" size={20} color="#B91C1C" />
            <Text style={s.macroChipText}>{kcal} kcal</Text>
          </View>
          <View style={[s.macroChip, { backgroundColor: "#D1FAE5" }]}>
            <MaterialCommunityIcons name="arm-flex" size={20} color="#047857" />
            <Text style={s.macroChipText}>{protein}g prot.</Text>
          </View>
          <View style={[s.macroChip, { backgroundColor: "#BFDBFE" }]}>
            <MaterialCommunityIcons name="corn" size={20} color="#1D4ED8" />
            <Text style={s.macroChipText}>{carbs}g carb.</Text>
          </View>
          <View style={[s.macroChip, { backgroundColor: "#FEF3C7" }]}>
            <MaterialCommunityIcons name="water" size={20} color="#92400E" />
            <Text style={s.macroChipText}>{fat}g gras.</Text>
          </View>
        </View>

        <Text style={[s.portionLabel, { color: colors.textSecondary }]}>
          Porción recomendada: {recommendedAmount}g
        </Text>

        {/* Ingredientes checklist */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <MaterialCommunityIcons
              name="format-list-checks"
              size={22}
              color={colors.brand}
            />
            <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
              Ingredientes
            </Text>
          </View>
          {ingredients.length > 0 ? (
            ingredients.map((item, index) => (
              <Pressable
                key={index}
                onPress={() => toggleIngredient(index)}
                style={[
                  s.checklistRow,
                  { borderColor: colors.border },
                  checkedIngredients[index] && s.checklistRowChecked,
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    checkedIngredients[index]
                      ? "checkbox-marked-circle"
                      : "checkbox-blank-circle-outline"
                  }
                  size={24}
                  color={
                    checkedIngredients[index]
                      ? colors.brand
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    s.checklistText,
                    { color: colors.textPrimary },
                    checkedIngredients[index] && s.checklistTextChecked,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={[s.placeholderText, { color: colors.textSecondary }]}>
              No hay lista de ingredientes para esta receta.
            </Text>
          )}
        </View>

        {/* Preparación */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <MaterialCommunityIcons
              name="silverware-clean"
              size={22}
              color={colors.brand}
            />
            <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
              Preparación
            </Text>
          </View>
          {instructions.length > 0 ? (
            instructions.map((step, index) => (
              <View
                key={index}
                style={[
                  s.stepRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[s.stepNumber, { backgroundColor: colors.brand }]}>
                  <Text style={s.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={[s.stepText, { color: colors.textPrimary }]}>
                  {step}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[s.placeholderText, { color: colors.textSecondary }]}>
              No hay pasos de preparación. Ajusta la receta a tu gusto.
            </Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(
  colors: {
    border: string;
    textPrimary: string;
    textSecondary: string;
    surface: string;
    brand: string;
  },
  typography: { title: object; body: object; subtitle: object },
) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: PAGE_PADDING,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      ...typography.title,
      fontSize: 18,
    },
    scroll: { flex: 1 },
    scrollContent: {
      padding: PAGE_PADDING,
    },
    dishName: {
      ...typography.title,
      fontSize: 24,
      lineHeight: 30,
      marginBottom: 12,
    },
    messageWrap: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 16,
    },
    messageText: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
    },
    macrosRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 8,
    },
    macroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    macroChipText: {
      ...typography.body,
      fontSize: 13,
      fontWeight: "600",
      color: "#1F2937",
    },
    portionLabel: {
      ...typography.body,
      fontSize: 12,
      marginBottom: 24,
    },
    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    sectionTitle: {
      ...typography.subtitle,
      fontSize: 18,
      fontWeight: "700",
    },
    checklistRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    checklistRowChecked: {
      opacity: 0.75,
    },
    checklistText: {
      ...typography.body,
      flex: 1,
      fontSize: 15,
    },
    checklistTextChecked: {
      textDecorationLine: "line-through",
      color: colors.textSecondary,
    },
    placeholderText: {
      ...typography.body,
      fontSize: 14,
      fontStyle: "italic",
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 10,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumberText: {
      ...typography.body,
      fontSize: 14,
      fontWeight: "700",
      color: "#FFF",
    },
    stepText: {
      ...typography.body,
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
    },
  });
}
