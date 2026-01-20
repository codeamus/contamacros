// src/presentation/hooks/ui/useStaggerAnimation.ts
/**
 * Hook para animaciones escalonadas (stagger) de elementos en lista
 */
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

export function useStaggerAnimation(
  count: number,
  delay: number = 50,
  initialDelay: number = 0,
) {
  const animations = useRef<Animated.Value[]>(
    Array.from({ length: count }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    animations.forEach((anim, index) => {
      const timer = setTimeout(() => {
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      }, initialDelay + index * delay);

      timers.push(timer);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [animations, delay, initialDelay]);

  return animations;
}
