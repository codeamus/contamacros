// src/presentation/components/scanner/ConfirmMacroModal.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { MacroAnalysisResult } from "@/data/ai/geminiService";
import type { MealType } from "@/domain/models/foodLogDb";
import { todayStrLocal } from "@/presentation/utils/date";

type ConfirmMacroModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  analysisResult: MacroAnalysisResult | null;
  meal: MealType;
};

export function ConfirmMacroModal({
  visible,
  onClose,
  onSuccess,
  analysisResult,
  meal,
}: ConfirmMacroModalProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const s = makeStyles(colors, typography);

  const [grams, setGrams] = useState("100");
  const [saving, setSaving] = useState(false);

  // Parsear servingSize para obtener los gramos que sugiere la IA (ej. "1 plato aprox 400g" → 400)
  const defaultGrams = useMemo(() => {
    if (!analysisResult?.servingSize) return 100;

    const servingSize = analysisResult.servingSize.toLowerCase();
    const match = servingSize.match(/(\d+)\s*(g|gr|gramos?|ml|mililitros?)/);
    if (match) {
      return parseInt(match[1], 10);
    }

    // Si dice "unidad" o similar, usar 100g por defecto
    return 100;
  }, [analysisResult]);

  // Al abrir el modal o cambiar el resultado, prellenar gramos con lo que detectó la IA
  useEffect(() => {
    if (visible && analysisResult) {
      setGrams(String(defaultGrams));
    }
  }, [visible, analysisResult, defaultGrams]);

  // Calcular macros para la porción ingresada
  const calculatedMacros = useMemo(() => {
    if (!analysisResult) return null;
    
    const gramsNum = parseFloat(grams) || defaultGrams;
    const servingGrams = defaultGrams || 100;
    
    // Calcular factor de conversión
    const factor = gramsNum / servingGrams;
    
    return {
      calories: Math.round(analysisResult.calories * factor),
      protein: Math.round(analysisResult.protein * factor * 10) / 10,
      carbs: Math.round(analysisResult.carbs * factor * 10) / 10,
      fats: Math.round(analysisResult.fats * factor * 10) / 10,
      grams: gramsNum,
    };
  }, [analysisResult, grams, defaultGrams]);

  const canSave = useMemo(() => {
    if (!analysisResult) return false;
    const gramsNum = parseFloat(grams);
    return Number.isFinite(gramsNum) && gramsNum > 0 && gramsNum <= 2000;
  }, [analysisResult, grams]);

  const handleSave = async () => {
    if (!analysisResult || !calculatedMacros || !canSave || saving) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const day = todayStrLocal();
      const result = await foodLogRepository.create({
        day,
        meal,
        name: analysisResult.foodName,
        grams: Math.round(calculatedMacros.grams),
        calories: calculatedMacros.calories,
        protein_g: calculatedMacros.protein,
        carbs_g: calculatedMacros.carbs,
        fat_g: calculatedMacros.fats,
        source: "ai_scan",
        source_type: "manual",
      });

      if (!result.ok) {
        throw new Error(result.message || "Error al guardar el alimento");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        message: `¡${analysisResult.foodName} agregado!`,
        type: "success",
        duration: 3000,
      });

      setGrams("100");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("[ConfirmMacroModal] Error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        message: error instanceof Error ? error.message : "Error al guardar el alimento",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!analysisResult) return null;

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
            <View>
              <Text style={s.title}>Confirmar Alimento</Text>
              <Text style={s.subtitle}>
                Revisa y ajusta los datos detectados
              </Text>
            </View>
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
              <Text style={s.label}>Alimento detectado</Text>
              <View style={s.foodNameContainer}>
                <MaterialCommunityIcons
                  name="food"
                  size={20}
                  color={colors.brand}
                />
                <Text style={s.foodName}>{analysisResult.foodName}</Text>
              </View>
            </View>

            {/* Cantidad */}
            <View style={s.fieldContainer}>
              <Text style={s.label}>Cantidad (gramos)</Text>
              <Text style={s.helpText}>
                Porción detectada: {analysisResult.servingSize}
              </Text>
              <TextInput
                style={s.input}
                value={grams}
                onChangeText={setGrams}
                placeholder="100"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Macros calculados */}
            {calculatedMacros && (
              <View style={s.macrosContainer}>
                <Text style={s.sectionTitle}>Valores nutricionales</Text>
                
                <View style={s.macroRow}>
                  <View style={s.macroItem}>
                    <MaterialCommunityIcons
                      name="fire"
                      size={20}
                      color={colors.brand}
                    />
                    <Text style={s.macroLabel}>Calorías</Text>
                    <Text style={s.macroValue}>{calculatedMacros.calories}</Text>
                  </View>
                  
                  <View style={s.macroItem}>
                    <MaterialCommunityIcons
                      name="dumbbell"
                      size={20}
                      color="#4A90E2"
                    />
                    <Text style={s.macroLabel}>Proteína</Text>
                    <Text style={s.macroValue}>
                      {calculatedMacros.protein.toFixed(1)}g
                    </Text>
                  </View>
                </View>

                <View style={s.macroRow}>
                  <View style={s.macroItem}>
                    <MaterialCommunityIcons
                      name="bread-slice"
                      size={20}
                      color="#F5A623"
                    />
                    <Text style={s.macroLabel}>Carbohidratos</Text>
                    <Text style={s.macroValue}>
                      {calculatedMacros.carbs.toFixed(1)}g
                    </Text>
                  </View>
                  
                  <View style={s.macroItem}>
                    <MaterialCommunityIcons
                      name="oil"
                      size={20}
                      color="#50C878"
                    />
                    <Text style={s.macroLabel}>Grasas</Text>
                    <Text style={s.macroValue}>
                      {calculatedMacros.fats.toFixed(1)}g
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Botón guardar */}
            <View style={s.saveSection}>
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
                      name="check-circle"
                      size={24}
                      color={colors.onCta}
                    />
                    <Text style={s.saveButtonText}>Agregar al Diario</Text>
                  </>
                )}
              </Pressable>
              {!canSave && (
                <Text style={s.saveHint}>
                  Ingresa una cantidad válida (1-2000g)
                </Text>
              )}
            </View>
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
      alignItems: "flex-start",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      ...typography.h2,
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    subtitle: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
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
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    helpText: {
      ...typography.caption,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    foodNameContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.brand + "30",
    },
    foodName: {
      ...typography.subtitle,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      flex: 1,
    },
    input: {
      ...typography.body,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    macrosContainer: {
      marginBottom: 20,
    },
    sectionTitle: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 16,
    },
    macroRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 12,
    },
    macroItem: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      gap: 8,
    },
    macroLabel: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
    },
    macroValue: {
      ...typography.h3,
      fontSize: 20,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    saveSection: {
      marginTop: 8,
      gap: 12,
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 20,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.brand,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    saveButtonText: {
      ...typography.button,
      fontSize: 18,
      fontWeight: "800",
      color: colors.onCta,
    },
    saveHint: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
      fontStyle: "italic",
    },
  });
}
