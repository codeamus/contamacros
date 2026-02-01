import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { MiniStat } from "./MiniStat";

type SummaryCardsProps = {
  remaining: number;
  caloriesConsumed: number;
  loading: boolean;
  restantesAnimation: Animated.Value | null | undefined;
  consumidasAnimation: Animated.Value | null | undefined;
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
});

export function SummaryCards({
  remaining,
  caloriesConsumed,
  loading,
  restantesAnimation,
  consumidasAnimation,
}: SummaryCardsProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.row}>
      {restantesAnimation && (
        <Animated.View
          style={{
            flex: 1,
            opacity: restantesAnimation,
            transform: [
              {
                translateY: restantesAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
              { scale: restantesAnimation },
            ],
          }}
        >
          <MiniStat
            title="Restantes"
            value={loading ? null : `${remaining}`}
            unit="kcal"
            icon={
              <MaterialCommunityIcons
                name="target"
                size={18}
                color={colors.brand}
              />
            }
          />
        </Animated.View>
      )}
      {consumidasAnimation && (
        <Animated.View
          style={{
            flex: 1,
            opacity: consumidasAnimation,
            transform: [
              {
                translateY: consumidasAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
              { scale: consumidasAnimation },
            ],
          }}
        >
          <MiniStat
            title="Consumidas"
            value={loading ? null : `${caloriesConsumed}`}
            unit="kcal"
            icon={
              <MaterialCommunityIcons
                name="fire"
                size={18}
                color={colors.cta}
              />
            }
          />
        </Animated.View>
      )}
    </View>
  );
}
