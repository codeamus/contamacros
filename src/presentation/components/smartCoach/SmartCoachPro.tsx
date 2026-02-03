// src/presentation/components/smartCoach/SmartCoachPro.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type SmartCoachProProps = {
  isPremium: boolean;
  caloriesConsumed?: number;
  caloriesTarget?: number;
  onShowPaywall?: () => void;
};

/** Tono variado, alegre y muy humano */
const GREETINGS = {
  breakfast: [
    "¡Buenos días! ¿Qué tal un desayuno rico en proteína para arrancar con todo? 🍳",
    "¡Arriba ese ánimo! Un buen café y unos huevos estarían genial hoy. ☕️",
    "¿Listo para nutrir tu cuerpo? Piensa en algo fresco y nutritivo para empezar. 🍓",
  ],
  lunch: [
    "¡Ya casi es hora de almorzar! ¿Qué tienes en mente para seguir tu plan? 🥗",
    "Recuerda incluir vegetales en tu almuerzo. ¡Tu cuerpo te lo agradecerá! 🥦",
    "Momento de recargar energías. ¡Busca ese equilibrio en tu plato! 🍗",
  ],
  snack: [
    "¿Un antojo de media tarde? Unos frutos secos o una fruta serían ideales. 🍎",
    "¡No te olvides de hidratarte! Y quizás un snack ligero para aguantar hasta la cena. 🥜",
    "Mantén el ritmo, ¡vas muy bien! ¿Qué tal un yogurt griego para la tarde? 🥛",
  ],
  dinner: [
    "Cerrando el día... Prueba algo ligero para descansar mejor. 🌜",
    "¡Gran día! Una cena equilibrada es el broche de oro. 🍲",
    "¿Qué tal una proteína magra para terminar el día con éxito? 🐟",
  ],
  surplus: [
    "¡Has comido bien! ¿Qué tal una caminata ligera para ayudar a la digestión? 🚶‍♂️",
    "¡Energía al máximo! Un poco de movimiento suave te vendría genial ahora. ✨",
    "Cuerpo cargado. ¡Es el momento perfecto para un paseo o estiramientos! 🧘‍♂️",
  ],
};

function getRandomItem<T>(arr: T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index] as T;
}

export default function SmartCoachPro({
  isPremium,
  caloriesConsumed = 0,
  caloriesTarget = 0,
  onShowPaywall,
}: SmartCoachProProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const content = useMemo(() => {
    const hour = new Date().getHours();
    const isSurplus = caloriesTarget > 0 && caloriesConsumed > caloriesTarget;

    if (isSurplus) {
      return {
        title: "Coach: ¡Actívate!",
        message: getRandomItem(GREETINGS.surplus),
        icon: "run" as const,
        iconColor: colors.cta,
      };
    }

    if (hour >= 5 && hour < 11) {
      return {
        title: "Coach: ¡Desayuno!",
        message: getRandomItem(GREETINGS.breakfast),
        icon: "coffee-outline" as const,
        iconColor: colors.brand,
      };
    }
    if (hour >= 11 && hour < 15) {
      return {
        title: "Coach: Almuerzo",
        message: getRandomItem(GREETINGS.lunch),
        icon: "food-apple-outline" as const,
        iconColor: colors.brand,
      };
    }
    if (hour >= 15 && hour < 19) {
      return {
        title: "Coach: Snack pro",
        message: getRandomItem(GREETINGS.snack),
        icon: "food-croissant" as const,
        iconColor: colors.brand,
      };
    }
    return {
      title: "Coach: Cena",
      message: getRandomItem(GREETINGS.dinner),
      icon: "weather-night" as const,
      iconColor: colors.brand,
    };
  }, [caloriesConsumed, caloriesTarget, colors]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isPremium) {
      onShowPaywall?.();
    } else {
      router.push("/smart-coach-pro");
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        s.card,
        { borderColor: isPremium ? colors.brand + "40" : colors.border },
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View
        style={[s.iconContainer, { backgroundColor: content.iconColor + "15" }]}
      >
        <MaterialCommunityIcons
          name={content.icon}
          size={24}
          color={content.iconColor}
        />
      </View>

      <View style={s.textContainer}>
        <Text style={s.title}>{content.title}</Text>
        <Text style={s.message}>{content.message}</Text>
        <View style={s.actions}>
          <Text style={s.actionText}>
            {isPremium ? "Chatear con Coach" : "Ver Smart Coach Pro"}
          </Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={14}
            color={colors.brand}
          />
        </View>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      gap: 12,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    textContainer: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...typography.subtitle,
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    message: {
      ...typography.body,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    actionText: {
      ...typography.caption,
      fontSize: 13,
      fontWeight: "700",
      color: colors.brand,
    },
  });
}
