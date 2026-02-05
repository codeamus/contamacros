// app/(auth)/register.tsx
import AuthTextField from "@/presentation/components/auth/AuthTextField";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useToast } from "@/presentation/hooks/ui/useToast";
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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const logoLight = require("assets/images/logo-light-removebg.png");

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const { showToast } = useToast();
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

  // Validaciones Memorizadas
  const emailError = useMemo(() => {
    if (!touched.email) return null;
    if (!email.trim()) return "Ingresa tu email";
    if (!isValidEmail(email)) return "Email inválido";
    return null;
  }, [email, touched.email]);

  const passwordError = useMemo(() => {
    if (!touched.password) return null;
    if (!password.trim()) return "Crea una contraseña";
    if (!isStrongEnoughPassword(password))
      return "Debe contener mayúscula, minúscula, número y carácter especial.";
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

      // ✅ FLUJO VANGUARDISTA: Redirigir a verificación OTP
      showToast({
        message: "¡Código enviado! Revisa tu email",
        type: "success",
        duration: 4000,
      });

      router.push({
        pathname: "/(auth)/verify-otp",
        params: { email: email.trim().toLowerCase() },
      });
    } catch (e) {
      setFormError("No pudimos crear tu cuenta. Intenta nuevamente.");
    } finally {
      setLoading(false);
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
          outputRange: [15, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
                <Text style={styles.title}>Crear cuenta</Text>
              </View>
            </View>

            <Text style={styles.subtitle}>
              Te tomará menos de un minuto. Luego configuramos tu objetivo.
            </Text>

            <View style={{ gap: 16, marginTop: 18 }}>
              <AuthTextField
                label="Email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (!touched.email)
                    setTouched((s) => ({ ...s, email: true }));
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
                placeholder="••••••••"
                error={passwordError}
                leftIcon={
                  <Feather name="lock" size={18} color={colors.textSecondary} />
                }
                rightIcon={
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                }
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
                placeholder="••••••••"
                error={confirmError}
                leftIcon={
                  <Feather
                    name="shield"
                    size={18}
                    color={colors.textSecondary}
                  />
                }
                rightIcon={
                  <Pressable onPress={() => setShowConfirm(!showConfirm)}>
                    <Feather
                      name={showConfirm ? "eye-off" : "eye"}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                }
              />

              {!!formError && (
                <View style={styles.alert}>
                  <Feather
                    name="alert-triangle"
                    size={16}
                    color={colors.onCta}
                  />
                  <Text style={styles.alertText}>{formError}</Text>
                </View>
              )}

              <View style={{ marginTop: 8 }}>
                <PrimaryButton
                  title="Crear cuenta"
                  onPress={onSubmit}
                  loading={loading}
                  disabled={!canSubmit}
                />
              </View>

              <Pressable
                onPress={() => router.back()}
                style={styles.footerLink}
              >
                {({ pressed }) => (
                  <Text style={[styles.link, pressed && styles.linkPressed]}>
                    Ya tengo cuenta{" "}
                    <Text style={styles.linkStrong}>Iniciar sesión</Text>
                  </Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 18,
    },
    card: {
      padding: 24,
      borderRadius: 32,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
        },
        android: { elevation: 6 },
      }),
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 8,
    },
    logoWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logo: {
      width: 36,
      height: 36,
    },
    brand: {
      color: colors.primary || colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    title: {
      ...typography.title,
      fontSize: 24,
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: 8,
      color: colors.textSecondary,
      lineHeight: 20,
      ...typography.body,
    },
    alert: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.cta || "#ef4444",
    },
    alertText: {
      flex: 1,
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
    },
    footerLink: {
      marginTop: 10,
    },
    link: {
      color: colors.textSecondary,
      textAlign: "center",
      fontSize: 14,
    },
    linkPressed: { opacity: 0.7 },
    linkStrong: {
      color: colors.textPrimary,
      fontWeight: "bold",
    },
  });
}
