import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function RegisterScreen() {
  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "600" }}>Crear cuenta</Text>

      {/* TODO: inputs + submit */}
      <Pressable onPress={() => router.back()}>
        <Text style={{ marginTop: 12 }}>Ya tengo cuenta</Text>
      </Pressable>
    </View>
  );
}
