// app/(auth)/forgot-password.tsx
import { supabase } from "@/data/supabase/supabaseClient";
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
     KeyboardAvoidingView,
     Platform,
     Pressable,
     StyleSheet,
     Text,
     View,
} from "react-native";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  async function handleSendCode() {
    if (!email.includes("@")) {
      showToast({ message: "Ingresa un email válido", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          // Importante: Esto le dice a Supabase que envíe un OTP
          redirectTo: undefined,
        },
      );

      if (error) throw error;

      showToast({ message: "Código de recuperación enviado", type: "success" });

      // Navegamos a la pantalla donde pondrá la nueva clave
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: email.trim() },
      });
    } catch (error: any) {
      showToast({
        message: error.message || "Error al enviar el correo",
        type: "error",
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
      >
        <View style={styles.card}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.iconCircle}>
            <Feather name="key" size={30} color={colors.textPrimary} />
          </View>

          <Text style={styles.title}>Recuperar acceso</Text>
          <Text style={styles.subtitle}>
            Te enviaremos un código de 8 dígitos para que puedas crear una nueva
            contraseña.
          </Text>

          <View style={{ gap: 20, width: "100%" }}>
            <AuthTextField
              label="Email de tu cuenta"
              value={email}
              onChangeText={setEmail}
              placeholder="tuemail@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={
                <Feather name="mail" size={18} color={colors.textSecondary} />
              }
            />

            <PrimaryButton
              title="Enviar código"
              onPress={handleSendCode}
              loading={loading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      padding: 20,
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    card: {
      padding: 30,
      borderRadius: 32,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    backBtn: { position: "absolute", top: 20, left: 20 },
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
      marginBottom: 20,
    },
  });
}
