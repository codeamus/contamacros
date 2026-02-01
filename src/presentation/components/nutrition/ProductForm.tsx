// src/presentation/components/nutrition/ProductForm.tsx
// Formulario para productos que no existen en Open Food Facts (inserción en generic_foods).

import type { GenericFoodDb } from "@/data/food/genericFoodsRepository";
import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export type BaseUnit = "g" | "ml";

function parseFloatInput(s: string): number {
  const normalized = s
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export type ProductFormProps = {
  /** Código de barras pre-llenado desde el scanner (solo lectura). */
  barcode: string;
  /** Llamado al guardar con éxito; recibe el alimento creado. */
  onSuccess: (food: GenericFoodDb) => void;
  /** Llamado al cancelar (opcional). */
  onCancel?: () => void;
  /** Texto del botón principal. */
  submitLabel?: string;
};

export default function ProductForm({
  barcode,
  onSuccess,
  onCancel,
  submitLabel = "Crear",
}: ProductFormProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [baseUnit, setBaseUnit] = useState<BaseUnit>("g");
  const [nameEs, setNameEs] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  
  // Unit support
  const [isUnit, setIsUnit] = useState(false);
  const [gramsPerUnit, setGramsPerUnit] = useState("");
  const [unitLabel, setUnitLabel] = useState("1 unidad");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, kcal: false, gramsPerUnit: false });

  const unitSuffix = baseUnit === "ml" ? "100 ml" : "100 g";
  const unitLabelShort = baseUnit === "ml" ? "por 100 ml" : "por 100 g";

  const nameValid = nameEs.trim().length >= 2;
  const kcalNum = useMemo(() => parseFloatInput(kcal), [kcal]);
  const kcalValid = kcalNum >= 0;
  
  const gPerUnitNum = parseFloatInput(gramsPerUnit);
  const unitValid = !isUnit || (gPerUnitNum > 0 && unitLabel.trim().length > 0);

  const showNameError = touched.name && !nameValid;
  const showKcalError = touched.kcal && (kcal.trim() === "" || kcalNum < 0);
  const showUnitError = isUnit && touched.gramsPerUnit && gPerUnitNum <= 0;

  const canSubmit =
    nameValid &&
    kcalValid &&
    unitValid &&
    barcode.trim().length > 0 &&
    !saving &&
    parseFloatInput(protein) >= 0 &&
    parseFloatInput(carbs) >= 0 &&
    parseFloatInput(fat) >= 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setSaving(true);

    const res = await genericFoodsRepository.createByBarcode({
      name_es: nameEs.trim(),
      barcode: barcode.trim(),
      base_unit: baseUnit,
      kcal_100g: Math.round(kcalNum),
      protein_100g: parseFloatInput(protein),
      carbs_100g: parseFloatInput(carbs),
      fat_100g: parseFloatInput(fat),
      grams_per_unit: isUnit ? gPerUnitNum : undefined,
      unit_label_es: isUnit ? unitLabel : undefined,
    });

    setSaving(false);

    if (!res.ok) {
      setError(res.message ?? "No se pudo crear el producto.");
      return;
    }

    onSuccess(res.data);
  }, [
    canSubmit,
    nameEs,
    barcode,
    baseUnit,
    kcalNum,
    protein,
    carbs,
    fat,
    isUnit,
    gPerUnitNum,
    unitLabel,
    onSuccess,
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        scrollContent: {
          padding: 24,
          paddingBottom: 40,
        },
        sectionTitle: {
          fontFamily: typography.subtitle?.fontFamily,
          fontSize: 13,
          color: colors.textSecondary,
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        row: {
          marginBottom: 20,
        },
        label: {
          fontFamily: typography.body?.fontFamily,
          fontSize: 14,
          color: colors.textPrimary,
          marginBottom: 8,
        },
        unitToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        unitToggleText: {
            fontFamily: typography.body?.fontFamily,
            fontSize: 16,
            color: colors.textPrimary,
        },
        unitContainer: {
            marginTop: 8,
            paddingLeft: 12,
            borderLeftWidth: 2,
            borderLeftColor: colors.border,
        },
        segmentRow: {
          flexDirection: "row",
          gap: 12,
        },
        segment: {
          flex: 1,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 14,
          borderWidth: 1.5,
          alignItems: "center",
          justifyContent: "center",
        },
        input: {
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontFamily: typography.body?.fontFamily,
          fontSize: 16,
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          minHeight: 48,
        },
        inputLocked: {
          backgroundColor: colors.border + "20",
          color: colors.textSecondary,
        },
        inputError: {
          borderColor: "#EF4444",
        },
        errorText: {
          fontFamily: typography.body?.fontFamily,
          fontSize: 12,
          color: "#EF4444",
          marginTop: 6,
        },
        actions: {
          flexDirection: "row",
          gap: 14,
          marginTop: 28,
        },
        cancelBtn: {
          flex: 1,
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
        },
      }),
    [colors, typography],
  );

  const segmentStyle = useCallback(
    (active: boolean) => [
      styles.segment,
      {
        backgroundColor: active ? colors.cta : colors.surface,
        borderColor: colors.border,
      },
    ],
    [styles, colors.cta, colors.surface, colors.border],
  );
  const segmentTextStyle = useCallback(
    (active: boolean) => ({
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: active ? colors.onCta : colors.textSecondary,
    }),
    [typography, colors.onCta, colors.textSecondary],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Unidad base: Gramos / Mililitros */}
        <Text style={styles.sectionTitle}>Unidad</Text>
        <View style={[styles.row, styles.segmentRow]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBaseUnit("g");
            }}
            style={({ pressed }) => [
              ...segmentStyle(baseUnit === "g"),
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={segmentTextStyle(baseUnit === "g")}>Gramos (g)</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBaseUnit("ml");
            }}
            style={({ pressed }) => [
              ...segmentStyle(baseUnit === "ml"),
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={segmentTextStyle(baseUnit === "ml")}>
              Mililitros (ml)
            </Text>
          </Pressable>
        </View>

        {/* Toggle para Unidad */}
        <Pressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsUnit(!isUnit);
            }}
            style={({ pressed }) => [
                styles.unitToggle,
                isUnit && { borderColor: colors.brand, backgroundColor: colors.brand + "10" },
                pressed && { opacity: 0.7 }
            ]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Feather name={isUnit ? "check-circle" : "circle"} size={20} color={isUnit ? colors.brand : colors.textSecondary} />
                <Text style={styles.unitToggleText}>¿Viene por unidades? (ej: huevo)</Text>
            </View>
        </Pressable>

        {isUnit && (
            <View style={[styles.row, styles.unitContainer]}>
                <View style={{ marginBottom: 16 }}>
                    <Text style={styles.label}>Peso de 1 unidad ({baseUnit}) *</Text>
                    <TextInput
                        style={[styles.input, showUnitError && styles.inputError]}
                        value={gramsPerUnit}
                        onChangeText={setGramsPerUnit}
                        placeholder={baseUnit === "g" ? "Ej: 50" : "Ej: 200"}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="decimal-pad"
                        onBlur={() => setTouched(p => ({ ...p, gramsPerUnit: true }))}
                    />
                    {showUnitError && (
                        <Text style={styles.errorText}>Ingresa el peso mayor a 0</Text>
                    )}
                </View>
                
                <View>
                    <Text style={styles.label}>Nombre de la unidad</Text>
                    <TextInput
                        style={styles.input}
                        value={unitLabel}
                        onChangeText={setUnitLabel}
                        placeholder="Ej: 1 huevo, 1 rebanada"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>
            </View>
        )}

        {/* Nombre (obligatorio) */}
        <Text style={styles.sectionTitle}>Datos del producto</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nombre del producto *</Text>
          <TextInput
            style={[styles.input, showNameError && styles.inputError]}
            value={nameEs}
            onChangeText={(t) => {
              setNameEs(t);
              setError(null);
            }}
            onBlur={() => setTouched((p) => ({ ...p, name: true }))}
            placeholder="Ej: Leche descremada"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="sentences"
            accessibilityLabel="Nombre del producto"
          />
          {showNameError && (
            <Text style={styles.errorText}>Escribe al menos 2 caracteres</Text>
          )}
        </View>

        {/* Código de barras (solo lectura) */}
        <View style={styles.row}>
          <Text style={styles.label}>Código de barras</Text>
          <TextInput
            style={[styles.input, styles.inputLocked]}
            value={barcode}
            editable={false}
            placeholder="—"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Código de barras"
          />
        </View>

        {/* Valores nutricionales por 100g / 100ml */}
        <Text style={styles.sectionTitle}>Valores por {unitSuffix}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Calorías (kcal) *</Text>
          <TextInput
            style={[styles.input, showKcalError && styles.inputError]}
            value={kcal}
            onChangeText={(t) => {
              setKcal(t);
              setError(null);
            }}
            onBlur={() => setTouched((p) => ({ ...p, kcal: true }))}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            accessibilityLabel={`Calorías por ${unitSuffix}`}
          />
          {showKcalError && (
            <Text style={styles.errorText}>
              Las calorías son obligatorias y deben ser ≥ 0
            </Text>
          )}
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Proteínas (g {unitLabelShort})</Text>
          <TextInput
            style={styles.input}
            value={protein}
            onChangeText={setProtein}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Carbohidratos (g {unitLabelShort})</Text>
          <TextInput
            style={styles.input}
            value={carbs}
            onChangeText={setCarbs}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Grasas (g {unitLabelShort})</Text>
          <TextInput
            style={styles.input}
            value={fat}
            onChangeText={setFat}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>

        {error ? (
          <View style={styles.row}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {onCancel && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCancel();
              }}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.subtitle?.fontFamily,
                  fontSize: 15,
                }}
              >
                Cancelar
              </Text>
            </Pressable>
          )}
          <PrimaryButton
            title={saving ? "Guardando..." : submitLabel}
            onPress={handleSubmit}
            loading={saving}
            disabled={!canSubmit}
            icon={<Feather name="check" size={18} color={theme.colors.onCta} />}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
