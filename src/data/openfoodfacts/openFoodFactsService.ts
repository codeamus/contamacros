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

function mapOffProduct(raw: any): OffProduct {
  const nutr = raw?.nutriments ?? {};

  // OpenFoodFacts puede devolver energía en kcal o kJ
  const energyKcal = toNumber(nutr["energy-kcal_100g"]);
  const energyKj = toNumber(nutr["energy-kj_100g"]) ?? toNumber(nutr["energy_100g"]);

  const kcal100 = convertEnergyToKcal(energyKcal, energyKj);

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
        `&fields=code,product_name,product_name_es,product_name_en,generic_name,brands,image_front_url,image_url,nutriments`;

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
    if (!code) return { ok: false, message: "Barcode vacío." };

    try {
      const url =
        `${BASE}/api/v2/product/${encodeURIComponent(code)}` +
        `?fields=code,product_name,product_name_es,product_name_en,generic_name,brands,image_front_url,image_url,nutriments`;

      const r = await fetch(url, { signal });
      if (!r.ok)
        return { ok: false, message: `OFF product error (${r.status})` };

      const json = await r.json();
      if (json?.status === 0) {
        return {
          ok: false,
          message: json?.status_verbose ?? "Producto no encontrado.",
        };
      }

      const product = json?.product ?? json;
      if (!product) return { ok: false, message: "Producto no encontrado." };

      return { ok: true, data: mapOffProduct(product) };
    } catch (e: any) {
      // Si fue cancelado, no es un error real
      if (e?.name === "AbortError" || signal?.aborted) {
        return { ok: false, message: "Búsqueda cancelada." };
      }
      return { ok: false, message: e?.message ?? "Error obteniendo producto." };
    }
  },
};
