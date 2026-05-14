import { readNutritionLabel, type LabelReadResult } from "@/data/ai/labelReaderService";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { type CameraView } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useCallback, useState } from "react";
import type { RefObject } from "react";

type UseLabelScannerOptions = {
  onSuccess: (result: LabelReadResult) => void;
};

let isInFlight = false;

export function useLabelScanner({ onSuccess }: UseLabelScannerOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const { showToast } = useToast();

  const captureAndRead = useCallback(async (cameraRef: RefObject<CameraView | null>) => {
    if (isScanning || isInFlight) return;
    if (!cameraRef.current) {
      showToast({ message: "Cámara no disponible", type: "error" });
      return;
    }

    isInFlight = true;
    setIsScanning(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.9,
      });

      if (!photo?.base64) throw new Error("No se pudo capturar la imagen");

      // Mayor resolución que el food scanner (800px vs 512px) para leer texto pequeño
      const processed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );

      if (!processed.base64) throw new Error("Error al procesar la imagen");

      const retryTimer = setTimeout(() => setIsRetrying(true), 5000);

      try {
        const result = await readNutritionLabel(processed.base64);
        clearTimeout(retryTimer);
        setIsRetrying(false);

        const hasAnyValue = result.kcal_100g != null || result.protein_100g != null ||
                            result.carbs_100g != null || result.fat_100g != null;

        if (!hasAnyValue) {
          showToast({
            message: "No se detectó una tabla nutricional. Asegúrate de enfocar bien la etiqueta.",
            type: "error",
            duration: 4000,
          });
          return;
        }

        onSuccess(result);
      } catch (err) {
        clearTimeout(retryTimer);
        setIsRetrying(false);
        throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al leer la etiqueta";
      showToast({ message: msg, type: "error", duration: 4000 });
    } finally {
      setIsScanning(false);
      isInFlight = false;
    }
  }, [isScanning, onSuccess, showToast]);

  return { isScanning, isRetrying, captureAndRead };
}
