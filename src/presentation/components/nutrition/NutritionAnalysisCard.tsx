// src/presentation/components/nutrition/NutritionAnalysisCard.tsx

import type { NutritionAnalysisResult } from "@/data/ai/nutritionAnalyzerService";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  result: NutritionAnalysisResult;
};

function scoreColor(score: number): string {
  if (score >= 7) return "#22C55E";
  if (score >= 4) return "#FBBF24";
  return "#FF6B6B";
}

function scoreLabel(score: number): string {
  if (score >= 8) return "Muy saludable";
  if (score >= 6) return "Aceptable";
  if (score >= 4) return "Moderado";
  if (score >= 2) return "Poco saludable";
  return "Evitar";
}

function ScoreGauge({ score, colors }: { score: number; colors: any }) {
  const color = scoreColor(score);
  const pct = score / 10;

  return (
    <View style={gaugeStyles.container}>
      <View style={[gaugeStyles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            gaugeStyles.fill,
            { width: `${pct * 100}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <View style={gaugeStyles.labelRow}>
        <Text style={[gaugeStyles.score, { color }]}>{score}/10</Text>
        <Text style={[gaugeStyles.label, { color }]}>{scoreLabel(score)}</Text>
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: { gap: 6 },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  score: {
    fontSize: 22,
    fontWeight: "800",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export default function NutritionAnalysisCard({ result }: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);
  const color = scoreColor(result.healthScore);

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Nombre del producto */}
      <Text style={s.productName}>{result.productName}</Text>
      <Text style={s.servingSize}>{result.servingSize}</Text>

      {/* Score de salud */}
      <View style={[s.card, { borderColor: color + "40" }]}>
        <View style={s.cardHeader}>
          <MaterialCommunityIcons name="star-check" size={20} color={color} />
          <Text style={s.cardTitle}>Score de salud</Text>
        </View>
        <ScoreGauge score={result.healthScore} colors={colors} />
      </View>

      {/* Macros */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <MaterialCommunityIcons name="food-apple" size={20} color={colors.brand} />
          <Text style={s.cardTitle}>Información nutricional</Text>
        </View>
        <View style={s.macrosGrid}>
          <MacroItem label="Calorías" value={`${result.calories}`} unit="kcal" colors={colors} typography={typography} highlight />
          <MacroItem label="Proteína" value={`${result.protein}g`} unit="" colors={colors} typography={typography} />
          <MacroItem label="Carbos" value={`${result.carbs}g`} unit="" colors={colors} typography={typography} />
          <MacroItem label="Grasas" value={`${result.fats}g`} unit="" colors={colors} typography={typography} />
        </View>
      </View>

      {/* ¿Encaja en tu meta? */}
      <View style={[s.card, s.goalCard, { borderColor: result.fitsGoal ? "#22C55E40" : "#FF6B6B40" }]}>
        <MaterialCommunityIcons
          name={result.fitsGoal ? "check-circle" : "alert-circle"}
          size={22}
          color={result.fitsGoal ? "#22C55E" : "#FF6B6B"}
        />
        <Text style={[s.goalText, { color: result.fitsGoal ? "#22C55E" : "#FF6B6B" }]}>
          {result.fitsGoal
            ? "Cabe en tu meta calórica de hoy"
            : "Supera tus calorías restantes de hoy"}
        </Text>
      </View>

      {/* Advertencias */}
      {result.warnings.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <MaterialCommunityIcons name="alert" size={20} color="#FBBF24" />
            <Text style={s.cardTitle}>Advertencias</Text>
          </View>
          <View style={s.warningsList}>
            {result.warnings.map((w) => (
              <View key={w} style={s.warningItem}>
                <MaterialCommunityIcons name="circle-small" size={20} color="#FBBF24" />
                <Text style={s.warningText}>{w}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recomendación */}
      {result.recommendation ? (
        <View style={[s.card, s.recommendationCard]}>
          <View style={s.cardHeader}>
            <MaterialCommunityIcons name="robot" size={20} color="#38BDF8" />
            <Text style={s.cardTitle}>Análisis personalizado</Text>
          </View>
          <Text style={s.recommendationText}>{result.recommendation}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function MacroItem({
  label,
  value,
  unit,
  colors,
  typography,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  colors: any;
  typography: any;
  highlight?: boolean;
}) {
  return (
    <View style={macroStyles.item}>
      <Text style={[macroStyles.value, { color: highlight ? colors.brand : colors.textPrimary, ...typography.h2 }]}>
        {value}
        {unit ? <Text style={[macroStyles.unit, { color: colors.textSecondary }]}> {unit}</Text> : null}
      </Text>
      <Text style={[macroStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  item: { flex: 1, alignItems: "center", gap: 2 },
  value: { fontSize: 20, fontWeight: "800" },
  unit: { fontSize: 12, fontWeight: "400" },
  label: { fontSize: 11, fontWeight: "500" },
});

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    container: {
      padding: 20,
      gap: 12,
      paddingBottom: 32,
    },
    productName: {
      ...typography.h1,
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    servingSize: {
      ...typography.body,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    cardTitle: {
      ...typography.subtitle,
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    macrosGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    goalCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    goalText: {
      ...typography.body,
      fontSize: 14,
      fontWeight: "600",
      flex: 1,
    },
    warningsList: { gap: 6 },
    warningItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    warningText: {
      ...typography.body,
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
    },
    recommendationCard: {
      borderColor: "#38BDF820",
      backgroundColor: "#38BDF808",
    },
    recommendationText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 22,
    },
  });
}
