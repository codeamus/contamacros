import Skeleton from "@/presentation/components/ui/Skeleton";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ActivityCardProps = {
  caloriesBurned: number;
  isSyncing: boolean;
  syncCalories: () => Promise<void>;
  cancelSync: () => void;
  onOpenSettings: () => void;
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
    opacity: 0.7,
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
});

export function ActivityCard({
  caloriesBurned,
  isSyncing,
  syncCalories,
  cancelSync,
  onOpenSettings,
}: ActivityCardProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

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
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.brand + "15", borderColor: colors.brand + "30" },
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
            {caloriesBurned > 0 && (
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
      </View>

      <View style={styles.content}>
        <View style={styles.valueContainer}>
          {isSyncing ? (
            <>
              <Skeleton
                height={32}
                width={80}
                radius={8}
                bg={colors.border}
                highlight={colors.border}
                style={{ marginBottom: 4 }}
              />
              <Skeleton
                height={14}
                width={100}
                radius={6}
                bg={colors.border}
                highlight={colors.border}
                style={{ opacity: 0.7 }}
              />
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.value,
                  {
                    fontFamily: typography.title?.fontFamily,
                    color: colors.textPrimary,
                  },
                ]}
              >
                {caloriesBurned > 0 ? caloriesBurned.toLocaleString() : "—"}
              </Text>
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
            </>
          )}
        </View>
        {caloriesBurned > 0 && !isSyncing && (
          <View
            style={[
              styles.badge,
              { backgroundColor: "#10B98115", borderWidth: 1, borderColor: "#10B98130" },
            ]}
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={14}
              color="#10B981"
            />
            <Text style={[styles.badgeText, { fontFamily: typography.body?.fontFamily, color: "#10B981" }]}>
              Sincronizado
            </Text>
          </View>
        )}
      </View>

      {caloriesBurned === 0 && (
        <>
          {isSyncing ? (
            <View style={[styles.emptyState, { borderTopColor: colors.border }]}>
              <Text
                style={[
                  styles.emptyText,
                  { fontFamily: typography.body?.fontFamily, color: colors.textSecondary },
                ]}
              >
                Buscando datos...
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  cancelSync();
                }}
                style={({ pressed }) => [
                  { marginTop: 10, paddingVertical: 6, paddingHorizontal: 12 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.emptyText,
                    {
                      fontFamily: typography.body?.fontFamily,
                      color: colors.brand,
                      fontSize: 13,
                    },
                  ]}
                >
                  Cancelar
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onOpenSettings}
              style={({ pressed }) => [
                styles.emptyState,
                { borderTopColor: colors.border },
                {
                  backgroundColor: `${colors.brand}14`,
                  borderWidth: 1,
                  borderColor: `${colors.brand}40`,
                  borderRadius: 12,
                  paddingVertical: 20,
                  paddingHorizontal: 20,
                  marginHorizontal: 4,
                  minHeight: 72,
                  justifyContent: "center",
                },
                pressed && {
                  opacity: 0.85,
                  backgroundColor: `${colors.brand}22`,
                },
              ]}
            >
              <Text
                style={[
                  styles.emptyText,
                  {
                    fontFamily: typography.body?.fontFamily,
                    fontWeight: "600",
                    color: colors.brand,
                    fontSize: 15,
                    lineHeight: 22,
                  },
                ]}
                numberOfLines={2}
              >
                Configurar permisos de salud en Ajustes
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}
