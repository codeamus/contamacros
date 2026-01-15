// app/(onboarding)/goal.tsx
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function GoalScreen() {
  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "600" }}>Tu objetivo</Text>

      {/* TODO: selector déficit / mantener / superávit */}
      <Pressable onPress={() => router.push("/(onboarding)/profile")}>
        <Text style={{ marginTop: 12 }}>Continuar</Text>
      </Pressable>
    </View>
  );
}
