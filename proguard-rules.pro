# --- TUS REGLAS ORIGINALES ---
# Reanimated & New Arch
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Network & Supabase
-keepattributes Signature, *Annotation*, EnclosingMethod
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Expo Camera (Mantener por si acaso)
-keep class expo.modules.camera.** { *; }

# --- NUEVAS REGLAS PARA SDK 35 Y ANDROIDX ---

# CameraX (Core, Camera2, View, Lifecycle)
-keep class androidx.camera.core.** { *; }
-keep class androidx.camera.camera2.** { *; }
-keep class androidx.camera.view.** { *; }
-keep class androidx.camera.lifecycle.** { *; }
-keep class androidx.camera.featurecombinationquery.** { *; }

# Interfaces que CameraX carga por reflexión (Dinámico)
-keep class * implements androidx.camera.core.impl.CameraConfig$DefaultProvider { *; }
-keep class * implements androidx.camera.core.impl.Config { *; }

# Kotlin Coroutines (Evita crashes en el hilo principal al iniciar)
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.coroutines.android.HandlerContext$HandlerPost {
    volatile <fields>;
}

# Metadatos de Kotlin para que las librerías se encuentren entre sí
-keep class kotlin.Metadata { *; }

# AndroidX Core & Splashscreen (Evita que la app muera al mostrar el logo)
-keep class androidx.core.app.unusedapprestrictions.** { *; }
-keep class androidx.core.graphics.drawable.IconCompatParcelizer { *; }
-keep class androidx.core.splashscreen.** { *; }
-dontwarn androidx.core.splashscreen.**