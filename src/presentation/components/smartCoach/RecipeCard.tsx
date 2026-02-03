import { SmartCoachRecipe } from "@/data/ai/geminiService";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface RecipeCardProps {
  recipe: SmartCoachRecipe;
  onAdd: () => void;
  onView: () => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onAdd,
  onView,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const factor = recipe.recommendedAmount / 100;
  const kcal = Math.round(recipe.kcal_100g * factor);
  const protein = Math.round(recipe.protein_100g * factor);
  const carbs = Math.round(recipe.carbs_100g * factor);
  const fat = Math.round(recipe.fat_100g * factor);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {recipe.name}
      </Text>

      <View style={styles.macrosRow}>
        <View style={[styles.pill, { backgroundColor: "#FEE2E2" }]}>
          <Text style={styles.pillText}>{kcal} kcal</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: "#A7F3D0" }]}>
          <Text style={styles.pillText}>{protein}g P</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: "#BFDBFE" }]}>
          <Text style={styles.pillText}>{carbs}g C</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: "#FDE68A" }]}>
          <Text style={styles.pillText}>{fat}g G</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onView}
          style={[styles.btn, { borderColor: colors.border }]}
        >
          <MaterialCommunityIcons
            name="chef-hat"
            size={16}
            color={colors.brand}
          />
          <Text style={[styles.btnText, { color: colors.brand }]}>
            Ver Receta
          </Text>
        </Pressable>

        <Pressable
          onPress={onAdd}
          style={[
            styles.btn,
            styles.btnPrimary,
            { backgroundColor: colors.brand },
          ]}
        >
          <MaterialCommunityIcons
            name="plus-circle"
            size={16}
            color={colors.onCta}
          />
          <Text style={[styles.btnText, { color: colors.onCta }]}>
            Registrar
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    gap: 10,
    maxWidth: 280,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  macrosRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F2937",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  btnPrimary: {
    borderWidth: 0,
  },
  btnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
