export type OffProduct = {
  id: string; // code/barcode o unique key
  barcode?: string;
  name: string;
  brand?: string;
  imageUrl?: string;

  // Nutrientes por 100g (o 100ml) normalizados a number | null
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;

  // Unidad de referencia (por ahora asumimos 100g)
  basis: "100g";
};
