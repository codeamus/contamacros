// app/(tabs)/index.tsx
import { Redirect } from "expo-router";

/**
 * Entry point del grupo (tabs).
 * Decidimos cuál tab mostrar por defecto.
 * Más adelante esto puede ser dinámico (ej: último tab visitado).
 */
export default function TabsIndex() {
  return <Redirect href="/(tabs)/home" />;
}
