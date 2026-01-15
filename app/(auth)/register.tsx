// app/(auth)/register.tsx
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import {
  isStrongEnoughPassword,
  isValidEmail,
} from "@/presentation/utils/authValidation";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";


export default function RegisterScreen() {
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirm: false,
  });

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const emailError = useMemo(() => {
    if (!touched.email) return null;
    if (!email.trim()) return "Ingresa tu email";
    if (!isValidEmail(email)) return "Email inválido";
    return null;
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return null;
    if (!password.trim()) return "Crea una contraseña";
    if (!isStrongEnoughPassword(password)) return "Mínimo 6 caracteres";
    return null;
  }, [password, touched.password]);

  const confirmError = useMemo(() => {
    if (!touched.confirm) return null;
    if (!confirm.trim()) return "Confirma tu contraseña";
    if (confirm !== password) return "Las contraseñas no coinciden";
    return null;
  }, [confirm, password, touched.confirm]);

  const canSubmit =
    !emailError &&
    !passwordError &&
    !confirmError &&
    email &&
    password &&
    confirm;

  async function onSubmit() {
    setTouched({ email: true, password: true, confirm: true });
    setFormError(null);

    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await signUp(email.trim(), password);
      if (!res.ok) {
        setFormError(res.message ?? "No pudimos crear tu cuenta.");
        return;
      }else{
        router.replace("/(onboarding)/goal");
      }
      
    } catch (e) {
      setFormError("No pudimos crear tu cuenta. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Crear cuenta</Text>
        <Text style={styles.subtitle}>
          Te tomará menos de un minuto. Luego configuramos tu objetivo.
        </Text>

        <View style={{ gap: 14, marginTop: 18 }}>
          <AuthTextField
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (!touched.email) setTouched((s) => ({ ...s, email: true }));
            }}
            placeholder="tuemail@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
          />

          <AuthTextField
            label="Contraseña"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (!touched.password)
                setTouched((s) => ({ ...s, password: true }));
            }}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            error={passwordError}
          />

          <AuthTextField
            label="Confirmar contraseña"
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t);
              if (!touched.confirm)
                setTouched((s) => ({ ...s, confirm: true }));
            }}
            placeholder="Repite tu contraseña"
            secureTextEntry
            error={confirmError}
          />

          {!!formError && <Text style={styles.formError}>{formError}</Text>}

          <PrimaryButton
            title="Crear cuenta"
            onPress={onSubmit}
            loading={loading}
            disabled={!canSubmit}
          />

          {!!successMsg && <Text style={styles.success}>{successMsg}</Text>}

          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>
              Ya tengo cuenta{" "}
              <Text style={styles.linkStrong}>Iniciar sesión</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 6, color: "#6B7280", fontSize: 14 },
  formError: { color: "#EF4444", fontSize: 13, marginTop: 4 },
  link: { color: "#374151", textAlign: "center", marginTop: 8 },
  linkStrong: { fontWeight: "700", color: "#111827" },
  success: { color: "#16A34A", fontSize: 13, marginTop: 4 },
});
