import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

/**
 * Ruta de captura para deep links OAuth.
 *
 * Expo Router necesita que exista una ruta que coincida con
 * `contamacro://auth/callback` para evitar el error "Unmatched Route"
 * cuando Android abre la app tras completar el login en el navegador.
 *
 * Esta pantalla no hace lógica de autenticación; el intercambio del `code`
 * por sesión se realiza en `AuthProvider.signInWithGoogle()` después de que
 * `openAuthSessionAsync()` devuelve la URL final.
 */
export default function AuthCallbackScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

