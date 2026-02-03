import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface MacrosHeaderProps {
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
  calories: { current: number; target: number };
}

export const MacrosHeader: React.FC<MacrosHeaderProps> = ({
  protein,
  carbs,
  fat,
  calories,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const renderMiniMacro = (
    label: string,
    value: number,
    target: number,
    color: string,
    icon: string,
  ) => {
    const progress = target > 0 ? Math.min(value / target, 1) : 0;
    return (
      <View style={styles.macroItem}>
        <View style={styles.macroHeader}>
          <MaterialCommunityIcons name={icon as any} size={10} color={color} />
          <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>
            {label}
          </Text>
        </View>
        <View
          style={[styles.progressBarBg, { backgroundColor: colors.border }]}
        >
          <View
            style={[
              styles.progressBarFill,
              { backgroundColor: color, width: `${progress * 100}%` },
            ]}
          />
        </View>
        <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
          {Math.round(value)}/{Math.round(target)}g
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.kcalContainer}>
        <Text style={[styles.kcalValue, { color: colors.textPrimary }]}>
          {Math.round(calories.current)}
        </Text>
        <Text style={[styles.kcalLabel, { color: colors.textSecondary }]}>
          KCAL / {Math.round(calories.target)}
        </Text>
      </View>
      <View style={styles.macrosContainer}>
        {renderMiniMacro(
          "Prot",
          protein.current,
          protein.target,
          "#A7F3D0",
          "arm-flex",
        )}
        {renderMiniMacro(
          "Carb",
          carbs.current,
          carbs.target,
          "#BFDBFE",
          "chart-donut-variant",
        )}
        {renderMiniMacro(
          "Gras",
          fat.current,
          fat.target,
          "#FDE68A",
          "water-percent",
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 16,
  },
  kcalContainer: {
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#E1E5D3",
    paddingRight: 16,
  },
  kcalValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  kcalLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  macrosContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  macroItem: {
    flex: 1,
    gap: 2,
  },
  macroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  macroLabel: {
    fontSize: 9,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 3,
    borderRadius: 1.5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  macroValue: {
    fontSize: 8,
    fontWeight: "600",
  },
});
