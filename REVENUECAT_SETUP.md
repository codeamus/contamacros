# Configuración de RevenueCat para ContaMacros

Este documento explica cómo configurar RevenueCat en el dashboard y en la app.

## 📋 Pasos de Configuración en RevenueCat Dashboard

### 1. Crear Productos en App Store Connect / Google Play Console

#### iOS (App Store Connect):
1. Ve a **App Store Connect** → Tu app → **Subscriptions**
2. Crea los siguientes productos de suscripción:
   - **monthly**: Plan Mensual (recurring, mensual)
   - **yearly**: Plan Anual (recurring, anual)
   - **lifetime**: Plan de por vida (non-consumable, una sola vez)

#### Android (Google Play Console):
1. Ve a **Google Play Console** → Tu app → **Monetización** → **Productos**
2. Crea los siguientes productos:
   - **monthly**: Plan Mensual (subscription, mensual)
   - **yearly**: Plan Anual (subscription, anual)
   - **lifetime**: Plan de por vida (one-time product)

### 2. Configurar RevenueCat Dashboard

1. **Inicia sesión en [RevenueCat Dashboard](https://app.revenuecat.com/)**

2. **Crea un nuevo proyecto** (si no tienes uno):
   - Nombre: "ContaMacros"
   - Plataforma: iOS y Android

3. **Agrega tu app iOS**:
   - Bundle ID: `com.codeamusdev2.contamacro`
   - App Store Connect API Key (recomendado) o Shared Secret

4. **Agrega tu app Android**:
   - Package Name: `com.codeamusdev2.contamacro`
   - Google Play Service Account JSON

5. **Crea el Entitlement**:
   - Ve a **Entitlements**
   - Crea un nuevo entitlement llamado: **"ContaMacros Pro"**
   - Este es el entitlement que la app verifica para acceso premium

6. **Crea Products**:
   - Ve a **Products**
   - Para cada producto (monthly, yearly, lifetime):
     - Crea el producto con el mismo identifier que en App Store/Play Store
     - Asigna el entitlement "ContaMacros Pro"

7. **Crea Offerings**:
   - Ve a **Offerings**
   - Crea una oferta llamada "default" (o el nombre que prefieras)
   - Agrega los packages:
     - **$rc_monthly** → Producto "monthly"
     - **$rc_annual** → Producto "yearly"
     - **$rc_lifetime** → Producto "lifetime"
   - Marca esta oferta como "Current Offering"

### 3. Configurar API Keys

La app ya está configurada con la API key de prueba:
- **Test API Key**: `test_NRNZSuygVnpFpUiNUIGeCryumjI`

Para producción, actualiza la API key en `src/domain/services/revenueCatService.ts`:
```typescript
const REVENUECAT_API_KEY = "tu_api_key_de_produccion";
```

## 🔧 Configuración en la App

### Archivos Creados:

1. **`src/domain/services/revenueCatService.ts`**
   - Servicio principal para interactuar con RevenueCat SDK
   - Maneja inicialización, compras, restauración, etc.

2. **`src/presentation/hooks/subscriptions/useRevenueCat.ts`**
   - Hook React para usar RevenueCat en componentes
   - Proporciona estado de suscripción, ofertas, etc.

3. **`src/presentation/hooks/subscriptions/usePremium.ts`**
   - Hook helper para obtener estado premium de manera consistente
   - Prioriza RevenueCat sobre `profile.is_premium`

4. **`src/presentation/components/premium/CustomerCenter.tsx`**
   - Componente para gestionar suscripciones
   - Permite restaurar compras y abrir RevenueCat UI

### Archivos Modificados:

1. **`src/presentation/components/premium/PremiumPaywall.tsx`**
   - Ahora usa RevenueCat para procesar compras reales
   - Obtiene precios dinámicamente desde RevenueCat
   - Soporta monthly, annual, y lifetime

2. **`app/(tabs)/settings.tsx`**
   - Agregada sección "Premium" para usuarios premium
   - Botón para abrir Customer Center
   - Usa RevenueCat para verificar estado premium

3. **`app/(tabs)/home.tsx`**
   - Usa RevenueCat para verificar estado premium

4. **`app/(tabs)/diary.tsx`**
   - Usa RevenueCat para verificar estado premium

5. **`src/presentation/hooks/auth/AuthProvider.tsx`**
   - Inicializa RevenueCat cuando el usuario se autentica
   - Cierra sesión en RevenueCat cuando el usuario se desautentica

6. **`app.json`**
   - Agregado plugin de RevenueCat

## 🧪 Testing

### Sandbox Testing (iOS):
1. Crea una cuenta de prueba en App Store Connect
2. Configura el dispositivo con la cuenta de prueba
3. Las compras se procesarán en modo sandbox

### Testing (Android):
1. Crea una cuenta de prueba en Google Play Console
2. Agrega la cuenta a tu dispositivo
3. Las compras se procesarán en modo de prueba

## 📱 Uso en la App

### Verificar Estado Premium:
```typescript
import { usePremium } from "@/presentation/hooks/subscriptions/usePremium";

const { isPremium } = usePremium();
```

### Procesar Compra:
```typescript
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";

const { purchasePackage, offerings } = useRevenueCat();

// Obtener package
const packageToPurchase = offerings?.availablePackages.find(pkg => 
  pkg.identifier === "$rc_annual"
);

// Comprar
if (packageToPurchase) {
  const result = await purchasePackage(packageToPurchase);
  if (result.ok) {
    // Compra exitosa
  }
}
```

### Restaurar Compras:
```typescript
const { restorePurchases } = useRevenueCat();
const result = await restorePurchases();
```

### Abrir Customer Center:
```typescript
import CustomerCenter from "@/presentation/components/premium/CustomerCenter";

<CustomerCenter
  visible={showCustomerCenter}
  onClose={() => setShowCustomerCenter(false)}
/>
```

## 🔐 Seguridad

- La API key está en el código del cliente (esto es normal para RevenueCat)
- RevenueCat maneja la validación de compras en el servidor
- Los entitlements se verifican desde los servidores de RevenueCat
- Nunca confíes solo en `profile.is_premium` - siempre verifica con RevenueCat

## 📝 Notas Importantes

1. **RevenueCat es la fuente de verdad**: El estado premium debe verificarse desde RevenueCat, no solo desde `profile.is_premium`

2. **Sincronización**: La app actualiza `profile.is_premium` en Supabase después de una compra exitosa para compatibilidad, pero RevenueCat es la autoridad

3. **Identificadores de Packages**: RevenueCat usa identificadores como `$rc_monthly`, `$rc_annual`, `$rc_lifetime` por defecto, pero puedes personalizarlos en el dashboard

4. **Entitlement ID**: El entitlement "ContaMacros Pro" debe coincidir exactamente con el configurado en el dashboard

5. **Testing**: Usa cuentas de prueba para testing. Las compras reales solo funcionan en producción.

## 🚀 Próximos Pasos

1. Configurar productos en App Store Connect / Google Play Console
2. Configurar RevenueCat Dashboard con los productos
3. Probar compras en modo sandbox/testing
4. Cambiar a API key de producción antes del lanzamiento
5. Monitorear métricas en RevenueCat Dashboard
