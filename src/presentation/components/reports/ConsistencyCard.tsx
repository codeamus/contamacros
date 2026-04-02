// src/presentation/components/reports/ConsistencyCard.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  /** Set de días registrados en formato YYYY-MM-DD */
  loggedDays: Set<string>;
  /** Racha actual (días consecutivos hasta hoy) */
  currentStreak: number;
  /** Mejor racha histórica */
  bestStreak: number;
};

function getTodayStr(): string {
  const d = new Date();
  return d.toISOString().split("T")[0]!;
}

/** Genera los 35 días previos (5 semanas) para el heatmap */
function buildHeatmapDays(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split("T")[0]!);
  }
  return days;
}

export function ConsistencyCard({ loggedDays, currentStreak, bestStreak }: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const heatmapDays = useMemo(() => buildHeatmapDays(), []);

  // % días del mes actual
  const monthStats = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    void new Date(year, month + 1, 0).getDate(); // daysInMonth unused in pct calc
    const dayOfMonth = today.getDate();

    let logged = 0;
    for (let d = 1; d <= dayOfMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (loggedDays.has(dateStr)) logged++;
    }

    return {
      pct: Math.round((logged / dayOfMonth) * 100),
      logged,
      total: dayOfMonth,
    };
  }, [loggedDays]);

  const today = getTodayStr();

  // Etiquetas de día de semana encima del heatmap
  const weekLabels = ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <View>
      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpiItem}>
          <View style={s.kpiValueRow}>
            <Text style={[s.kpiBig, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
              {currentStreak}
            </Text>
            <Text style={s.kpiEmoji}>🔥</Text>
          </View>
          <Text style={[s.kpiLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Racha actual
          </Text>
        </View>

        <View style={[s.kpiDivider, { backgroundColor: colors.border }]} />

        <View style={s.kpiItem}>
          <View style={s.kpiValueRow}>
            <Text style={[s.kpiBig, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
              {bestStreak}
            </Text>
            <Text style={s.kpiEmoji}>🏆</Text>
          </View>
          <Text style={[s.kpiLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Mejor racha
          </Text>
        </View>

        <View style={[s.kpiDivider, { backgroundColor: colors.border }]} />

        <View style={s.kpiItem}>
          <View style={s.kpiValueRow}>
            <Text style={[s.kpiBig, { color: colors.brand, fontFamily: typography.subtitle?.fontFamily }]}>
              {monthStats.pct}%
            </Text>
            <Text style={s.kpiEmoji}>✅</Text>
          </View>
          <Text style={[s.kpiLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Este mes
          </Text>
        </View>
      </View>

      {/* Heatmap (5 semanas x 7 días) */}
      <View style={s.heatmapWrap}>
        {/* Labels semana */}
        <View style={s.weekLabelsRow}>
          {weekLabels.map((l) => (
            <Text
              key={l}
              style={[s.weekLabel, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}
            >
              {l}
            </Text>
          ))}
        </View>

        {/* Grid: 5 filas (semanas) × 7 columnas */}
        <View style={s.grid}>
          {Array.from({ length: 5 }).map((_, week) => (
            <View key={week} style={s.gridRow}>
              {Array.from({ length: 7 }).map((_, dow) => {
                const idx = week * 7 + dow;
                const dayStr = heatmapDays[idx];
                const isLogged = dayStr ? loggedDays.has(dayStr) : false;
                const isToday = dayStr === today;
                const isFuture = dayStr ? dayStr > today : false;

                return (
                  <View
                    key={dow}
                    style={[
                      s.cell,
                      {
                        backgroundColor: isFuture
                          ? "transparent"
                          : isLogged
                          ? "#22C55E"
                          : `${colors.border}`,
                        borderColor: isToday ? "#22C55E" : "transparent",
                        borderWidth: isToday ? 1.5 : 0,
                        opacity: isFuture ? 0.15 : 1,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Leyenda */}
        <View style={s.legendRow}>
          <Text style={[s.legendText, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Sin registros
          </Text>
          <View style={s.legendScale}>
            {[0.15, 0.4, 0.65, 1].map((opacity) => (
              <View
                key={opacity}
                style={[s.legendCell, { backgroundColor: "#22C55E", opacity }]}
              />
            ))}
          </View>
          <Text style={[s.legendText, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
            Registrado
          </Text>
        </View>
      </View>
    </View>
  );
}

const CELL_SIZE = 14;
const CELL_GAP = 4;

const s = StyleSheet.create({
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 20,
  },
  kpiItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  kpiValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  kpiBig: {
    fontSize: 26,
  },
  kpiEmoji: {
    fontSize: 16,
  },
  kpiLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  kpiDivider: {
    width: 1,
    height: 40,
    opacity: 0.4,
  },
  heatmapWrap: {
    alignItems: "center",
    gap: 8,
  },
  weekLabelsRow: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  weekLabel: {
    width: CELL_SIZE,
    fontSize: 10,
    textAlign: "center",
  },
  grid: {
    gap: CELL_GAP,
  },
  gridRow: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  legendScale: {
    flexDirection: "row",
    gap: 3,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
  },
});
