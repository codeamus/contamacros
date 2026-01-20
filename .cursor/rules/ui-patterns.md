# Patrones de UI - ContaMacros

- **Colores y Tipografía:** Usar exclusivamente el hook `useTheme()`. No hardcodear colores hexadecimales.
- **Componentes:** Usar `PrimaryButton` para acciones principales.
- **Safe Area:** Todas las pantallas deben comenzar con `SafeAreaView` de `react-native-safe-area-context`.
- **Performance:** Búsquedas de texto deben incluir `debounce` (300ms+) y `AbortController`.