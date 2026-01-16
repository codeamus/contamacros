// app/(tabs)/home.tsx
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function HomeScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  // Placeholder data (después viene de DB/state)
  const caloriesConsumed = 1420;
  const caloriesTarget = 2100;
  const remaining = Math.max(caloriesTarget - caloriesConsumed, 0);

  const protein = { value: 98, target: 140 };
  const carbs = { value: 160, target: 220 };
  const fat = { value: 45, target: 70 };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerKicker}>Diario</Text>
            <Text style={s.headerTitle}>Hoy</Text>
          </View>

          <Pressable
            style={s.headerIconBtn}
            onPress={() => {
              /* luego: settings o calendar */
            }}
          >
            <Feather name="calendar" size={18} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            style={s.headerIconBtn}
            onPress={() => {
              /* luego: settings */
            }}
          >
            <Feather name="settings" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Summary Cards */}
        <View style={s.summaryRow}>
          <MiniStat
            title="Restantes"
            value={`${remaining}`}
            unit="kcal"
            icon={
              <MaterialCommunityIcons
                name="target"
                size={18}
                color={colors.brand}
              />
            }
            colors={colors}
            typography={typography}
          />
          <MiniStat
            title="Consumidas"
            value={`${caloriesConsumed}`}
            unit="kcal"
            icon={
              <MaterialCommunityIcons
                name="fire"
                size={18}
                color={colors.cta}
              />
            }
            colors={colors}
            typography={typography}
          />
        </View>

        {/* Main Calories Card */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <View style={s.cardHeaderLeft}>
              <View style={s.badge}>
                <MaterialCommunityIcons
                  name="fire"
                  size={18}
                  color={colors.onCta}
                />
              </View>
              <Text style={s.cardTitle}>Calorías</Text>
            </View>

            <View style={s.chip}>
              <Feather name="flag" size={14} color={colors.textSecondary} />
              <Text style={s.chipText}>{caloriesTarget} kcal</Text>
            </View>
          </View>

          <Text style={s.bigValue}>
            {caloriesConsumed}
            <Text style={s.bigUnit}> kcal</Text>
          </Text>

          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                {
                  width: `${Math.min(
                    (caloriesConsumed / caloriesTarget) * 100,
                    100
                  )}%`,
                },
              ]}
            />
          </View>

          <View style={s.hintRow}>
            <Feather name="info" size={14} color={colors.textSecondary} />
            <Text style={s.hintText}>
              {remaining} kcal para llegar a tu objetivo
            </Text>
          </View>
        </View>

        {/* Macros */}
        <View style={s.sectionHeader}>
          <View style={s.sectionTitleRow}>
            <MaterialCommunityIcons
              name="chart-donut"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={s.sectionTitle}>Macros</Text>
          </View>
          <Pressable
            onPress={() => {
              /* luego: detalles */
            }}
          >
            <Text style={s.sectionAction}>Ver detalle</Text>
          </Pressable>
        </View>

        <View style={s.macrosRow}>
          <MacroCard
            label="Proteína"
            icon="food-steak"
            value={protein.value}
            target={protein.target}
            colors={colors}
            typography={typography}
          />
          <MacroCard
            label="Carbs"
            icon="bread-slice"
            value={carbs.value}
            target={carbs.target}
            colors={colors}
            typography={typography}
          />
          <MacroCard
            label="Grasas"
            icon="peanut"
            value={fat.value}
            target={fat.target}
            colors={colors}
            typography={typography}
          />
        </View>

        {/* Meals */}
        <View style={s.sectionHeader}>
          <View style={s.sectionTitleRow}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={s.sectionTitle}>Comidas</Text>
          </View>
          <Pressable
            onPress={() => {
              /* luego: historial del día */
            }}
          >
            <Text style={s.sectionAction}>Ver todo</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <MealRow
            title="Desayuno"
            icon="coffee"
            subtitle="Sin registros"
            colors={colors}
            typography={typography}
            onAdd={() =>
              router.push({
                pathname: "/(tabs)/add-food",
                params: { meal: "breakfast" },
              })
            }
          />
          <View style={s.divider} />
          <MealRow
            title="Almuerzo"
            icon="food"
            subtitle="Sin registros"
            colors={colors}
            typography={typography}
            onAdd={() =>
              router.push({
                pathname: "/(tabs)/add-food",
                params: { meal: "lunch" },
              })
            }
          />
          <View style={s.divider} />
          <MealRow
            title="Cena"
            icon="food-variant"
            subtitle="Sin registros"
            colors={colors}
            typography={typography}
            onAdd={() =>
              router.push({
                pathname: "/(tabs)/add-food",
                params: { meal: "dinner" },
              })
            }
          />
        </View>

        {/* bottom spacer for FAB */}
        <View style={{ height: 86 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={s.fab}>
        <PrimaryButton
          title="Agregar comida"
          onPress={() => {
            // siguiente: /(tabs)/add-meal (screen) o modal
          }}
          icon={<Feather name="plus" size={18} color={colors.onCta} />}
        />
      </View>
    </SafeAreaView>
  );
}

function MiniStat({
  title,
  value,
  unit,
  icon,
  colors,
  typography,
}: {
  title: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  colors: any;
  typography: any;
}) {
  return (
    <View
      style={[
        mini.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={mini.row}>
        <View style={[mini.iconWrap, { borderColor: colors.border }]}>
          {icon}
        </View>
        <Text
          style={[
            mini.title,
            {
              color: colors.textSecondary,
              fontFamily: typography.body?.fontFamily,
            },
          ]}
        >
          {title}
        </Text>
      </View>
      <Text
        style={[
          mini.value,
          {
            color: colors.textPrimary,
            fontFamily: typography.subtitle?.fontFamily,
          },
        ]}
      >
        {value}{" "}
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.body?.fontFamily,
            fontSize: 12,
          }}
        >
          {unit}
        </Text>
      </Text>
    </View>
  );
}

const mini = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  title: { fontSize: 13 },
  value: { fontSize: 18 },
});

function MacroCard({
  label,
  icon,
  value,
  target,
  colors,
  typography,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  value: number;
  target: number;
  colors: any;
  typography: any;
}) {
  const pct = Math.min(value / target, 1);

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
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
      </View>

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

      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${pct * 100}%`,
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
        de {target} g
      </Text>
    </View>
  );
}

function MealRow({
  title,
  icon,
  subtitle,
  colors,
  typography,
  onAdd,
}: {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  subtitle: string;
  colors: any;
  typography: any;
  onAdd: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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

      <Pressable
        onPress={onAdd}
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
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { padding: 18, gap: 14 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 2,
    },
    headerKicker: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    headerTitle: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 28,
      color: colors.textPrimary,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    summaryRow: { flexDirection: "row", gap: 10 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },

    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },

    badge: {
      width: 34,
      height: 34,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cta,
      borderWidth: 1,
      borderColor: colors.border,
    },

    cardTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },

    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      height: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    chipText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    bigValue: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 34,
      color: colors.textPrimary,
    },
    bigUnit: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },

    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressFill: { height: "100%", backgroundColor: colors.brand },

    hintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    hintText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    sectionAction: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.brand,
    },

    macrosRow: { flexDirection: "row", gap: 10 },

    divider: { height: 1, backgroundColor: colors.border, opacity: 0.7 },

    fab: { position: "absolute", left: 18, right: 18, bottom: 18 },
  });
}
