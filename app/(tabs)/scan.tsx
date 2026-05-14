// app/(tabs)/scan.tsx
import type { MealType } from "@/domain/models/foodLogDb";
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { ConfirmMacroModal } from "@/presentation/components/scanner/ConfirmMacroModal";
import { ScannerOverlay } from "@/presentation/components/scanner/ScannerOverlay";
import { useLabelScanner } from "@/presentation/hooks/scanner/useLabelScanner";
import { useMacroScanner } from "@/presentation/hooks/scanner/useMacroScanner";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { ratingPromptService } from "@/domain/services/ratingPromptService";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
function isMealType(x: unknown): x is MealType {
  return typeof x === "string" && MEALS.includes(x as MealType);
}

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

function parseSuggestedGrams(servingSize: string): number {
  const match = servingSize.toLowerCase().match(/(\d+)\s*(g|gr|gramos?|ml|mililitros?)/);
  return match ? parseInt(match[1], 10) : 100;
}

export default function ScanScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const FRAME_W = Math.round(screenWidth * 0.82);
  const FRAME_H = 210;

  const params = useLocalSearchParams<{
    meal?: string;
    returnTo?: string;
    mode?: string;
    recipeId?: string;
    barcode?: string;
  }>();
  const meal: MealType = isMealType(params.meal) ? params.meal : "snack";
  const pendingBarcode = typeof params.barcode === "string" && params.barcode.trim() ? params.barcode.trim() : null;
  const returnTo = params.returnTo || "add-food";
  const recipeId = typeof params.recipeId === "string" ? params.recipeId : "";

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanMode, setScanMode] = useState<"barcode" | "ai">("barcode");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);


  // Ref para capturar foto directamente desde la CameraView (evita abrir cámara nativa 2 veces)
  const cameraRef = useRef<CameraView>(null);

  // Evita dobles lecturas (iOS puede disparar 2 veces)
  const lockRef = useRef(false);

  // Hook para escaneo por IA (platos de comida)
  const {
    isAnalyzing,
    isRetrying,
    analysisResult,
    captureAndAnalyze,
    resetAnalysis,
  } = useMacroScanner({
    onAnalysisComplete: (result) => {
      setShowConfirmModal(true);
    },
    onLimitReached: () => {
      Alert.alert(
        "Función exclusiva Premium",
        "El escaneo por IA es exclusivo para usuarios Premium. ¡Activa tu plan para usarlo sin límites!",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Ver Premium", onPress: () => setPaywallVisible(true), style: "default" },
        ],
        { cancelable: true },
      );
    },
  });

  // Hook para leer etiquetas nutricionales con IA (viene del flujo barcode no encontrado)
  const { isScanning: isLabelScanning, isRetrying: isLabelRetrying, captureAndRead } = useLabelScanner({
    onSuccess: (result) => {
      router.replace({
        pathname: "/(tabs)/add-food",
        params: {
          meal,
          barcode: pendingBarcode ?? undefined,
          ...(result.productName ? { aiName: result.productName } : {}),
          ...(result.kcal_100g != null ? { aiKcal: String(result.kcal_100g) } : {}),
          ...(result.protein_100g != null ? { aiProtein: String(result.protein_100g) } : {}),
          ...(result.carbs_100g != null ? { aiCarbs: String(result.carbs_100g) } : {}),
          ...(result.fat_100g != null ? { aiFat: String(result.fat_100g) } : {}),
        },
      });
    },
  });


  // TESTING ONLY: Reset rating prompt state on mount
  useEffect(() => {
    const resetRatingPrompt = async () => {
      console.log("[ScanScreen] 🧪 TESTING MODE: Resetting rating prompt state");
      await ratingPromptService.reset();
    };
    resetRatingPrompt();
  }, []);

  // Resetear el estado cuando la pantalla recibe foco (para permitir escanear de nuevo)
  useFocusEffect(
    useCallback(() => {
      console.log(
        "[ScanScreen] 🔄 Pantalla enfocada, reseteando estado de escaneo",
      );
      setScanned(false);
      lockRef.current = false;
      resetAnalysis();
      setShowConfirmModal(false);
    }, [resetAnalysis]),
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      console.log("[ScanScreen] 📷 Código escaneado:", {
        data,
        returnTo,
        meal,
      });

      if (lockRef.current) {
        console.log("[ScanScreen] ⚠️ Escaneo bloqueado (ya procesado)");
        return;
      }

      lockRef.current = true;
      setScanned(true);

      try {
        if (returnTo === "my-foods") {
          console.log(
            "[ScanScreen] 🔄 Navegando a my-foods con barcode:",
            data,
          );
          router.replace({
            pathname: "/(tabs)/my-foods",
            params: { barcode: data },
          });
        } else if (returnTo === "create-recipe") {
          console.log(
            "[ScanScreen] 🔄 Navegando a create-recipe con barcode:",
            data,
          );
          router.replace({
            pathname: "/(tabs)/create-recipe",
            params: { barcode: data, recipeId: recipeId || undefined },
          });
        } else {
          console.log(
            "[ScanScreen] 🔄 Navegando a add-food con barcode:",
            data,
            "meal:",
            meal,
          );
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
    [meal, returnTo, recipeId],
  );

  // Detectar modo desde params
  useEffect(() => {
    const mode = params.mode as "barcode" | "ai" | undefined;
    setScanMode(mode === "ai" ? "ai" : "barcode");
  }, [params.mode]);

  const handleClose = useCallback(() => {
    if (returnTo === "create-recipe") {
      router.replace({
        pathname: "/(tabs)/create-recipe",
        params: recipeId ? { recipeId } : { reset: "true" },
      });
    } else if (returnTo === "add-food") {
      router.replace("/(tabs)/add-food");
    } else {
      router.back();
    }
  }, [returnTo, recipeId]);

  const handleModeToggle = useCallback(() => {
    setScanMode((prev) => (prev === "barcode" ? "ai" : "barcode"));
    setScanned(false);
    lockRef.current = false;
    resetAnalysis();
  }, [resetAnalysis]);

  const handleCapture = useCallback(() => {
    if (scanMode !== "ai") return;
    // Si hay un barcode pendiente → leer la etiqueta nutricional
    if (pendingBarcode) {
      if (!isLabelScanning) captureAndRead(cameraRef);
    } else {
      if (!isAnalyzing) captureAndAnalyze(cameraRef);
    }
  }, [scanMode, pendingBarcode, isAnalyzing, isLabelScanning, captureAndAnalyze, captureAndRead, cameraRef]);

  const handleCloseConfirmModal = useCallback(() => {
    setShowConfirmModal(false);
    resetAnalysis();
  }, [resetAnalysis]);

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
            Continuar
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

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <CameraView
        ref={cameraRef}
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
        <>
          {/* Overlay oscuro recortado alrededor del frame */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <BlurView
              intensity={70}
              tint="dark"
              style={[styles.barcodeTopOverlay, { height: insets.top + 116 }]}
            />
            <View style={[styles.barcodeMiddleRow, { height: FRAME_H }]}>
              <BlurView intensity={70} tint="dark" style={styles.barcodeSideOverlay} />
              <View style={{ width: FRAME_W }} />
              <BlurView intensity={70} tint="dark" style={styles.barcodeSideOverlay} />
            </View>
            <BlurView intensity={70} tint="dark" style={styles.barcodeBottomOverlay} />
          </View>

          <View style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
            <View style={styles.topRow}>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
              >
                <Feather name="x" size={24} color="white" />
              </Pressable>
              <Text style={styles.title}>Escanear código</Text>
              <View style={styles.iconBtn} />
            </View>

            {/* Frame con esquinas iluminadas */}
            <View style={[styles.frame, { width: FRAME_W, height: FRAME_H }]}>
              {/* Esquina top-left */}
              <View style={[styles.corner, styles.cornerTL]} />
              {/* Esquina top-right */}
              <View style={[styles.corner, styles.cornerTR]} />
              {/* Esquina bottom-left */}
              <View style={[styles.corner, styles.cornerBL]} />
              {/* Esquina bottom-right */}
              <View style={[styles.corner, styles.cornerBR]} />
            </View>

            <Text style={styles.hint}>Apunta la cámara al código de barras</Text>
          </View>
        </>
      ) : (
        <>
          <ScannerOverlay isScanning={isAnalyzing} isRetrying={isRetrying} />
          <View style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
            <View style={styles.topRow}>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Feather name="x" size={24} color="white" />
              </Pressable>

              <Text style={styles.title}>
                {pendingBarcode ? "Leer etiqueta" : "Escaneo por IA"}
              </Text>

              {!pendingBarcode ? (
                <Pressable
                  onPress={handleModeToggle}
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
                >
                  <Feather name="maximize-2" size={24} color="white" />
                </Pressable>
              ) : (
                <View style={styles.iconBtn} />
              )}
            </View>

            {pendingBarcode && (
              <Text style={styles.hint}>
                {isLabelScanning
                  ? isLabelRetrying ? "Analizando…" : "Leyendo etiqueta…"
                  : "Enfoca la tabla nutricional y toca el botón"}
              </Text>
            )}

            {/* Botón de captura */}
            <View style={styles.captureContainer}>
              <Pressable
                onPress={handleCapture}
                disabled={pendingBarcode ? isLabelScanning : isAnalyzing}
                style={({ pressed }) => [
                  styles.captureButton,
                  (pendingBarcode ? isLabelScanning : isAnalyzing) && styles.captureButtonDisabled,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
                ]}
              >
                {(pendingBarcode ? isLabelScanning : isAnalyzing) ? (
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
        barcodeToRegister={pendingBarcode}
      />

      {/* Premium Paywall Modal */}
      <PremiumPaywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => {
          setPaywallVisible(false);
          // El usuario ahora es premium, puede escanear ilimitadamente
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  topRow: {
    width: "100%",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  title: { color: "white", fontSize: 16, fontWeight: "800" },
  frame: {
    marginTop: 54,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: "rgba(255,255,255,0.95)",
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: "rgba(255,255,255,0.95)",
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: "rgba(255,255,255,0.95)",
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: "rgba(255,255,255,0.95)",
    borderBottomRightRadius: 10,
  },
  hint: { marginTop: 20, color: "rgba(255,255,255,0.85)", fontSize: 13, letterSpacing: 0.2 },
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
  barcodeTopOverlay: {
    width: "100%",
  },
  barcodeMiddleRow: {
    flexDirection: "row",
  },
  barcodeSideOverlay: {
    flex: 1,
  },
  barcodeBottomOverlay: {
    flex: 1,
  },
});
