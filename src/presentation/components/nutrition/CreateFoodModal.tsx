// src/presentation/components/nutrition/CreateFoodModal.tsx
import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import { GamificationService } from "@/domain/services/gamificationService";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type CreateFoodModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialName?: string;
};

type PortionUnit = "gr" | "ml" | "unidad";

export default function CreateFoodModal({
  visible,
  onClose,
  onSuccess,
  initialName = "",
}: CreateFoodModalProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const s = makeStyles(colors, typography);

  const [name, setName] = useState(initialName);
  const [portionBase, setPortionBase] = useState("100");
  const [portionUnit, setPortionUnit] = useState<PortionUnit>("gr");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [gramsPerUnit, setGramsPerUnit] = useState("");
  const [unitLabel, setUnitLabel] = useState("unidad");
  const [saving, setSaving] = useState(false);

  // Calcular calorías automáticamente
  const calculatedCalories = useMemo(() => {
    const p = parseFloat(protein) || 0;
    const c = parseFloat(carbs) || 0;
    const f = parseFloat(fat) || 0;
    // Fórmula: Proteínas × 4 + Carbohidratos × 4 + Grasas × 9
    return p * 4 + c * 4 + f * 9;
  }, [protein, carbs, fat]);

  // Calcular valores por 100g basados en la cantidad base
  const macrosPer100g = useMemo(() => {
    const p = parseFloat(protein) || 0;
    const c = parseFloat(carbs) || 0;
    const f = parseFloat(fat) || 0;

    // Si es "unidad", usar gramsPerUnit para calcular valores por 100g
    if (portionUnit === "unidad") {
      const gramsPerUnitValue = parseFloat(gramsPerUnit) || 0;
      if (gramsPerUnitValue <= 0) return { protein: 0, carbs: 0, fat: 0 };

      // Los macros ingresados son por 1 unidad (que pesa gramsPerUnitValue gramos)
      // Necesitamos convertir a valores por 100g
      // Fórmula: (macro_por_unidad / grams_per_unit) * 100
      const factor = 100 / gramsPerUnitValue;
      return {
        protein: p * factor,
        carbs: c * factor,
        fat: f * factor,
      };
    }

    // Si es "gr" o "ml", usar portionBase directamente
    const base = parseFloat(portionBase) || 100;
    if (base <= 0) return { protein: 0, carbs: 0, fat: 0 };

    // Normalizar a 100g
    const factor = 100 / base;
    return {
      protein: p * factor,
      carbs: c * factor,
      fat: f * factor,
    };
  }, [portionBase, portionUnit, gramsPerUnit, protein, carbs, fat]);

  const canSave = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      parseFloat(portionBase) > 0 &&
      (parseFloat(protein) >= 0 || parseFloat(carbs) >= 0 || parseFloat(fat) >= 0) &&
      (portionUnit !== "unidad" || (parseFloat(gramsPerUnit) > 0 && unitLabel.trim().length > 0))
    );
  }, [name, portionBase, protein, carbs, fat, portionUnit, gramsPerUnit, unitLabel]);

  const handleSave = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await genericFoodsRepository.create({
        name_es: name.trim(),
        portion_base: parseFloat(portionBase),
        portion_unit: portionUnit,
        protein_100g: macrosPer100g.protein,
        carbs_100g: macrosPer100g.carbs,
        fat_100g: macrosPer100g.fat,
        grams_per_unit: portionUnit === "unidad" ? parseFloat(gramsPerUnit) : null,
        unit_label_es: portionUnit === "unidad" ? unitLabel.trim() : null,
      });

      if (!result.ok) {
        throw new Error(result.message || "Error al crear el alimento");
      }

      // Registrar aporte en gamificación (+50 XP)
      await GamificationService.recordFoodContribution();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        message: "¡Alimento creado! +50 XP ganados 🎉",
        type: "success",
        duration: 3000,
      });

      // Resetear formulario
      setName("");
      setPortionBase("100");
      setPortionUnit("gr");
      setProtein("");
      setCarbs("");
      setFat("");
      setGramsPerUnit("");
      setUnitLabel("unidad");

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("[CreateFoodModal] Error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        message: error instanceof Error ? error.message : "Error al crear el alimento",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.title}>Agregar Alimento a la Comunidad</Text>
            <Pressable onPress={onClose} style={s.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <ScrollView
            style={s.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Nombre del alimento */}
            <View style={s.fieldContainer}>
              <Text style={s.label}>Nombre del alimento *</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Pastel de Jaiba"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />
            </View>

            {/* Cantidad base y unidad */}
            <View style={s.row}>
              <View style={[s.fieldContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={s.label}>Cantidad base *</Text>
                <TextInput
                  style={s.input}
                  value={portionBase}
                  onChangeText={setPortionBase}
                  placeholder="100"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[s.fieldContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={s.label}>Unidad *</Text>
                <View style={s.unitSelector}>
                  {(["gr", "ml", "unidad"] as PortionUnit[]).map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPortionUnit(unit);
                      }}
                      style={[
                        s.unitOption,
                        portionUnit === unit && s.unitOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          s.unitOptionText,
                          portionUnit === unit && s.unitOptionTextSelected,
                        ]}
                      >
                        {unit === "gr" ? "gr" : unit === "ml" ? "ml" : "unidad"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Campo extra para unidad */}
            {portionUnit === "unidad" && (
              <View style={s.fieldContainer}>
                <Text style={s.label}>¿Cuántos gramos pesa una unidad? *</Text>
                <View style={s.row}>
                  <TextInput
                    style={[s.input, { flex: 1, marginRight: 8 }]}
                    value={gramsPerUnit}
                    onChangeText={setGramsPerUnit}
                    placeholder="Ej: 150"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[s.input, { flex: 1, marginLeft: 8 }]}
                    value={unitLabel}
                    onChangeText={setUnitLabel}
                    placeholder="Etiqueta (ej: unidad, pieza)"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
            )}

            {/* Macros */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>
                Macronutrientes{" "}
                {portionUnit === "unidad"
                  ? `(por ${portionBase} ${portionUnit}${portionBase !== "1" ? "s" : ""})`
                  : `(por ${portionBase} ${portionUnit})`}
              </Text>
              
              <View style={s.macrosContainer}>
                <View style={s.macroField}>
                  <Text style={s.macroLabel}>Proteínas (g)</Text>
                  <TextInput
                    style={s.macroInput}
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={s.macroField}>
                  <Text style={s.macroLabel}>Carbohidratos (g)</Text>
                  <TextInput
                    style={s.macroInput}
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={s.macroField}>
                  <Text style={s.macroLabel}>Grasas (g)</Text>
                  <TextInput
                    style={s.macroInput}
                    value={fat}
                    onChangeText={setFat}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Calorías calculadas */}
              <View style={s.caloriesContainer}>
                <MaterialCommunityIcons
                  name="fire"
                  size={20}
                  color={colors.brand}
                />
                <Text style={s.caloriesLabel}>Calorías calculadas:</Text>
                <Text style={s.caloriesValue}>
                  {calculatedCalories.toFixed(1)} kcal
                </Text>
              </View>

              {/* Valores por 100g */}
              <View style={s.infoBox}>
                <Text style={s.infoTitle}>Valores por 100g:</Text>
                <Text style={s.infoText}>
                  Proteínas: {macrosPer100g.protein.toFixed(1)}g | Carbos:{" "}
                  {macrosPer100g.carbs.toFixed(1)}g | Grasas:{" "}
                  {macrosPer100g.fat.toFixed(1)}g
                </Text>
              </View>
            </View>

            {/* Botón guardar */}
            <Pressable
              onPress={handleSave}
              disabled={!canSave || saving}
              style={({ pressed }) => [
                s.saveButton,
                (!canSave || saving) && s.saveButtonDisabled,
                pressed && s.saveButtonPressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.onCta} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="plus-circle"
                    size={20}
                    color={colors.onCta}
                  />
                  <Text style={s.saveButtonText}>
                    Agregar y ganar +50 XP
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    container: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      width: "100%",
      maxWidth: 500,
      maxHeight: "90%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      ...typography.h2,
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      flex: 1,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      padding: 20,
    },
    fieldContainer: {
      marginBottom: 20,
    },
    label: {
      ...typography.subtitle,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    input: {
      ...typography.body,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    row: {
      flexDirection: "row",
    },
    unitSelector: {
      flexDirection: "row",
      gap: 8,
    },
    unitOption: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
    },
    unitOptionSelected: {
      borderColor: colors.brand,
      backgroundColor: colors.brand + "15",
    },
    unitOptionText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    unitOptionTextSelected: {
      color: colors.brand,
      fontWeight: "700",
    },
    section: {
      marginTop: 8,
      marginBottom: 20,
    },
    sectionTitle: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    macrosContainer: {
      gap: 12,
      marginBottom: 16,
    },
    macroField: {
      marginBottom: 8,
    },
    macroLabel: {
      ...typography.body,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    macroInput: {
      ...typography.body,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    caloriesContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.brand + "15",
      marginBottom: 12,
    },
    caloriesLabel: {
      ...typography.body,
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    caloriesValue: {
      ...typography.h3,
      fontSize: 18,
      fontWeight: "800",
      color: colors.brand,
      marginLeft: "auto",
    },
    infoBox: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: {
      ...typography.subtitle,
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 4,
    },
    infoText: {
      ...typography.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.brand,
      marginTop: 8,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonPressed: {
      opacity: 0.8,
    },
    saveButtonText: {
      ...typography.button,
      fontSize: 16,
      fontWeight: "700",
      color: colors.onCta,
    },
  });
}
