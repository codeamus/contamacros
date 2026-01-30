# --- Reanimated & New Arch ---
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# --- Network & Supabase ---
-keepattributes Signature, *Annotation*, EnclosingMethod
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# --- Expo Camera ---
-keep class expo.modules.camera.** { *; }