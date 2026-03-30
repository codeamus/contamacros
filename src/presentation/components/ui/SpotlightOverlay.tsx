// src/presentation/components/ui/SpotlightOverlay.tsx
import { TOUR_STEPS } from "@/core/constants/tourSteps";
import {
  SpotlightLayout,
  useTour,
} from "@/presentation/hooks/tour/TourProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const OVERLAY_COLOR = "rgba(0,0,0,0.82)";
const SPOTLIGHT_BORDER_RADIUS = 16;
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 88 : 75;
const TOOLTIP_PADDING = 20;

function computeDiaryTabLayout(): SpotlightLayout {
  const { width, height } = Dimensions.get("window");
  const tabCount = 4;
  const tabWidth = width / tabCount;
  // Diary is 2nd visible tab (index 1)
  return {
    x: tabWidth,
    y: height - TAB_BAR_HEIGHT,
    width: tabWidth,
    height: TAB_BAR_HEIGHT,
  };
}

export default function SpotlightOverlay() {
  const { isActive, currentStepIndex, currentStep, getLayout, nextStep, skipTour } =
    useTour();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  // Pulse animation for spotlight ring
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Fade for wrong-touch feedback
  const wrongTouchAnim = useRef(new Animated.Value(0)).current;

  // Tamaño real de la tooltip medido con onLayout
  const [tooltipHeight, setTooltipHeight] = useState(0);

  // Delay showing overlay when step changes (let screen mount & report layout)
  const [readyToShow, setReadyToShow] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setReadyToShow(false);
      return;
    }
    setReadyToShow(false);
    const timer = setTimeout(() => setReadyToShow(true), 350);
    return () => clearTimeout(timer);
  }, [isActive, currentStepIndex]);

  useEffect(() => {
    if (!readyToShow || !isActive) {
      pulseLoop.current?.stop();
      return;
    }
    pulseAnim.setValue(0);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.current.start();
    return () => pulseLoop.current?.stop();
  }, [readyToShow, isActive, pulseAnim]);

  if (!isActive || !currentStep) return null;

  // Resolve layout for current step
  let layout: SpotlightLayout | null = null;
  if (currentStep.id === "diary-tab") {
    layout = computeDiaryTabLayout();
  } else if (currentStep.screen !== "finish") {
    layout = getLayout(currentStep.id);
  }

  const { width: SW, height: SH } = Dimensions.get("window");
  const padding = currentStep.spotlightPadding ?? 0;

  const spot = layout
    ? {
        x: layout.x - padding,
        y: layout.y - padding,
        w: layout.width + padding * 2,
        h: layout.height + padding * 2,
      }
    : null;

  // Tooltip placement basado en altura real medida con onLayout.
  // Mientras tooltipHeight === 0 (primer render), usamos top: 0 y dejamos
  // que onLayout lo corrija en el siguiente frame sin parpadeo visible.
  let tooltipTop: number;
  if (!spot || tooltipHeight === 0) {
    tooltipTop = SH / 2 - tooltipHeight / 2;
  } else {
    const topSpace = spot.y;
    const bottomSpace = SH - (spot.y + spot.h);

    if (bottomSpace >= tooltipHeight + TOOLTIP_PADDING) {
      tooltipTop = spot.y + spot.h + TOOLTIP_PADDING;
    } else if (topSpace >= tooltipHeight + TOOLTIP_PADDING) {
      tooltipTop = spot.y - tooltipHeight - TOOLTIP_PADDING;
    } else {
      tooltipTop = SH / 2 - tooltipHeight / 2;
    }
  }

  const isFinish = currentStep.screen === "finish";
  const isLastContentStep = currentStepIndex === TOUR_STEPS.length - 1;
  const buttonLabel =
    isLastContentStep || isFinish ? "¡Empezar!" : "Siguiente";

  function handleOutsidePress() {
    // Pulse stronger to hint "tap the spotlight"
    wrongTouchAnim.setValue(0);
    Animated.sequence([
      Animated.timing(wrongTouchAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(wrongTouchAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  const wrongScale = wrongTouchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const ringOpacity = Animated.add(
    pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] }),
    wrongTouchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
  );

  const styles = makeStyles(colors, typography);

  if (!readyToShow) {
    // Show dim overlay while waiting for layout
    return (
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          pointerEvents="none"
        />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* === OVERLAY (4 views + optional center overlay for finish) === */}
      {isFinish || !spot ? (
        // Full overlay for finish step
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: OVERLAY_COLOR }]}
          onPress={handleOutsidePress}
        />
      ) : (
        <>
          {/* Top blocker */}
          <Pressable
            style={[styles.blocker, { top: 0, left: 0, right: 0, height: Math.max(0, spot.y) }]}
            onPress={handleOutsidePress}
          />
          {/* Bottom blocker */}
          <Pressable
            style={[styles.blocker, { top: spot.y + spot.h, left: 0, right: 0, bottom: 0 }]}
            onPress={handleOutsidePress}
          />
          {/* Left blocker */}
          <Pressable
            style={[
              styles.blocker,
              {
                top: spot.y,
                left: 0,
                width: Math.max(0, spot.x),
                height: spot.h,
              },
            ]}
            onPress={handleOutsidePress}
          />
          {/* Right blocker */}
          <Pressable
            style={[
              styles.blocker,
              {
                top: spot.y,
                left: spot.x + spot.w,
                right: 0,
                height: spot.h,
              },
            ]}
            onPress={handleOutsidePress}
          />

          {/* Spotlight border/pulse ring */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.spotlightRing,
              {
                left: spot.x - 4,
                top: spot.y - 4,
                width: spot.w + 8,
                height: spot.h + 8,
                borderRadius: SPOTLIGHT_BORDER_RADIUS + 4,
                borderColor: colors.cta,
                opacity: ringOpacity,
                transform: [
                  {
                    scale: Animated.add(
                      pulseScale as any,
                      wrongTouchAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.02],
                      }) as any,
                    ) as any,
                  },
                ],
              },
            ]}
          />

          {/* Spotlight hole border (non-animated, for crisp edge) */}
          <View
            pointerEvents="none"
            style={[
              styles.spotlightBorder,
              {
                left: spot.x,
                top: spot.y,
                width: spot.w,
                height: spot.h,
                borderRadius: SPOTLIGHT_BORDER_RADIUS,
              },
            ]}
          />
        </>
      )}

      {/* === TOOLTIP === */}
      <View
        style={[
          styles.tooltip,
          { position: "absolute", left: 20, right: 20, top: tooltipTop },
        ]}
        onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
        pointerEvents="box-none"
      >
        {/* Icon badge */}
        <View style={styles.tooltipBadge}>
          <MaterialCommunityIcons
            name={isFinish ? "check-circle" : "map-marker-path"}
            size={20}
            color={colors.onCta}
          />
        </View>

        {/* Step indicator */}
        {!isFinish && (
          <Text style={styles.stepIndicator}>
            {currentStepIndex + 1} / {TOUR_STEPS.length}
          </Text>
        )}

        <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
        <Text style={styles.tooltipDescription}>{currentStep.description}</Text>

        {/* Dots */}
        {!isFinish && (
          <View style={styles.dots}>
            {TOUR_STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentStepIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}

        {/* Buttons row */}
        <View style={styles.buttonRow}>
          {!isFinish && (
            <Pressable
              onPress={skipTour}
              style={({ pressed }) => [
                styles.skipBtn,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
            >
              <Text style={styles.skipText}>Saltar</Text>
            </Pressable>
          )}
          <Pressable
            onPress={nextStep}
            style={({ pressed }) => [
              styles.nextBtn,
              { backgroundColor: colors.cta },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={[styles.nextBtnText, { color: colors.onCta, fontFamily: typography.subtitle?.fontFamily }]}>
              {buttonLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    blocker: {
      position: "absolute",
      backgroundColor: OVERLAY_COLOR,
    },
    spotlightRing: {
      position: "absolute",
      borderWidth: 2.5,
    },
    spotlightBorder: {
      position: "absolute",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.2)",
    },
    tooltip: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 16 },
      }),
    },
    tooltipBadge: {
      alignSelf: "flex-start",
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.cta,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    stepIndicator: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    tooltipTitle: {
      ...typography.title,
      color: colors.textPrimary,
      fontSize: 18,
      marginBottom: 6,
    },
    tooltipDescription: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 14,
    },
    dots: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 14,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 18,
      backgroundColor: colors.cta,
    },
    buttonRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
    },
    skipBtn: {
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    skipText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
    nextBtn: {
      flex: 1,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    nextBtnText: {
      fontSize: 15,
    },
  });
}
