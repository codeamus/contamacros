# Configuración de Precios en CLP para Chile

Este documento explica cómo configurar los precios para que se muestren en Pesos Chilenos (CLP) cuando el usuario está en Chile.

## ✅ ¿Cómo Funciona?

Los precios se muestran **automáticamente** según la región del usuario:
- Si el usuario está en Chile → Los precios se muestran en CLP
- Si el usuario está en USA → Los precios se muestran en USD
- Si el usuario está en otro país → Los precios se muestran en la moneda local

**No necesitas hacer nada en el código** - App Store Connect y RevenueCat manejan esto automáticamente.

## 📋 Pasos para Configurar Precios en CLP

### 1. Ve a App Store Connect

1. Inicia sesión en [App Store Connect](https://appstoreconnect.apple.com/)
2. Selecciona tu app **ContaMacros**
3. Ve a **Subscriptions** (Suscripciones)

### 2. Configura Precios para Chile

Para cada producto (`contamacros_month` y `contamacros_yearly`):

1. **Selecciona el producto** (ej: `contamacros_month`)
2. Haz clic en **Pricing** (Precios)
3. En la sección **Price Schedule** (Calendario de Precios):
   - Haz clic en **Add Price** o **Edit**
   - Selecciona **Chile** en la lista de países
   - Configura el precio:
     - **Mensual**: $4.990 CLP
     - **Anual**: $39.990 CLP
4. Guarda los cambios

### 3. Verifica en RevenueCat

1. Ve a [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Verifica que los productos estén sincronizados
3. Los precios deberían aparecer correctamente para cada región

## 🧪 Probar en Desarrollo

### Opción 1: Simulador iOS con Región Chile

1. Abre el **Simulador iOS**
2. Ve a **Settings** → **General** → **Language & Region**
3. Cambia **Region** a **Chile**
4. Reinicia la app
5. Los precios deberían mostrarse en CLP

### Opción 2: Dispositivo Real

1. Configura tu iPhone/iPad en **Settings** → **General** → **Language & Region** → **Region: Chile**
2. Abre la app
3. Los precios deberían mostrarse en CLP automáticamente

### Opción 3: StoreKit Configuration (Solo Desarrollo)

El archivo `ContaMacros.storekit` tiene precios configurados, pero por defecto pueden mostrarse en USD según la región del simulador.

## 🔍 Verificar en los Logs

Cuando ejecutes la app, revisa los logs para ver qué moneda está usando:

```
[PremiumPaywall] Monedas detectadas: {
  monthly: "CLP",
  annual: "CLP",
  lifetime: "CLP"
}
```

Si ves `"USD"` en lugar de `"CLP"`, significa que:
1. Los precios aún no están configurados para Chile en App Store Connect, O
2. El simulador/dispositivo está configurado en otra región

## ⚠️ Notas Importantes

1. **Los precios deben estar aprobados**: Los productos deben estar en estado "Ready to Submit" o "Approved" para que los precios se muestren correctamente

2. **Sincronización**: Puede tomar unos minutos después de configurar los precios en App Store Connect para que se sincronicen con RevenueCat

3. **StoreKit Configuration**: En desarrollo local, los precios pueden mostrarse en USD si el simulador está configurado en esa región. Esto es normal y no afecta la producción.

4. **Producción**: Una vez que los precios estén configurados en App Store Connect para Chile, se mostrarán automáticamente en CLP para usuarios chilenos.

## 📱 Resultado Esperado

Cuando todo esté configurado correctamente, los usuarios en Chile verán:
- **Plan Mensual**: $4.990 CLP / mes
- **Plan Anual**: $39.990 CLP / año

Los usuarios en otros países verán los precios en su moneda local automáticamente.
