import { supabase } from "@/data/supabase/supabaseClient";
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
     KeyboardAvoidingView,
     Platform,
     StyleSheet,
     Text,
     View,
} from "react-native";

export default function VerifyOtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const styles = makeStyles(typography);
  const { showToast } = useToast();

  const handleVerify = async () => {
    const cleanToken = token.trim();
    if (cleanToken.length < 6) return;
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: cleanToken,
      type: "signup",
    });

    if (error) {
      showToast({
        message: "Código incorrecto o expirado",
        type: "error",
        position: "top",
      });
      setLoading(false);
    } else {
      showToast({
        message: "¡Cuenta verificada!",
        type: "success",
        position: "top",
      });
      // El AuthGate detectará la sesión y te mandará al Home automáticamente
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Verifica tu email
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Hemos enviado un código de 6 dígitos a: {"\n"}
          <Text style={{ fontWeight: "bold", color: colors.textPrimary }}>
            {email}
          </Text>
        </Text>

        <AuthTextField
          label="Código de verificación"
          value={token}
          onChangeText={setToken}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={8}
          textAlign="center"
          style={{ fontSize: 24, letterSpacing: 8 }} // Estilo para que parezca OTP
        />

        <PrimaryButton
          title="Verificar y entrar"
          onPress={handleVerify}
          loading={loading}
          disabled={token.length < 8}
        />

        <Text
          style={[styles.resend, { color: colors.textSecondary }]}
          onPress={() => router.back()}
        >
          ¿Te equivocaste de email?{" "}
          <Text style={{ color: colors.textPrimary }}>Volver</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(typography: any) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 20 },
    card: { padding: 24, borderRadius: 24, borderWidth: 1, gap: 20 },
    title: {
      fontSize: 22,
      fontWeight: "bold",
      textAlign: "center",
      fontFamily: typography.subtitle?.fontFamily,
    },
    subtitle: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      fontFamily: typography.body?.fontFamily,
    },
    resend: {
      textAlign: "center",
      marginTop: 10,
      fontSize: 13,
      fontFamily: typography.body?.fontFamily,
    },
  });
}
