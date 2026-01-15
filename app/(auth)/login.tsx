import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function LoginScreen() {
  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "600" }}>Iniciar sesión</Text>

      {/* TODO: inputs + submit */}
      <Pressable onPress={() => router.push("/(auth)/register")}>
        <Text style={{ marginTop: 12 }}>¿No tienes cuenta? Regístrate</Text>
      </Pressable>
    </View>
  );
}
