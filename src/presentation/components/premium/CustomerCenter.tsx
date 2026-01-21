// src/presentation/components/premium/CustomerCenter.tsx
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
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
  const { showToast } = useToast();
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
      console.error("[CustomerCenter] Error al restaurar:", error);
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
      showToast({
        message: "Error al abrir la gestión de suscripciones",
        type: "error",
        duration: 2000,
      });
    }
  };

  const handleManageSubscriptionInAppStore = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (Platform.OS === "ios") {
        const url = "https://apps.apple.com/account/subscriptions";
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          showToast({
            message: "Abriendo configuración de suscripciones",
            type: "info",
            duration: 2000,
          });
        } else {
          showToast({
            message: "No se pudo abrir la configuración de suscripciones",
            type: "error",
            duration: 2000,
          });
        }
      } else {
        showToast({
          message: "Disponible solo en iOS",
          type: "info",
          duration: 2000,
        });
      }
    } catch (error) {
      console.error("[CustomerCenter] Error al abrir suscripciones:", error);
      showToast({
        message: "Error al abrir la configuración de suscripciones",
        type: "error",
        duration: 2000,
      });
    }
  };

  const hasActiveSubscription =
    customerInfo?.entitlements.active["ContaMacros Pro"] !== undefined;

  // Debug: Log para verificar el estado
  console.log("[CustomerCenter] Estado:", {
    hasActiveSubscription,
    platform: Platform.OS,
    customerInfo: customerInfo ? "presente" : "null",
  });

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

                {Platform.OS === "ios" && (
                  <>
                    <View style={{ height: 8 }} />
                    <Pressable
                      onPress={handleManageSubscriptionInAppStore}
                      style={({ pressed }) => [
                        s.actionButton,
                        s.actionButtonSecondary,
                        pressed && s.actionButtonPressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="credit-card-outline"
                        size={20}
                        color={colors.brand}
                      />
                      <Text style={[s.actionButtonText, s.actionButtonTextSecondary]}>
                        Gestionar en App Store
                      </Text>
                    </Pressable>
                  </>
                )}
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

                {Platform.OS === "ios" && (
                  <>
                    <View style={{ height: 8 }} />
                    <Pressable
                      onPress={handleManageSubscriptionInAppStore}
                      style={({ pressed }) => [
                        s.actionButton,
                        s.actionButtonSecondary,
                        pressed && s.actionButtonPressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="credit-card-outline"
                        size={20}
                        color={colors.brand}
                      />
                      <Text style={[s.actionButtonText, s.actionButtonTextSecondary]}>
                        Gestionar en App Store
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            <View style={s.infoContainer}>
              <Text style={s.infoText}>
                Para cancelar o modificar tu suscripción, usa el botón Gestionar suscripción o
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
