// src/data/openfoodfacts/openFoodFactsService.ts
import type { OffProduct } from "@/domain/models/offProduct";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickName(p: any): string {
  return (
    p?.product_name ||
    p?.product_name_es ||
    p?.product_name_en ||
    p?.generic_name ||
    "Producto sin nombre"
  );
}

/**
 * Convierte energía de kJ a kcal si es necesario.
 * OpenFoodFacts puede devolver energía en kJ o kcal.
 * 1 kcal = 4.184 kJ
 */
function convertEnergyToKcal(
  energyKcal: number | null,
  energyKj: number | null,
): number | null {
  // Si ya tenemos kcal, usamos ese valor
  if (energyKcal !== null) return energyKcal;

  // Si tenemos kJ, convertimos a kcal
  if (energyKj !== null) {
    return energyKj / 4.184;
  }

  return null;
}

/**
 * Detecta si el producto es líquido (ml) o sólido (gr) según campos de OFF.
 * 1) serving_quantity_unit (ej: "ml", "L")
 * 2) quantity (ej: "1 L", "330 ml", "liquide")
 * Por defecto: "gr".
 */
function detectUnitType(raw: any): "gr" | "ml" {
  const servingUnit = raw?.serving_quantity_unit;
  if (servingUnit != null && typeof servingUnit === "string") {
    const u = servingUnit.toLowerCase().trim();
    if (u === "ml" || u === "l" || u === "litre" || u === "liter") return "ml";
  }

  const quantity = raw?.quantity;
  if (quantity != null && typeof quantity === "string") {
    const q = quantity.toLowerCase();
    if (q.includes("ml") || q.includes("liquide") || q === "l" || /\d+\s*l\b/.test(q)) return "ml";
  }

  return "gr";
}

function mapOffProduct(raw: any): OffProduct {
  const nutr = raw?.nutriments ?? {};

  // OpenFoodFacts puede devolver energía en kcal o kJ
  const energyKcal = toNumber(nutr["energy-kcal_100g"]);
  const energyKj = toNumber(nutr["energy-kj_100g"]) ?? toNumber(nutr["energy_100g"]);

  const kcal100 = convertEnergyToKcal(energyKcal, energyKj);
  const unitType = detectUnitType(raw);

  return {
    id: String(raw?.code ?? raw?._id ?? raw?.id ?? "unknown"),
    barcode: raw?.code ? String(raw.code) : undefined,
    name: pickName(raw),
    brand: raw?.brands ? String(raw.brands) : undefined,
    imageUrl:
      raw?.image_front_url ||
      raw?.image_url ||
      raw?.selected_images?.front?.display?.en ||
      undefined,
    kcal_100g: kcal100,
    protein_100g: toNumber(nutr["proteins_100g"]),
    carbs_100g: toNumber(nutr["carbohydrates_100g"]),
    fat_100g: toNumber(nutr["fat_100g"]),
    basis: "100g",
    unitType,
  };
}

const BASE = "https://world.openfoodfacts.org";

