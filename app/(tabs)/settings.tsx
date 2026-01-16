
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    Alert.alert("Cerrar sesión", "¿Seguro que quieres salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await signOut();
            // ✅ AuthGate redirige a login
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Ajustes</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cuenta</Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Email: </Text>
          {profile?.email ?? "—"}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Objetivo: </Text>
          {profile?.goal ?? "—"}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Meta diaria: </Text>
          {profile?.daily_calorie_target
            ? `${profile.daily_calorie_target} kcal`
            : "—"}
        </Text>
      </View>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton
          title="Cerrar sesión"
          onPress={onLogout}
          loading={loading}
        />
      </View>

      <Pressable
        onPress={() =>
          Alert.alert(
            "Próximo",
            "Aquí después agregamos: theme, privacidad, soporte, rate app."
          )
        }
        style={{ marginTop: 16 }}
      >
        <Text style={styles.link}>Ver opciones futuras</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 18, backgroundColor: "#F9FAFB" },
  title: { fontSize: 28, fontWeight: "800", color: "#111827", marginTop: 12 },
  card: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  row: { color: "#374151", marginTop: 6 },
  label: { fontWeight: "700", color: "#111827" },
  link: { textAlign: "center", color: "#374151" },
});
