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


export default function LoginScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>(
    { email: false, password: false }
  );

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailError = useMemo(() => {
    if (!touched.email) return null;
    if (!email.trim()) return "Ingresa tu email";
    if (!isValidEmail(email)) return "Email inválido";
    return null;
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return null;
    if (!password.trim()) return "Ingresa tu contraseña";
    if (!isStrongEnoughPassword(password)) return "Mínimo 6 caracteres";
    return null;
  }, [password, touched.password]);

  const canSubmit = !emailError && !passwordError && email && password;

  async function onSubmit() {
    setTouched({ email: true, password: true });
    setFormError(null);

    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await signIn(email.trim(), password);
      if (!res.ok) {
        setFormError(res.message ?? "No pudimos iniciar sesión.");
        return;
      }
      // ✅ No hacemos router.replace aquí.
      // El AuthGate (guard) se encarga de redirigir.
    } catch (e) {
      setFormError("No pudimos iniciar sesión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Iniciar sesión</Text>
        <Text style={styles.subtitle}>
          Accede para registrar tus comidas y macros.
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
            placeholder="••••••••"
            secureTextEntry
            error={passwordError}
          />

          {!!formError && <Text style={styles.formError}>{formError}</Text>}

          <PrimaryButton
            title="Entrar"
            onPress={onSubmit}
            loading={loading}
            disabled={!canSubmit}
          />

          <Pressable
            onPress={() => {
              // Placeholder: lo implementamos en un issue futuro
              setFormError("Recuperación de contraseña: pendiente.");
            }}
          >
            <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.link}>
              ¿No tienes cuenta?{" "}
              <Text style={styles.linkStrong}>Regístrate</Text>
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
});
