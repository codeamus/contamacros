// app/(onboarding)/about.tsx
import { Gender } from "@/domain/services/calorieGoals";
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
     DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
     Modal,
     Platform,
     Pressable,
     StyleSheet,
     Text,
     View,
} from "react-native";

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

export default function AboutScreen() {
  const { updateProfile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const [gender, setGender] = useState<Gender | null>(null);

  // Por defecto: 25 años atrás (solo UX)
  const defaultDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear() - 25, now.getMonth(), now.getDate());
  }, []);

  const [birthDate, setBirthDate] = useState<Date>(defaultDate);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Guardrails de edad: 13..90 (coherente con el servicio)
  const minBirthDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear() - 90, now.getMonth(), now.getDate());
  }, []);
  const maxBirthDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
  }, []);

  const birthDateYmd = useMemo(() => toYmd(birthDate), [birthDate]);

  const canContinue = !!gender && !loading;

  function openPicker() {
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
  }

  function onPickerChange(e: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setPickerOpen(false);
    }
    if (e.type === "dismissed") return;
    const d = selected ?? birthDate;
    setBirthDate(clampDate(d, minBirthDate, maxBirthDate));
  }

  async function onContinue() {
    if (!gender) return;

    setErr(null);
    setLoading(true);

    // ⚠️ Requiere que ProfileDb / tabla tenga:
    // gender: "male" | "female"
    // birth_date: "YYYY-MM-DD"
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
    <View style={styles.screen}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <MaterialCommunityIcons
              name="account"
              size={22}
              color={colors.onCta}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Onboarding</Text>
            <Text style={styles.title}>Sobre ti</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Usamos estos datos solo para calcular tu metabolismo basal.
        </Text>

        <View style={{ gap: 12, marginTop: 18 }}>
          <OptionRow
            title="Hombre"
            desc="Fórmula Mifflin–St Jeor"
            selected={gender === "male"}
            onPress={() => setGender("male")}
            colors={colors}
            typography={typography}
            icon="user"
          />
          <OptionRow
            title="Mujer"
            desc="Fórmula Mifflin–St Jeor"
            selected={gender === "female"}
            onPress={() => setGender("female")}
            colors={colors}
            typography={typography}
            icon="user"
          />

          {/* Birthdate picker */}
          <Pressable onPress={openPicker} style={styles.birthRow}>
            <View style={styles.birthIcon}>
              <Feather name="calendar" size={18} color={colors.onCta} />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.birthLabel}>Fecha de nacimiento</Text>
              <Text style={styles.birthValue}>{birthDateYmd}</Text>
            </View>

            <Feather
              name="chevron-right"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>

          {!!err && (
            <View style={styles.alert}>
              <Feather name="alert-triangle" size={16} color={colors.onCta} />
              <Text style={styles.alertText}>{err}</Text>
            </View>
          )}

          <View style={{ marginTop: 8 }}>
            <PrimaryButton
              title="Continuar"
              onPress={onContinue}
              loading={loading}
              disabled={!canContinue}
            />
          </View>
        </View>
      </View>

      {/* Picker UI */}
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
              maximumDate={maxBirthDate}
              minimumDate={minBirthDate}
              onChange={onPickerChange}
              style={{ alignSelf: "stretch" }}
            />
          </View>
        </Modal>
      )}
    </View>
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
          borderRadius: 16,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.95 : 1,
          transform: pressed ? [{ scale: 0.995 }] : [],
        },
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.brand : colors.cta,
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

    logoBadge: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.cta,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    brand: {
      color: colors.textSecondary,
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      marginBottom: 2,
    },

    title: { ...typography.title, color: colors.textPrimary },

    subtitle: { marginTop: 8, color: colors.textSecondary, ...typography.body },

    birthRow: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    birthIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cta,
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
      marginTop: 8,
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

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
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
