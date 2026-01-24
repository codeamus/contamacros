// src/presentation/hooks/scanner/useMacroScanner.ts
import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { analyzeFoodImage, type MacroAnalysisResult } from "@/data/ai/geminiService";
import { handleError, getErrorMessage } from "@/core/errors/errorHandler";
import { useToast } from "@/presentation/hooks/ui/useToast";

type UseMacroScannerOptions = {
  onAnalysisComplete?: (result: MacroAnalysisResult) => void;
};

export function useMacroScanner(options?: UseMacroScannerOptions) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MacroAnalysisResult | null>(null);
  const { showToast } = useToast();

  const captureAndAnalyze = useCallback(async () => {
    if (isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);

    try {
      // Solicitar permisos de cámara si no están otorgados
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Se necesitan permisos de cámara para escanear alimentos");
      }

      // Capturar foto desde la cámara
      const photo = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (photo.canceled || !photo.assets[0]) {
        setIsAnalyzing(false);
        return;
      }

      const asset = photo.assets[0];
      
      if (!asset.base64) {
        throw new Error("No se pudo capturar la imagen");
      }

      // Redimensionar imagen a 800px de ancho para optimizar velocidad
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      if (!manipulatedImage.base64) {
        throw new Error("Error al procesar la imagen");
      }

      // Analizar con Gemini
      const result = await analyzeFoodImage(manipulatedImage.base64);
      
      setAnalysisResult(result);
      options?.onAnalysisComplete?.(result);
    } catch (error) {
      console.error("[useMacroScanner] Error:", error);
      const errorMessage = getErrorMessage(error);
      
      showToast({
        message: errorMessage,
        type: "error",
        duration: 4000,
      });
      
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, options, showToast]);

  const resetAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setIsAnalyzing(false);
  }, []);

  return {
    isAnalyzing,
    analysisResult,
    captureAndAnalyze,
    resetAnalysis,
  };
}
