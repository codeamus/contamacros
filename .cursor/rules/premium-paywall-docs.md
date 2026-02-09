# Documentación de PremiumPaywall.tsx

## Descripción general

El componente `PremiumPaywall` es la interfaz para gestionar la compra y suscripción premium usando RevenueCat.

Provee la UI para mostrar planes, beneficios, estados de suscripción, y la compra o restauración de planes premium.

---

## Integración con RevenueCat

- Usa el servicio `RevenueCatService` para operaciones principales:
  - Inicializar RevenueCat con el ID del usuario.
  - Identificar al usuario para associar con su cuenta de compra.
  - Obtener información del cliente, estados de suscripción y ofertas activas.
  - Gestionar la compra de paquetes y restauración.

- El hook `useRevenueCat` provee el estado reactivo de suscripciones y funciones para las acciones de compra y restauración.

- El componente maneja estados internos para mostrar modales, loading, y feedback táctil.

---

## Metodología

- Renderiza beneficios premium con iconos y descripciones.
- Muestra ofertas y planes disponibles utilizando la data proveniente de RevenueCat.
- Envía eventos de haptics y toasts para mejorar UX.
- Controla el flujo de compra y restauración con feedback visual y mensajes de error.

---

## Componentes relacionados

- `RevenueCatService` en `src/domain/services/revenueCatService.ts`
- `useRevenueCat` en `src/presentation/hooks/subscriptions/useRevenueCat.ts`
- `useAuth` para obtener información del usuario actual

---

Esta documentación te ayudará a entender la lógica del paywall premium y las interacciones con RevenueCat para suscripciones en la app.

