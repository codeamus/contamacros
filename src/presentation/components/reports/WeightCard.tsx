// src/presentation/components/reports/WeightCard.tsx
import { WeightService, type WeightEntry } from "@/domain/services/weightService";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

type Props = {
  startDate: string;
  endDate: string;
  onInputFocus?: () => void;
};

const CHART_HEIGHT = 120;
const TOP_PAD = 12;
const H_PAD = 16;

function buildCurvePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function buildAreaPath(
  points: { x: number; y: number }[],
  chartBottom: number,
): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]!.x} ${chartBottom}`;
  d += ` L ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  d += ` L ${points[points.length - 1]!.x} ${chartBottom} Z`;
  return d;
}

export function WeightCard({ startDate, endDate, onInputFocus }: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [inputKg, setInputKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [chartWidth, setChartWidth] = useState(300);

  const todayStr = new Date().toISOString().split("T")[0]!;

  const loadEntries = useCallback(async () => {
    const data = await WeightService.getRange(startDate, endDate);
    setEntries(data);
  }, [startDate, endDate]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleSave = useCallback(async () => {
    const kg = parseFloat(inputKg.replace(",", "."));
    if (isNaN(kg) || kg <= 0 || kg > 500) return;
    setSaving(true);
    await WeightService.save({ date: todayStr, kg });
    await loadEntries();
    setInputKg("");
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [inputKg, todayStr, loadEntries]);

  // Stats y gráfico
  const chartData = useMemo(() => {
    if (entries.length < 2) return null;
    const innerW = chartWidth - H_PAD * 2;
    const weights = entries.map((e) => e.kg);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;

    const toX = (i: number) =>
      H_PAD +
      (entries.length === 1 ? innerW / 2 : (i / (entries.length - 1)) * innerW);
    const toY = (kg: number) =>
      TOP_PAD + CHART_HEIGHT - ((kg - minW) / range) * CHART_HEIGHT;

    const points = entries.map((e, i) => ({ x: toX(i), y: toY(e.kg) }));
    const chartBottom = TOP_PAD + CHART_HEIGHT;

    return {
      linePath: buildCurvePath(points),
      areaPath: buildAreaPath(points, chartBottom),
      points,
      first: entries[0]!.kg,
      last: entries[entries.length - 1]!.kg,
      diff: entries[entries.length - 1]!.kg - entries[0]!.kg,
    };
  }, [entries, chartWidth]);

  const latestEntry = entries.length > 0 ? entries[entries.length - 1]! : null;

  const todayEntry = entries.find((e) => e.date === todayStr);

  return (
    <View>
      {/* Header stats */}
      {latestEntry && (
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text
              style={[s.statValue, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}
            >
              {latestEntry.kg} kg
            </Text>
            <Text style={[s.statLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
              Último registro
            </Text>
          </View>

          {chartData && (
            <View style={s.statItem}>
              <Text
                style={[
                  s.statValue,
                  {
                    color: chartData.diff < 0 ? colors.brand : "#FB923C",
                    fontFamily: typography.subtitle?.fontFamily,
                  },
                ]}
              >
                {chartData.diff > 0 ? "+" : ""}
                {chartData.diff.toFixed(1)} kg
              </Text>
              <Text style={[s.statLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
                En el período
              </Text>
            </View>
          )}

          {entries.length > 0 && (
            <View style={s.statItem}>
              <Text
                style={[s.statValue, { color: colors.textSecondary, fontFamily: typography.subtitle?.fontFamily }]}
              >
                {entries.length}
              </Text>
              <Text style={[s.statLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
                Registros
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Curva de peso */}
      {chartData ? (
        <View
          onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
          style={s.chartWrap}
        >
          <Svg width={chartWidth} height={CHART_HEIGHT + TOP_PAD + 8}>
            <Defs>
              <LinearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#22C55E" stopOpacity={0.25} />
                <Stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* Área */}
            <Path d={chartData.areaPath} fill="url(#weightGrad)" />
            {/* Línea */}
            <Path
              d={chartData.linePath}
              stroke="#22C55E"
              strokeWidth={2.5}
              fill="none"
            />
            {/* Puntos */}
            {chartData.points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#22C55E" opacity={0.7} />
            ))}
            {/* Último punto destacado */}
            <Circle
              cx={chartData.points[chartData.points.length - 1]!.x}
              cy={chartData.points[chartData.points.length - 1]!.y}
              r={5}
              fill="#22C55E"
            />
          </Svg>
        </View>
      ) : entries.length === 1 ? (
        <View style={s.singleEntry}>
          <Text style={[s.singleText, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Registrá al menos 2 pesos para ver la curva
          </Text>
        </View>
      ) : (
        <View style={s.emptyState}>
          <Text style={[s.emptyTitle, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Empezá a registrar tu peso para ver tu progreso
          </Text>
        </View>
      )}

      {/* Input de registro */}
      <View style={s.inputRow}>
        <TextInput
          value={inputKg}
          onChangeText={setInputKg}
          placeholder={todayEntry ? `Hoy: ${todayEntry.kg} kg (actualizar)` : "Peso de hoy (ej: 72.5)"}
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          style={[
            s.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontFamily: typography.body?.fontFamily,
            },
          ]}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          onFocus={onInputFocus}
        />
        <Pressable
          onPress={handleSave}
          disabled={saving || !inputKg.trim()}
          style={({ pressed }) => [
            s.saveBtn,
            { backgroundColor: colors.brand },
            (saving || !inputKg.trim()) && { opacity: 0.4 },
            pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Feather name="check" size={18} color={colors.background} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  chartWrap: {
    marginBottom: 12,
  },
  singleEntry: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  singleText: {
    fontSize: 12,
    textAlign: "center",
  },
  emptyState: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontSize: 13,
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
