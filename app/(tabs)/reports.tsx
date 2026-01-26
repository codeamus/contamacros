// app/(tabs)/reports.tsx
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { PdfReportService } from "@/domain/services/pdfReportService";
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { usePremium } from "@/presentation/hooks/subscriptions/usePremium";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type DateRange = "day" | "week" | "month" | "custom";

export default function ReportsScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);
  const { isPremium } = usePremium();

  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportHTML, setReportHTML] = useState<string | null>(null);
  const { showToast } = useToast();

  // Calcular fechas según el rango seleccionado
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    
    if (dateRange === "custom") {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
        };
      }
      // Fallback a semana si no hay fechas personalizadas
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    }
    
    if (dateRange === "day") {
      // Solo hoy
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    }
    
    if (dateRange === "week") {
      // Últimos 7 días
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    }
    
    if (dateRange === "month") {
      // Últimos 30 días
      const start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    }
    
    // Fallback
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Estado de estadísticas
  const [stats, setStats] = useState<{
    dailyCalories: { day: string; calories: number }[];
    totalMacros: {
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      totalCalories: number;
    };
    topFoods: {
      name: string;
      totalCalories: number;
      timesEaten: number;
    }[];
    consistency: {
      daysWithLogs: number;
      totalDays: number;
      percentage: number;
    };
  } | null>(null);

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    try {
      const result = await foodLogRepository.getBentoStats(startDate, endDate);
      if (result.ok && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error("[Reports] Error loading stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    setLoading(true);
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadStats();
  }, [loadStats]);

  // Preparar datos para el gráfico de barras con colores vibrantes
  const barChartData = useMemo(() => {
    if (!stats?.dailyCalories) return [];
    
    // Colores vibrantes para las barras
    const vibrantColors = ["#22C55E", "#10B981", "#34D399", "#6EE7B7"];
    
    return stats.dailyCalories.map((item, index) => {
      const date = new Date(item.day);
      // Formato más corto: solo día del mes (ej: "19", "20") para evitar solapamiento
      const shortLabel = date.getDate().toString();
      
      return {
        value: item.calories,
        label: shortLabel,
        frontColor: vibrantColors[index % vibrantColors.length],
        gradientColor: vibrantColors[index % vibrantColors.length] + "CC",
        spacing: 2,
        labelWidth: 30, // Reducido para etiquetas más cortas
        labelTextStyle: {
          color: colors.textSecondary,
          fontSize: 11,
          fontFamily: typography.body?.fontFamily,
          fontWeight: "600" as const,
        },
      };
    });
  }, [stats, colors, typography]);

  // Calcular porcentajes de macros para el donut
  const macroPercentages = useMemo(() => {
    if (!stats?.totalMacros) return { protein: 0, carbs: 0, fat: 0 };
    
    const total = stats.totalMacros.protein_g + stats.totalMacros.carbs_g + stats.totalMacros.fat_g;
    if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
    
    return {
      protein: (stats.totalMacros.protein_g / total) * 100,
      carbs: (stats.totalMacros.carbs_g / total) * 100,
      fat: (stats.totalMacros.fat_g / total) * 100,
    };
  }, [stats]);

  // Color del fuego según consistencia
  const fireColor = useMemo(() => {
    if (!stats?.consistency) return colors.textSecondary;
    const pct = stats.consistency.percentage;
    if (pct >= 80) return "#10B981"; // Verde esmeralda
    if (pct >= 60) return "#F59E0B"; // Amarillo/naranja
    return "#EF4444"; // Coral/rojo
  }, [stats, colors]);

  // Función para exportar PDF
  const handleExportPDF = useCallback(async () => {
    if (!isPremium) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPaywallVisible(true);
      return;
    }

    setExportingPDF(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await PdfReportService.generateAndSharePDF(
        startDate,
        endDate,
      );

      if (result.ok && result.data) {
        // Si se generó PDF exitosamente, ya se compartió
        if (result.data.pdfUri) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast({
            message: "PDF generado y listo para compartir",
            type: "success",
            duration: 2000,
          });
        } else {
          // Fallback: mostrar HTML en modal
          setReportHTML(result.data.html);
          setShowReportModal(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast({
            message: "Reporte generado",
            type: "success",
            duration: 2000,
          });
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast({
          message: result.message || "Error al generar el reporte",
          type: "error",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("[Reports] Error exporting PDF:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Error al generar el reporte",
        type: "error",
        duration: 3000,
      });
    } finally {
      setExportingPDF(false);
    }
  }, [isPremium, startDate, endDate, showToast]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Reportes Premium</Text>
            <Text style={s.headerSubtitle}>Análisis avanzado de tu nutrición</Text>
          </View>
          <Pressable
            onPress={handleExportPDF}
            disabled={exportingPDF}
            style={({ pressed }) => [
              s.exportButton,
              (pressed || exportingPDF) && s.exportButtonPressed,
              !isPremium && s.exportButtonDisabled,
            ]}
          >
            {exportingPDF ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <MaterialCommunityIcons
                name="file-export"
                size={20}
                color={isPremium ? colors.brand : colors.textSecondary}
              />
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              s.exportButton,
              pressed && s.exportButtonPressed,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/settings");
            }}
          >
            <Feather name="settings" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Selector de Rango - Scroll Horizontal */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.rangeSelector}
          style={s.rangeSelectorContainer}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDateRange("day");
            }}
            style={({ pressed }) => [
              s.rangePill,
              dateRange === "day" && s.rangePillActive,
              pressed && s.rangePillPressed,
            ]}
          >
            <Text
              style={[
                s.rangePillText,
                dateRange === "day" && s.rangePillTextActive,
              ]}
            >
              Día
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDateRange("week");
            }}
            style={({ pressed }) => [
              s.rangePill,
              dateRange === "week" && s.rangePillActive,
              pressed && s.rangePillPressed,
            ]}
          >
            <Text
              style={[
                s.rangePillText,
                dateRange === "week" && s.rangePillTextActive,
              ]}
            >
              Semana
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDateRange("month");
            }}
            style={({ pressed }) => [
              s.rangePill,
              dateRange === "month" && s.rangePillActive,
              pressed && s.rangePillPressed,
            ]}
          >
            <Text
              style={[
                s.rangePillText,
                dateRange === "month" && s.rangePillTextActive,
              ]}
            >
              Mes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDateRange("custom");
              if (!customStartDate) {
                setShowDatePicker("start");
              }
            }}
            style={({ pressed }) => [
              s.rangePill,
              dateRange === "custom" && s.rangePillActive,
              pressed && s.rangePillPressed,
            ]}
          >
            <Text
              style={[
                s.rangePillText,
                dateRange === "custom" && s.rangePillTextActive,
              ]}
            >
              Personalizado 📅
            </Text>
          </Pressable>
        </ScrollView>


        {/* Bento Grid */}
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={s.loadingText}>Cargando estadísticas...</Text>
          </View>
        ) : (
          <>
            {/* Bloque 1: Gráfico de Barras (Ancho completo) */}
            <View style={[s.bentoCard, !isPremium && s.blurredCard]}>
              {!isPremium && (
                <Pressable
                  style={s.blurOverlay}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setPaywallVisible(true);
                  }}
                >
                  <View style={s.blurContent}>
                    <MaterialCommunityIcons
                      name="lock"
                      size={32}
                      color={colors.brand}
                    />
                    <Text style={s.blurText}>
                      Desbloquea análisis avanzados con Premium ✨
                    </Text>
                  </View>
                </Pressable>
              )}
              <View style={s.cardHeader}>
                <MaterialCommunityIcons
                  name="chart-bar"
                  size={20}
                  color={colors.brand}
                />
                <Text style={s.cardTitle}>Calorías Diarias</Text>
              </View>
              {barChartData.length > 0 ? (
                <View style={s.chartContainer}>
                  <BarChart
                    data={barChartData}
                    width={SCREEN_WIDTH - 72}
                    height={240}
                    barWidth={22}
                    spacing={30}
                    roundedTop
                    roundedBottom
                    hideRules
                    xAxisThickness={0}
                    yAxisThickness={0}
                    yAxisTextStyle={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontFamily: typography.body?.fontFamily,
                      fontWeight: "600",
                    }}
                    xAxisLabelTextStyle={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontFamily: typography.body?.fontFamily,
                      fontWeight: "600",
                      marginTop: 6,
                    }}
                    noOfSections={4}
                    maxValue={Math.max(...barChartData.map((d) => d.value), 0) * 1.2}
                    barBorderRadius={8}
                    isAnimated
                    animationDuration={800}
                    showVerticalLines={false}
                    showReferenceLine1={false}
                    showReferenceLine2={false}
                    showReferenceLine3={false}
                  />
                  <View style={s.chartLegend}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={s.chartLegendText}>
                      Los números representan los días del mes
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={s.emptyState}>
                  <Text style={s.emptyStateText}>No hay datos en este rango</Text>
                </View>
              )}
            </View>

            {/* Bloque 2 y 3: Donut y Consistencia (50% cada uno) */}
            <View style={s.horizontalRow}>
              {/* Bloque 2: Donut de Macros */}
              <View style={[s.bentoCard, s.halfWidth, !isPremium && s.blurredCard]}>
                {!isPremium && (
                  <Pressable
                    style={s.blurOverlay}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setPaywallVisible(true);
                    }}
                  >
                    <View style={s.blurContent}>
                      <MaterialCommunityIcons
                        name="lock"
                        size={24}
                        color={colors.brand}
                      />
                    </View>
                  </Pressable>
                )}
                <View style={s.cardHeader}>
                  <MaterialCommunityIcons
                    name="chart-donut"
                    size={20}
                    color={colors.brand}
                  />
                  <Text style={s.cardTitle}>Macros</Text>
                </View>
                {stats?.totalMacros ? (
                  <View style={s.donutContainer}>
                    <View style={s.donutWrapper}>
                      <MacroDonut
                        protein={macroPercentages.protein}
                        carbs={macroPercentages.carbs}
                        fat={macroPercentages.fat}
                        colors={colors}
                        size={120}
                      />
                      <View style={s.donutIcons}>
                        <Text style={s.donutIcon}>🥑</Text>
                        <Text style={s.donutIcon}>🍗</Text>
                        <Text style={s.donutIcon}>🍞</Text>
                      </View>
                    </View>
                    <View style={s.macroLabels}>
                      <MacroLabel
                        label="Proteína"
                        value={stats.totalMacros.protein_g}
                        color="#EF4444"
                        colors={colors}
                        typography={typography}
                      />
                      <MacroLabel
                        label="Carbs"
                        value={stats.totalMacros.carbs_g}
                        color="#F59E0B"
                        colors={colors}
                        typography={typography}
                      />
                      <MacroLabel
                        label="Grasas"
                        value={stats.totalMacros.fat_g}
                        color="#10B981"
                        colors={colors}
                        typography={typography}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={s.emptyState}>
                    <Text style={s.emptyStateText}>Sin datos</Text>
                  </View>
                )}
              </View>

              {/* Bloque 3: Consistencia */}
              <View style={[s.bentoCard, s.halfWidth, !isPremium && s.blurredCard]}>
                {!isPremium && (
                  <Pressable
                    style={s.blurOverlay}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setPaywallVisible(true);
                    }}
                  >
                    <View style={s.blurContent}>
                      <MaterialCommunityIcons
                        name="lock"
                        size={24}
                        color={colors.brand}
                      />
                    </View>
                  </Pressable>
                )}
                <View style={s.cardHeader}>
                  <MaterialCommunityIcons
                    name="fire"
                    size={20}
                    color={fireColor}
                  />
                  <Text style={s.cardTitle}>Consistencia</Text>
                </View>
                {stats?.consistency ? (
                  <View style={s.consistencyContainer}>
                    <Text style={[s.consistencyPercentage, { color: fireColor }]}>
                      {stats.consistency.percentage}%
                    </Text>
                    <MaterialCommunityIcons
                      name="fire"
                      size={48}
                      color={fireColor}
                    />
                    <Text style={s.consistencySubtext}>
                      {stats.consistency.daysWithLogs} de {stats.consistency.totalDays} días
                    </Text>
                  </View>
                ) : (
                  <View style={s.emptyState}>
                    <Text style={s.emptyStateText}>Sin datos</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bloque 4: Análisis de Dieta (Ancho completo) */}
            <View style={[s.bentoCard, !isPremium && s.blurredCard]}>
              {!isPremium && (
                <Pressable
                  style={s.blurOverlay}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setPaywallVisible(true);
                  }}
                >
                  <View style={s.blurContent}>
                    <MaterialCommunityIcons
                      name="lock"
                      size={32}
                      color={colors.brand}
                    />
                    <Text style={s.blurText}>
                      Desbloquea análisis avanzados con Premium ✨
                    </Text>
                  </View>
                </Pressable>
              )}
              <View style={s.cardHeader}>
                <MaterialCommunityIcons
                  name="food-apple"
                  size={20}
                  color={colors.brand}
                />
                <Text style={s.cardTitle}>Análisis de Dieta</Text>
              </View>
              {stats?.topFoods && stats.topFoods.length > 0 ? (
                <View style={s.topFoodsList}>
                  {stats.topFoods.map((food, index) => (
                    <View key={food.name} style={s.topFoodItem}>
                      <View style={s.topFoodRank}>
                        <Text style={s.topFoodRankText}>#{index + 1}</Text>
                      </View>
                      <View style={s.topFoodInfo}>
                        <Text style={s.topFoodName} numberOfLines={1}>
                          {food.name}
                        </Text>
                        <Text style={s.topFoodDetails}>
                          {food.totalCalories.toLocaleString()} kcal • {food.timesEaten} veces
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={s.emptyState}>
                  <Text style={s.emptyStateText}>No hay alimentos registrados</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Premium Paywall Modal */}
      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => {
          // El perfil se actualiza automáticamente
        }}
      />

      {/* Report HTML Modal */}
      {showReportModal && reportHTML && (
        <Modal
          visible={showReportModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowReportModal(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={s.reportModalHeader}>
              <Text style={s.reportModalTitle}>Reporte Nutricional</Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowReportModal(false);
                  setReportHTML(null);
                }}
                style={s.reportModalClose}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textPrimary}
                />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }}>
              <View style={s.reportModalContent}>
                <View style={s.reportModalInfo}>
                  <MaterialCommunityIcons
                    name="information"
                    size={20}
                    color={colors.brand}
                  />
                  <Text style={s.reportModalInfoText}>
                    El reporte está listo. Usa "Compartir PDF" para enviarlo por WhatsApp, Email o guardarlo.
                  </Text>
                </View>
                <ScrollView
                  style={s.reportModalHTMLContainer}
                  contentContainerStyle={s.reportModalHTMLContent}
                  nestedScrollEnabled
                >
                  <Text
                    style={s.reportModalHTML}
                    selectable
                  >
                    {reportHTML}
                  </Text>
                </ScrollView>
                <View style={s.reportModalActions}>
                  <Pressable
                    onPress={async () => {
                      if (!reportHTML) return;
                      
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      
                      try {
                        // Intentar generar y compartir PDF usando el servicio
                        const result = await PdfReportService.generateAndSharePDF(
                          startDate,
                          endDate,
                        );

                        if (result.ok && result.data.pdfUri) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          showToast({
                            message: "PDF compartido exitosamente",
                            type: "success",
                            duration: 2000,
                          });
                        } else {
                          throw new Error(result.message || "No se pudo generar el PDF");
                        }
                      } catch (pdfError) {
                        // Fallback: copiar HTML al portapapeles
                        try {
                          const { Clipboard } = require("react-native");
                          Clipboard.setString(reportHTML);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          showToast({
                            message: "HTML copiado. Pégalo en un navegador para ver el reporte.",
                            type: "success",
                            duration: 3000,
                          });
                        } catch (clipboardError) {
                          showToast({
                            message: "El reporte está visible en pantalla",
                            type: "info",
                            duration: 2000,
                          });
                        }
                      }
                    }}
                    style={s.reportModalButton}
                  >
                    <MaterialCommunityIcons
                      name="share-variant"
                      size={18}
                      color={colors.brand}
                    />
                    <Text style={s.reportModalButtonText}>Compartir PDF</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      if (!reportHTML) return;
                      
                      try {
                        const { Clipboard } = require("react-native");
                        Clipboard.setString(reportHTML);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        showToast({
                          message: "HTML copiado al portapapeles",
                          type: "success",
                          duration: 2000,
                        });
                      } catch (error) {
                        showToast({
                          message: "No se pudo copiar",
                          type: "error",
                          duration: 2000,
                        });
                      }
                    }}
                    style={[s.reportModalButton, s.reportModalButtonSecondary]}
                  >
                    <MaterialCommunityIcons
                      name="content-copy"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={s.reportModalButtonTextSecondary}>Copiar HTML</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Date Picker */}
      {Platform.OS === "android" && showDatePicker && (
        <DateTimePicker
          value={
            showDatePicker === "start"
              ? customStartDate || new Date()
              : customEndDate || new Date()
          }
          mode="date"
          display="default"
          maximumDate={new Date()}
          minimumDate={showDatePicker === "end" ? customStartDate || undefined : undefined}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            if (Platform.OS === "android") {
              setShowDatePicker(null);
            }
            if (event.type === "dismissed") {
              setShowDatePicker(null);
              return;
            }
            const date = selectedDate || new Date();
            if (showDatePicker === "start") {
              setCustomStartDate(date);
              setShowDatePicker("end");
            } else {
              setCustomEndDate(date);
              setShowDatePicker(null);
            }
          }}
        />
      )}

      {Platform.OS === "ios" && showDatePicker && (
        <Modal visible={true} transparent animationType="fade">
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={() => setShowDatePicker(null)}
          />
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: typography.subtitle?.fontFamily,
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.textPrimary,
                }}
              >
                {showDatePicker === "start" ? "Fecha inicio" : "Fecha fin"}
              </Text>
              <Pressable
                onPress={() => {
                  if (showDatePicker === "start") {
                    setCustomStartDate(null);
                  } else {
                    setCustomEndDate(null);
                  }
                  setShowDatePicker(null);
                }}
              >
                <Text
                  style={{
                    fontFamily: typography.body?.fontFamily,
                    fontSize: 16,
                    color: colors.brand,
                  }}
                >
                  Cancelar
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={
                showDatePicker === "start"
                  ? customStartDate || new Date()
                  : customEndDate || new Date()
              }
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              minimumDate={
                showDatePicker === "end" ? customStartDate || undefined : undefined
              }
              onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                if (event.type === "dismissed") {
                  setShowDatePicker(null);
                  return;
                }
                const date = selectedDate || new Date();
                if (showDatePicker === "start") {
                  setCustomStartDate(date);
                  setShowDatePicker("end");
                } else {
                  setCustomEndDate(date);
                  setShowDatePicker(null);
                }
              }}
              style={{ alignSelf: "stretch" }}
            />
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// Componente de Donut para Macros - Versión mejorada con SVG
function MacroDonut({
  protein,
  carbs,
  fat,
  colors,
  size,
}: {
  protein: number;
  carbs: number;
  fat: number;
  colors: any;
  size: number;
}) {
  const total = protein + carbs + fat;
  if (total === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 14,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 20, color: colors.textSecondary, fontWeight: "600" }}>—</Text>
      </View>
    );
  }

  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calcular porcentajes
  const proteinPct = (protein / total) * 100;
  const carbsPct = (carbs / total) * 100;
  const fatPct = (fat / total) * 100;

  // Offsets para cada segmento
  const proteinOffset = circumference * (1 - proteinPct / 100);
  const carbsOffset = circumference * (1 - carbsPct / 100);
  const fatOffset = circumference * (1 - fatPct / 100);

  // Rotaciones iniciales
  const proteinStart = -90;
  const carbsStart = proteinStart + (proteinPct / 100) * 360;
  const fatStart = carbsStart + (carbsPct / 100) * 360;

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size}>
        {/* Proteína (rojo) */}
        {proteinPct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#EF4444"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={proteinOffset}
            strokeLinecap="round"
            transform={`rotate(${proteinStart} ${center} ${center})`}
          />
        )}
        {/* Carbs (naranja) */}
        {carbsPct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#F59E0B"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={carbsOffset}
            strokeLinecap="round"
            transform={`rotate(${carbsStart} ${center} ${center})`}
          />
        )}
        {/* Grasas (verde) */}
        {fatPct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#10B981"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={fatOffset}
            strokeLinecap="round"
            transform={`rotate(${fatStart} ${center} ${center})`}
          />
        )}
      </Svg>
    </View>
  );
}

