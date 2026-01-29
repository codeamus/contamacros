// src/presentation/components/nutrition/CreateGenericFoodByBarcodeModal.tsx
import type { GenericFoodDb } from "@/data/food/genericFoodsRepository";
import ProductForm from "@/presentation/components/nutrition/ProductForm";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import React from "react";
import { Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  barcode: string;
  onClose: () => void;
  onSuccess: (food: GenericFoodDb) => void;
};

export default function CreateGenericFoodByBarcodeModal({
  visible,
  barcode,
  onClose,
  onSuccess,
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    box: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 20,
      overflow: "hidden",
      maxHeight: "90%",
    },
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.box}>
          <ProductForm
            key={barcode}
            barcode={barcode}
            onSuccess={(food) => {
              onSuccess(food);
              onClose();
            }}
            onCancel={onClose}
            submitLabel="Crear y usar"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
