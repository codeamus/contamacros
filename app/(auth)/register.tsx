// app/(auth)/register.tsx
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { translateAuthError } from "@/presentation/utils/authErrorTranslator";
import {
  isStrongEnoughPassword,
  isValidEmail,
} from "@/presentation/utils/authValidation";
import { Feather } from "@expo/vector-icons";
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

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirm: false,
  });

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
    !!email &&
    !!password &&
    !!confirm;

  async function onSubmit() {
    setTouched({ email: true, password: true, confirm: true });
    setFormError(null);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await signUp(email.trim(), password);
      if (!res.ok) {
        setFormError(translateAuthError(res.message));
        return;
      }
      // ✅ No redirigimos aquí.
      // AuthGate se encarga del flujo (onboarding / tabs) para evitar duplicidad.
    } catch (e) {
      setFormError("No pudimos crear tu cuenta. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  // Animación de entrada (igual a login)
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
              <Text style={styles.brand}>ContaMacro</Text>
              <Text style={styles.title}>Crear cuenta</Text>
            </View>
          </View>

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
              leftIcon={
                <Feather name="mail" size={18} color={colors.textSecondary} />
              }
            />

            <AuthTextField
              label="Contraseña"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (!touched.password)
                  setTouched((s) => ({ ...s, password: true }));
              }}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
            />

            <AuthTextField
              label="Confirmar contraseña"
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                if (!touched.confirm)
                  setTouched((s) => ({ ...s, confirm: true }));
              }}
              secureTextEntry={!showConfirm}
              textContentType="newPassword"
              autoComplete="new-password"
            />

            {!!formError && (
              <View style={styles.alert}>
                <Feather name="alert-triangle" size={16} color={colors.onCta} />
                <Text style={styles.alertText}>{formError}</Text>
              </View>
            )}

            <PrimaryButton
              title="Crear cuenta"
              onPress={onSubmit}
              loading={loading}
              disabled={!canSubmit}
            />

            <Pressable onPress={() => router.back()}>
              {({ pressed }) => (
                <Text style={[styles.link, pressed && styles.linkPressed]}>
                  Ya tengo cuenta{" "}
                  <Text style={styles.linkStrong}>Iniciar sesión</Text>
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
        default: {},
      }),
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    logoWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface, // mantiene contraste en light/dark
      borderWidth: 1,
      borderColor: colors.border,
    },

    logo: {
      width: 42,
      height: 42,
    },

    brand: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      marginBottom: 2,
    },

    title: {
      ...typography.title,
      color: colors.textPrimary,
    },

    subtitle: {
      marginTop: 8,
      color: colors.textSecondary,
      ...typography.body,
    },

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
  });
}
