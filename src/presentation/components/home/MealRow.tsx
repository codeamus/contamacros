import { AnimatedProgressBar } from "@/presentation/components/home/AnimatedProgressBar";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef } from "react";
import { Animated, Pressable, View, Text } from "react-native";

type MealRowProps = {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  count: number;
  kcal: number;
  totalKcal: number;
  loading: boolean;
  onOpen: () => void;
  onAdd: () => void;
};

export const MealRow = React.memo(function MealRow({
  title,
  icon,
  count,
  kcal,
  totalKcal,
  loading,
  onOpen,
  onAdd,
}: MealRowProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const pct = useMemo(() => {
    if (!totalKcal || totalKcal <= 0) return 0;
    return Math.min(kcal / totalKcal, 1);
  }, [kcal, totalKcal]);

  const subtitle = useMemo(() => {
    if (loading) return "Cargando…";
    if (count === 0) return "Sin registros";
    if (count === 1) return `1 item · ${kcal} kcal`;
    return `${count} items · ${kcal} kcal`;
  }, [loading, count, kcal]);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onOpen();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 8,
      }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flex: 1,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={colors.textPrimary}
          />
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                flex: 1,
                fontFamily: typography.subtitle?.fontFamily,
                fontSize: 15,
                color: colors.textPrimary,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>

            <View
              style={{
                height: 26,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontFamily: typography.body?.fontFamily,
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                {loading ? "—" : `${kcal} kcal`}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: typography.body?.fontFamily,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {subtitle}
          </Text>

          <AnimatedProgressBar
            percentage={pct * 100}
            loading={loading}
          />
        </View>
      </Animated.View>

      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onAdd();
        }}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            height: 36,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? "rgba(34,197,94,0.10)" : "transparent",
          },
        ]}
      >
        <Feather name="plus" size={16} color={colors.brand} />
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 13,
            color: colors.brand,
          }}
        >
          Añadir
        </Text>
      </Pressable>
    </Pressable>
  );
});
