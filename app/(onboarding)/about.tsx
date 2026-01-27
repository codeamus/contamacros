// app/(onboarding)/about.tsx
import { Gender } from "@/domain/services/calorieGoals";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function clampDate(d: Date, min: Date, max: Date) {
  const t = d.getTime();
  return new Date(Math.min(Math.max(t, min.getTime()), max.getTime()));
}

function formatYmdToSpanishLong(ymd: string) {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return ymd;

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${d} de ${months[m - 1]} de ${y}`;
}

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [gender, setGender] = useState<Gender | null>(null);

  const defaultDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear() - 25, now.getMonth(), now.getDate());
  }, []);

  const [birthDate, setBirthDate] = useState<Date>(defaultDate);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const minBirthDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear() - 90, now.getMonth(), now.getDate());
  }, []);
  const maxBirthDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
  }, []);

  const birthDateYmd = useMemo(() => toYmd(birthDate), [birthDate]);
  const birthDateLabel = useMemo(
    () => formatYmdToSpanishLong(birthDateYmd),
    [birthDateYmd],
  );

  const canContinue = useMemo(() => !!gender && !loading, [gender, loading]);

  function openPicker() {
    setPickerOpen(true);
  }
  function closePicker() {
    setPickerOpen(false);
  }

  function onPickerChange(e: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setPickerOpen(false);
    if (e.type === "dismissed") return;
    const d = selected ?? birthDate;
    setBirthDate(clampDate(d, minBirthDate, maxBirthDate));
  }

  async function onContinue() {
    if (!gender) return;

    setErr(null);
    setLoading(true);

    const res = await updateProfile({
      gender,
      birth_date: birthDateYmd,
    } as any);

    if (!res.ok) {
      setErr(res.message ?? "No pudimos guardar tus datos.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/(onboarding)/activity");
  }

  const styles = makeStyles(colors, typography);

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          { top: insets.top + 8 },
          pressed && { opacity: 0.8 },
        ]}
        hitSlop={12}
      >
        <Feather name="arrow-left" size={26} color="#fff" />
      </Pressable>
      <ScrollView>
        <View style={styles.screen}>
          {/* HERO (idéntico a goal.tsx) */}
          <View style={styles.heroFrame}>
            <View style={styles.heroHalo} />
            <View style={styles.heroCard}>
              <Image
                source={require("../../assets/images/onboarding/onboarding-2.png")}
                style={styles.heroImage}
                contentFit="contain"
              />
            </View>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
          >
            {/* SHEET (idéntico a goal.tsx) */}
            <View style={styles.sheet}>
              <View style={styles.header}>
                <View style={styles.logoBadge}>
                  <MaterialCommunityIcons
                    name="account"
                    size={22}
                    color={colors.onCta}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kicker}>Onboarding</Text>
                  <Text style={styles.title}>Sobre ti</Text>
                </View>
              </View>

              <Text style={styles.subtitle}>
                Usamos estos datos solo para estimar tu metabolismo basal.
              </Text>

              <View style={{ gap: 12, marginTop: 16 }}>
                <OptionRow
                  title="Hombre"
                  desc="Usaremos la fórmula correspondiente"
                  selected={gender === "male"}
                  onPress={() => setGender("male")}
                  colors={colors}
                  typography={typography}
                  icon="user"
                />
                <OptionRow
                  title="Mujer"
                  desc="Usaremos la fórmula correspondiente"
                  selected={gender === "female"}
                  onPress={() => setGender("female")}
                  colors={colors}
                  typography={typography}
                  icon="user"
                />

                {/* Fecha */}
                <Pressable onPress={openPicker} style={styles.birthRow}>
                  <View style={styles.birthIcon}>
                    <Feather name="calendar" size={18} color={colors.onCta} />
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.birthLabel}>Fecha de nacimiento</Text>
                    <Text style={styles.birthValue}>{birthDateLabel}</Text>
                  </View>

                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {!!err && (
                  <View style={styles.alert}>
                    <Feather
                      name="alert-triangle"
                      size={16}
                      color={colors.onCta}
                    />
                    <Text style={styles.alertText}>{err}</Text>
                  </View>
                )}

                <View style={{ marginTop: 4 }}>
                  <PrimaryButton
                    title="Continuar"
                    onPress={onContinue}
                    loading={loading}
                    disabled={!canContinue}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>

          {/* ANDROID picker inline */}
          {Platform.OS === "android" && pickerOpen && (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display="default"
              locale="es-ES"
              maximumDate={maxBirthDate}
              minimumDate={minBirthDate}
              onChange={onPickerChange}
            />
          )}

          {/* iOS modal */}
          {Platform.OS === "ios" && (
            <Modal visible={pickerOpen} transparent animationType="fade">
              <Pressable style={styles.modalBackdrop} onPress={closePicker} />
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Selecciona tu fecha</Text>
                  <Pressable onPress={closePicker} style={styles.modalDone}>
                    <Text style={styles.modalDoneText}>Listo</Text>
                  </Pressable>
                </View>

                <DateTimePicker
                  value={birthDate}
                  mode="date"
                  display="spinner"
                  locale="es-ES"
                  maximumDate={maxBirthDate}
                  minimumDate={minBirthDate}
                  onChange={onPickerChange}
                  textColor={colors.textPrimary}
                  style={{ alignSelf: "stretch" }}
                />
              </View>
            </Modal>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionRow({
  title,
  desc,
  icon,
  selected,
  onPress,
  colors,
  typography,
}: {
  title: string;
  desc: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  selected: boolean;
  onPress: () => void;
  colors: any;
  typography: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderWidth: 1,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected ? "rgba(34,197,94,0.12)" : colors.surface,
          borderRadius: 20,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.96 : 1,
          transform: pressed ? [{ scale: 0.995 }] : [],
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.brand : colors.cta,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Feather name={icon} size={18} color={colors.onCta} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 16,
            color: colors.textPrimary,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: typography.body?.fontFamily,
            fontSize: 13,
            color: colors.textSecondary,
          }}
        >
          {desc}
        </Text>
      </View>

      {selected && <Feather name="check" size={18} color={colors.brand} />}
    </Pressable>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    backButton: {
      position: "absolute",
      left: 16,
      zIndex: 999,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    screen: {
      flex: 1,
      backgroundColor:
        colors.background === "#22C55E"
          ? "rgba(34,197,94,0.95)"
          : colors.background,
    },

    // ✅ EXACTAMENTE igual a goal.tsx
    heroFrame: {
      alignItems: "center",
      marginTop: 28,
      marginBottom: 8,
    },
    heroHalo: {
      position: "absolute",
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: "rgba(34,197,94,0.18)",
    },
    heroCard: {
      width: "86%",
      aspectRatio: 1,
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
    },
    heroImage: {
      width: "100%",
      height: "100%",
      borderRadius: 20,
    },

    // ✅ EXACTAMENTE igual a goal.tsx
    sheetWrap: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      marginHorizontal: 18,
      marginBottom: 18,
      padding: 18,
      borderRadius: 28,
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
        android: { elevation: 8 },
      }),
    },

    header: { flexDirection: "row", alignItems: "center", gap: 12 },

    logoBadge: {
      width: 46,
      height: 46,
      borderRadius: 18,
      backgroundColor: colors.cta,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    kicker: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      marginBottom: 2,
    },

    title: { ...typography.title, color: colors.textPrimary },

    subtitle: { marginTop: 8, color: colors.textSecondary, ...typography.body },

    birthRow: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    birthIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cta,
      borderWidth: 1,
      borderColor: colors.border,
    },
    birthLabel: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textSecondary,
    },
    birthValue: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      color: colors.textPrimary,
    },

    alert: {
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.cta,
      borderWidth: 1,
      borderColor: colors.border,
    },
    alertText: {
      flex: 1,
      color: colors.onCta,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      lineHeight: 16,
    },

    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
    modalSheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    modalHeader: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      color: colors.textPrimary,
    },
    modalDone: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: "rgba(34,197,94,0.12)",
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalDoneText: {
      fontFamily: typography.subtitle?.fontFamily,
      color: colors.brand,
      fontSize: 14,
    },
  });
}
