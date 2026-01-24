// src/presentation/hooks/scanner/useMacroScanner.ts
import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { analyzeFoodImage, type MacroAnalysisResult } from "@/data/ai/geminiService";
import { handleError, getErrorMessage } from "@/core/errors/errorHandler";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { usePremium } from "@/presentation/hooks/subscriptions/usePremium";
import { canScanToday, incrementScanCount } from "@/domain/services/scanLimitService";

type UseMacroScannerOptions = {
  onAnalysisComplete?: (result: MacroAnalysisResult) => void;
  onLimitReached?: () => void; // Callback cuando se alcanza el límite
};

// Lock in-flight para evitar llamadas concurrentes
let isAnalyzingInFlight = false;

export function useMacroScanner(options?: UseMacroScannerOptions) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MacroAnalysisResult | null>(null);
  const { showToast } = useToast();
  const { isPremium } = usePremium();

  const captureAndAnalyze = useCallback(async () => {
    // Lock in-flight: evitar llamadas concurrentes
    if (isAnalyzing || isAnalyzingInFlight) {
      return;
    }
    
    isAnalyzingInFlight = true;

    // Verificar límite diario solo si NO es premium
    if (!isPremium) {
      const canScan = await canScanToday();
      if (!canScan) {
        // Límite alcanzado, notificar al componente padre
        options?.onLimitReached?.();
        return;
      }
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
        mediaTypes: "images",
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (photo.canceled || !photo.assets[0]) {
        setIsAnalyzing(false);
        isAnalyzingInFlight = false;
        return;
      }

      const asset = photo.assets[0];
      
      if (!asset.base64) {
        throw new Error("No se pudo capturar la imagen");
      }

      // Compresión obligatoria: máximo 512px (ancho o alto) y calidad 0.3
      // Esto reduce drásticamente el tamaño del Base64, consumiendo el mínimo de tokens posible
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 512 } }], // Máximo 512px de ancho (mantiene aspect ratio)
        {
          compress: 0.3, // Calidad 0.3 para optimización extrema de tokens
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      if (!manipulatedImage.base64) {
        throw new Error("Error al procesar la imagen");
      }

      // Analizar con Gemini (el servicio maneja reintentos automáticamente)
      // Mostrar "Reintentando..." si el análisis tarda más de 4 segundos (probable reintento)
      const analysisPromise = analyzeFoodImage(manipulatedImage.base64);
      const timeoutId = setTimeout(() => {
        setIsRetrying(true);
      }, 4000); // Mostrar "Reintentando..." después de 4 segundos

      try {
        const result = await analysisPromise;
        clearTimeout(timeoutId);
        setIsRetrying(false);
        setAnalysisResult(result);
        
        // Incrementar contador solo si NO es premium y el análisis fue exitoso
        if (!isPremium) {
          await incrementScanCount();
        }
        
        options?.onAnalysisComplete?.(result);
      } catch (error) {
        clearTimeout(timeoutId);
        setIsRetrying(false);
        throw error;
      }
    } catch (error) {
      console.error("[useMacroScanner] Error:", error);
      
      // Determinar tipo de error para mostrar mensaje descriptivo
      let errorMessage: string;
      let isApiKeyError = false;
      let isNetworkError = false;

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        // Detectar errores de API Key
        if (errorMsg.includes("api key") || 
            errorMsg.includes("api_key") || 
            errorMsg.includes("autenticación") ||
            errorMsg.includes("no configurada")) {
          isApiKeyError = true;
          errorMessage = "Error de API Key: Verifica que EXPO_PUBLIC_GEMINI_API_KEY esté configurada en tu archivo .env";
        }
        // Detectar errores de límite de tokens (429) o quota exceeded
        else if (errorMsg.includes("429") || 
                 errorMsg.includes("resource_exhausted") ||
                 errorMsg.includes("quota exceeded") ||
                 errorMsg.includes("quota") ||
                 errorMsg.includes("límite") ||
                 errorMsg.includes("rate limit") ||
                 errorMsg.includes("revisa billing") ||
                 errorMsg.includes("reintenta en")) {
          // El mensaje ya viene formateado desde geminiService con retryDelay
          errorMessage = error.message;
        }
        // Detectar errores de red/conexión
        else if (errorMsg.includes("conexión") || 
                 errorMsg.includes("network") || 
                 errorMsg.includes("404") ||
                 errorMsg.includes("internet") ||
                 errorMsg.includes("failed to fetch") ||
                 errorMsg.includes("timeout")) {
          isNetworkError = true;
          // El servicio ya reintentó automáticamente, mostrar mensaje final
          errorMessage = "Error de conexión: Verifica tu internet e intenta de nuevo";
        }
        // Otros errores
        else {
          errorMessage = getErrorMessage(error);
        }
      } else {
        errorMessage = getErrorMessage(error);
      }
      
      showToast({
        message: errorMessage,
        type: "error",
        duration: isApiKeyError || isNetworkError ? 6000 : 4000,
      });
      
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
      isAnalyzingInFlight = false; // Liberar lock
    }
  }, [isAnalyzing, isPremium, options, showToast]);

  const resetAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setIsRetrying(false);
  }, []);

  return {
    isAnalyzing,
    isRetrying,
    analysisResult,
    captureAndAnalyze,
    resetAnalysis,
  };
}