export const openFoodFactsService = {
  // ✅ Búsqueda por texto: usa v1 (mejor para nombre/marca)
  async search(params: {
    query: string;
    page?: number;
    pageSize?: number;
    cc?: string; // país (opcional)
    lc?: string; // idioma (opcional)
    signal?: AbortSignal; // Para cancelar requests
  }): Promise<Result<{ items: OffProduct[]; page: number; pageSize: number }>> {
    const q = params.query.trim();
    if (!q) return { ok: true, data: { items: [], page: 1, pageSize: 20 } };

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    // Si quieres CL por ahora:
    const cc = (params.cc ?? "cl").toLowerCase();
    const lc = (params.lc ?? "es").toLowerCase();

    try {
      // v1 Search API
      const url =
        `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
        `&search_simple=1&action=process&json=1` +
        `&page=${page}&page_size=${pageSize}` +
        `&lc=${encodeURIComponent(lc)}` +
        `&cc=${encodeURIComponent(cc)}` +
        `&fields=code,product_name,product_name_es,product_name_en,generic_name,brands,image_front_url,image_url,nutriments,serving_quantity_unit,quantity`;

      const r = await fetch(url, { signal: params.signal });
      if (!r.ok) {
        return { ok: false, message: `OFF v1 search error (${r.status})` };
      }

      const json = await r.json();
      const products = Array.isArray(json?.products) ? json.products : [];
      const items = products.map(mapOffProduct);

      return { ok: true, data: { items, page, pageSize } };
    } catch (e: any) {
      // Si fue cancelado, no es un error real
      if (e?.name === "AbortError" || params.signal?.aborted) {
        return { ok: false, message: "Búsqueda cancelada." };
      }
      return { ok: false, message: e?.message ?? "Error buscando productos." };
    }
  },

  // Tu getByBarcode v2 puede quedarse tal cual
  async getByBarcode(
    barcode: string,
    signal?: AbortSignal,
  ): Promise<Result<OffProduct>> {
    const code = barcode.trim();
    console.log("[OpenFoodFacts] 🔍 getByBarcode llamado:", { code, hasSignal: !!signal });
    
    if (!code) {
      console.error("[OpenFoodFacts] ❌ Barcode vacío");
      return { ok: false, message: "Barcode vacío." };
    }

    try {
      const url =
        `${BASE}/api/v2/product/${encodeURIComponent(code)}` +
        `?fields=code,product_name,product_name_es,product_name_en,generic_name,brands,image_front_url,image_url,nutriments,serving_quantity_unit,quantity`;

      console.log("[OpenFoodFacts] 🌐 Haciendo request a:", url);

      const r = await fetch(url, { signal });
      
      console.log("[OpenFoodFacts] 📡 Respuesta HTTP:", {
        status: r.status,
        statusText: r.statusText,
        ok: r.ok,
      });
      
      if (!r.ok) {
        console.error("[OpenFoodFacts] ❌ Error HTTP:", r.status, r.statusText);
        // 404 = producto no está en la base de datos de Open Food Facts
        if (r.status === 404) {
          return {
            ok: false,
            message:
              "Producto no encontrado en Open Food Facts. Puedes buscarlo por nombre o agregarlo manualmente.",
          };
        }
        return { ok: false, message: `Error al consultar Open Food Facts (${r.status})` };
      }

      const json = await r.json();
      
      console.log("[OpenFoodFacts] 📦 JSON recibido:", {
        hasStatus: "status" in json,
        status: json?.status,
        statusVerbose: json?.status_verbose,
        hasProduct: !!json?.product,
        productKeys: json?.product ? Object.keys(json.product) : [],
      });
      
      if (json?.status === 0) {
        console.error("[OpenFoodFacts] ❌ Producto no encontrado (status=0):", json?.status_verbose);
        return {
          ok: false,
          message: json?.status_verbose ?? "Producto no encontrado.",
        };
      }

      const product = json?.product ?? json;
      
      if (!product) {
        console.error("[OpenFoodFacts] ❌ No hay producto en la respuesta");
        return { ok: false, message: "Producto no encontrado." };
      }

      console.log("[OpenFoodFacts] ✅ Producto encontrado:", {
        code: product?.code,
        name: pickName(product),
        hasNutriments: !!product?.nutriments,
      });

      const mapped = mapOffProduct(product);
      
      console.log("[OpenFoodFacts] ✅ Producto mapeado:", {
        id: mapped.id,
        name: mapped.name,
        kcal_100g: mapped.kcal_100g,
        protein_100g: mapped.protein_100g,
        carbs_100g: mapped.carbs_100g,
        fat_100g: mapped.fat_100g,
      });

      return { ok: true, data: mapped };
    } catch (e: any) {
      console.error("[OpenFoodFacts] 💥 Excepción:", {
        name: e?.name,
        message: e?.message,
        stack: e?.stack,
        isAbortError: e?.name === "AbortError",
        signalAborted: signal?.aborted,
      });
      
      // Si fue cancelado, no es un error real
      if (e?.name === "AbortError" || signal?.aborted) {
        return { ok: false, message: "Búsqueda cancelada." };
      }
      return { ok: false, message: e?.message ?? "Error obteniendo producto." };
    }
  },
};
