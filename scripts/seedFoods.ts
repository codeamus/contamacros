/* scripts/seedFoods.ts
   pnpm ts-node scripts/seedFoods.ts
   (opcional) SEED_TO_FOODS=true pnpm ts-node scripts/seedFoods.ts
*/
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

type GenericFoodSeed = {
  name_es: string;
  aliases?: string[];
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  unit_label_es?: string;
  grams_per_unit?: number;
  tags?: string[];
  country_tags?: string[];
};

type RecipeSeed = {
  name_es: string;
  aliases?: string[];
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  portion_label_es?: string;
  grams_per_portion?: number;
  tags?: string[];
  country_tags?: string[];
};

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normArr(arr: string[]) {
  return Array.from(new Set(arr.map(norm).filter(Boolean)));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Faltan envs: EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const SEED_TO_FOODS = process.env.SEED_TO_FOODS === "true";

const GENERIC_FOODS: GenericFoodSeed[] = [
  // ===== Frutas (CL + LATAM) =====
  {
    name_es: "Plátano",
    aliases: ["Banana"],
    kcal_100g: 89,
    tags: ["fruta"],
    protein_100g: 1.1,
    carbs_100g: 22.8,
    fat_100g: 0.3,
    unit_label_es: "1 mediano",
    grams_per_unit: 118,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Manzana",
    aliases: ["Apple"],
    tags: ["fruta"],
    kcal_100g: 52,
    protein_100g: 0.3,
    carbs_100g: 13.8,
    fat_100g: 0.2,
    unit_label_es: "1 mediana",
    grams_per_unit: 182,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Naranja",
    tags: ["fruta"],
    kcal_100g: 47,
    protein_100g: 0.9,
    carbs_100g: 11.8,
    fat_100g: 0.1,
    unit_label_es: "1 mediana",
    grams_per_unit: 131,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Mandarina",
    aliases: ["Clementina"],
    tags: ["fruta"],
    kcal_100g: 53,
    protein_100g: 0.8,
    carbs_100g: 13.3,
    fat_100g: 0.3,
    unit_label_es: "1 unidad",
    grams_per_unit: 88,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Frutilla",
    aliases: ["Fresa"],
    tags: ["fruta"],
    kcal_100g: 32,
    protein_100g: 0.7,
    carbs_100g: 7.7,
    fat_100g: 0.3,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Arándanos",
    aliases: ["Blueberries"],
    tags: ["fruta"],
    kcal_100g: 57,
    protein_100g: 0.7,
    carbs_100g: 14.5,
    fat_100g: 0.3,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Uvas",
    tags: ["fruta"],
    kcal_100g: 69,
    protein_100g: 0.7,
    carbs_100g: 18.1,
    fat_100g: 0.2,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Piña",
    aliases: ["Ananá"],
    tags: ["fruta"],
    kcal_100g: 50,
    protein_100g: 0.5,
    carbs_100g: 13.1,
    fat_100g: 0.1,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Mango",
    tags: ["fruta"],
    kcal_100g: 60,
    protein_100g: 0.8,
    carbs_100g: 15.0,
    fat_100g: 0.4,
    country_tags: ["latam"],
  },
  {
    name_es: "Papaya",
    tags: ["fruta"],
    kcal_100g: 43,
    protein_100g: 0.5,
    carbs_100g: 10.8,
    fat_100g: 0.3,
    country_tags: ["latam"],
  },
  {
    name_es: "Palta",
    aliases: ["Aguacate"],
    tags: ["fruta", "grasa-sana"],
    kcal_100g: 160,
    protein_100g: 2.0,
    carbs_100g: 8.5,
    fat_100g: 14.7,
    unit_label_es: "1/2 palta",
    grams_per_unit: 100,
    country_tags: ["cl", "latam"],
  },

  // ===== Verduras =====
  {
    name_es: "Tomate",
    tags: ["verdura"],
    kcal_100g: 18,
    protein_100g: 0.9,
    carbs_100g: 3.9,
    fat_100g: 0.2,
    unit_label_es: "1 mediano",
    grams_per_unit: 123,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Lechuga",
    tags: ["verdura"],
    kcal_100g: 15,
    protein_100g: 1.4,
    carbs_100g: 2.9,
    fat_100g: 0.2,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Zanahoria",
    tags: ["verdura"],
    kcal_100g: 41,
    protein_100g: 0.9,
    carbs_100g: 9.6,
    fat_100g: 0.2,
    unit_label_es: "1 mediana",
    grams_per_unit: 61,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Cebolla",
    tags: ["verdura"],
    kcal_100g: 40,
    protein_100g: 1.1,
    carbs_100g: 9.3,
    fat_100g: 0.1,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Pimentón",
    aliases: ["Morrón", "Ají dulce"],
    tags: ["verdura"],
    kcal_100g: 31,
    protein_100g: 1.0,
    carbs_100g: 6.0,
    fat_100g: 0.3,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Brócoli",
    tags: ["verdura"],
    kcal_100g: 34,
    protein_100g: 2.8,
    carbs_100g: 6.6,
    fat_100g: 0.4,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Espinaca",
    tags: ["verdura"],
    kcal_100g: 23,
    protein_100g: 2.9,
    carbs_100g: 3.6,
    fat_100g: 0.4,
    country_tags: ["cl", "latam"],
  },

  // ===== Carb base =====
  {
    name_es: "Arroz cocido",
    aliases: ["Arroz blanco cocido"],
    tags: ["carbohidrato"],
    kcal_100g: 130,
    protein_100g: 2.4,
    carbs_100g: 28.2,
    fat_100g: 0.3,
    unit_label_es: "1 taza",
    grams_per_unit: 158,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Fideos cocidos",
    aliases: ["Pasta cocida", "Tallarines cocidos"],
    tags: ["carbohidrato"],
    kcal_100g: 131,
    protein_100g: 5.0,
    carbs_100g: 25.0,
    fat_100g: 1.1,
    unit_label_es: "1 taza",
    grams_per_unit: 140,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Pan marraqueta",
    aliases: ["Pan francés", "Pan batido"],
    tags: ["pan"],
    kcal_100g: 270,
    protein_100g: 9.0,
    carbs_100g: 55.0,
    fat_100g: 2.5,
    unit_label_es: "1/2 marraqueta",
    grams_per_unit: 50,
    country_tags: ["cl"],
  },
  {
    name_es: "Pan de molde",
    tags: ["pan"],
    kcal_100g: 265,
    protein_100g: 9.0,
    carbs_100g: 49.0,
    fat_100g: 3.2,
    unit_label_es: "1 rebanada",
    grams_per_unit: 25,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Papa cocida",
    aliases: ["Patata cocida"],
    tags: ["carbohidrato"],
    kcal_100g: 87,
    protein_100g: 1.9,
    carbs_100g: 20.1,
    fat_100g: 0.1,
    unit_label_es: "1 mediana",
    grams_per_unit: 173,
    country_tags: ["cl", "latam"],
  },

  // ===== Proteínas =====
  {
    name_es: "Pechuga de pollo cocida",
    aliases: ["Pollo cocido"],
    tags: ["proteina"],
    kcal_100g: 165,
    protein_100g: 31.0,
    carbs_100g: 0.0,
    fat_100g: 3.6,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Carne de vacuno magra cocida",
    aliases: ["Vacuno cocido", "Res cocida"],
    tags: ["proteina"],
    kcal_100g: 217,
    protein_100g: 26.0,
    carbs_100g: 0.0,
    fat_100g: 12.0,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Atún al agua (escurrido)",
    tags: ["proteina"],
    kcal_100g: 116,
    protein_100g: 26.0,
    carbs_100g: 0.0,
    fat_100g: 1.0,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Huevo",
    tags: ["proteina"],
    kcal_100g: 143,
    protein_100g: 13.0,
    carbs_100g: 1.1,
    fat_100g: 9.5,
    unit_label_es: "1 unidad",
    grams_per_unit: 50,
    country_tags: ["cl", "latam"],
  },

  // ===== Lácteos =====
  {
    name_es: "Leche entera",
    tags: ["lacteo"],
    kcal_100g: 61,
    protein_100g: 3.2,
    carbs_100g: 4.8,
    fat_100g: 3.3,
    unit_label_es: "1 vaso",
    grams_per_unit: 200,
    country_tags: ["cl", "latam"],
  },
  {
    name_es: "Yogur natural",
    aliases: ["Yoghurt natural"],
    tags: ["lacteo"],
    kcal_100g: 61,
    protein_100g: 3.5,
    carbs_100g: 4.7,
    fat_100g: 3.3,
    unit_label_es: "1 pote",
    grams_per_unit: 125,
    country_tags: ["cl", "latam"],
  },

  // ===== Fast food genérico LATAM =====
  {
    name_es: "Hamburguesa simple (genérica)",
    aliases: ["Hamburguesa"],
    tags: ["fastfood"],
    kcal_100g: 250,
    protein_100g: 13.0,
    carbs_100g: 23.0,
    fat_100g: 12.0,
    unit_label_es: "1 unidad",
    grams_per_unit: 150,
    country_tags: ["latam"],
  },
  {
    name_es: "Pizza (genérica)",
    tags: ["fastfood"],
    kcal_100g: 266,
    protein_100g: 11.0,
    carbs_100g: 33.0,
    fat_100g: 10.0,
    unit_label_es: "1 porción",
    grams_per_unit: 120,
    country_tags: ["latam"],
  },
];

const RECIPES: RecipeSeed[] = [
  // ===== CL =====
  {
    name_es: "Porotos con riendas",
    aliases: ["Porotos"],
    tags: ["cl", "plato"],
    country_tags: ["cl"],
    kcal_100g: 120,
    protein_100g: 6.0,
    carbs_100g: 18.0,
    fat_100g: 3.0,
    portion_label_es: "1 plato",
    grams_per_portion: 350,
  },
  {
    name_es: "Cazuela de pollo",
    tags: ["cl", "plato"],
    country_tags: ["cl"],
    kcal_100g: 85,
    protein_100g: 6.5,
    carbs_100g: 7.5,
    fat_100g: 3.0,
    portion_label_es: "1 plato",
    grams_per_portion: 400,
  },
  {
    name_es: "Pastel de choclo",
    tags: ["cl", "plato"],
    country_tags: ["cl"],
    kcal_100g: 170,
    protein_100g: 8.0,
    carbs_100g: 20.0,
    fat_100g: 7.0,
    portion_label_es: "1 porción",
    grams_per_portion: 300,
  },
  {
    name_es: "Completo italiano",
    aliases: ["Completo"],
    tags: ["cl", "fastfood"],
    country_tags: ["cl"],
    kcal_100g: 240,
    protein_100g: 9.0,
    carbs_100g: 23.0,
    fat_100g: 13.0,
    portion_label_es: "1 unidad",
    grams_per_portion: 220,
  },

  // ===== LATAM =====
  {
    name_es: "Arroz con pollo",
    tags: ["latam", "plato"],
    country_tags: ["latam"],
    kcal_100g: 145,
    protein_100g: 7.5,
    carbs_100g: 19.0,
    fat_100g: 4.5,
    portion_label_es: "1 plato",
    grams_per_portion: 350,
  },
  {
    name_es: "Tallarines con salsa",
    aliases: ["Pasta con salsa"],
    tags: ["latam", "plato"],
    country_tags: ["latam"],
    kcal_100g: 140,
    protein_100g: 5.0,
    carbs_100g: 22.0,
    fat_100g: 3.5,
    portion_label_es: "1 plato",
    grams_per_portion: 320,
  },
  {
    name_es: "Pollo a la plancha con ensalada",
    tags: ["latam", "plato"],
    country_tags: ["latam"],
    kcal_100g: 120,
    protein_100g: 12.0,
    carbs_100g: 3.0,
    fat_100g: 6.0,
    portion_label_es: "1 plato",
    grams_per_portion: 350,
  },
];

async function upsertGenericFoods(items: GenericFoodSeed[]) {
  const payload = items.map((x) => {
    const aliases = x.aliases ?? [];
    const tags = x.tags ?? [];
    const country_tags = x.country_tags ?? ["latam"];

    const aliases_norm = normArr(aliases);
    const aliases_search = [norm(x.name_es), ...aliases_norm].join(" ");

    return {
      name_es: x.name_es.trim(),
      name_norm: norm(x.name_es),
      aliases,
      aliases_norm,
      aliases_search,

      kcal_100g: Math.round(x.kcal_100g),
      protein_100g: round1(x.protein_100g),
      carbs_100g: round1(x.carbs_100g),
      fat_100g: round1(x.fat_100g),

      unit_label_es: x.unit_label_es ?? null,
      grams_per_unit: x.grams_per_unit ?? null,

      tags,
      country_tags,
    };
  });

  const { error } = await supabase
    .from("generic_foods")
    .upsert(payload, { onConflict: "name_norm" });

  if (error) throw error;
}

async function upsertRecipes(items: RecipeSeed[]) {
  // ⚠️ Solo si existe tabla recipes. Si no existe, lo saltamos.
  const { data: tableCheck } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", "recipes")
    .maybeSingle();

  if (!tableCheck) {
    console.log("Tabla recipes no existe -> saltando recipes ✅");
    return;
  }

  const payload = items.map((x) => {
    const aliases = x.aliases ?? [];
    const tags = x.tags ?? [];
    const country_tags = x.country_tags ?? ["latam"];

    const aliases_norm = normArr(aliases);
    const aliases_search = [norm(x.name_es), ...aliases_norm].join(" ");

    return {
      name_es: x.name_es.trim(),
      name_norm: norm(x.name_es),
      aliases,
      aliases_norm,
      aliases_search,

      kcal_100g: Math.round(x.kcal_100g),
      protein_100g: round1(x.protein_100g),
      carbs_100g: round1(x.carbs_100g),
      fat_100g: round1(x.fat_100g),

      portion_label_es: x.portion_label_es ?? null,
      grams_per_portion: x.grams_per_portion ?? null,

      tags,
      country_tags,
    };
  });

  const { error } = await supabase
    .from("recipes")
    .upsert(payload, { onConflict: "name_norm" });

  if (error) throw error;
}

/**
 * Opcional: Copia genéricos a public.foods (para que tu AddFood los encuentre).
 * - category y portion_* se infieren.
 * - source = 'manual_seed', verified=true, country_scope='CL/LATAM'
 */
async function seedIntoFoods(items: GenericFoodSeed[]) {
  const categoryFromTags = (tags: string[]) => {
    const t = new Set(tags);
    if (t.has("proteina")) return "protein";
    if (t.has("carbohidrato") || t.has("pan")) return "carb";
    if (t.has("lacteo")) return "dairy";
    if (t.has("verdura")) return "veg";
    if (t.has("fruta")) return "fruit";
    if (t.has("fastfood")) return "mixed";
    return "mixed";
  };

  const payload = items.map((x) => {
    const tags = x.tags ?? [];
    const category = categoryFromTags(tags);

    // si tiene unidad definida -> base 1 unidad, si no -> base 100g
    const hasUnit = Boolean(x.unit_label_es && x.grams_per_unit);
    const portion_unit = hasUnit ? "unidad" : "g";
    const portion_base = hasUnit ? 1 : 100;

    return {
      name: x.name_es.trim(),
      category,
      portion_unit,
      portion_base,

      calories: Math.round(x.kcal_100g),
      protein: round1(x.protein_100g),
      carbs: round1(x.carbs_100g),
      fat: round1(x.fat_100g),

      barcode: null,
      brand: null,

      source: "manual_seed",
      verified: true,
      country_scope: "CL/LATAM",
    };
  });

  // ⚠️ No tienes constraint unique para evitar duplicados.
  // Solución simple: borrar por source='manual_seed' y reinsertar.
  const { error: delErr } = await supabase
    .from("foods")
    .delete()
    .eq("source", "manual_seed");

  if (delErr) throw delErr;

  const { error: insErr } = await supabase.from("foods").insert(payload);
  if (insErr) throw insErr;
}

async function main() {
  console.log("Seeding generic_foods:", GENERIC_FOODS.length);
  await upsertGenericFoods(GENERIC_FOODS);
  console.log("OK generic_foods ✅");

  console.log("Seeding recipes:", RECIPES.length);
  await upsertRecipes(RECIPES);
  console.log("OK recipes ✅");

  if (SEED_TO_FOODS) {
    console.log("Seeding into foods:", GENERIC_FOODS.length);
    await seedIntoFoods(GENERIC_FOODS);
    console.log("OK foods ✅");
  }

  console.log("DONE ✅");
}

main().catch((e) => {
  console.error("Seed failed:", e?.message ?? e);
  process.exit(1);
});
