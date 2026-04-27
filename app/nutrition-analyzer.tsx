// app/(tabs)/nutrition-analyzer.tsx

import {
  analyzeProductNutrition,
  type NutritionAnalysisResult,
  type UserNutritionContext,
} from "@/data/ai/nutritionAnalyzerService";
import NutritionAnalysisCard from "@/presentation/components/nutrition/NutritionAnalysisCard";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenState = "camera" | "preview" | "analyzing" | "result" | "error";

export default function NutritionAnalyzerScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { profile } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [screenState, setScreenState] = useState<ScreenState>("camera");
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [result, setResult] = useState<NutritionAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const cameraRef = useRef<CameraView>(null);
  const s = makeStyles(colors, typography);

  const userContext: UserNutritionContext = {
    dailyCalorieGoal: profile?.daily_calorie_target ?? 2000,
    remainingCalories: profile?.daily_calorie_target ?? 2000,
    remainingProtein: profile?.protein_g ?? 150,
    remainingCarbs: profile?.carbs_g ?? 250,
    remainingFat: profile?.fat_g ?? 65,
  };

  // Paso 1: tomar foto y mostrar preview
  const handleCapture = async () => {
    if (!cameraRef.current || screenState !== "camera") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (!photo?.base64 || !photo.uri) throw new Error("No se pudo capturar la foto");

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 900 } }],
        { base64: true, compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (!manipulated.base64) throw new Error("Error al procesar la imagen");

      setCapturedUri(manipulated.uri);
      setCapturedBase64(manipulated.base64);
      setScreenState("preview");
    } catch (err: any) {
      setErrorMessage(err?.message || "No se pudo capturar la foto. Intenta de nuevo.");
      setScreenState("error");
    }
  };

  // Paso 2: enviar a analizar desde el preview
  const handleAnalyze = async () => {
    if (!capturedBase64) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState("analyzing");

    try {
      const analysis = await analyzeProductNutrition(capturedBase64, userContext);
      setResult(analysis);
      setScreenState("result");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setErrorMessage(err?.message || "No se pudo analizar el producto. Intenta de nuevo.");
      setScreenState("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setCapturedUri(null);
    setCapturedBase64(null);
    setErrorMessage("");
    setScreenState("camera");
  };

  if (!permission) {
    return (
      <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.flex, s.center, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="camera-off" size={48} color={colors.textSecondary} />
        <Text style={[s.emptyTitle, { marginTop: 16 }]}>Permiso de cámara requerido</Text>
        <Text style={s.emptySubtitle}>Necesitamos acceso a tu cámara para analizar productos.</Text>
        <Pressable style={s.ctaButton} onPress={requestPermission}>
          <Text style={s.ctaButtonText}>Permitir acceso</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const headerBg = screenState === "result" || screenState === "error"
    ? colors.background
    : "#000";
  const headerTextColor = screenState === "result" || screenState === "error"
    ? colors.textPrimary
    : "#fff";

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: headerBg }]} edges={["top"]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg }]}>
        <Pressable onPress={() => router.back()} style={s.backButton} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={headerTextColor} />
        </Pressable>
        <Text style={[s.headerTitle, { color: headerTextColor }]}>Analizar Producto</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ESTADO: Cámara */}
      {screenState === "camera" && (
        <CameraView ref={cameraRef} style={s.flex} facing="back">
          <View style={s.hintContainer}>
            <View style={s.hintBadge}>
              <MaterialCommunityIcons name="lightbulb-on" size={16} color="#FBBF24" />
              <Text style={s.hintText}>
                Apunta a la tabla nutricional o frente del producto
              </Text>
            </View>
          </View>
          <View style={s.captureContainer}>
            <Pressable
              onPress={handleCapture}
              style={({ pressed }) => [s.captureButton, pressed && { opacity: 0.8 }]}
            >
              <View style={s.captureButtonInner} />
            </Pressable>
          </View>
        </CameraView>
      )}

      {/* ESTADO: Preview — usuario confirma antes de analizar */}
      {screenState === "preview" && capturedUri && (
        <View style={s.flex}>
          <Image source={{ uri: capturedUri }} style={s.previewImage} resizeMode="cover" />

          <View style={[s.actionsRow, { backgroundColor: "#000", borderTopColor: "#333" }]}>
            <Pressable
              onPress={handleRetry}
              style={[s.actionButton, s.actionButtonSecondary, { borderColor: "#555" }]}
            >
              <MaterialCommunityIcons name="camera-retake" size={18} color="#fff" />
              <Text style={[s.actionButtonText, { color: "#fff" }]}>Repetir</Text>
            </Pressable>
            <Pressable
              onPress={handleAnalyze}
              style={[s.actionButton, s.actionButtonPrimary, { backgroundColor: colors.brand }]}
            >
              <MaterialCommunityIcons name="star-check" size={18} color="#fff" />
              <Text style={[s.actionButtonText, { color: "#fff" }]}>Analizar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ESTADO: Analizando */}
      {screenState === "analyzing" && capturedUri && (
        <View style={s.flex}>
          <Image
            source={{ uri: capturedUri }}
            style={[s.previewImage, { opacity: 0.4 }]}
            resizeMode="cover"
          />
          <View style={s.analyzingOverlay}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={[s.analyzingText, { color: colors.textPrimary }]}>
              Analizando producto...
            </Text>
            <Text style={[s.analyzingSubtext, { color: colors.textSecondary }]}>
              Esto puede tomar unos segundos
            </Text>
          </View>
        </View>
      )}

      {/* ESTADO: Resultado */}
      {screenState === "result" && result && (
        <View style={[s.flex, { backgroundColor: colors.background }]}>
          <NutritionAnalysisCard result={result} />
          <View style={[s.actionsRow, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Pressable
              onPress={handleRetry}
              style={[s.actionButton, s.actionButtonSecondary, { borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name="camera-retake" size={18} color={colors.textPrimary} />
              <Text style={[s.actionButtonText, { color: colors.textPrimary }]}>Otro producto</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={[s.actionButton, s.actionButtonPrimary, { backgroundColor: colors.brand }]}
            >
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
              <Text style={[s.actionButtonText, { color: "#fff" }]}>Listo</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ESTADO: Error */}
      {screenState === "error" && (
        <View style={[s.flex, s.center, { backgroundColor: colors.background, padding: 24 }]}>
          <MaterialCommunityIcons name="image-search" size={56} color={colors.textSecondary} />
          <Text style={[s.emptyTitle, { marginTop: 16 }]}>No pude leer el producto</Text>
          <Text style={s.emptySubtitle}>{errorMessage}</Text>
          <Text style={[s.tipText, { color: colors.textSecondary }]}>
            Intenta fotografiar directamente la tabla nutricional o el frente con el nombre visible.
          </Text>
          <Pressable style={s.ctaButton} onPress={handleRetry}>
            <MaterialCommunityIcons name="camera-retake" size={18} color="#fff" />
            <Text style={s.ctaButtonText}>Intentar de nuevo</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    flex: { flex: 1 },
    center: { alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      ...typography.subtitle,
      fontSize: 17,
      fontWeight: "700",
    },
    hintContainer: {
      position: "absolute",
      bottom: 120,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    hintBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,0,0,0.65)",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    hintText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "500",
    },
    captureContainer: {
      position: "absolute",
      bottom: 40,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    captureButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 4,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    captureButtonInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#fff",
    },
    previewImage: {
      flex: 1,
      width: "100%",
    },
    analyzingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: "rgba(0,0,0,0.3)",
    },
    analyzingText: {
      fontSize: 17,
      fontWeight: "700",
    },
    analyzingSubtext: {
      fontSize: 13,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
    },
    actionButtonSecondary: {
      borderWidth: 1,
    },
    actionButtonPrimary: {},
    actionButtonText: {
      fontSize: 15,
      fontWeight: "700",
    },
    emptyTitle: {
      ...typography.h2,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 8,
    },
    emptySubtitle: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 16,
    },
    tipText: {
      fontSize: 13,
      textAlign: "center",
      lineHeight: 18,
      marginBottom: 24,
      paddingHorizontal: 8,
    },
    ctaButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.brand,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 14,
    },
    ctaButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
