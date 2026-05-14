import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ActivityCardProps = {
  isPremium: boolean;
  isLoading?: boolean;
  caloriesBurned: number;
  isSyncing: boolean;
  syncCalories: () => Promise<void>;
  cancelSync: () => void;
  onShowPaywall: () => void;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  syncButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  syncButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
  },
  unit: {
    fontSize: 13,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyState: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  // Premium upsell
  upsellBody: {
    gap: 10,
  },
  upsellFeatures: {
    gap: 6,
  },
  upsellFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  upsellFeatureText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  upsellButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 2,
  },
  upsellButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  // Syncing state
  syncingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  syncingText: {
    fontSize: 13,
    flex: 1,
  },
  cancelLink: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  cancelLinkText: {
    fontSize: 13,
  },
  // Last sync label
  lastSync: {
    fontSize: 11,
    marginTop: 2,
  },
  // No data state
  noDataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noDataText: {
    fontSize: 13,
  },
  syncSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  syncSecondaryText: {
    fontSize: 13,
  },
});

function ActivityCardSkeleton({ colors }: { colors: any }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  const Box = ({
    w,
    h,
    r = 8,
    style,
  }: {
    w: number | string;
    h: number;
    r?: number;
    style?: object;
  }) => (
    <Animated.View
      style={[
        {
          width: w as any,
          height: h,
          borderRadius: r,
          backgroundColor: "#4a7a66",
          opacity,
        },
        style,
      ]}
    />
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Header row */}
      <View style={[styles.header, { justifyContent: "space-between" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Box w={40} h={40} r={14} />
          <View style={{ gap: 6 }}>
            <Box w={110} h={14} r={6} />
            <Box w={80} h={11} r={5} />
          </View>
        </View>
        <Box w={32} h={32} r={10} />
      </View>

      {/* Value row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Box w={70} h={28} r={8} />
          <Box w={90} h={13} r={5} />
        </View>
        <Box w={95} h={28} r={999} />
      </View>
    </View>
  );
}

function PremiumUpsell({ onShowPaywall }: { onShowPaywall: () => void }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const features = [
    {
      icon: "watch" as const,
      text:
        Platform.OS === "ios"
          ? "Sincroniza calorías quemadas desde tu Apple Watch"
          : "Sincroniza calorías desde tu smartband o wearable",
    },
    {
      icon: "sync" as const,
      text: "Actualización automática cada vez que abres la app",
    },
    {
      icon: "fire" as const,
      text: "Ve tu balance calórico real: consumidas vs. quemadas",
    },
  ];

  return (
    <View style={styles.upsellBody}>
      <View style={styles.upsellFeatures}>
        {features.map((f, i) => (
          <View key={i} style={styles.upsellFeatureRow}>
            <MaterialCommunityIcons
              name={f.icon}
              size={16}
              color={colors.brand}
            />
            <Text
              style={[
                styles.upsellFeatureText,
                {
                  fontFamily: typography.body?.fontFamily,
                  color: colors.textSecondary,
                },
              ]}
            >
              {f.text}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onShowPaywall();
        }}
        style={({ pressed }) => [
          styles.upsellButton,
          {
            backgroundColor: colors.brand,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons name="crown" size={15} color="#fff" />
        <Text
          style={[
            styles.upsellButtonText,
            { fontFamily: typography.subtitle?.fontFamily, color: "#fff" },
          ]}
        >
          Desbloquear con Premium
        </Text>
      </Pressable>
    </View>
  );
}

export function ActivityCard({
  isPremium,
  isLoading = false,
  caloriesBurned,
  isSyncing,
  syncCalories,
  cancelSync,
  onShowPaywall,
}: ActivityCardProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  if (isLoading) {
    return <ActivityCardSkeleton colors={colors} />;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.brand + "15",
              borderColor: colors.brand + "30",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="heart-pulse"
            size={20}
            color={colors.brand}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.title,
              {
                fontFamily: typography.subtitle?.fontFamily,
                color: colors.textPrimary,
              },
            ]}
          >
            Actividad Física
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                fontFamily: typography.body?.fontFamily,
                color: colors.textSecondary,
              },
            ]}
          >
            {Platform.OS === "ios" ? "Apple Health" : "Health Connect"}
            {isPremium && caloriesBurned > 0 && (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                }}
              >
                {" "}
                • Sincroniza automáticamente
              </Text>
            )}
          </Text>
        </View>

        {isPremium && (
          <Pressable
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              try {
                await syncCalories();
              } catch {}
            }}
            disabled={isSyncing}
            style={({ pressed }) => [
              styles.syncButton,
              { borderColor: colors.border, backgroundColor: "transparent" },
              (pressed || isSyncing) && styles.syncButtonPressed,
            ]}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <MaterialCommunityIcons
                name="sync"
                size={16}
                color={colors.textSecondary}
              />
            )}
          </Pressable>
        )}
      </View>

      {/* Body */}
      {isPremium ? (
        <>
          {/* Estado: sincronizando */}
          {isSyncing ? (
            <View style={styles.syncingRow}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text
                style={[
                  styles.syncingText,
                  {
                    fontFamily: typography.body?.fontFamily,
                    color: colors.textSecondary,
                  },
                ]}
              >
                Sincronizando...
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  cancelSync();
                }}
                style={({ pressed }) => [
                  styles.cancelLink,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text
                  style={[
                    styles.cancelLinkText,
                    {
                      fontFamily: typography.body?.fontFamily,
                      color: colors.brand,
                    },
                  ]}
                >
                  Cancelar
                </Text>
              </Pressable>
            </View>
          ) : caloriesBurned > 0 ? (
            /* Estado: datos disponibles */
            <View style={styles.content}>
              <View style={styles.valueContainer}>
                <Text
                  style={[
                    styles.value,
                    {
                      fontFamily: typography.title?.fontFamily,
                      color: colors.textPrimary,
                    },
                  ]}
                >
                  {caloriesBurned.toLocaleString()}
                </Text>
                <View>
                  <Text
                    style={[
                      styles.unit,
                      {
                        fontFamily: typography.body?.fontFamily,
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    kcal quemadas
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: "#10B98115",
                    borderWidth: 1,
                    borderColor: "#10B98130",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={14}
                  color="#10B981"
                />
                <Text
                  style={[
                    styles.badgeText,
                    {
                      fontFamily: typography.body?.fontFamily,
                      color: "#10B981",
                    },
                  ]}
                >
                  Sincronizado
                </Text>
              </View>
            </View>
          ) : (
            /* Estado: sin datos, acción manual requerida */
            <View style={styles.noDataRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.noDataText,
                    {
                      fontFamily: typography.body?.fontFamily,
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  Sin datos de actividad hoy
                </Text>
              </View>
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  try {
                    await syncCalories();
                  } catch (error) {
                    console.log("[ActivityCard] Sync error:", error);
                  }
                }}
                style={({ pressed }) => [
                  styles.syncSecondaryBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                ]}
              >
                <MaterialCommunityIcons
                  name="sync"
                  size={14}
                  color={colors.brand}
                />
                <Text
                  style={[
                    styles.syncSecondaryText,
                    {
                      fontFamily: typography.subtitle?.fontFamily,
                      color: colors.brand,
                    },
                  ]}
                >
                  Sincronizar
                </Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <PremiumUpsell onShowPaywall={onShowPaywall} />
      )}
    </View>
  );
}
