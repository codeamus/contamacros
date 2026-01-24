// src/presentation/components/scanner/ScannerOverlay.tsx
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Text } from "react-native";
import { useTheme } from "@/presentation/theme/ThemeProvider";

type ScannerOverlayProps = {
  isScanning?: boolean;
};

export function ScannerOverlay({ isScanning = false }: ScannerOverlayProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  
  // Animación del efecto de escaneo
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const cornerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      // Animación de la línea de escaneo
      const scanAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

      // Animación de las esquinas (pulso sutil)
      const cornerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(cornerAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(cornerAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      );

      scanAnimation.start();
      cornerAnimation.start();

      return () => {
        scanAnimation.stop();
        cornerAnimation.stop();
      };
    }
  }, [isScanning, scanLineAnim, cornerAnim]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 190], // Altura del frame
  });

  const cornerOpacity = cornerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Overlay oscuro con agujero para el frame */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View style={styles.frameContainer}>
            {/* Frame de enfoque */}
            <View style={[styles.frame, { borderColor: colors.brand }]}>
              {/* Esquinas animadas */}
              <Animated.View
                style={[
                  styles.corner,
                  styles.topLeft,
                  { opacity: cornerOpacity, borderColor: colors.brand },
                ]}
              />
              <Animated.View
                style={[
                  styles.corner,
                  styles.topRight,
                  { opacity: cornerOpacity, borderColor: colors.brand },
                ]}
              />
              <Animated.View
                style={[
                  styles.corner,
                  styles.bottomLeft,
                  { opacity: cornerOpacity, borderColor: colors.brand },
                ]}
              />
              <Animated.View
                style={[
                  styles.corner,
                  styles.bottomRight,
                  { opacity: cornerOpacity, borderColor: colors.brand },
                ]}
              />

              {/* Línea de escaneo animada */}
              {isScanning && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      backgroundColor: colors.brand,
                      transform: [{ translateY: scanLineTranslateY }],
                    },
                  ]}
                />
              )}
            </View>
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay} />
      </View>

      {/* Texto de instrucción */}
      <View style={styles.hintContainer}>
        <Text style={[styles.hint, { color: colors.textPrimary }]}>
          {isScanning
            ? "Analizando alimento..."
            : "Apunta la cámara al alimento"}
        </Text>
      </View>
    </View>
  );
}

const FRAME_WIDTH = 270;
const FRAME_HEIGHT = 190;
const CORNER_LENGTH = 20;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  middleRow: {
    flexDirection: "row",
    height: FRAME_HEIGHT,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  frameContainer: {
    width: FRAME_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    position: "relative",
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: CORNER_LENGTH,
    height: CORNER_LENGTH,
    borderWidth: CORNER_WIDTH,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 22,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 22,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 22,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 22,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.8,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  hintContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  hint: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
});
