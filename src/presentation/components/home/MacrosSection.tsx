import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { MacroCard } from "./MacroCard";

type MacroItem = { value: number; target: number };

type MacrosSectionProps = {
  protein: MacroItem;
  carbs: MacroItem;
  fat: MacroItem;
  loading: boolean;
  cardAnimation: Animated.Value | null | undefined;
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 14 },
  sectionAction: { fontSize: 13 },
  macrosRow: { flexDirection: "row", gap: 10 },
});

export function MacrosSection({
  protein,
  carbs,
  fat,
  loading,
  cardAnimation,
}: MacrosSectionProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const animatedStyle = cardAnimation
    ? {
        opacity: cardAnimation,
        transform: [
          {
            translateY: cardAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
      }
    : undefined;

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons
            name="chart-donut"
            size={18}
            color={colors.textPrimary}
          />
          <Text
            style={[
              styles.sectionTitle,
              {
                fontFamily: typography.subtitle?.fontFamily,
                color: colors.textPrimary,
              },
            ]}
          >
            Macros
          </Text>
        </View>
        <Pressable onPress={() => {}}>
          <Text
            style={[
              styles.sectionAction,
              {
                fontFamily: typography.body?.fontFamily,
                color: colors.brand,
              },
            ]}
          >
            Ver detalle
          </Text>
        </Pressable>
      </View>

      <View style={styles.macrosRow}>
        {cardAnimation && (
          <>
            <Animated.View style={[{ flex: 1 }, animatedStyle]}>
              <MacroCard
                label="Proteína"
                icon="food-steak"
                value={protein.value}
                target={protein.target}
                loading={loading}
              />
            </Animated.View>
            <Animated.View style={[{ flex: 1 }, animatedStyle]}>
              <MacroCard
                label="Carbs"
                icon="bread-slice"
                value={carbs.value}
                target={carbs.target}
                loading={loading}
              />
            </Animated.View>
            <Animated.View style={[{ flex: 1 }, animatedStyle]}>
              <MacroCard
                label="Grasas"
                icon="peanut"
                value={fat.value}
                target={fat.target}
                loading={loading}
              />
            </Animated.View>
          </>
        )}
      </View>
    </>
  );
}
