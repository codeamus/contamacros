import { useTheme } from "@/presentation/theme/ThemeProvider";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type AnimatedProgressBarProps = {
  percentage: number;
  loading: boolean;
};

/**
 * Barra de progreso animada (0–100%).
 */
export function AnimatedProgressBar({ percentage, loading }: AnimatedProgressBarProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(widthAnim, {
        toValue: percentage,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [percentage, loading, widthAnim]);

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: colors.border },
      ]}
    >
      <Animated.View
        style={{
          height: "100%",
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
          backgroundColor: colors.brand,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
});
