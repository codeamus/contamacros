// app/(onboarding)/goal.tsx
import PrimaryButton from "@/presentation/components/ui/PrimaryButton";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Goal = "deficit" | "maintain" | "surplus";

export default function GoalScreen() {
  const { updateProfile } = useAuth();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = useMemo(() => !!goal && !loading, [goal, loading]);

  async function onContinue() {
    if (!goal) return;

    setLoading(true);
    setError(null);

    const res = await updateProfile({ goal });
    if (!res.ok) {
      setError(res.message ?? "No pudimos guardar tu objetivo.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/(onboarding)/profile");
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Tu objetivo</Text>
      <Text style={styles.subtitle}>
        Esto nos ayuda a estimar tus calorías diarias.
      </Text>

      <View style={{ gap: 10, marginTop: 16 }}>
        <GoalOption
          title="Bajar de peso"
          desc="Déficit calórico"
          selected={goal === "deficit"}
          onPress={() => setGoal("deficit")}
        />
        <GoalOption
          title="Mantener"
          desc="Mantener tu peso actual"
          selected={goal === "maintain"}
          onPress={() => setGoal("maintain")}
        />
        <GoalOption
          title="Subir masa"
          desc="Superávit calórico"
          selected={goal === "surplus"}
          onPress={() => setGoal("surplus")}
        />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={{ marginTop: 18 }}>
        <PrimaryButton
          title="Continuar"
          onPress={onContinue}
          loading={loading}
          disabled={!canContinue}
        />
      </View>
    </View>
  );
}

function GoalOption({
  title,
  desc,
  selected,
  onPress,
}: {
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <View style={{ gap: 2 }}>
        <Text
          style={[styles.optionTitle, selected && styles.optionTitleSelected]}
        >
          {title}
        </Text>
        <Text
          style={[styles.optionDesc, selected && styles.optionDescSelected]}
        >
          {desc}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
  },
  option: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
  },
  optionSelected: {
    borderColor: "#111827",
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  optionTitleSelected: {
    color: "#111827",
  },
  optionDesc: {
    fontSize: 13,
    color: "#6B7280",
  },
  optionDescSelected: {
    color: "#374151",
  },
  error: {
    marginTop: 12,
    color: "#EF4444",
    fontSize: 13,
  },
});
