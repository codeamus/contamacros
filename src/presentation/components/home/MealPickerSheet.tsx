import type { MealType } from "@/domain/models/foodLogDb";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

type MealPickerSheetProps = {
  open: boolean;
  onClose: () => void;
  onPick: (meal: MealType) => void;
};

function SheetOption({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? "rgba(34,197,94,0.10)" : "transparent",
          borderRadius: 18,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
      ]}
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
            backgroundColor: "transparent",
          }}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={colors.textPrimary}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: typography.subtitle?.fontFamily,
              fontSize: 15,
              color: colors.textPrimary,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: typography.body?.fontFamily,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}

const sheetStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 18,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function MealPickerSheet({ open, onClose, onPick }: MealPickerSheetProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const translateY = useRef(new Animated.Value(420)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 420,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [open, backdrop, translateY]);

  if (!open) return null;

  return (
    <View style={sheetStyles.wrap} pointerEvents="box-none">
      <Animated.View style={[sheetStyles.backdrop, { opacity: backdrop }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          sheetStyles.panel,
          {
            transform: [{ translateY }],
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[sheetStyles.handle, { backgroundColor: colors.border }]} />

        <View style={sheetStyles.headRow}>
          <Text
            style={{
              fontFamily: typography.subtitle?.fontFamily,
              fontSize: 16,
              color: colors.textPrimary,
            }}
          >
            Agregar comida
          </Text>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            style={sheetStyles.closeBtn}
          >
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={{ gap: 10, marginTop: 8 }}>
          <SheetOption
            title="Desayuno"
            subtitle="Café, pan, avena…"
            icon="coffee"
            onPress={() => onPick("breakfast")}
          />
          <SheetOption
            title="Almuerzo"
            subtitle="Plato principal…"
            icon="food"
            onPress={() => onPick("lunch")}
          />
          <SheetOption
            title="Cena"
            subtitle="Liviano o completo…"
            icon="food-variant"
            onPress={() => onPick("dinner")}
          />
          <SheetOption
            title="Snack"
            subtitle="Colación / picoteo…"
            icon="food-apple"
            onPress={() => onPick("snack")}
          />
        </View>
      </Animated.View>
    </View>
  );
}
