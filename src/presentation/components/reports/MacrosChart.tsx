// src/presentation/components/reports/MacrosChart.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

export type DailyMacros = {
  day: string; // YYYY-MM-DD
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type Props = {
  data: DailyMacros[];
  width: number;
};

const CHART_HEIGHT = 140;
const TOP_PAD = 12;
const H_PAD = 16;

const MACRO_COLORS = {
  protein: "#22C55E",   // verde brand
  carbs: "#F59E0B",     // ámbar
  fat: "#FB923C",       // naranja
};

function buildPath(
  points: { x: number; y: number }[],
): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export function MacrosChart({ data, width }: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const innerW = width - H_PAD * 2;
    const allVals = data.flatMap((d) => [d.protein_g, d.carbs_g, d.fat_g]);
    const maxVal = Math.max(...allVals, 1);

    const toY = (val: number) =>
      TOP_PAD + CHART_HEIGHT - (val / maxVal) * CHART_HEIGHT;
    const toX = (i: number) =>
      H_PAD + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);

    const proteinPoints = data.map((d, i) => ({ x: toX(i), y: toY(d.protein_g) }));
    const carbsPoints = data.map((d, i) => ({ x: toX(i), y: toY(d.carbs_g) }));
    const fatPoints = data.map((d, i) => ({ x: toX(i), y: toY(d.fat_g) }));

    const avgProtein = Math.round(data.reduce((s, d) => s + d.protein_g, 0) / data.length);
    const avgCarbs = Math.round(data.reduce((s, d) => s + d.carbs_g, 0) / data.length);
    const avgFat = Math.round(data.reduce((s, d) => s + d.fat_g, 0) / data.length);

    return {
      proteinPath: buildPath(proteinPoints),
      carbsPath: buildPath(carbsPoints),
      fatPath: buildPath(fatPoints),
      lastProtein: proteinPoints[proteinPoints.length - 1]!,
      lastCarbs: carbsPoints[carbsPoints.length - 1]!,
      lastFat: fatPoints[fatPoints.length - 1]!,
      avgProtein,
      avgCarbs,
      avgFat,
    };
  }, [data, width]);

  if (!chartData || data.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <Text style={[s.emptyText, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
          Registrá comidas para ver la evolución de tus macros
        </Text>
      </View>
    );
  }

  const svgH = CHART_HEIGHT + TOP_PAD + 8;

  return (
    <View>
      {/* Gráfico SVG */}
      <Svg width={width} height={svgH}>
        {/* Líneas de guía horizontales */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <Line
            key={frac}
            x1={H_PAD}
            y1={TOP_PAD + CHART_HEIGHT * (1 - frac)}
            x2={width - H_PAD}
            y2={TOP_PAD + CHART_HEIGHT * (1 - frac)}
            stroke={colors.border}
            strokeWidth={0.5}
            opacity={0.4}
          />
        ))}

        {/* Línea grasa */}
        <Path
          d={chartData.fatPath}
          stroke={MACRO_COLORS.fat}
          strokeWidth={2}
          fill="none"
          opacity={0.8}
        />
        {/* Línea carbs */}
        <Path
          d={chartData.carbsPath}
          stroke={MACRO_COLORS.carbs}
          strokeWidth={2}
          fill="none"
          opacity={0.8}
        />
        {/* Línea proteína (encima) */}
        <Path
          d={chartData.proteinPath}
          stroke={MACRO_COLORS.protein}
          strokeWidth={2.5}
          fill="none"
        />

        {/* Puntos finales */}
        <Circle cx={chartData.lastProtein.x} cy={chartData.lastProtein.y} r={4} fill={MACRO_COLORS.protein} />
        <Circle cx={chartData.lastCarbs.x} cy={chartData.lastCarbs.y} r={4} fill={MACRO_COLORS.carbs} />
        <Circle cx={chartData.lastFat.x} cy={chartData.lastFat.y} r={4} fill={MACRO_COLORS.fat} />
      </Svg>

      {/* Chips de promedio */}
      <View style={s.chipsRow}>
        <View style={[s.chip, { backgroundColor: `${MACRO_COLORS.protein}22`, borderColor: `${MACRO_COLORS.protein}44` }]}>
          <View style={[s.chipDot, { backgroundColor: MACRO_COLORS.protein }]} />
          <Text style={[s.chipLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Prot
          </Text>
          <Text style={[s.chipValue, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
            {chartData.avgProtein}g
          </Text>
        </View>

        <View style={[s.chip, { backgroundColor: `${MACRO_COLORS.carbs}22`, borderColor: `${MACRO_COLORS.carbs}44` }]}>
          <View style={[s.chipDot, { backgroundColor: MACRO_COLORS.carbs }]} />
          <Text style={[s.chipLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Carbs
          </Text>
          <Text style={[s.chipValue, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
            {chartData.avgCarbs}g
          </Text>
        </View>

        <View style={[s.chip, { backgroundColor: `${MACRO_COLORS.fat}22`, borderColor: `${MACRO_COLORS.fat}44` }]}>
          <View style={[s.chipDot, { backgroundColor: MACRO_COLORS.fat }]} />
          <Text style={[s.chipLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Grasa
          </Text>
          <Text style={[s.chipValue, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
            {chartData.avgFat}g
          </Text>
        </View>
      </View>
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
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipLabel: {
    fontSize: 11,
  },
  chipValue: {
    fontSize: 13,
  },
});
