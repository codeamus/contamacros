// app/(tabs)/about-smart-coach-pro.tsx
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

export default function AboutSmartCoachProScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={s.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.title}>Smart Coach Pro</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.card, { borderColor: colors.brand + "40", backgroundColor: colors.brand + "12" }]}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={32} color={colors.brand} />
          <Text style={s.cardTitle}>¿Qué hace el Smart Coach Pro?</Text>
          <Text style={s.cardBody}>
            Analiza tu progreso del día (calorías y macros consumidos vs. tu meta) y te da una
            recomendación personalizada: qué comer para completar tu déficit o qué ejercicio hacer
            si te pasaste de calorías, usando tu historial y actividad física.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Cuando te falta llegar a tu meta</Text>
          <Text style={s.body}>
            Si te faltan calorías o macros, el Coach prioriza el nutriente que más te falta y sugiere
            alimentos ideales (de tu historial, tus recetas o la base comunitaria), con cantidad
            sugerida en gramos o unidades.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Cuando te pasaste de calorías</Text>
          <Text style={s.body}>
            Si consumiste más de tu meta, el Coach te sugiere ejercicios concretos y cuántos minutos
            hacer para equilibrar. Si tienes actividad sincronizada (Apple Health / Health Connect),
            la tiene en cuenta y te muestra solo el esfuerzo restante.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Un toque para agregar</Text>
          <Text style={s.body}>
            Cuando la recomendación es un alimento, puedes agregarlo al diario con un solo toque en
            «Agregar», sin tener que buscar ni editar porciones.
          </Text>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>
            Desbloquea Smart Coach Pro con una suscripción ContaMacros Pro para ver tu recomendación
            en la pantalla de Inicio.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...typography.subtitle,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    card: {
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 24,
      gap: 12,
    },
    cardTitle: {
      ...typography.subtitle,
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    cardBody: {
      ...typography.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    body: {
      ...typography.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    footer: {
      marginTop: 16,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerText: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
      fontStyle: "italic",
    },
  });
}
