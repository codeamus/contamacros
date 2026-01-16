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

function mapOffProduct(raw: any): OffProduct {
  const nutr = raw?.nutriments ?? {};

  const kcal100 =
    toNumber(nutr["energy-kcal_100g"]) ??
    // fallback (a veces energy_100g viene en kJ; si te pasa, luego lo mejoramos)
    toNumber(nutr["energy_100g"]);

  return {
    id: String(raw?.code ?? raw?._id ?? raw?.id ?? raw?.barcode ?? "unknown"),
    barcode: raw?.code
      ? String(raw.code)
      : raw?.barcode
      ? String(raw.barcode)
      : undefined,
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

const BASE = "https://world.openfoodfacts.org"; // dominio “world” habitual :contentReference[oaicite:2]{index=2}

export const openFoodFactsService = {
  // Buscar por texto (Search API v2)
  async search(params: {
    query: string;
    page?: number;
    pageSize?: number;
  }): Promise<Result<{ items: OffProduct[]; page: number; pageSize: number }>> {
    const q = params.query.trim();
    if (!q) return { ok: true, data: { items: [], page: 1, pageSize: 20 } };

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    try {
      // Search API v2 (wiki) :contentReference[oaicite:3]{index=3}
      // Nota: OpenFoodFacts cambia detalles con el tiempo; si algo no responde,
      // te ajusto el endpoint exacto con tu error real.
      const url =
        `${BASE}/api/v2/search?search_terms=${encodeURIComponent(q)}` +
        `&page=${page}&page_size=${pageSize}` +
        `&fields=code,product_name,product_name_es,product_name_en,generic_name,brands,image_front_url,image_url,nutriments`;

      const r = await fetch(url);
      if (!r.ok) {
        return { ok: false, message: `OFF search error (${r.status})` };
      }
      const json = await r.json();

      const products = Array.isArray(json?.products) ? json.products : [];
      const items = products.map(mapOffProduct);

      return { ok: true, data: { items, page, pageSize } };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Error buscando productos." };
    }
  },

  // Buscar por código de barras (API v2)
  async getByBarcode(barcode: string): Promise<Result<OffProduct>> {
    const code = barcode.trim();
    if (!code) return { ok: false, message: "Barcode vacío." };

    try {
      // API docs: “Get a product by barcode” (hay endpoints v0 y v2; preferimos v2). :contentReference[oaicite:4]{index=4}
      const url =
        `${BASE}/api/v2/product/${encodeURIComponent(code)}` +
        `?fields=code,product_name,product_name_es,product_name_en,generic_name,brands,image_front_url,image_url,nutriments`;

      const r = await fetch(url);
      if (!r.ok)
        return { ok: false, message: `OFF product error (${r.status})` };

      const json = await r.json();
      const product = json?.product ?? json; // según respuesta

      if (!product) return { ok: false, message: "Producto no encontrado." };

      return { ok: true, data: mapOffProduct(product) };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Error obteniendo producto." };
    }
  },
};
