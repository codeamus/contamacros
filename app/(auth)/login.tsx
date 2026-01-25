// app/(auth)/login.tsx
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import {
  isStrongEnoughPassword,
  isValidEmail,
} from "@/presentation/utils/authValidation";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const logoLight = require("assets/images/logo-light-removebg.png");

function translateAuthMessage(msg?: string) {
  if (!msg) return null;

  const m = msg.toLowerCase();

  if (m.includes("user already registered") || m.includes("already registered"))
    return "Este email ya está registrado. Inicia sesión.";

  if (m.includes("invalid login credentials"))
    return "Email o contraseña incorrectos.";

  if (m.includes("email address is invalid") || m.includes("invalid email"))
    return "Email inválido.";

  if (m.includes("password") && m.includes("short"))
    return "La contraseña es demasiado corta.";

  if (m.includes("email not confirmed") || m.includes("email_not_confirmed") || m.includes("not confirmed"))
    return "Confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.";

  return msg;
}

export default function LoginScreen() {
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();

  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>(
    { email: false, password: false },
  );

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null,
  );
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

  const canSubmit = !emailError && !passwordError && !!email && !!password;

  async function onSubmit() {
    setTouched({ email: true, password: true });
    setFormError(null);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await signIn(email.trim(), password);
      if (!res.ok) {
        setFormError(
          translateAuthMessage(res.message) ?? "No pudimos iniciar sesión.",
        );
        return;
      }
    } catch {
      setFormError("No pudimos iniciar sesión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setFormError(null);
    setOauthLoading("google");
    try {
      const res = await signInWithGoogle();
      if (!res.ok && res.message) {
        setFormError(res.message ?? "No pudimos iniciar con Google.");
      }
    } finally {
      setOauthLoading(null);
    }
  }

  async function onApple() {
    setFormError(null);
    setOauthLoading("apple");
    try {
      const res = await signInWithApple();
      if (!res.ok && res.message) {
        setFormError(res.message ?? "No pudimos iniciar con Apple.");
      }
    } finally {
      setOauthLoading(null);
    }
  }

  // Animación de entrada
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const styles = makeStyles(colors, typography);

  const cardAnimStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  } as const;

  const busy = loading || !!oauthLoading;

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View style={[styles.card, cardAnimStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Image
                source={logoLight}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>ContaMacros</Text>
              <Text style={styles.title}>Iniciar sesión</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Registra tus comidas y sigue tus macros en segundos.
          </Text>

          {/* Form */}
          <View style={{ gap: 14, marginTop: 18 }}>
            <AuthTextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="tuemail@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={emailError}
              leftIcon={
                <Feather name="mail" size={18} color={colors.textSecondary} />
              }
            />

            <AuthTextField
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              error={passwordError}
              leftIcon={
                <Feather name="lock" size={18} color={colors.textSecondary} />
              }
              rightIcon={
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.textSecondary}
                />
              }
              onPressRightIcon={() => setShowPassword((s) => !s)}
            />

            {!!formError && (
              <View style={styles.alert}>
                <Feather name="alert-triangle" size={16} color={colors.onCta} />
                <Text style={styles.alertText}>{formError}</Text>
              </View>
            )}

            <PrimaryButton
              title="Entrar"
              onPress={onSubmit}
              loading={loading}
              disabled={!canSubmit || busy}
            />

            <Pressable
              onPress={() =>
                setFormError("Recuperación de contraseña: pendiente.")
              }
              disabled={busy}
            >
              {({ pressed }) => (
                <Text style={[styles.link, pressed && styles.linkPressed]}>
                  ¿Olvidaste tu contraseña?
                </Text>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <Pressable
              onPress={onGoogle}
              disabled={busy}
              style={({ pressed }) => [
                styles.oauthButton,
                pressed && { transform: [{ scale: 0.99 }], opacity: 0.9 },
                busy && { opacity: 0.6 },
              ]}
            >
              <MaterialCommunityIcons
                name="google"
                size={20}
                color={colors.textPrimary}
              />
              <Text style={styles.oauthText}>
                {oauthLoading === "google"
                  ? "Conectando..."
                  : "Continuar con Google"}
              </Text>
            </Pressable>

            {/* Apple (solo iOS) - OCULTO */}
            {false && Platform.OS === "ios" && (
              <Pressable
                onPress={onApple}
                disabled={busy}
                style={({ pressed }) => [
                  styles.oauthButton,
                  pressed && { transform: [{ scale: 0.99 }], opacity: 0.9 },
                  busy && { opacity: 0.6 },
                ]}
              >
                <MaterialCommunityIcons
                  name="apple"
                  size={22}
                  color={colors.textPrimary}
                />
                <Text style={styles.oauthText}>
                  {oauthLoading === "apple"
                    ? "Conectando..."
                    : "Continuar con Apple"}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => router.push("/(auth)/register")}
              disabled={busy}
            >
              {({ pressed }) => (
                <Text style={[styles.link, pressed && styles.linkPressed]}>
                  ¿No tienes cuenta?{" "}
                  <Text style={styles.linkStrong}>Regístrate</Text>
                </Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      padding: 18,
      justifyContent: "center",
      backgroundColor:
        colors.background === "#22C55E"
          ? "rgba(34,197,94,0.95)"
          : colors.background,
    },
    card: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.14,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
        },
        android: { elevation: 7 },
      }),
    },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    logoWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logo: { width: 42, height: 42 },
    brand: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      marginBottom: 2,
    },
    title: { ...typography.title, color: colors.textPrimary },
    subtitle: { marginTop: 8, color: colors.textSecondary, ...typography.body },

    alert: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.cta,
    },
    alertText: {
      flex: 1,
      color: colors.onCta,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      lineHeight: 16,
    },

    link: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 6,
      ...typography.body,
    },
    linkPressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
    linkStrong: {
      color: colors.textPrimary,
      fontFamily: typography.subtitle?.fontFamily,
    },

    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 6,
    },
    dividerLine: {
      flex: 1,
      height: 0.5,
      backgroundColor: colors.border,
      opacity: 0.6,
    },
    dividerText: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      opacity: 0.6,
    },

    oauthButton: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      backgroundColor: "transparent",
    },
    oauthText: {
      color: colors.textPrimary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
    },
  });
}
