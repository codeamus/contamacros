// src/domain/services/userService.ts
import { supabase } from "@/data/supabase/supabaseClient";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

/**
 * Servicio para gestión de usuarios (avatares, etc.)
 */
export const UserService = {
  /**
   * Actualiza el avatar del usuario
   * Sube la imagen al bucket 'avatars' y actualiza avatar_url en profiles
   * La imagen ya viene comprimida desde ImagePicker (quality: 0.2)
   * 
   * @param imageUri - URI local de la imagen seleccionada (ya comprimida)
   * @returns URL pública del avatar o error
   */
  async updateUserAvatar(imageUri: string): Promise<ServiceResult<string>> {
    try {
      // Obtener sesión actual
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        return { ok: false, message: sessionError.message, code: sessionError.code };
      }

      const userId = sessionData.session?.user?.id;
      if (!userId) {
        return { ok: false, message: "No hay sesión activa" };
      }

      // Convertir la imagen a ArrayBuffer usando expo-file-system (método base64)
      console.log("[UserService] 📸 Leyendo imagen desde URI:", { imageUri });
      
      // Leer la imagen como base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64 || base64.length === 0) {
        console.error("[UserService] ❌ Base64 está vacío");
        return { ok: false, message: "La imagen está vacía o no se pudo leer correctamente" };
      }

      console.log("[UserService] ✅ Base64 obtenido:", {
        length: base64.length,
        sizeKB: (base64.length * 3 / 4 / 1024).toFixed(2), // Aproximación del tamaño en KB
      });

      // Decodificar base64 a ArrayBuffer
      const arrayBuffer = decode(base64);
      
      console.log("[UserService] 📋 ArrayBuffer creado:", {
        size: arrayBuffer.byteLength,
        sizeKB: (arrayBuffer.byteLength / 1024).toFixed(2),
      });

      if (arrayBuffer.byteLength === 0) {
        console.error("[UserService] ❌ ArrayBuffer está vacío (0 bytes)");
        return { ok: false, message: "La imagen está vacía o no se pudo leer correctamente" };
      }

      // Nombre del archivo: ${userId}_avatar.jpg
      const fileName = `${userId}_avatar.jpg`;
      const filePath = fileName;

      // Subir al bucket 'avatars' pasando el ArrayBuffer directamente
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) {
        console.error("[UserService] Error subiendo avatar:", uploadError);
        return { ok: false, message: uploadError.message };
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        return { ok: false, message: "No se pudo obtener la URL pública del avatar" };
      }

      // Actualizar avatar_url en profiles
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", userId);

      if (updateError) {
        console.error("[UserService] Error actualizando avatar_url:", updateError);
        return { ok: false, message: updateError.message, code: updateError.code };
      }

      return { ok: true, data: urlData.publicUrl };
    } catch (error) {
      console.error("[UserService] Excepción en updateUserAvatar:", error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al actualizar el avatar",
      };
    }
  },
};