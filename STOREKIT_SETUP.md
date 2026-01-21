# Configuración de StoreKit Configuration para Desarrollo iOS

Este archivo explica cómo configurar StoreKit Configuration para desarrollo local sin necesidad de productos aprobados en App Store Connect.

## 📋 Pasos Rápidos

1. **Genera el proyecto nativo iOS**:
   ```bash
   npx expo prebuild --platform ios
   ```

2. **Abre el proyecto en Xcode**:
   ```bash
   open ios/ContaMacros.xcworkspace
   ```

3. **Configura StoreKit Configuration**:
   - En Xcode, ve a **Product** → **Scheme** → **Edit Scheme** (o presiona `⌘<`)
   - Selecciona **Run** en el lado izquierdo
   - Ve a la pestaña **Options**
   - En **StoreKit Configuration**, selecciona `ContaMacros.storekit`
   - Haz clic en **Close**

4. **Ejecuta la app desde Xcode**:
   - Presiona `⌘R` o haz clic en el botón Play
   - Las compras ahora usarán el archivo StoreKit Configuration local

## ✅ Verificación

Una vez configurado correctamente, deberías ver en los logs:
- `[RevenueCat] Ofertas obtenidas:` con los productos disponibles
- Los precios `$4.990 CLP` y `$39.990 CLP` en el componente PremiumPaywall

## 🔍 Productos Configurados

El archivo `ContaMacros.storekit` incluye:
- **contamacros_month**: Plan Mensual - $4.990 CLP
- **contamacros_yearly**: Plan Anual - $39.990 CLP

Estos Product IDs deben coincidir con los configurados en RevenueCat Dashboard.

## 💰 Precios por Región

### Cómo funcionan los precios:

1. **En desarrollo (StoreKit Configuration)**:
   - Los precios se muestran según la región del simulador/dispositivo
   - Por defecto pueden aparecer en USD si el dispositivo está configurado en esa región
   - Para ver precios en CLP, configura el simulador/dispositivo en **Settings** → **General** → **Language & Region** → **Region: Chile**

2. **En producción (App Store Connect)**:
   - Los precios se muestran automáticamente según la región del usuario
   - Debes configurar los precios para cada región en App Store Connect:
     - Ve a **App Store Connect** → Tu app → **Subscriptions**
     - Selecciona cada producto
     - En **Pricing**, configura los precios para Chile (CLP)
     - Los precios se mostrarán automáticamente según la región del usuario

3. **RevenueCat**:
   - RevenueCat obtiene los precios desde App Store Connect/StoreKit
   - Los precios se formatean automáticamente según la región del usuario
   - El campo `product.priceString` ya incluye la moneda y formato correcto (ej: "US$3,99" o "$4.990 CLP")

## ⚠️ Notas Importantes

- **Solo funciona en desarrollo local**: Para producción, necesitas productos aprobados en App Store Connect
- **Debes ejecutar desde Xcode**: No funciona si ejecutas con `expo run:ios` directamente
- **El archivo StoreKit Configuration**: Ya está incluido en el proyecto (`ContaMacros.storekit`)

## 🐛 Solución de Problemas

### El error persiste después de configurar StoreKit Configuration

1. Verifica que seleccionaste el archivo correcto en Xcode Scheme
2. Asegúrate de ejecutar la app desde Xcode, no desde Expo CLI
3. Limpia el build: **Product** → **Clean Build Folder** (`⇧⌘K`)
4. Reconstruye el proyecto: **Product** → **Build** (`⌘B`)

### Los productos no aparecen

1. Verifica que los Product IDs en `ContaMacros.storekit` coincidan con RevenueCat Dashboard
2. Verifica que el offering "default" esté configurado en RevenueCat Dashboard
3. Revisa los logs de RevenueCat para ver qué productos está buscando
