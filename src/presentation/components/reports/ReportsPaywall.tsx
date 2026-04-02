// src/presentation/components/reports/ReportsPaywall.tsx
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: React.ReactNode;
};

/**
 * Wrapper que bloquea el contenido para usuarios free.
 * Muestra el contenido desenfocado + overlay con CTA premium.
 */
export function ReportsPaywall({ children }: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const [paywallVisible, setPaywallVisible] = useState(false);

  return (
    <View style={styles.root}>
      {/* Contenido borroso detrás */}
      <View style={styles.blurredContent} pointerEvents="none">
        {children}
      </View>

      {/* Capa de blur */}
      <BlurView
        intensity={60}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Overlay oscuro adicional para legibilidad */}
      <View style={[styles.dimOverlay]} pointerEvents="none" />

      {/* Card central */}
      <View style={styles.cardWrap} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Icono candado */}
          <View
            style={[styles.iconCircle, { backgroundColor: `${colors.brand}22` }]}
          >
            <Feather name="lock" size={28} color={colors.brand} />
          </View>

          <Text
            style={[
              styles.title,
              {
                color: colors.textPrimary,
                fontFamily: typography.subtitle?.fontFamily,
              },
            ]}
          >
            Reportes Premium
          </Text>

          <Text
            style={[
              styles.body,
              {
                color: colors.textSecondary,
                fontFamily: typography.body?.fontFamily,
              },
            ]}
          >
            Visualizá tu progreso de calorías, macros, peso y consistencia con gráficos detallados.
          </Text>

          {/* Features list */}
          {[
            "Gráfico de calorías diarias",
            "Evolución de macros (proteína, grasa, carbs)",
            "Registro y curva de peso corporal",
            "Racha y consistencia de registro",
          ].map((feat) => (
            <View key={feat} style={styles.featureRow}>
              <Feather name="check-circle" size={14} color={colors.brand} />
              <Text
                style={[
                  styles.featureText,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.body?.fontFamily,
                  },
                ]}
              >
                {feat}
              </Text>
            </View>
          ))}

          <Pressable
            onPress={() => setPaywallVisible(true)}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.cta },
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text
              style={[
                styles.ctaText,
                {
                  color: colors.onCta,
                  fontFamily: typography.subtitle?.fontFamily,
                },
              ]}
            >
              Desbloquear Reportes
            </Text>
          </Pressable>
        </View>
      </View>

      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => setPaywallVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blurredContent: {
    flex: 1,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  cardWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  featureText: {
    fontSize: 13,
  },
  cta: {
    marginTop: 8,
    width: "100%",
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 16,
  },
});
