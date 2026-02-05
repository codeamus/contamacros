// app/(auth)/reset-password.tsx
import { supabase } from "@/data/supabase/supabaseClient";
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
     KeyboardAvoidingView,
     Platform,
     ScrollView,
     StyleSheet,
     Text,
     View,
} from "react-native";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onResetPassword() {
    // Validaciones básicas
    if (token.length < 8) {
      showToast({
        message: "El código debe ser de 8 dígitos",
        type: "warning",
      });
      return;
    }
    if (newPassword.length < 6) {
      showToast({
        message: "La contraseña debe tener al menos 6 caracteres",
        type: "warning",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ message: "Las contraseñas no coinciden", type: "error" });
      return;
    }

    setLoading(true);
    try {
      // PASO 1: Verificar el código OTP (Tipo 'recovery')
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email!,
        token: token.trim(),
        type: "recovery", // <--- Clave para recuperación
      });

      if (verifyError) throw verifyError;

      // PASO 2: Actualizar la contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      showToast({
        message: "¡Contraseña actualizada con éxito!",
        type: "success",
        position: "top",
      });

      // Enviamos al login para que entre con su nueva clave
      router.replace("/(auth)/login");
    } catch (error: any) {
      showToast({
        message: error.message || "Error al restablecer la contraseña",
        type: "error",
        position: "top",
      });
    } finally {
      setLoading(false);
    }
  }

  const styles = makeStyles(colors, typography);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        >
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Feather name="shield" size={30} color={colors.textPrimary} />
            </View>

            <Text style={styles.title}>Nueva Contraseña</Text>
            <Text style={styles.subtitle}>
              Ingresa el código enviado a{"\n"}
              <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
                {email}
              </Text>
            </Text>

            <View style={{ gap: 16, width: "100%" }}>
              <AuthTextField
                label="Código de 8 dígitos"
                value={token}
                onChangeText={setToken}
                placeholder="00000000"
                keyboardType="number-pad"
                maxLength={8}
                style={styles.otpInput}
              />

              <AuthTextField
                label="Nueva Contraseña"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                secureTextEntry
                leftIcon={
                  <Feather name="lock" size={18} color={colors.textSecondary} />
                }
              />

              <AuthTextField
                label="Confirmar Contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry
                leftIcon={
                  <Feather
                    name="check-circle"
                    size={18}
                    color={colors.textSecondary}
                  />
                }
              />

              <View style={{ marginTop: 10 }}>
                <PrimaryButton
                  title="Restablecer y Guardar"
                  onPress={onResetPassword}
                  loading={loading}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    screen: { flex: 1, padding: 20, backgroundColor: colors.background },
    card: {
      padding: 30,
      borderRadius: 32,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.05,
      shadowRadius: 20,
      elevation: 5,
    },
    iconCircle: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    title: { ...typography.title, fontSize: 24, color: colors.textPrimary },
    subtitle: {
      marginTop: 8,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 25,
      lineHeight: 20,
    },
    otpInput: {
      fontSize: 24,
      textAlign: "center",
      letterSpacing: 4,
      fontWeight: "bold",
      color: colors.primary,
    },
  });
}
