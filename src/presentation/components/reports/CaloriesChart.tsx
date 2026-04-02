// src/presentation/components/reports/CaloriesChart.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

export type DailyCalories = {
  day: string; // YYYY-MM-DD
  calories: number;
};

type Props = {
  data: DailyCalories[];
  calorieGoal: number;
  width: number;
};

const CHART_HEIGHT = 140;
const LABEL_HEIGHT = 24;
const TOP_PAD = 12;
const BAR_RADIUS = 5;

export function CaloriesChart({ data, calorieGoal, width }: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const maxVal = Math.max(...data.map((d) => d.calories), calorieGoal, 1);
    const BAR_AREA = width - 32; // padding horizontal
    const barW = Math.max(8, Math.floor(BAR_AREA / data.length) - 4);
    const gap = Math.floor((BAR_AREA - barW * data.length) / (data.length + 1));

    const bars = data.map((d, i) => {
      const barH = Math.max(
        4,
        ((d.calories || 0) / maxVal) * CHART_HEIGHT,
      );
      const x = gap + i * (barW + gap);
      const y = TOP_PAD + CHART_HEIGHT - barH;
      const overGoal = calorieGoal > 0 && d.calories > calorieGoal;
      const color = overGoal ? "#7A4A2E" : "#22C55E";

      // Label: día del mes
      const date = new Date(d.day + "T12:00:00");
      const label = date.getDate().toString();

      return { x, y, barW, barH, color, label, calories: d.calories };
    });

    // Línea de meta calórica
    const goalY =
      TOP_PAD + CHART_HEIGHT - (calorieGoal / maxVal) * CHART_HEIGHT;

    // Promedios para el header
    const totalCals = data.reduce((s, d) => s + (d.calories || 0), 0);
    const avg = data.length > 0 ? Math.round(totalCals / data.length) : 0;
    const daysInGoal =
      calorieGoal > 0 ? data.filter((d) => d.calories <= calorieGoal).length : 0;
    const pctInGoal =
      calorieGoal > 0 ? Math.round((daysInGoal / data.length) * 100) : null;

    return { bars, goalY, maxVal, avg, daysInGoal, pctInGoal, BAR_AREA };
  }, [data, calorieGoal, width]);

  if (!chartData || data.length === 0) {
    return (
      <View style={[s.emptyWrap]}>
        <Text style={[s.emptyText, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
          Registrá comidas para ver tu gráfico de calorías
        </Text>
      </View>
    );
  }

  const { bars, goalY, avg, pctInGoal } = chartData;
  const svgH = CHART_HEIGHT + TOP_PAD + LABEL_HEIGHT;

  return (
    <View>
      {/* KPIs del header */}
      <View style={s.kpiRow}>
        <View style={s.kpiItem}>
          <Text style={[s.kpiValue, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
            {avg.toLocaleString()}
          </Text>
          <Text style={[s.kpiLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            kcal promedio
          </Text>
        </View>
        {pctInGoal !== null && (
          <View style={s.kpiItem}>
            <Text style={[s.kpiValue, { color: colors.brand, fontFamily: typography.subtitle?.fontFamily }]}>
              {pctInGoal}%
            </Text>
            <Text style={[s.kpiLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
              días en meta
            </Text>
          </View>
        )}
        {calorieGoal > 0 && (
          <View style={s.kpiItem}>
            <Text style={[s.kpiValue, { color: colors.textSecondary, fontFamily: typography.subtitle?.fontFamily }]}>
              {calorieGoal.toLocaleString()}
            </Text>
            <Text style={[s.kpiLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
              meta diaria
            </Text>
          </View>
        )}
      </View>

      {/* Gráfico SVG */}
      <Svg width={width} height={svgH}>
        {/* Línea de meta */}
        {calorieGoal > 0 && (
          <Line
            x1={16}
            y1={goalY}
            x2={width - 16}
            y2={goalY}
            stroke="#22C55E"
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.5}
          />
        )}

        {/* Barras */}
        {bars.map((bar, i) => (
          <React.Fragment key={i}>
            <Rect
              x={bar.x}
              y={bar.y}
              width={bar.barW}
              height={bar.barH}
              rx={BAR_RADIUS}
              ry={BAR_RADIUS}
              fill={bar.color}
              opacity={0.9}
            />
            {/* Label día */}
            <SvgText
              x={bar.x + bar.barW / 2}
              y={TOP_PAD + CHART_HEIGHT + LABEL_HEIGHT - 4}
              fontSize={10}
              fill={colors.textSecondary}
              textAnchor="middle"
              fontFamily={typography.body?.fontFamily}
            >
              {bar.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>

      {/* Leyenda */}
      {calorieGoal > 0 && (
        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: "#22C55E" }]} />
            <Text style={[s.legendText, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
              En meta
            </Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: "#7A4A2E" }]} />
            <Text style={[s.legendText, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
              Sobre meta
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  emptyWrap: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  kpiItem: {
    alignItems: "center",
    gap: 2,
  },
  kpiValue: {
    fontSize: 20,
  },
  kpiLabel: {
    fontSize: 11,
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    marginTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
});
