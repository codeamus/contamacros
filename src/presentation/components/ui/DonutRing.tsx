// src/presentation/components/ui/DonutRing.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function DonutRing({
  progress, // 0..1
  size = 92,
  stroke = 12,
  trackColor,
  fillColor,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  trackColor: string;
  fillColor: string;
}) {
  const p = Math.max(0, Math.min(progress, 1));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const half = size / 2;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: p,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [p, anim]);

  const dashOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const rotate = useMemo(() => [{ rotate: "-90deg" }], []);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={half}
          cy={half}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />

        <AnimatedCircle
          cx={half}
          cy={half}
          r={radius}
          stroke={fillColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset as any}
          originX={half}
          originY={half}
          transform={rotate as any}
        />
      </Svg>
    </View>
  );
}
