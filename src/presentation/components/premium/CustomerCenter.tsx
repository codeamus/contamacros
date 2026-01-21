// src/presentation/components/premium/CustomerCenter.tsx
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform } from "react-native";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type CustomerCenterProps = {
  visible: boolean;
  onClose: () => void;
};

export default function CustomerCenter({
  visible,
  onClose,
}: CustomerCenterProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { customerInfo, restorePurchases, reload } = useRevenueCat();
  const [isRestoring, setIsRestoring] = useState(false);
  const s = makeStyles(colors, typography);

  const handleRestore = async () => {
    setIsRestoring(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await restorePurchases();
      await reload();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleOpenRevenueCatUI = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Solo importar en plataformas nativas
      if (Platform.OS === "ios" || Platform.OS === "android") {
        const PurchasesUI = await import("react-native-purchases-ui");
        // RevenueCat UI maneja automáticamente la gestión de suscripciones
        await PurchasesUI.default.presentCustomerCenter();
      } else {
        console.warn("[CustomerCenter] Customer Center solo está disponible en iOS y Android");
      }
    } catch (error) {
      console.error("[CustomerCenter] Error al abrir UI:", error);
    }
  };

  const hasActiveSubscription =
    customerInfo?.entitlements.active["ContaMacros Pro"] !== undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.container}>
          <View style={s.header}>
            <Text style={s.title}>Gestionar Suscripción</Text>
            <Pressable onPress={onClose} style={s.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <View style={s.content}>
            {hasActiveSubscription ? (
              <>
                <View style={s.statusContainer}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={48}
                    color="#10B981"
                  />
                  <Text style={s.statusTitle}>Suscripción Activa</Text>
                  <Text style={s.statusText}>
                    Tienes acceso a todas las funciones premium
                  </Text>
                </View>

                <Pressable
                  onPress={handleOpenRevenueCatUI}
                  style={({ pressed }) => [
                    s.actionButton,
                    pressed && s.actionButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="cog"
                    size={20}
                    color={colors.onCta}
                  />
                  <Text style={s.actionButtonText}>
                    Gestionar suscripción
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={s.statusContainer}>
                  <MaterialCommunityIcons
                    name="account-off"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text style={s.statusTitle}>Sin Suscripción Activa</Text>
                  <Text style={s.statusText}>
                    No tienes una suscripción activa en este momento
                  </Text>
                </View>

                <Pressable
                  onPress={handleRestore}
                  disabled={isRestoring}
                  style={({ pressed }) => [
                    s.actionButton,
                    s.actionButtonSecondary,
                    (pressed || isRestoring) && s.actionButtonPressed,
                  ]}
                >
                  {isRestoring ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="refresh"
                        size={20}
                        color={colors.brand}
                      />
                      <Text style={[s.actionButtonText, s.actionButtonTextSecondary]}>
                        Restaurar compras
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            <View style={s.infoContainer}>
              <Text style={s.infoText}>
                Para cancelar o modificar tu suscripción, usa el botón "Gestionar suscripción" o
                ve a la configuración de tu dispositivo.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    container: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      width: "100%",
      maxWidth: 400,
      maxHeight: "80%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      ...typography.h2,
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      padding: 20,
    },
    statusContainer: {
      alignItems: "center",
      marginBottom: 24,
    },
    statusTitle: {
      ...typography.subtitle,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 8,
    },
    statusText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.brand,
      marginBottom: 16,
    },
    actionButtonSecondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.brand,
    },
    actionButtonPressed: {
      opacity: 0.7,
    },
    actionButtonText: {
      ...typography.button,
      fontSize: 16,
      fontWeight: "600",
      color: colors.onCta,
    },
    actionButtonTextSecondary: {
      color: colors.brand,
    },
    infoContainer: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      textAlign: "center",
    },
  });
}