// Componente de etiqueta de macro
function MacroLabel({
  label,
  value,
  color,
  colors,
  typography,
}: {
  label: string;
  value: number;
  color: string;
  colors: any;
  typography: any;
}) {
  return (
    <View style={macroLabelStyles.container}>
      <View style={[macroLabelStyles.dot, { backgroundColor: color }]} />
      <Text style={[macroLabelStyles.label, { color: colors.textSecondary, fontFamily: typography.body?.fontFamily }]}>
        {label}
      </Text>
      <Text style={[macroLabelStyles.value, { color: colors.textPrimary, fontFamily: typography.subtitle?.fontFamily }]}>
        {value.toFixed(1)}g
      </Text>
    </View>
  );
}

const macroLabelStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    flex: 1,
  },
  value: {
    fontSize: 12,
    fontWeight: "600",
  },
});

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 18,
      gap: 16,
      paddingBottom: 40,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 4,
    },
    headerTitle: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 28,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    exportButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    exportButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.95 }],
    },
    exportButtonDisabled: {
      opacity: 0.5,
    },
    rangeSelectorContainer: {
      marginBottom: 8,
    },
    rangeSelector: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 2,
      paddingRight: 18,
    },
    rangePill: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    rangePillActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    rangePillPressed: {
      opacity: 0.7,
    },
    rangePillText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    rangePillTextActive: {
      color: colors.onCta,
    },
    blurredCard: {
      position: "relative",
      overflow: "hidden",
    },
    blurOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: Platform.OS === "ios" 
        ? colors.surface + "F0" // 94% opacidad en iOS para mejor blur
        : colors.background + "E8", // 91% opacidad en Android
      zIndex: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 28,
    },
    blurContent: {
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 16,
    },
    blurText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
      paddingHorizontal: 20,
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: 48,
      gap: 16,
    },
    loadingText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
    bentoCard: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    cardTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    chartContainer: {
      alignItems: "center",
      justifyContent: "center",
    },
    chartLegend: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 12,
    },
    chartLegendText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 11,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    horizontalRow: {
      flexDirection: "row",
      gap: 12,
    },
    halfWidth: {
      flex: 1,
    },
    donutContainer: {
      alignItems: "center",
      gap: 16,
    },
    donutWrapper: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    donutIcons: {
      position: "absolute",
      flexDirection: "row",
      gap: 8,
      top: "50%",
      transform: [{ translateY: -12 }],
    },
    donutIcon: {
      fontSize: 20,
    },
    macroLabels: {
      width: "100%",
      gap: 8,
    },
    consistencyContainer: {
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 8,
    },
    consistencyPercentage: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 42,
      fontWeight: "800",
    },
    consistencySubtext: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
    topFoodsList: {
      gap: 12,
    },
    topFoodItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    topFoodRank: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.brand + "15",
      borderWidth: 1.5,
      borderColor: colors.brand + "30",
      alignItems: "center",
      justifyContent: "center",
    },
    topFoodRankText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      fontWeight: "700",
      color: colors.brand,
    },
    topFoodInfo: {
      flex: 1,
      gap: 4,
    },
    topFoodName: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    topFoodDetails: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
    },
    emptyStateText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    reportModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    reportModalTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    reportModalClose: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reportModalContent: {
      padding: 20,
      gap: 16,
    },
    reportModalInfo: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
      backgroundColor: colors.brand + "10",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.brand + "30",
    },
    reportModalInfoText: {
      flex: 1,
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    reportModalHTMLContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 500,
    },
    reportModalHTMLContent: {
      padding: 16,
    },
    reportModalHTML: {
      fontFamily: "monospace",
      fontSize: 10,
      color: colors.textPrimary,
      lineHeight: 14,
    },
    reportModalActions: {
      marginTop: 20,
      flexDirection: "row",
      gap: 12,
    },
    reportModalButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.brand,
      backgroundColor: colors.brand + "10",
    },
    reportModalButtonSecondary: {
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    reportModalButtonText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 15,
      fontWeight: "600",
      color: colors.brand,
    },
    reportModalButtonTextSecondary: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
  });
}
