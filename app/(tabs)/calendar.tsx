// app/(tabs)/calendar.tsx
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { useCalendarData } from "@/presentation/hooks/diary/useCalendarData";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { formatDateToSpanish, todayStrLocal } from "@/presentation/utils/date";
import * as Haptics from "expo-haptics";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function CalendarScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const { summaries, loading, getCaloriesForDay } = useCalendarData(
    currentYear,
    currentMonth,
  );

  const [selectedDay, setSelectedDay] = useState<string | null>(
    todayStrLocal(),
  );

  // Calcular días del mes
  const daysInMonth = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysCount = lastDay.getDate();

    const days: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> =
      [];

    // Días del mes anterior (para completar la primera semana)
    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0);
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay.getDate() - i;
      const date = new Date(currentYear, currentMonth - 2, day);
      days.push({
        day,
        dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0",
        )}-${String(day).padStart(2, "0")}`,
        isCurrentMonth: false,
      });
    }

    // Días del mes actual
    for (let day = 1; day <= daysCount; day++) {
      days.push({
        day,
        dateStr: `${currentYear}-${String(currentMonth).padStart(
          2,
          "0",
        )}-${String(day).padStart(2, "0")}`,
        isCurrentMonth: true,
      });
    }

    // Días del mes siguiente (para completar la última semana)
    const remainingDays = 42 - days.length; // 6 semanas * 7 días
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear, currentMonth, day);
      days.push({
        day,
        dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0",
        )}-${String(day).padStart(2, "0")}`,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const selectedDayCalories = useMemo(() => {
    if (!selectedDay) return 0;
    return getCaloriesForDay(selectedDay);
  }, [selectedDay, getCaloriesForDay]);

  const selectedDaySummary = useMemo(() => {
    if (!selectedDay) return null;
    return summaries.find((s) => s.day === selectedDay);
  }, [selectedDay, summaries]);

  const isToday = useCallback((dateStr: string) => {
    const today = todayStrLocal();
    return dateStr === today;
  }, []);
  
  const isSelected = useCallback((dateStr: string) => {
    if (!selectedDay) return false;
    // Comparación estricta de strings
    return String(dateStr) === String(selectedDay);
  }, [selectedDay]);

  function navigateMonth(direction: "prev" | "next") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (direction === "prev") {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
    // Resetear selección cuando cambias de mes para evitar confusión
    // El usuario puede seleccionar un día del nuevo mes
    setSelectedDay(null);
  }

  function handleDayPress(dateStr: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Actualizar directamente el estado
    setSelectedDay(dateStr);
  }

  async function handleViewDay() {
    if (!selectedDay) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/(tabs)/diary",
      params: { day: selectedDay },
    });
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable
            style={s.headerBackBtn}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color={colors.textPrimary} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={s.headerKicker}>Calendario</Text>
            <Text style={s.headerTitle}>
              {MONTHS[currentMonth - 1]} {currentYear}
            </Text>
          </View>
        </View>

        {/* Navegación de mes */}
        <View style={s.monthNav}>
          <Pressable
            style={s.monthNavBtn}
            onPress={() => navigateMonth("prev")}
          >
            <Feather name="chevron-left" size={20} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            style={s.monthNavBtn}
            onPress={() => {
              const today = new Date();
              const todayStr = todayStrLocal();
              setCurrentMonth(today.getMonth() + 1);
              setCurrentYear(today.getFullYear());
              setSelectedDay(todayStr);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={s.monthNavToday}>Hoy</Text>
          </Pressable>

          <Pressable
            style={s.monthNavBtn}
            onPress={() => navigateMonth("next")}
          >
            <Feather name="chevron-right" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Calendario */}
        <View style={s.calendarCard}>
          {/* Días de la semana */}
          <View style={s.weekdaysRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={s.weekdayCell}>
                <Text style={s.weekdayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Días del mes */}
          <View style={s.daysGrid}>
            {daysInMonth.map(({ day, dateStr, isCurrentMonth }) => {
              const calories = getCaloriesForDay(dateStr);
              const today = isToday(dateStr);
              const selected = isSelected(dateStr);
              const hasData = calories > 0;

              // Priorizar el estilo de selección sobre el de "hoy"
              // Si está seleccionado, siempre mostrar como seleccionado (incluso si es hoy)
              const showAsSelected = selected && isCurrentMonth;
              const showAsToday = today && !selected;

              return (
                <Pressable
                  key={dateStr}
                  style={[
                    s.dayCell,
                    !isCurrentMonth && s.dayCellOtherMonth,
                    showAsToday && s.dayCellToday,
                    showAsSelected && s.dayCellSelected,
                  ]}
                  onPress={() => handleDayPress(dateStr)}
                >
                  <Text
                    style={[
                      s.dayNumber,
                      !isCurrentMonth && s.dayNumberOtherMonth,
                      showAsToday && s.dayNumberToday,
                      showAsSelected && s.dayNumberSelected,
                    ]}
                  >
                    {day}
                  </Text>
                  {hasData && (
                    <View
                      style={[
                        s.dayIndicator,
                        calories > 2000 && s.dayIndicatorHigh,
                        calories > 1500 && calories <= 2000 && s.dayIndicatorMid,
                        calories <= 1500 && s.dayIndicatorLow,
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Resumen del día seleccionado */}
        {selectedDay && (
          <View style={s.summaryCard}>
            <View style={s.summaryHeader}>
              <View>
                <Text style={s.summaryKicker}>Día seleccionado</Text>
                <Text style={s.summaryDate}>
                  {formatDateToSpanish(selectedDay)}
                </Text>
              </View>
              {selectedDayCalories > 0 && (
                <View style={s.summaryBadge}>
                  <MaterialCommunityIcons
                    name="fire"
                    size={18}
                    color={colors.onCta}
                  />
                </View>
              )}
            </View>

            {loading ? (
              <View style={s.summaryContent}>
                <Text style={s.summaryLoading}>Cargando...</Text>
              </View>
            ) : selectedDayCalories > 0 ? (
              <View style={s.summaryContent}>
                <View style={s.summaryStat}>
                  <Text style={s.summaryStatValue}>{selectedDayCalories}</Text>
                  <Text style={s.summaryStatLabel}>kcal consumidas</Text>
                </View>
              </View>
            ) : (
              <View style={s.summaryContent}>
                <Text style={s.summaryEmpty}>
                  No hay registros para este día
                </Text>
              </View>
            )}

            {selectedDayCalories > 0 && (
              <Pressable
                style={s.summaryButton}
                onPress={handleViewDay}
              >
                <Text style={s.summaryButtonText}>Ver detalles del día</Text>
                <Feather name="arrow-right" size={18} color={colors.brand} />
              </Pressable>
            )}
          </View>
        )}

        {/* Leyenda */}
        <View style={s.legendCard}>
          <Text style={s.legendTitle}>Leyenda</Text>
          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, s.legendDotLow]} />
              <Text style={s.legendText}>Bajo (0-1500 kcal)</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, s.legendDotMid]} />
              <Text style={s.legendText}>Medio (1500-2000)</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, s.legendDotHigh]} />
              <Text style={s.legendText}>Alto (2000+ kcal)</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { padding: 18, gap: 16 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 4,
    },
    headerBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
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

    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
    },
    monthNavBtn: {
      width: 44,
      height: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    monthNavToday: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.brand,
    },

    calendarCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    weekdaysRow: {
      flexDirection: "row",
      marginBottom: 8,
    },
    weekdayCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
    },
    weekdayText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    daysGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    dayCell: {
      width: "13.5%",
      aspectRatio: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 6,
      paddingBottom: 4,
      position: "relative",
    },
    dayCellOtherMonth: {
      opacity: 0.3,
    },
    dayCellToday: {
      borderColor: colors.brand,
      borderWidth: 2,
      backgroundColor: `${colors.brand}15`,
    },
    dayCellSelected: {
      borderColor: colors.brand,
      borderWidth: 2,
      backgroundColor: `${colors.brand}20`,
    },
    dayNumber: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    dayNumberOtherMonth: {
      color: colors.textSecondary,
    },
    dayNumberToday: {
      color: colors.brand,
      fontWeight: "700",
    },
    dayNumberSelected: {
      color: colors.brand,
      fontWeight: "700",
    },
    dayIndicator: {
      position: "absolute",
      bottom: 4,
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    dayIndicatorLow: {
      backgroundColor: colors.brand,
      opacity: 0.5,
    },
    dayIndicatorMid: {
      backgroundColor: colors.cta,
      opacity: 0.7,
    },
    dayIndicatorHigh: {
      backgroundColor: colors.cta,
    },

    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    summaryKicker: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    summaryDate: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      color: colors.textPrimary,
    },
    summaryBadge: {
      width: 38,
      height: 38,
      borderRadius: 16,
      backgroundColor: colors.cta,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryContent: {
      minHeight: 60,
      justifyContent: "center",
    },
    summaryLoading: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
    summaryEmpty: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    summaryStat: {
      alignItems: "flex-start",
    },
    summaryStatValue: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 32,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    summaryStatLabel: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    summaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    summaryButtonText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 15,
      color: colors.brand,
    },

    legendCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    legendTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 14,
      color: colors.textPrimary,
    },
    legendRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendDotLow: {
      backgroundColor: colors.brand,
      opacity: 0.5,
    },
    legendDotMid: {
      backgroundColor: colors.cta,
      opacity: 0.7,
    },
    legendDotHigh: {
      backgroundColor: colors.cta,
    },
    legendText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}
