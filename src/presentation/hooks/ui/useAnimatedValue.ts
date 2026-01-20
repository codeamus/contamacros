// src/presentation/hooks/ui/useAnimatedValue.ts
/**
 * Hook para animar valores numéricos (count up animation)
 */
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

export function useAnimatedValue(
  targetValue: number,
  duration: number = 800,
  delay: number = 0,
): Animated.Value {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => {
        Animated.timing(animatedValue, {
          toValue: targetValue,
          duration,
          useNativeDriver: false,
        }).start();
      }, delay);
      return () => clearTimeout(timer);
    } else {
      Animated.timing(animatedValue, {
        toValue: targetValue,
        duration,
        useNativeDriver: false,
      }).start();
    }
  }, [targetValue, duration, delay, animatedValue]);

  return animatedValue;
}
