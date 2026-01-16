import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { foodLogRepository } from "@/data/food/foodLogRepository";
import { openFoodFactsService } from "@/data/openfoodfacts/openFoodFactsService";
import type { MealType } from "@/domain/models/foodLogDb";
import type { OffProduct } from "@/domain/models/offProduct";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { todayStrLocal } from "@/presentation/utils/date";
import { MEAL_LABELS } from "@/presentation/utils/mealLabels";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toFloatSafe(s: string) {
  const normalized = s.replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function computeFrom100g(p: OffProduct, grams: number) {
  const factor = grams / 100;

  const kcal = Math.round((p.kcal_100g ?? 0) * factor);
  const protein = Math.round((p.protein_100g ?? 0) * factor);
  const carbs = Math.round((p.carbs_100g ?? 0) * factor);
  const fat = Math.round((p.fat_100g ?? 0) * factor);

  return { kcal, protein, carbs, fat };
}

export default function AddFoodScreen() {
  const day = todayStrLocal();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [results, setResults] = useState<OffProduct[]>([]);
  const [selected, setSelected] = useState<OffProduct | null>(null);

  const [gramsStr, setGramsStr] = useState("100");
  const gramsNum = useMemo(() => toFloatSafe(gramsStr), [gramsStr]);

  const [meal, setMeal] = useState<MealType>("snack");

  const [isSearching, setIsSearching] = useState(false);


  // Debounce search
useEffect(() => {
  setErr(null);

  const q = query.trim();
  if (q.length < 2) {
    setResults([]);
    setIsSearching(false);
    return;
  }

  setIsSearching(true);

  const t = setTimeout(async () => {
    const res = await openFoodFactsService.search({
      query: q,
      page: 1,
      pageSize: 20,
    });

    if (!res.ok) {
      setErr(res.message);
      setResults([]);
      setIsSearching(false);
      return;
    }

    setResults(res.data.items);
    setIsSearching(false);
  }, 450);

  return () => clearTimeout(t);
}, [query]);


  const gramsError = useMemo(() => {
    if (!gramsStr.trim()) return "Ingresa gramos";
    if (!Number.isFinite(gramsNum)) return "Valor inválido";
    if (gramsNum <= 0) return "Debe ser > 0";
    if (gramsNum > 2000) return "Demasiado alto (máx 2000g)";
    return null;
  }, [gramsStr, gramsNum]);

  const preview = useMemo(() => {
    if (!selected) return null;
    const g = Number.isFinite(gramsNum) ? clamp(gramsNum, 1, 2000) : 100;
    return computeFrom100g(selected, g);
  }, [selected, gramsNum]);

  async function onAdd() {
    if (!selected) return;
    setErr(null);

    if (gramsError) {
      setErr(gramsError);
      return;
    }

    if (!preview) return;

    setLoading(true);
    const res = await foodLogRepository.create({
      day,
      meal,
      name: selected.name,
      calories: preview.kcal,
      protein_g: preview.protein,
      carbs_g: preview.carbs,
      fat_g: preview.fat,
    });

    setLoading(false);

    if (!res.ok) {
      setErr(res.message ?? "No pudimos guardar el alimento.");
      return;
    }

    Alert.alert("Agregado ✅", "Se agregó al diario de hoy.", [
      { text: "OK", onPress: () => router.replace("/(tabs)/diary") },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Agregar alimento</Text>
      <Text style={styles.subtitle}>
        Busca en OpenFoodFacts y registra gramos.
      </Text>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (selected) setSelected(null);
          }}
          placeholder="Ej: yogurt, arroz, leche..."
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          style={styles.input}
        />
      </View>

      {isSearching && !selected && (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 6, color: "#6B7280" }}>Buscando...</Text>
        </View>
      )}

      {!!err && <Text style={styles.error}>{err}</Text>}

      {/* Selector meal (simple MVP) */}
      <View style={styles.mealRow}>
        {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((m) => {
          const active = meal === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMeal(m)}
              style={[styles.mealChip, active && styles.mealChipActive]}
            >
              <Text
                style={[
                  styles.mealChipText,
                  active && styles.mealChipTextActive,
                ]}
              >
                {MEAL_LABELS[m]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Lista resultados */}
      {!selected && (
        <ScrollView>
          <View style={{ marginTop: 10, gap: 10 }}>
            {results.map((it) => (
              <Pressable
                key={it.id}
                style={styles.result}
                onPress={() => setSelected(it)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {it.brand ? it.brand : "Sin marca"} · {it.kcal_100g ?? "?"}{" "}
                    kcal / 100g
                  </Text>
                </View>
                <Text style={styles.resultArrow}>›</Text>
              </Pressable>
            ))}

            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <Text style={styles.empty}>
                Sin resultados. Prueba otro término.
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* Detalle seleccionado */}
      {selected && (
        <View style={styles.card}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {selected.name}
          </Text>
          <Text style={styles.cardMeta}>
            {selected.brand ? selected.brand : "Sin marca"} · Base: 100g
          </Text>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Gramos consumidos</Text>
            <TextInput
              value={gramsStr}
              onChangeText={setGramsStr}
              keyboardType="numeric"
              style={styles.gramsInput}
              placeholder="100"
              placeholderTextColor="#9CA3AF"
            />
            {!!gramsError && (
              <Text style={styles.errorSmall}>{gramsError}</Text>
            )}
          </View>

          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Estimación</Text>
            <Text style={styles.previewRow}>
              Calorías: <Text style={styles.bold}>{preview?.kcal ?? 0}</Text>
            </Text>
            <Text style={styles.previewRow}>
              Proteína:{" "}
              <Text style={styles.bold}>{preview?.protein ?? 0}g</Text>
            </Text>
            <Text style={styles.previewRow}>
              Carbs: <Text style={styles.bold}>{preview?.carbs ?? 0}g</Text>
            </Text>
            <Text style={styles.previewRow}>
              Grasas: <Text style={styles.bold}>{preview?.fat ?? 0}g</Text>
            </Text>
          </View>

          <PrimaryButton
            title={loading ? "Agregando..." : "Agregar al diario"}
            onPress={onAdd}
            loading={loading}
            disabled={loading}
          />

          <Pressable
            onPress={() => setSelected(null)}
            style={{ marginTop: 10 }}
          >
            <Text style={styles.backLink}>← Volver a resultados</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, backgroundColor: "#F9FAFB" },
  title: { fontSize: 28, fontWeight: "800", color: "#111827", marginTop: 10 },
  subtitle: { marginTop: 6, color: "#6B7280" },

  searchBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "white",
    paddingHorizontal: 12,
  },
  input: { paddingVertical: 12, color: "#111827" },

  error: { marginTop: 10, color: "#EF4444" },
  errorSmall: { marginTop: 6, color: "#EF4444", fontSize: 12 },

  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  mealChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
  },
  mealChipActive: { borderColor: "#111827" },
  mealChipText: { color: "#374151", fontWeight: "700", fontSize: 12 },
  mealChipTextActive: { color: "#111827" },

  result: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultName: { fontWeight: "800", color: "#111827" },
  resultMeta: { color: "#6B7280", marginTop: 4, fontSize: 12 },
  resultArrow: { color: "#9CA3AF", fontSize: 22, paddingHorizontal: 6 },

  empty: { color: "#6B7280", textAlign: "center", marginTop: 16 },

  card: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
  },
  cardTitle: { fontWeight: "900", color: "#111827", fontSize: 16 },
  cardMeta: { marginTop: 6, color: "#6B7280" },

  label: { color: "#374151", fontWeight: "800" },
  gramsInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
  },

  previewBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  previewTitle: { fontWeight: "900", color: "#111827", marginBottom: 8 },
  previewRow: { color: "#374151", marginTop: 6 },
  bold: { fontWeight: "900", color: "#111827" },

  backLink: { color: "#374151", textAlign: "center", fontWeight: "800" },
});
