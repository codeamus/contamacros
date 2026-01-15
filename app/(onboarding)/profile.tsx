import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "600" }}>Tu perfil</Text>

      {/* TODO: peso / altura */}
      <Pressable onPress={() => router.replace("/(tabs)")}>
        <Text style={{ marginTop: 12 }}>Finalizar</Text>
      </Pressable>
    </View>
  );
}
