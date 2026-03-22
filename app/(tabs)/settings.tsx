// app/(tabs)/settings.tsx
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { supabase } from "@/data/supabase/supabaseClient";
import type { ActivityLevelDb, GoalDb } from "@/domain/models/profileDb";
import {
  calculateCalorieGoal,
  calculateCalorieGoalFromProfile,
  type GoalType,
} from "@/domain/services/calorieGoals";
import { computeMacroTargets } from "@/domain/services/macroTargets";
import { UserService } from "@/domain/services/userService";
import CustomerCenter from "@/presentation/components/premium/CustomerCenter";
import PremiumPaywall from "@/presentation/components/premium/PremiumPaywall";
import { Avatar } from "@/presentation/components/ui/Avatar";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useHealthSync } from "@/presentation/hooks/health/useHealthSync";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import type { ThemeMode } from "@/presentation/theme/colors";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

type SettingItemProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  colors: any;
  typography: any;
};

const SettingItem = React.memo(function SettingItem({
  icon,
  label,
  value,
  onPress,
  rightElement,
  colors,
  typography,
}: SettingItemProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: onPress ? (pressed ? 0.7 : 1) : 1,
        },
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: `${colors.brand}15`,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <MaterialCommunityIcons name={icon} size={20} color={colors.brand} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: typography.subtitle?.fontFamily,
            fontSize: 15,
            color: colors.textPrimary,
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        {value && (
          <Text
            style={{
              fontFamily: typography.body?.fontFamily,
              fontSize: 13,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {value}
          </Text>
        )}
      </View>

      {rightElement ||
        (onPress && (
          <Feather
            name="chevron-right"
            size={18}
            color={colors.textSecondary}
          />
        ))}
    </Pressable>
  );
});

type ThemeOptionProps = {
  mode: ThemeMode;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  selected: boolean;
  onPress: () => void;
  colors: any;
  typography: any;
};

