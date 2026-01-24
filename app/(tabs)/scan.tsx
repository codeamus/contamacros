// app/(tabs)/scan.tsx
import type { MealType } from "@/domain/models/foodLogDb";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useMacroScanner } from "@/presentation/hooks/scanner/useMacroScanner";
import { ScannerOverlay } from "@/presentation/components/scanner/ScannerOverlay";
import { ConfirmMacroModal } from "@/presentation/components/scanner/ConfirmMacroModal";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
function isMealType(x: unknown): x is MealType {
  return typeof x === "string" && MEALS.includes(x as MealType);
}

type ScanMode = "barcode" | "ai";

export default function ScanScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const params = useLocalSearchParams<{ meal?: string; returnTo?: string }>();
  const meal: MealType = isMealType(params.meal) ? params.meal : "snack";
  const returnTo = params.returnTo || "add-food";

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("barcode");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Evita dobles lecturas (iOS puede disparar 2 veces)
  const lockRef = useRef(false);

  // Hook para escaneo por IA
  const {
    isAnalyzing,
    analysisResult,
    captureAndAnalyze,
    resetAnalysis,
  } = useMacroScanner({
    onAnalysisComplete: (result) => {
      setShowConfirmModal(true);
    },
  });

  // Resetear el estado cuando la pantalla recibe foco (para permitir escanear de nuevo)
  useFocusEffect(
    useCallback(() => {
      console.log("[ScanScreen] 🔄 Pantalla enfocada, reseteando estado de escaneo");
      setScanned(false);
      lockRef.current = false;
      resetAnalysis();
      setShowConfirmModal(false);
    }, [resetAnalysis])
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      console.log("[ScanScreen] 📷 Código escaneado:", { data, returnTo, meal });
      
      if (lockRef.current) {
        console.log("[ScanScreen] ⚠️ Escaneo bloqueado (ya procesado)");
        return;
      }
      
      lockRef.current = true;
      setScanned(true);

      try {
        if (returnTo === "my-foods") {
          console.log("[ScanScreen] 🔄 Navegando a my-foods con barcode:", data);
          router.replace({
            pathname: "/(tabs)/my-foods",
            params: { barcode: data },
          });
        } else {
          console.log("[ScanScreen] 🔄 Navegando a add-food con barcode:", data, "meal:", meal);
          router.replace({
            pathname: "/(tabs)/add-food",
            params: { meal, barcode: data },
          });
        }
      } catch (error) {
        console.error("[ScanScreen] ❌ Error al navegar:", error);
        lockRef.current = false;
        setScanned(false);
      }
    },
    [meal, returnTo]
  );

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.body?.fontFamily,
          }}
        >
          Cargando permisos...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, padding: 18, gap: 12 },
        ]}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 16,
          }}
        >
          Necesitamos acceso a la cámara
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.body?.fontFamily,
            textAlign: "center",
          }}
        >
          Para escanear códigos de barra y buscar productos.
        </Text>

        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.cta },
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          <Text
            style={{
              color: colors.onCta,
              fontFamily: typography.subtitle?.fontFamily,
            }}
          >
            Dar permiso
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.subtitle?.fontFamily,
            }}
          >
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleModeToggle = useCallback(() => {
    setScanMode((prev) => (prev === "barcode" ? "ai" : "barcode"));
    setScanned(false);
    lockRef.current = false;
    resetAnalysis();
  }, [resetAnalysis]);

  const handleCapture = useCallback(() => {
    if (scanMode === "ai" && !isAnalyzing) {
      captureAndAnalyze();
    }
  }, [scanMode, isAnalyzing, captureAndAnalyze]);

  const handleCloseConfirmModal = useCallback(() => {
    setShowConfirmModal(false);
    resetAnalysis();
  }, [resetAnalysis]);

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={
          scanMode === "barcode"
            ? {
                // EAN-13 / UPC-A / UPC-E suelen ser los más comunes
                barcodeTypes: ["ean13", "upc_a", "upc_e", "ean8", "code128"],
              }
            : undefined
        }
        onBarcodeScanned={
          scanMode === "barcode" && !scanned ? onBarcodeScanned : undefined
        }
      />

      {/* Overlay */}
      {scanMode === "barcode" ? (
        <View style={styles.overlay}>
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Feather name="x" size={20} color="white" />
            </Pressable>

            <Text style={styles.title}>Escanear código</Text>

            <Pressable
              onPress={handleModeToggle}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <MaterialCommunityIcons name="brain" size={20} color="white" />
            </Pressable>
          </View>

          <View style={styles.frame} />
          <Text style={styles.hint}>Alinea el código dentro del recuadro</Text>
        </View>
      ) : (
        <>
          <ScannerOverlay isScanning={isAnalyzing} />
          <View style={styles.overlay}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Feather name="x" size={20} color="white" />
              </Pressable>

              <Text style={styles.title}>Escaneo por IA</Text>

              <Pressable
                onPress={handleModeToggle}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Feather name="maximize-2" size={20} color="white" />
              </Pressable>
            </View>

            {/* Botón de captura */}
            <View style={styles.captureContainer}>
              <Pressable
                onPress={handleCapture}
                disabled={isAnalyzing}
                style={({ pressed }) => [
                  styles.captureButton,
                  isAnalyzing && styles.captureButtonDisabled,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
                ]}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="large" color="white" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* Modal de confirmación */}
      <ConfirmMacroModal
        visible={showConfirmModal}
        onClose={handleCloseConfirmModal}
        onSuccess={() => {
          handleCloseConfirmModal();
          if (returnTo === "add-food") {
            router.back();
          }
        }}
        analysisResult={analysisResult}
        meal={meal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    paddingTop: 18,
  },
  topRow: {
    width: "100%",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  title: { color: "white", fontSize: 16, fontWeight: "800" },
  frame: {
    marginTop: 70,
    width: 270,
    height: 190,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  hint: { marginTop: 16, color: "rgba(255,255,255,0.9)", fontSize: 13 },
  cta: {
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  captureContainer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderWidth: 4,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "white",
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
});
