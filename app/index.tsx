// app/index.tsx
import { Redirect } from "expo-router";

// Punto de entrada: redirige a la ruta que luego será resuelta por los layouts.
// Por ahora mandamos a tabs/home. Cuando implementemos auth/onboarding, ajustaremos.
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