const ThemeOption = React.memo(function ThemeOption({
  mode: _mode,
  label,
  icon,
  selected,
  onPress,
  colors,
  typography,
}: ThemeOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: 16,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected ? `${colors.brand}10` : colors.surface,
          alignItems: "center",
          gap: 8,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={selected ? colors.brand : colors.textSecondary}
      />
      <Text
        style={{
          fontFamily: typography.subtitle?.fontFamily,
          fontSize: 13,
          color: selected ? colors.brand : colors.textSecondary,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

export default function SettingsScreen() {
  const { profile, signOut, updateProfile, refreshProfile } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { colors, typography } = theme;
  const { showToast } = useToast();

  // Usar RevenueCat como fuente de verdad para premium, con fallback a profile.is_premium
  const { isPremium: revenueCatPremium } = useRevenueCat();
  const profilePremium = profile?.is_premium ?? false;
  const isPremium = revenueCatPremium || profilePremium; // RevenueCat tiene prioridad

  const {
    syncCalories,
    isSyncing,
    caloriesBurned,
    hasPermissions,
    error: healthError,
  } = useHealthSync(isPremium);
  const insets = useSafeAreaInsets();
  const s = makeStyles(colors, typography, insets);

  const [loading, setLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showHeightModal, setShowHeightModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [showCustomerCenter, setShowCustomerCenter] = useState(false);
  const [showDataSourcesModal, setShowDataSourcesModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarCacheKey, setAvatarCacheKey] = useState(Date.now());

  const handleThemeChange = useCallback(
    async (mode: ThemeMode) => {
      await setThemeMode(mode);
      showToast({
        message: `Tema cambiado a ${mode === "system" ? "automático" : mode === "light" ? "claro" : "oscuro"}`,
        type: "success",
        duration: 1500,
      });
    },
    [setThemeMode, showToast],
  );

  const [deleting, setDeleting] = useState(false);

  const onLogout = useCallback(() => {
    setLoading(true);
    signOut().finally(() => {
      setLoading(false);
    });
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Eliminar Cuenta",
      "¿Estás seguro? Esta acción es irreversible y se borrarán todos tus datos (macros, historial y perfil) de forma permanente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar definitivamente",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase.functions.invoke("delete-user");
              if (error) {
                showToast({
                  message: "No pudimos eliminar tu cuenta. Intenta nuevamente.",
                  type: "error",
                  duration: 3000,
                });
                return;
              }
              await signOut();
              showToast({
                message: "Tu cuenta ha sido eliminada.",
                type: "success",
                duration: 3000,
              });
            } catch {
              showToast({
                message: "Ocurrió un error inesperado. Intenta nuevamente.",
                type: "error",
                duration: 3000,
              });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [signOut, showToast]);

  const handleUpdateGoal = useCallback(
    async (newGoal: GoalDb) => {
      if (!profile) return;

      setUpdating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        // Única fuente de verdad: calculateCalorieGoalFromProfile (solo cuerpo + actividad + nuevo objetivo)
        const baseProfile = {
          gender: profile.gender,
          birth_date: profile.birth_date,
          height_cm: profile.height_cm,
          weight_kg: profile.weight_kg,
          activity_level: profile.activity_level,
        };
        const calorieResult = calculateCalorieGoalFromProfile(
          baseProfile,
          newGoal,
        );

        const macros = computeMacroTargets({
          calories: calorieResult.dailyCalorieTarget,
          weightKg: profile.weight_kg || 70,
        });

        // Enviar exactamente lo que calcula la App (la BD ya no tiene trigger que lo sobrescriba)
        const res = await updateProfile({
          goal: newGoal,
          goal_adjustment: calorieResult.goalAdjustment,
          daily_calorie_target: calorieResult.dailyCalorieTarget,
          protein_g: macros.proteinG,
          carbs_g: macros.carbsG,
          fat_g: macros.fatG,
        });

        if (!res.ok) {
          showToast({
            message: res.message || "No se pudo actualizar el objetivo",
            type: "error",
            duration: 3000,
          });
          return;
        }

        await refreshProfile();
        setShowGoalModal(false);
        showToast({
          message: "Objetivo actualizado correctamente",
          type: "success",
          duration: 2000,
        });
      } catch (error: any) {
        console.error(error);
        showToast({
          message: error.message || "Error al actualizar el objetivo",
          type: "error",
          duration: 3000,
        });
      } finally {
        setUpdating(false);
      }
    },
    [profile, updateProfile, refreshProfile, showToast],
  );

  const handleUpdateWeight = useCallback(async () => {
    if (!profile) return;

    const weightNum = parseFloat(weightInput.replace(",", "."));
    if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 300) {
      showToast({
        message: "Ingresa un peso válido (1-300 kg)",
        type: "error",
        duration: 2000,
      });
      return;
    }

    setUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Recalcular calorías con el nuevo peso
      const calorieResult = calculateCalorieGoal({
        gender: profile.gender || "male",
        birthDate: profile.birth_date || "1990-01-01",
        heightCm: profile.height_cm || 170,
        weightKg: weightNum,
        activityLevel: profile.activity_level || "moderate",
        goalType:
          (profile.goal === "maintain"
            ? "maintenance"
            : (profile.goal as GoalType)) || "maintenance",
        goalAdjustment: profile.goal_adjustment ?? undefined,
      });

      // Recalcular macros con el nuevo peso
      const macros = computeMacroTargets({
        calories: calorieResult.dailyCalorieTarget,
        weightKg: weightNum,
      });

      // Actualizar perfil
      const res = await updateProfile({
        weight_kg: weightNum,
        daily_calorie_target: calorieResult.dailyCalorieTarget,
        protein_g: macros.proteinG,
        carbs_g: macros.carbsG,
        fat_g: macros.fatG,
      });

      if (!res.ok) {
        showToast({
          message: res.message || "No se pudo actualizar el peso",
          type: "error",
          duration: 3000,
        });
        return;
      }

      await refreshProfile();
      setShowWeightModal(false);
      setWeightInput("");
      showToast({
        message: "Peso actualizado correctamente",
        type: "success",
        duration: 2000,
      });
    } catch (error: any) {
      showToast({
        message: error.message || "Error al actualizar el peso",
        type: "error",
        duration: 3000,
      });
    } finally {
      setUpdating(false);
    }
  }, [profile, weightInput, updateProfile, refreshProfile, showToast]);

  const handleUpdateHeight = useCallback(async () => {
    if (!profile) return;

    const heightNum = parseFloat(heightInput.replace(",", "."));
    if (!Number.isFinite(heightNum) || heightNum <= 0 || heightNum > 250) {
      showToast({
        message: "Ingresa una altura válida (1-250 cm)",
        type: "error",
        duration: 2000,
      });
      return;
    }

    setUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Recalcular calorías con la nueva altura
      const calorieResult = calculateCalorieGoal({
        gender: profile.gender || "male",
        birthDate: profile.birth_date || "1990-01-01",
        heightCm: heightNum,
        weightKg: profile.weight_kg || 70,
        activityLevel: profile.activity_level || "moderate",
        goalType:
          (profile.goal === "maintain"
            ? "maintenance"
            : (profile.goal as GoalType)) || "maintenance",
        goalAdjustment: profile.goal_adjustment ?? undefined,
      });

      // Recalcular macros con la nueva altura
      const macros = computeMacroTargets({
        calories: calorieResult.dailyCalorieTarget,
        weightKg: profile.weight_kg || 70,
      });

      // Actualizar perfil
      const res = await updateProfile({
        height_cm: heightNum,
        daily_calorie_target: calorieResult.dailyCalorieTarget,
        protein_g: macros.proteinG,
        carbs_g: macros.carbsG,
        fat_g: macros.fatG,
      });

      if (!res.ok) {
        showToast({
          message: res.message || "No se pudo actualizar la altura",
          type: "error",
          duration: 3000,
        });
        return;
      }

      await refreshProfile();
      setShowHeightModal(false);
      setHeightInput("");
      showToast({
        message: "Altura actualizada correctamente",
        type: "success",
        duration: 2000,
      });
    } catch (error: any) {
      showToast({
        message: error.message || "Error al actualizar la altura",
        type: "error",
        duration: 3000,
      });
    } finally {
      setUpdating(false);
    }
  }, [profile, heightInput, updateProfile, refreshProfile, showToast]);

  const handleUpdateActivity = useCallback(
    async (newActivity: ActivityLevelDb) => {
      if (!profile) return;

      setUpdating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        // Convertir goal a GoalType para el cálculo
        const goalForCalc: GoalType =
          profile.goal === "maintain"
            ? "maintenance"
            : profile.goal === "deficit"
              ? "deficit"
              : profile.goal === "surplus"
                ? "surplus"
                : "maintenance";

        // Recalcular calorías con el nuevo nivel de actividad
        const calorieResult = calculateCalorieGoal({
          gender: profile.gender || "male",
          birthDate: profile.birth_date || "1990-01-01",
          heightCm: profile.height_cm || 170,
          weightKg: profile.weight_kg || 70,
          activityLevel: newActivity,
          goalType: goalForCalc,
          goalAdjustment:
            typeof profile.goal_adjustment === "number"
              ? profile.goal_adjustment
              : undefined,
        });

        // Recalcular macros
        const macros = computeMacroTargets({
          calories: calorieResult.dailyCalorieTarget,
          weightKg: profile.weight_kg || 70,
        });

        // Actualizar perfil
        const res = await updateProfile({
          activity_level: newActivity,
          goal_adjustment: calorieResult.goalAdjustment,
          daily_calorie_target: calorieResult.dailyCalorieTarget,
          protein_g: macros.proteinG,
          carbs_g: macros.carbsG,
          fat_g: macros.fatG,
        });

        if (!res.ok) {
          showToast({
            message:
              res.message || "No se pudo actualizar el nivel de actividad",
            type: "error",
            duration: 3000,
          });
          return;
        }

        await refreshProfile();
        setShowActivityModal(false);
        showToast({
          message: "Nivel de actividad actualizado correctamente",
          type: "success",
          duration: 2000,
        });
      } catch (error: any) {
        console.error(error);
        showToast({
          message: error.message || "Error al actualizar el nivel de actividad",
          type: "error",
          duration: 3000,
        });
      } finally {
        setUpdating(false);
      }
    },
    [profile, updateProfile, refreshProfile, showToast],
  );

  const handleUpdateName = useCallback(async () => {
    if (!profile) return;

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      showToast({
        message: "El nombre no puede estar vacío",
        type: "error",
        duration: 2000,
      });
      return;
    }

    if (trimmedName === profile.full_name) {
      setShowNameModal(false);
      return;
    }

    setUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await updateProfile({
        full_name: trimmedName,
      });

      if (!res.ok) {
        showToast({
          message: res.message || "No se pudo actualizar el nombre",
          type: "error",
          duration: 3000,
        });
        return;
      }

      await refreshProfile();
      setShowNameModal(false);
      showToast({
        message: "Nombre actualizado correctamente",
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast({
        message: "Error al actualizar el nombre",
        type: "error",
        duration: 3000,
      });
    } finally {
      setUpdating(false);
    }
  }, [profile, nameInput, updateProfile, refreshProfile, showToast]);

  const handlePickAvatar = useCallback(async () => {
    console.log(
      "[Settings] 🖼️ handlePickAvatar: Iniciando proceso de selección de avatar",
    );
    console.log(
      "[Settings] ⚠️ NOTA: Si la app crashea aquí, el módulo nativo no está disponible.",
    );
    console.log(
      "[Settings] ⚠️ SOLUCIÓN: Ejecuta 'npx expo run:ios' para reconstruir la app con el módulo nativo.",
    );

    // Envolver todo en un try-catch para evitar crashes
    try {
      console.log(
        "[Settings] 📦 Paso 1: Intentando importar expo-image-picker...",
      );
      // Importación dinámica del módulo
      const ImagePickerModule = await import("expo-image-picker");
      console.log("[Settings] ✅ Paso 1: Importación exitosa", {
        hasDefault: !!ImagePickerModule.default,
        hasRequestMediaLibraryPermissionsAsync:
          typeof ImagePickerModule.requestMediaLibraryPermissionsAsync ===
          "function",
        hasLaunchImageLibraryAsync:
          typeof ImagePickerModule.launchImageLibraryAsync === "function",
        moduleKeys: Object.keys(ImagePickerModule),
      });

      const ImagePicker = ImagePickerModule.default || ImagePickerModule;
      console.log("[Settings] 📋 Paso 1.1: ImagePicker asignado", {
        type: typeof ImagePicker,
        isObject: typeof ImagePicker === "object",
      });

      // Verificar que las funciones necesarias existan
      console.log("[Settings] 🔍 Paso 2: Verificando funciones disponibles...");
      if (
        !ImagePicker ||
        typeof ImagePicker.requestMediaLibraryPermissionsAsync !== "function" ||
        typeof ImagePicker.launchImageLibraryAsync !== "function"
      ) {
        console.error("[Settings] ❌ Paso 2: Funciones no disponibles", {
          hasImagePicker: !!ImagePicker,
          hasRequestMediaLibraryPermissionsAsync:
            typeof ImagePicker?.requestMediaLibraryPermissionsAsync ===
            "function",
          hasLaunchImageLibraryAsync:
            typeof ImagePicker?.launchImageLibraryAsync === "function",
        });
        showToast({
          message:
            "El módulo de selección de imágenes no está disponible. Por favor, reconstruye la app nativa ejecutando: npx expo run:ios",
          type: "error",
          duration: 5000,
        });
        return;
      }
      console.log(
        "[Settings] ✅ Paso 2: Todas las funciones están disponibles",
      );

      // Verificar que launchImageLibraryAsync existe antes de usarlo
      console.log(
        "[Settings] 🔍 Paso 3: Verificando launchImageLibraryAsync...",
      );
      if (typeof ImagePicker.launchImageLibraryAsync !== "function") {
        console.error(
          "[Settings] ❌ Paso 3: launchImageLibraryAsync no está disponible",
        );
        showToast({
          message:
            "La función de selección de imágenes no está disponible. Por favor, reconstruye la app ejecutando: npx expo run:ios",
          type: "error",
          duration: 5000,
        });
        return;
      }
      console.log(
        "[Settings] ✅ Paso 3: launchImageLibraryAsync está disponible",
      );

      // Abrir selector de imagen directamente (solicita permisos automáticamente si es necesario)
      console.log(
        "[Settings] 🖼️ Paso 4: Abriendo selector de imagen directamente...",
      );
      console.log(
        "[Settings] ⚠️ NOTA: launchImageLibraryAsync solicitará permisos automáticamente si es necesario.",
      );

      let result;
      try {
        console.log(
          "[Settings] 📋 Paso 4.1: Llamando a launchImageLibraryAsync...",
        );
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1], // Aspecto 1:1 para que sea cuadrada
          quality: 0.2, // Calidad baja para reducir el tamaño del archivo
        });
        console.log("[Settings] 📋 Paso 4.2: Resultado recibido", {
          canceled: result.canceled,
          hasAssets: !!result.assets,
          assetsLength: result.assets?.length || 0,
        });
      } catch (launchError) {
        console.error(
          "[Settings] ❌ Paso 4: Error al abrir selector de imagen",
          launchError,
        );
        console.error("[Settings] 📋 Detalles del error:", {
          name: launchError instanceof Error ? launchError.name : "Unknown",
          message:
            launchError instanceof Error
              ? launchError.message
              : String(launchError),
          stack: launchError instanceof Error ? launchError.stack : undefined,
        });

        const errorMessage =
          launchError instanceof Error
            ? launchError.message
            : String(launchError);
        if (
          errorMessage.includes("Cannot find native module") ||
          errorMessage.includes("ExponentImagePicker") ||
          errorMessage.includes("native module") ||
          errorMessage.includes("requireNativeModule")
        ) {
          showToast({
            message:
              "El módulo nativo no está disponible. Por favor, reconstruye la app ejecutando: npx expo run:ios",
            type: "error",
            duration: 6000,
          });
        } else {
          showToast({
            message:
              "Error al abrir el selector de imágenes. Asegúrate de haber reconstruido la app.",
            type: "error",
            duration: 4000,
          });
        }
        return;
      }
      console.log("[Settings] 📋 Paso 4.3: Procesando resultado del selector", {
        canceled: result.canceled,
        hasAssets: !!result.assets,
        assetsLength: result.assets?.length || 0,
        firstAsset: result.assets?.[0]
          ? {
              uri: result.assets[0].uri,
              width: result.assets[0].width,
              height: result.assets[0].height,
              fileSize: result.assets[0].fileSize,
            }
          : null,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log(
          "[Settings] ℹ️ Paso 4: Usuario canceló o no seleccionó imagen",
        );
        return;
      }

      const firstAsset = result.assets[0];
      if (!firstAsset) {
        console.warn("[Settings] ⚠️ Paso 4: No hay primer asset disponible");
        return;
      }

      const imageUri = firstAsset.uri;
      console.log("[Settings] 📸 Paso 5: URI de imagen obtenida", { imageUri });

      setUploadingAvatar(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log("[Settings] 🔄 Paso 6: Iniciando subida de avatar...");

      // Subir y actualizar avatar
      const uploadResult = await UserService.updateUserAvatar(imageUri);
      console.log("[Settings] 📋 Paso 6: Resultado de subida", {
        ok: uploadResult.ok,
        hasData: uploadResult.ok ? !!uploadResult.data : false,
        message: uploadResult.ok ? "N/A" : uploadResult.message,
        avatarUrl: uploadResult.ok ? uploadResult.data : null,
      });

      if (!uploadResult.ok) {
        console.error("[Settings] ❌ Paso 6: Error en subida", uploadResult);
        showToast({
          message: uploadResult.message || "No se pudo actualizar el avatar",
          type: "error",
          duration: 3000,
        });
        return;
      }

      console.log("[Settings] ✅ Paso 6: Avatar subido exitosamente", {
        url: uploadResult.data,
      });

      // Actualizar perfil para refrescar avatar_url
      console.log("[Settings] 🔄 Paso 7: Refrescando perfil...");
      await refreshProfile();
      console.log("[Settings] ✅ Paso 7: Perfil refrescado");

      // Forzar actualización del cache del avatar
      setAvatarCacheKey(Date.now());
      console.log(
        "[Settings] 🔄 Cache del avatar actualizado con nuevo timestamp",
      );

      showToast({
        message: "Avatar actualizado correctamente",
        type: "success",
        duration: 2000,
      });
      console.log("[Settings] ✅ Proceso completado exitosamente");
    } catch (error: unknown) {
      console.error(
        "[Settings] ❌ Error capturado en handlePickAvatar:",
        error,
      );
      console.error("[Settings] 📋 Detalles del error:", {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        isError: error instanceof Error,
      });

      // Detectar si es un error de módulo nativo no disponible
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log("[Settings] 🔍 Analizando tipo de error...", {
        errorMessage,
        includesCannotFind: errorMessage.includes("Cannot find native module"),
        includesExponentImagePicker: errorMessage.includes(
          "ExponentImagePicker",
        ),
        includesNativeModule: errorMessage.includes("native module"),
        includesRequireNativeModule: errorMessage.includes(
          "requireNativeModule",
        ),
      });

      if (
        errorMessage.includes("Cannot find native module") ||
        errorMessage.includes("ExponentImagePicker") ||
        errorMessage.includes("native module") ||
        errorMessage.includes("requireNativeModule")
      ) {
        console.error("[Settings] ❌ Error de módulo nativo no disponible");
        showToast({
          message:
            "El módulo nativo no está disponible. Por favor, reconstruye la app ejecutando: npx expo run:ios",
          type: "error",
          duration: 6000,
        });
      } else {
        console.error("[Settings] ❌ Error desconocido al actualizar avatar");
        showToast({
          message:
            "Error al actualizar el avatar. Asegúrate de haber reconstruido la app después de instalar expo-image-picker.",
          type: "error",
          duration: 4000,
        });
      }
    } finally {
      console.log(
        "[Settings] 🏁 Finalizando handlePickAvatar, limpiando estado de carga",
      );
      setUploadingAvatar(false);
    }
  }, [showToast, refreshProfile]);

  const goalLabel = useMemo(() => {
    if (!profile?.goal) return "—";
    const goalMap: Record<string, string> = {
      deficit: "Déficit calórico",
      maintain: "Mantenimiento",
      maintenance: "Mantenimiento",
      surplus: "Superávit calórico",
    };
    return goalMap[profile.goal] || profile.goal;
  }, [profile?.goal]);

  const activityLabel = useMemo(() => {
    if (!profile?.activity_level) return "—";
    const activityMap: Record<string, string> = {
      sedentary: "Sedentario",
      light: "Ligera",
      moderate: "Moderada",
      high: "Alta",
      very_high: "Muy alta",
    };
    return activityMap[profile.activity_level] || profile.activity_level;
  }, [profile?.activity_level]);

  const genderLabel = useMemo(() => {
    if (!profile?.gender) return "—";
    return profile.gender === "male" ? "Masculino" : "Femenino";
  }, [profile?.gender]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerContent}>
            <Pressable
              onPress={() => {
                console.log("[Settings] 👆 Pressable del avatar presionado");
                console.log(
                  "[Settings] ⚠️ IMPORTANTE: Si la app crashea, necesitas reconstruirla con: npx expo run:ios",
                );
                handlePickAvatar();
              }}
              disabled={uploadingAvatar}
              style={({ pressed }) => [
                s.avatarContainer,
                pressed && !uploadingAvatar && { opacity: 0.7 },
              ]}
            >
              {uploadingAvatar ? (
                <View style={s.avatarLoading}>
                  <ActivityIndicator size="small" color={colors.brand} />
                </View>
              ) : (
                <>
                  <Avatar
                    avatarUrl={
                      profile?.avatar_url
                        ? `${profile.avatar_url}?t=${avatarCacheKey}`
                        : null
                    }
                    fullName={profile?.full_name}
                    size={72}
                    colors={colors}
                    typography={typography}
                  />
                  <View style={s.avatarEditBadge}>
                    <MaterialCommunityIcons
                      name="camera"
                      size={16}
                      color="#FFFFFF"
                    />
                  </View>
                </>
              )}
            </Pressable>
            <View style={s.headerText}>
              <Text style={s.headerTitle}>
                {profile?.full_name ||
                  profile?.email?.split("@")[0] ||
                  "Usuario"}
              </Text>
              <Text style={s.headerSubtitle}>
                {profile?.email || "Sin email"}
              </Text>
            </View>
          </View>
        </View>

        {/* Perfil Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Perfil</Text>
          <View style={s.sectionContent}>
            <SettingItem
              icon="account"
              label="Nombre"
              value={profile?.full_name || "—"}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNameInput(profile?.full_name || "");
                setShowNameModal(true);
              }}
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="email-outline"
              label="Email"
              value={profile?.email || "—"}
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="target"
              label="Objetivo"
              value={goalLabel}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowGoalModal(true);
              }}
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="fire"
              label="Meta diaria"
              value={
                profile?.daily_calorie_target
                  ? `${profile.daily_calorie_target} kcal`
                  : "—"
              }
              colors={colors}
              typography={typography}
            />
            {profile?.height_cm && (
              <>
                <View style={{ height: 10 }} />
                <SettingItem
                  icon="human-male-height"
                  label="Altura"
                  value={`${profile.height_cm} cm`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setHeightInput((profile.height_cm || 170).toString());
                    setShowHeightModal(true);
                  }}
                  colors={colors}
                  typography={typography}
                />
              </>
            )}
            {profile?.weight_kg && (
              <>
                <View style={{ height: 10 }} />
                <SettingItem
                  icon="scale-bathroom"
                  label="Peso"
                  value={`${profile.weight_kg} kg`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setWeightInput((profile.weight_kg || 70).toString());
                    setShowWeightModal(true);
                  }}
                  colors={colors}
                  typography={typography}
                />
              </>
            )}
            {profile?.gender && (
              <>
                <View style={{ height: 10 }} />
                <SettingItem
                  icon="gender-male-female"
                  label="Género"
                  value={genderLabel}
                  colors={colors}
                  typography={typography}
                />
              </>
            )}
            {profile?.activity_level && (
              <>
                <View style={{ height: 10 }} />
                <SettingItem
                  icon="run"
                  label="Nivel de actividad"
                  value={activityLabel}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowActivityModal(true);
                  }}
                  colors={colors}
                  typography={typography}
                />
              </>
            )}
          </View>
        </View>

        {/* Preferencias Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Preferencias</Text>
          <View style={s.sectionContent}>
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontFamily: typography.body?.fontFamily,
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginBottom: 12,
                  paddingHorizontal: 4,
                }}
              >
                Tema de la aplicación
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <ThemeOption
                  mode="light"
                  label="Claro"
                  icon="weather-sunny"
                  selected={themeMode === "light"}
                  onPress={() => handleThemeChange("light")}
                  colors={colors}
                  typography={typography}
                />
                <ThemeOption
                  mode="dark"
                  label="Oscuro"
                  icon="weather-night"
                  selected={themeMode === "dark"}
                  onPress={() => handleThemeChange("dark")}
                  colors={colors}
                  typography={typography}
                />
                <ThemeOption
                  mode="system"
                  label="Automático"
                  icon="theme-light-dark"
                  selected={themeMode === "system"}
                  onPress={() => handleThemeChange("system")}
                  colors={colors}
                  typography={typography}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Premium Section - Solo si NO es premium */}
        {!isPremium && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Premium</Text>
            <View style={s.sectionContent}>
              <SettingItem
                icon="diamond-stone"
                label="Coach Pro"
                value="Desbloquea todas las funciones premium"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowPaywall(true);
                }}
                colors={colors}
                typography={typography}
              />
            </View>
          </View>
        )}

        {/* Premium Section - Solo si ES premium */}
        {isPremium && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Premium</Text>
            <View style={s.sectionContent}>
              <SettingItem
                icon="diamond-stone"
                label="Gestionar Suscripción"
                value="Modifica o cancela tu suscripción"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowCustomerCenter(true);
                }}
                colors={colors}
                typography={typography}
              />
            </View>
          </View>
        )}

        {/* Salud Section - Solo para Premium */}
        {isPremium && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Salud</Text>
            <View style={s.sectionContent}>
              <SettingItem
                icon={Platform.OS === "ios" ? "apple" : "google"}
                label={
                  Platform.OS === "ios" ? "Apple Health" : "Health Connect"
                }
                value={
                  isSyncing
                    ? "Sincronizando..."
                    : caloriesBurned > 0
                      ? `${caloriesBurned} kcal sincronizadas hoy`
                      : hasPermissions
                        ? "Conectado"
                        : "No conectado"
                }
                onPress={async () => {
                  try {
                    await syncCalories();
                    showToast({
                      message:
                        Platform.OS === "ios"
                          ? "Sincronizado con Apple Health"
                          : "Sincronizado con Health Connect",
                      type: "success",
                    });
                  } catch (error) {
                    showToast({
                      message:
                        error instanceof Error
                          ? error.message
                          : "Error al sincronizar",
                      type: "error",
                    });
                  }
                }}
                rightElement={
                  isSyncing ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : undefined
                }
                colors={colors}
                typography={typography}
              />
              {healthError && (
                <View style={{ marginTop: 8, paddingHorizontal: 16 }}>
                  <Text style={{ fontSize: 12, color: "#EF4444" }}>
                    {healthError}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>App</Text>
          <View style={s.sectionContent}>
            <SettingItem
              icon="information-outline"
              label="Versión"
              value="1.0.0"
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="help-circle-outline"
              label="Ayuda y soporte"
              onPress={() => Linking.openURL("https://www.contamacros.cl/#faq")}
              colors={colors}
              typography={typography}
            />
            <View style={{ height: 10 }} />
            <SettingItem
              icon="shield-check-outline"
              label="Privacidad"
              onPress={() => Linking.openURL("https://www.contamacros.cl/privacidad")}
              colors={colors}
              typography={typography}
            />
          </View>
        </View>

        {/* Información Legal / Créditos */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Información Legal</Text>
          <View style={s.sectionContent}>
            <SettingItem
              icon="database-outline"
              label="Fuentes de datos"
              value="OpenFoodFacts y licencia ODbL"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowDataSourcesModal(true);
              }}
              colors={colors}
              typography={typography}
            />
          </View>
        </View>

        {/* Cuenta Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cuenta</Text>
          <View style={s.sectionContent}>
            <Pressable
              onPress={onLogout}
              disabled={loading || deleting}
              style={({ pressed }) => [
                s.logoutButton,
                {
                  opacity: pressed ? 0.8 : 1,
                  backgroundColor: colors.surface,
                  borderColor: "#EF4444",
                },
              ]}
            >
              <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
              <Text
                style={[
                  s.logoutText,
                  {
                    fontFamily: typography.subtitle?.fontFamily,
                    color: "#EF4444",
                  },
                ]}
              >
                {loading ? "Cerrando sesión..." : "Cerrar sesión"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDeleteAccount}
              disabled={deleting || loading}
              style={({ pressed }) => [
                s.deleteButton,
                {
                  opacity: pressed ? 0.8 : 1,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                (deleting || loading) && { opacity: 0.55 },
              ]}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              )}
              <Text
                style={[
                  s.deleteText,
                  {
                    fontFamily: typography.body?.fontFamily,
                    color: colors.textSecondary,
                  },
                ]}
              >
                {deleting ? "Eliminando cuenta..." : "Eliminar cuenta"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Modal para editar objetivo */}
      <Modal
        visible={showGoalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setShowGoalModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.modalContent}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Cambiar objetivo</Text>
                <Pressable
                  onPress={() => setShowGoalModal(false)}
                  style={({ pressed }) => [
                    s.modalCloseBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={s.modalBody}>
                <Text style={s.modalDescription}>
                  Selecciona tu nuevo objetivo. Se recalcularán automáticamente
                  tus calorías y macros diarios.
                </Text>

                <View style={s.goalOptions}>
                  {(
                    [
                      {
                        value: "deficit",
                        label: "Déficit calórico",
                        icon: "trending-down",
                      },
                      {
                        value: "maintain",
                        label: "Mantenimiento",
                        icon: "trending-neutral",
                      },
                      {
                        value: "surplus",
                        label: "Superávit calórico",
                        icon: "trending-up",
                      },
                    ] as const
                  ).map((option) => {
                    // Comparar con ambos valores posibles (maintain/maintenance)
                    const isSelected = profile?.goal === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => handleUpdateGoal(option.value as GoalDb)}
                        disabled={updating || isSelected}
                        style={({ pressed }) => [
                          s.goalOption,
                          isSelected && s.goalOptionSelected,
                          (updating || isSelected) && {
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={option.icon as any}
                          size={24}
                          color={
                            isSelected ? colors.brand : colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            s.goalOptionText,
                            isSelected && s.goalOptionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected && (
                          <Feather
                            name="check"
                            size={18}
                            color={colors.brand}
                            style={{ marginLeft: "auto" }}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {updating && (
                  <View style={s.modalLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={s.modalLoadingText}>
                      Actualizando objetivos...
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal para editar peso */}
      <Modal
        visible={showWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWeightModal(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setShowWeightModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.modalContent}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Actualizar peso</Text>
                <Pressable
                  onPress={() => {
                    setShowWeightModal(false);
                    setWeightInput("");
                  }}
                  style={({ pressed }) => [
                    s.modalCloseBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={s.modalBody}>
                <Text style={s.modalDescription}>
                  Ingresa tu peso actual. Se recalcularán automáticamente tus
                  calorías y macros diarios.
                </Text>

                <View style={s.weightInputContainer}>
                  <TextInput
                    style={s.weightInput}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    placeholder="Ej: 75.5"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <Text style={s.weightInputLabel}>kg</Text>
                </View>

                {updating ? (
                  <View style={s.modalLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={s.modalLoadingText}>Actualizando...</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleUpdateWeight}
                    style={({ pressed }) => [
                      s.modalSaveBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={s.modalSaveBtnText}>Guardar</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal para editar altura */}
      <Modal
        visible={showHeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHeightModal(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setShowHeightModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.modalContent}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Actualizar altura</Text>
                <Pressable
                  onPress={() => {
                    setShowHeightModal(false);
                    setHeightInput("");
                  }}
                  style={({ pressed }) => [
                    s.modalCloseBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={s.modalBody}>
                <Text style={s.modalDescription}>
                  Ingresa tu altura actual. Se recalcularán automáticamente tus
                  calorías y macros diarios.
                </Text>

                <View style={s.weightInputContainer}>
                  <TextInput
                    style={s.weightInput}
                    value={heightInput}
                    onChangeText={setHeightInput}
                    placeholder="Ej: 175"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <Text style={s.weightInputLabel}>cm</Text>
                </View>

                {updating ? (
                  <View style={s.modalLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={s.modalLoadingText}>Actualizando...</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleUpdateHeight}
                    style={({ pressed }) => [
                      s.modalSaveBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={s.modalSaveBtnText}>Guardar</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal para editar nivel de actividad */}
      <Modal
        visible={showActivityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActivityModal(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setShowActivityModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.modalContent}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Cambiar nivel de actividad</Text>
                <Pressable
                  onPress={() => setShowActivityModal(false)}
                  style={({ pressed }) => [
                    s.modalCloseBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={s.modalBody}>
                <Text style={s.modalDescription}>
                  Selecciona tu nivel de actividad. Se recalcularán
                  automáticamente tus calorías y macros diarios.
                </Text>

                <View style={s.goalOptions}>
                  {(
                    [
                      {
                        value: "sedentary",
                        label: "Sedentario",
                        icon: "sofa",
                        desc: "Poco o ningún ejercicio",
                      },
                      {
                        value: "light",
                        label: "Ligera",
                        icon: "walk",
                        desc: "Ejercicio ligero 1-3 días/semana",
                      },
                      {
                        value: "moderate",
                        label: "Moderada",
                        icon: "run",
                        desc: "Ejercicio moderado 3-5 días/semana",
                      },
                      {
                        value: "high",
                        label: "Alta",
                        icon: "bike",
                        desc: "Ejercicio intenso 6-7 días/semana",
                      },
                      {
                        value: "very_high",
                        label: "Muy alta",
                        icon: "fire",
                        desc: "Ejercicio muy intenso, trabajo físico",
                      },
                    ] as const
                  ).map((option) => {
                    const isSelected = profile?.activity_level === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          handleUpdateActivity(option.value as ActivityLevelDb)
                        }
                        disabled={updating || isSelected}
                        style={({ pressed }) => [
                          s.activityOption,
                          isSelected && s.goalOptionSelected,
                          (updating || isSelected) && {
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={option.icon as any}
                          size={24}
                          color={
                            isSelected ? colors.brand : colors.textSecondary
                          }
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            style={[
                              s.activityOptionDesc,
                              isSelected && { color: colors.textSecondary },
                            ]}
                          >
                            {option.desc}
                          </Text>
                        </View>
                        {isSelected && (
                          <Feather
                            name="check"
                            size={18}
                            color={colors.brand}
                            style={{ marginLeft: "auto" }}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {updating && (
                  <View style={s.modalLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={s.modalLoadingText}>
                      Actualizando nivel de actividad...
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Modal para editar nombre */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setShowNameModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.modalContent}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Editar nombre</Text>
                <Pressable
                  onPress={() => {
                    setShowNameModal(false);
                    setNameInput("");
                  }}
                  style={({ pressed }) => [
                    s.modalCloseBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={s.modalBody}>
                <Text style={s.modalDescription}>
                  Ingresa tu nombre completo. Este nombre aparecerá en tu
                  perfil.
                </Text>

                <View style={s.weightInputContainer}>
                  <TextInput
                    style={[s.weightInput, { textAlign: "left" }]}
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="Ej: Matías"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="default"
                    autoFocus
                    maxLength={50}
                  />
                </View>

                {updating ? (
                  <View style={s.modalLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={s.modalLoadingText}>Actualizando...</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleUpdateName}
                    disabled={!nameInput.trim()}
                    style={({ pressed }) => [
                      s.modalSaveBtn,
                      (!nameInput.trim() || pressed) && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={s.modalSaveBtnText}>Guardar</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Premium Paywall Modal */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => {
          // El perfil se actualiza automáticamente vía refreshProfile
          showToast({
            message: "¡Bienvenido a Coach Pro! 💎",
            type: "success",
            duration: 3000,
          });
        }}
      />

      {/* Customer Center Modal */}
      <CustomerCenter
        visible={showCustomerCenter}
        onClose={() => setShowCustomerCenter(false)}
      />

      {/* Modal Fuentes de datos (ODbL / OpenFoodFacts) */}
      <Modal
        visible={showDataSourcesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDataSourcesModal(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setShowDataSourcesModal(false)}
        >
          <Pressable
            style={s.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Fuentes de datos</Text>
              <Pressable
                onPress={() => setShowDataSourcesModal(false)}
                style={({ pressed }) => [
                  s.modalCloseBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="x" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            <View style={s.modalBody}>
              <Text style={s.modalDescription}>
                ContaMacros utiliza la base de datos de{" "}
                <Text
                  style={{
                    color: colors.brand,
                    textDecorationLine: "underline",
                    fontFamily: typography.body?.fontFamily,
                    fontSize: 14,
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Linking.openURL("https://world.openfoodfacts.org/");
                  }}
                >
                  OpenFoodFacts
                </Text>{" "}
                para la información nutricional de productos escaneados. Los
                datos están disponibles bajo la licencia Open Database License
                (ODbL).
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, typography: any, _insets: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 18,
    },
    header: {
      marginBottom: 24,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    avatarContainer: {
      position: "relative",
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    avatarLoading: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: `${colors.brand}15`,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: `${colors.brand}30`,
    },
    avatarEditBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    headerText: {
      flex: 1,
      gap: 4,
    },
    headerTitle: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 24,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    headerSubtitle: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: "700",
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    sectionContent: {
      gap: 0,
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 2,
      gap: 10,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: "600",
    },
    deleteButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 1,
      gap: 10,
      marginTop: 12,
    },
    deleteText: {
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontFamily: typography.title?.fontFamily,
      fontSize: 20,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    modalBody: {
      padding: 20,
      gap: 20,
    },
    modalDescription: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    goalOptions: {
      gap: 12,
    },
    goalOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    goalOptionSelected: {
      borderColor: colors.brand,
      backgroundColor: `${colors.brand}10`,
    },
    goalOptionText: {
      flex: 1,
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 15,
      color: colors.textSecondary,
    },
    goalOptionTextSelected: {
      color: colors.brand,
      fontWeight: "600",
    },
    activityOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    activityOptionDesc: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textSecondary,
    },
    weightInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    weightInput: {
      flex: 1,
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 18,
      color: colors.textPrimary,
    },
    weightInputLabel: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 16,
      color: colors.textSecondary,
    },
    modalSaveBtn: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    modalSaveBtnText: {
      fontFamily: typography.subtitle?.fontFamily,
      fontSize: 16,
      color: colors.onCta,
      fontWeight: "600",
    },
    modalLoading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 16,
    },
    modalLoadingText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
}
