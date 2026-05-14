import { usePremium } from "@/presentation/hooks/subscriptions/usePremium";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  barcode: string;
  onClose: () => void;
  onScanWithAI: () => void;
  onShowPaywall: () => void;
  onEnterManually: () => void;
};

export default function ProductNotFoundModal({
  visible,
  barcode,
  onClose,
  onScanWithAI,
  onShowPaywall,
  onEnterManually,
}: Props) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const insets = useSafeAreaInsets();
  const { isPremium } = usePremium();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Icon */}
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.background },
          ]}
        >
          <MaterialCommunityIcons
            name="barcode-off"
            size={32}
            color={colors.textSecondary}
          />
        </View>

        <Text
          style={[
            styles.title,
            { fontFamily: typography.subtitle?.fontFamily, color: colors.textPrimary },
          ]}
        >
          Producto no encontrado
        </Text>

        <Text
          style={[
            styles.subtitle,
            { fontFamily: typography.body?.fontFamily, color: colors.textSecondary },
          ]}
        >
          No tenemos este código en nuestra base de datos todavía.
        </Text>

        {barcode ? (
          <View style={[styles.barcodeChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="barcode" size={16} color={colors.textSecondary} />
            <Text
              style={[
                styles.barcodeText,
                { fontFamily: typography.body?.fontFamily, color: colors.textSecondary },
              ]}
            >
              {barcode}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {/* Opción primaria: escanear etiqueta con IA (solo premium) */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (isPremium) onScanWithAI();
              else onShowPaywall();
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: isPremium ? colors.brand : colors.surface, opacity: pressed ? 0.88 : 1 },
              !isPremium && { borderWidth: 1, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="camera-iris"
              size={20}
              color={isPremium ? "#fff" : colors.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.primaryBtnTitleRow}>
                <Text
                  style={[
                    styles.primaryBtnTitle,
                    { fontFamily: typography.subtitle?.fontFamily, color: isPremium ? "#fff" : colors.textPrimary },
                  ]}
                >
                  Escanear tabla con IA
                </Text>
                <View style={styles.premiumBadge}>
                  <MaterialCommunityIcons name="crown" size={10} color="#1B3A2F" />
                  <Text style={styles.premiumBadgeText}>Premium</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.primaryBtnSub,
                  { fontFamily: typography.body?.fontFamily, color: isPremium ? "rgba(255,255,255,0.75)" : colors.textSecondary },
                ]}
              >
                {isPremium
                  ? "Toma una foto y extraemos los datos automáticamente"
                  : "Activa Premium para usar esta función"}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={isPremium ? "chevron-right" : "lock-outline"}
              size={18}
              color={isPremium ? "rgba(255,255,255,0.7)" : colors.textSecondary}
            />
          </Pressable>

          {/* Opción secundaria: ingresar manualmente */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onEnterManually();
            }}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
            <Text
              style={[
                styles.secondaryBtnText,
                { fontFamily: typography.subtitle?.fontFamily, color: colors.textPrimary },
              ]}
            >
              Ingresar manualmente
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: "center",
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  barcodeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  barcodeText: {
    fontSize: 13,
    letterSpacing: 1,
  },
  actions: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
  },
  primaryBtnTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  primaryBtnTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryBtnSub: {
    fontSize: 12,
    marginTop: 2,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#22C55E",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  premiumBadgeText: {
    color: "#1B3A2F",
    fontSize: 10,
    fontWeight: "800",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
  },
});
