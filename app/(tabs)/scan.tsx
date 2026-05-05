// app/(tabs)/scan.tsx
import type { MealType } from "@/domain/models/foodLogDb";
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { ConfirmMacroModal } from "@/presentation/components/scanner/ConfirmMacroModal";
import { ScannerOverlay } from "@/presentation/components/scanner/ScannerOverlay";
import { useMacroScanner } from "@/presentation/hooks/scanner/useMacroScanner";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { ratingPromptService } from "@/domain/services/ratingPromptService";
import { Feather } from "@expo/vector-icons";
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
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
function isMealType(x: unknown): x is MealType {
  return typeof x === "string" && MEALS.includes(x as MealType);
}

export default function ScanScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    meal?: string;
    returnTo?: string;
    mode?: string;
    recipeId?: string;
  }>();
  const meal: MealType = isMealType(params.meal) ? params.meal : "snack";
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

  // Hook para escaneo por IA
  const {
    isAnalyzing,
    isRetrying,
    analysisResult,
    captureAndAnalyze,
    resetAnalysis,
  } = useMacroScanner({
    onAnalysisComplete: () => {
      // Navegación automática: abrir modal de confirmación con los macros precargados
      setShowConfirmModal(true);
    },
    onLimitReached: () => {
      // Mostrar Alert cuando se alcanza el límite
      Alert.alert(
        "Función exclusiva Premium",
        "El escaneo por IA es exclusivo para usuarios Premium. ¡Activa tu plan para usarlo sin límites!",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Ver Premium",
            onPress: () => setPaywallVisible(true),
            style: "default",
          },
        ],
        { cancelable: true },
      );
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
    if (mode === "ai" || mode === "barcode") {
      setScanMode(mode);
    }
  }, [params.mode]);

  const handleClose = useCallback(() => {
    if (returnTo === "create-recipe") {
      router.replace({
        pathname: "/(tabs)/create-recipe",
        params: recipeId ? { recipeId } : { reset: "true" },
      });
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
    if (scanMode === "ai" && !isAnalyzing) {
      captureAndAnalyze(cameraRef);
    }
  }, [scanMode, isAnalyzing, captureAndAnalyze, cameraRef]);

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

            <Text style={styles.title}>Escanear código</Text>

            {/* Espaciador para mantener el título centrado */}
            <View style={styles.iconBtn} />
          </View>

          <View style={styles.frame} />
          <Text style={styles.hint}>Alinea el código dentro del recuadro</Text>
        </View>
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

              <Text style={styles.title}>Escaneo por IA</Text>

              <Pressable
                onPress={handleModeToggle}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Feather name="maximize-2" size={24} color="white" />
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
