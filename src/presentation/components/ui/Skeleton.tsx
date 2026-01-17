// src/presentation/components/ui/Skeleton.tsx
import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, View, ViewStyle } from "react-native";

export default function Skeleton({
  width = "100%",
  height = 14,
  radius = 12,
  style,
  bg = "#E5E7EB",
  highlight = "rgba(255,255,255,0.55)",
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  bg?: string;
  highlight?: string;
}) {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 220],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: bg,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: 80,
          height: "100%",
          backgroundColor: highlight,
          opacity: 0.7,
          transform: [{ translateX }, { skewX: "-20deg" }],
        }}
      />
    </View>
  );
}
