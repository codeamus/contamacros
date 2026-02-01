import Skeleton from "@/presentation/components/ui/Skeleton";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View, Text } from "react-native";

type MacroCardProps = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  value: number;
  target: number;
  loading: boolean;
};

export const MacroCard = React.memo(function MacroCard({
  label,
  icon,
  value,
  target,
  loading,
}: MacroCardProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const pct = useMemo(() => {
    if (!target || target <= 0) return 0;
    return Math.min(value / target, 1);
  }, [value, target]);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(progressAnim, {
        toValue: pct,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [pct, loading, progressAnim]);

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={colors.textSecondary}
        />
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 13,
            color: colors.textSecondary,
          }}
        >
          {label}
        </Text>
      </View>

      {loading ? (
        <Skeleton
          height={20}
          width="50%"
          radius={10}
          bg={colors.border}
          highlight={colors.border}
        />
      ) : (
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 18,
            color: colors.textPrimary,
          }}
        >
          {value}
          <Text
            style={{
              fontFamily: typography.body?.fontFamily,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {" "}
            g
          </Text>
        </Text>
      )}

      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.border,
          overflow: "hidden",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
            backgroundColor: colors.brand,
          }}
        />
      </View>

      <Text
        style={{
          fontFamily: typography.body?.fontFamily,
          fontSize: 12,
          color: colors.textSecondary,
        }}
      >
        {target ? `de ${target} g` : "Sin objetivo"}
      </Text>
    </View>
  );
});
