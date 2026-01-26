// app/(tabs)/create-food.tsx
import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import { GamificationService, getUserRank } from "@/domain/services/gamificationService";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PortionUnit = "gr" | "ml" | "unidad";

export default function CreateFoodScreen() {
  const params = useLocalSearchParams<{ initialName?: string }>();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();
  const s = makeStyles(colors, typography);

  const [name, setName] = useState(params.initialName || "");
  const [portionBase, setPortionBase] = useState("100");
  const [portionUnit, setPortionUnit] = useState<PortionUnit>("gr");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [gramsPerUnit, setGramsPerUnit] = useState("");
  const [unitLabel, setUnitLabel] = useState("unidad");
  const [saving, setSaving] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);

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
      (portionUnit !== "unidad" || (parseFloat(gramsPerUnit) > 0 && unitLabel.trim().length > 0)) &&
      !isDuplicate // No permitir guardar si es duplicado
    );
  }, [name, portionBase, protein, carbs, fat, portionUnit, gramsPerUnit, unitLabel, isDuplicate]);

  // Validar duplicados mientras el usuario escribe (debounced)
  useEffect(() => {
    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, " ");
    
    if (normalizedName.length < 2) {
      setIsDuplicate(false);
      setDuplicateName(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingDuplicate(true);
      const duplicateCheck = await genericFoodsRepository.checkDuplicate(normalizedName);
      
      if (duplicateCheck.ok && duplicateCheck.data) {
        setIsDuplicate(true);
        setDuplicateName(duplicateCheck.data.food.name_es);
        setSimilarity(duplicateCheck.data.similarity);
      } else {
        setIsDuplicate(false);
        setDuplicateName(null);
        setSimilarity(null);
      }
      setCheckingDuplicate(false);
    }, 500); // Esperar 500ms después de que el usuario deje de escribir

    return () => {
      clearTimeout(timeoutId);
      setCheckingDuplicate(false);
    };
  }, [name]);

  const handleSave = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Validación final de duplicados (por si acaso)
      if (isDuplicate) {
        setSaving(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast({
          message: "Este producto ya existe en la comunidad. ¡Búscalo para registrarlo!",
          type: "warning",
          duration: 4000,
        });
        return;
      }

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
      const contributionResult = await GamificationService.recordFoodContribution();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Verificar si subió de rango
      if (contributionResult.ok) {
        const statsResult = await GamificationService.getUserStats();
        if (statsResult.ok) {
          const currentRank = getUserRank(statsResult.data.xp_points);
          const previousRank = getUserRank(statsResult.data.xp_points - 50);
          
          if (currentRank.name !== previousRank.name) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast({
              message: `¡Felicidades! Ahora eres ${currentRank.emoji} ${currentRank.name}`,
              type: "success",
              duration: 5000,
            });
          } else {
            showToast({
              message: "¡Alimento creado! +50 XP ganados 🎉",
              type: "success",
              duration: 3000,
            });
          }
        } else {
          showToast({
            message: "¡Alimento creado! +50 XP ganados 🎉",
            type: "success",
            duration: 3000,
          });
        }
      } else {
        showToast({
          message: "¡Alimento creado! +50 XP ganados 🎉",
          type: "success",
          duration: 3000,
        });
      }

      // Navegar hacia atrás después de guardar exitosamente
      router.back();
    } catch (error) {
      console.error("[CreateFoodScreen] Error:", error);
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
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.container}
      >
        <View style={s.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={s.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Agregar Alimento Nuevo</Text>
            <Text style={s.subtitle}>
              Ayuda a otros compartiendo este alimento
            </Text>
          </View>
        </View>

        <ScrollView
          style={s.content}
          contentContainerStyle={s.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Banner */}
          <View style={s.infoBanner}>
            <MaterialCommunityIcons
              name="information"
              size={20}
              color={colors.brand}
            />
            <Text style={s.infoBannerText}>
              Solo necesitas el nombre y los valores nutricionales. Nosotros
              calculamos el resto automáticamente.
            </Text>
          </View>

          {/* Nombre del alimento */}
          <View style={s.fieldContainer}>
            <Text style={s.label}>
              1. ¿Cómo se llama este alimento? *
            </Text>
            <Text style={s.helpText}>
              Ejemplo: "Pastel de Jaiba", "Pollo a la Plancha", "Ensalada
              César"
            </Text>
            <View style={s.inputContainer}>
              <TextInput
                style={[
                  s.input,
                  isDuplicate && s.inputError,
                  checkingDuplicate && s.inputChecking,
                ]}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setIsDuplicate(false); // Resetear al escribir
                  setDuplicateName(null);
                  setSimilarity(null);
                }}
                placeholder="Escribe el nombre del alimento..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />
              {checkingDuplicate && (
                <View style={s.checkingIndicator}>
                  <ActivityIndicator size="small" color={colors.brand} />
                </View>
              )}
              {isDuplicate && !checkingDuplicate && (
                <View style={s.errorIndicator}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={20}
                    color="#EF4444"
                  />
                </View>
              )}
            </View>
            {isDuplicate && duplicateName && (
              <View style={s.duplicateWarning}>
                <MaterialCommunityIcons
                  name="alert"
                  size={18}
                  color="#F59E0B"
                />
                <View style={s.duplicateWarningContent}>
                  <Text style={s.duplicateWarningText}>
                    ⚠️ Parece que este alimento ya existe como "{duplicateName}".
                  </Text>
                  <Text style={s.duplicateWarningSubtext}>
                    Por favor, verifica si es el mismo antes de crear uno nuevo
                    para mantener la comunidad limpia.
                    {similarity && (
                      <Text style={s.similarityText}>
                        {" "}(Similitud: {Math.round(similarity * 100)}%)
                      </Text>
                    )}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Sección: ¿Cómo quieres medirlo? */}
          <View style={s.fieldContainer}>
            <Text style={s.label}>
              2. ¿Cómo quieres medir este alimento? *
            </Text>
            <Text style={s.helpText}>
              Elige la forma más común de medirlo
            </Text>
            <View style={s.unitSelector}>
              {(
                [
                  { key: "unidad", label: "Por unidad", icon: "cookie", desc: "Ej: 1 plátano, 1 huevo" },
                  { key: "gr", label: "Por peso", icon: "scale-bathroom", desc: "Ej: 100 gramos" },
                  { key: "ml", label: "Por volumen", icon: "cup", desc: "Ej: 250 ml" },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPortionUnit(item.key as PortionUnit);
                    // Resetear campos cuando cambia la unidad
                    if (item.key === "unidad") {
                      setPortionBase("1");
                      setGramsPerUnit("");
                    } else if (item.key === "gr") {
                      setPortionBase("100");
                    } else {
                      setPortionBase("100");
                    }
                  }}
                  style={[
                    s.unitOptionLarge,
                    portionUnit === item.key && s.unitOptionSelected,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={24}
                    color={
                      portionUnit === item.key ? colors.brand : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      s.unitOptionTextLarge,
                      portionUnit === item.key && s.unitOptionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={s.unitOptionDesc}>{item.desc}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Campo específico según unidad seleccionada */}
          {portionUnit === "unidad" ? (
            <View style={s.fieldContainer}>
              <Text style={s.label}>
                3. ¿Cuánto pesa una unidad en gramos? *
              </Text>
              <Text style={s.helpText}>
                Si no lo sabes exacto, estima. Ejemplo: un plátano mediano
                pesa ~120 gramos
              </Text>
              <View style={s.row}>
                <TextInput
                  style={[s.input, { flex: 1, marginRight: 8 }]}
                  value={gramsPerUnit}
                  onChangeText={setGramsPerUnit}
                  placeholder="120"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                <Text
                  style={[
                    s.unitHelper,
                    { flex: 1, marginLeft: 8, alignSelf: "center" },
                  ]}
                >
                  gramos
                </Text>
              </View>
              <View style={s.fieldContainer}>
                <Text style={s.label}>
                  ¿Cómo quieres que aparezca la unidad? (opcional)
                </Text>
                <Text style={s.helpText}>
                  Ejemplo: "unidad", "pieza", "rodaja", "taza"
                </Text>
                <TextInput
                  style={s.input}
                  value={unitLabel}
                  onChangeText={setUnitLabel}
                  placeholder="unidad"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          ) : (
            <View style={s.fieldContainer}>
              <Text style={s.label}>
                3. ¿Para qué cantidad quieres los valores? *
              </Text>
              <Text style={s.helpText}>
                Normalmente es 100 {portionUnit === "gr" ? "gramos" : "ml"},
                pero puedes cambiarlo si quieres
              </Text>
              <View style={s.row}>
                <TextInput
                  style={[s.input, { flex: 1, marginRight: 8 }]}
                  value={portionBase}
                  onChangeText={setPortionBase}
                  placeholder="100"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                <Text
                  style={[
                    s.unitHelper,
                    { flex: 1, marginLeft: 8, alignSelf: "center" },
                  ]}
                >
                  {portionUnit === "gr" ? "gramos" : "ml"}
                </Text>
              </View>
            </View>
          )}

          {/* Macros */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              4. ¿Cuántos macronutrientes tiene?
            </Text>
            <Text style={s.helpText}>
              Puedes buscar esta info en la etiqueta del producto o en
              internet. Si no sabes algún valor, déjalo en 0.
            </Text>

            <View style={s.macrosContainer}>
              <View style={s.macroCard}>
                <View style={s.macroHeader}>
                  <MaterialCommunityIcons
                    name="dumbbell"
                    size={20}
                    color="#4A90E2"
                  />
                  <Text style={s.macroLabel}>Proteínas</Text>
                </View>
                <View style={s.macroInputContainer}>
                  <TextInput
                    style={s.macroInput}
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  <Text style={s.macroUnit}>gramos</Text>
                </View>
                <Text style={s.macroExample}>
                  Ej: carne tiene ~25g, huevo tiene ~6g
                </Text>
              </View>

              <View style={s.macroCard}>
                <View style={s.macroHeader}>
                  <MaterialCommunityIcons
                    name="bread-slice"
                    size={20}
                    color="#F5A623"
                  />
                  <Text style={s.macroLabel}>Carbohidratos</Text>
                </View>
                <View style={s.macroInputContainer}>
                  <TextInput
                    style={s.macroInput}
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  <Text style={s.macroUnit}>gramos</Text>
                </View>
                <Text style={s.macroExample}>
                  Ej: arroz tiene ~28g, pan tiene ~50g
                </Text>
              </View>

              <View style={s.macroCard}>
                <View style={s.macroHeader}>
                  <MaterialCommunityIcons
                    name="oil"
                    size={20}
                    color="#50C878"
                  />
                  <Text style={s.macroLabel}>Grasas</Text>
                </View>
                <View style={s.macroInputContainer}>
                  <TextInput
                    style={s.macroInput}
                    value={fat}
                    onChangeText={setFat}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  <Text style={s.macroUnit}>gramos</Text>
                </View>
                <Text style={s.macroExample}>
                  Ej: aguacate tiene ~15g, aceite tiene ~100g
                </Text>
              </View>
            </View>

            {/* Calorías calculadas - Más prominente */}
            <View style={s.caloriesContainer}>
              <View style={s.caloriesIcon}>
                <MaterialCommunityIcons
                  name="fire"
                  size={28}
                  color={colors.brand}
                />
              </View>
              <View style={s.caloriesContent}>
                <Text style={s.caloriesLabel}>
                  Calorías calculadas automáticamente:
                </Text>
                <Text style={s.caloriesValue}>
                  {calculatedCalories.toFixed(0)} kcal
                </Text>
                <Text style={s.caloriesSubtext}>
                  Para{" "}
                  {portionUnit === "unidad"
                    ? `1 ${unitLabel || "unidad"}`
                    : `${portionBase} ${portionUnit === "gr" ? "gramos" : "ml"}`}
                </Text>
              </View>
            </View>
          </View>

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
                  <View style={s.saveButtonContent}>
                    <Text style={s.saveButtonText}>Agregar a la Comunidad</Text>
                    <Text style={s.saveButtonSubtext}>
                      Ganarás 50 puntos de experiencia 🎉
                    </Text>
                  </View>
                </>
              )}
            </Pressable>
            {!canSave && (
              <Text style={s.saveHint}>
                {isDuplicate
                  ? "Este alimento ya existe. Busca el nombre en la búsqueda principal."
                  : "Completa todos los campos marcados con * para continuar"}
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
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
    infoBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.brand + "15",
      borderWidth: 1,
      borderColor: colors.brand + "30",
      marginBottom: 20,
    },
    infoBannerText: {
      ...typography.body,
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
      lineHeight: 18,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 40,
    },
    fieldContainer: {
      marginBottom: 20,
    },
    label: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    helpText: {
      ...typography.caption,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    inputContainer: {
      position: "relative",
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
      paddingRight: 48, // Espacio para el indicador
    },
    inputError: {
      borderColor: "#EF4444",
      backgroundColor: "#EF444415",
    },
    inputChecking: {
      borderColor: colors.brand,
    },
    checkingIndicator: {
      position: "absolute",
      right: 14,
      top: "50%",
      transform: [{ translateY: -10 }],
    },
    errorIndicator: {
      position: "absolute",
      right: 14,
      top: "50%",
      transform: [{ translateY: -10 }],
    },
    duplicateWarning: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginTop: 8,
      padding: 14,
      borderRadius: 12,
      backgroundColor: "#F59E0B15",
      borderWidth: 2,
      borderColor: "#F59E0B60",
    },
    duplicateWarningContent: {
      flex: 1,
      gap: 4,
    },
    duplicateWarningText: {
      ...typography.subtitle,
      fontSize: 14,
      fontWeight: "700",
      color: "#F59E0B",
      lineHeight: 20,
    },
    duplicateWarningSubtext: {
      ...typography.body,
      fontSize: 12,
      color: "#F59E0B",
      lineHeight: 18,
      opacity: 0.9,
    },
    similarityText: {
      ...typography.caption,
      fontSize: 11,
      fontWeight: "600",
      color: "#F59E0B",
      opacity: 0.8,
    },
    row: {
      flexDirection: "row",
    },
    unitSelector: {
      gap: 12,
    },
    unitOptionLarge: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      gap: 8,
    },
    unitOptionSelected: {
      borderColor: colors.brand,
      backgroundColor: colors.brand + "15",
    },
    unitOptionTextLarge: {
      ...typography.subtitle,
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    unitOptionTextSelected: {
      color: colors.brand,
    },
    unitOptionDesc: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
    },
    unitHelper: {
      ...typography.body,
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: "500",
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
      gap: 16,
      marginBottom: 20,
    },
    macroCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    macroHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    macroLabel: {
      ...typography.subtitle,
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    macroInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    macroInput: {
      ...typography.body,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minWidth: 100,
      textAlign: "center",
    },
    macroUnit: {
      ...typography.body,
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    macroExample: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    caloriesContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: 20,
      borderRadius: 16,
      backgroundColor: colors.brand + "15",
      borderWidth: 2,
      borderColor: colors.brand + "30",
      marginBottom: 8,
    },
    caloriesIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.brand + "25",
      alignItems: "center",
      justifyContent: "center",
    },
    caloriesContent: {
      flex: 1,
    },
    caloriesLabel: {
      ...typography.body,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    caloriesValue: {
      ...typography.h1,
      fontSize: 32,
      fontWeight: "900",
      color: colors.brand,
      marginBottom: 2,
    },
    caloriesSubtext: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
    },
    saveSection: {
      marginTop: 8,
      gap: 12,
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 16,
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
    saveButtonContent: {
      flex: 1,
    },
    saveButtonText: {
      ...typography.button,
      fontSize: 18,
      fontWeight: "800",
      color: colors.onCta,
      marginBottom: 2,
    },
    saveButtonSubtext: {
      ...typography.caption,
      fontSize: 13,
      color: colors.onCta,
      opacity: 0.9,
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
