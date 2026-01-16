import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { FoodLogDb, MealType } from "@/domain/models/foodLogDb";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { todayStrLocal } from "@/presentation/utils/date";
import { MEAL_LABELS } from "@/presentation/utils/mealLabels";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function sumLogs(logs: FoodLogDb[]) {
  return logs.reduce(
    (acc, it) => {
      acc.calories += it.calories || 0;
      acc.protein += it.protein_g || 0;
      acc.carbs += it.carbs_g || 0;
      acc.fat += it.fat_g || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function groupByMeal(logs: FoodLogDb[]) {
  const map: Record<MealType, FoodLogDb[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const it of logs) map[it.meal].push(it);
  return map;
}

export default function DiaryScreen() {
  const { profile } = useAuth();
  const day = todayStrLocal();

  const [logs, setLogs] = useState<FoodLogDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => sumLogs(logs), [logs]);
  const grouped = useMemo(() => groupByMeal(logs), [logs]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const res = await foodLogRepository.listByDay(day);
    if (!res.ok) {
      setErr(res.message);
      setLogs([]);
      setLoading(false);
      return;
    }

    setLogs(res.data);
    setLoading(false);
  }, [day]);

  // ✅ se ejecuta al entrar y al volver desde add-food
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onDelete(id: string) {
    Alert.alert("Eliminar", "¿Eliminar este item del diario?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const res = await foodLogRepository.remove(id);
          if (!res.ok) {
            setErr(res.message);
            return;
          }
          setLogs((prev) => prev.filter((x) => x.id !== id));
        },
      },
    ]);
  }

  const targetKcal = profile?.daily_calorie_target ?? null;
  const targetP = profile?.protein_g ?? null;
  const targetC = profile?.carbs_g ?? null;
  const targetF = profile?.fat_g ?? null;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Diario</Text>
      <Text style={styles.subtitle}>{day}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen de hoy</Text>

        <Text style={styles.row}>
          Calorías:{" "}
          <Text style={styles.strong}>
            {totals.calories}
            {targetKcal ? ` / ${targetKcal}` : ""}
          </Text>
        </Text>

        <Text style={styles.row}>
          Proteína:{" "}
          <Text style={styles.strong}>
            {totals.protein}g{targetP ? ` / ${targetP}g` : ""}
          </Text>
        </Text>

        <Text style={styles.row}>
          Carbs:{" "}
          <Text style={styles.strong}>
            {totals.carbs}g{targetC ? ` / ${targetC}g` : ""}
          </Text>
        </Text>

        <Text style={styles.row}>
          Grasas:{" "}
          <Text style={styles.strong}>
            {totals.fat}g{targetF ? ` / ${targetF}g` : ""}
          </Text>
        </Text>
      </View>

      {!!err && <Text style={styles.error}>{err}</Text>}

      <PrimaryButton
        title={loading ? "Cargando..." : "+ Añadir"}
        onPress={() => router.push("/(tabs)/add-food")}
        disabled={loading}
      />

      <View style={{ marginTop: 14, gap: 14 }}>
        {MEAL_ORDER.map((m) => {
          const items = grouped[m];
          if (!items.length) return null;

          return (
            <View key={m} style={{ gap: 10 }}>
              <Text
                style={{ fontWeight: "900", color: "#111827", marginTop: 6 }}
              >
                {MEAL_LABELS[m]}
              </Text>

              {items.map((it) => (
                <Pressable
                  key={it.id}
                  style={styles.item}
                  onLongPress={() => onDelete(it.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemMeta}>
                      {it.calories} kcal · P {it.protein_g} / C {it.carbs_g} / F{" "}
                      {it.fat_g}
                    </Text>
                  </View>
                  <Text style={styles.itemChevron}>⋯</Text>
                </Pressable>
              ))}
            </View>
          );
        })}

        {!loading && logs.length === 0 && (
          <Text
            style={{ color: "#6B7280", textAlign: "center", marginTop: 12 }}
          >
            Aún no has registrado comidas hoy.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, backgroundColor: "#F9FAFB" },
  title: { fontSize: 28, fontWeight: "800", color: "#111827", marginTop: 12 },
  subtitle: { marginTop: 6, color: "#6B7280" },

  card: {
    marginTop: 14,
    padding: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
  },
  cardTitle: { fontWeight: "800", color: "#111827", marginBottom: 8 },
  row: { color: "#374151", marginTop: 6 },
  strong: { fontWeight: "800", color: "#111827" },

  error: { color: "#EF4444", marginTop: 10 },

  item: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemName: { fontWeight: "800", color: "#111827" },
  itemMeta: { color: "#6B7280", marginTop: 4, fontSize: 12 },
  itemChevron: { color: "#9CA3AF", fontSize: 22, paddingHorizontal: 6 },
});
