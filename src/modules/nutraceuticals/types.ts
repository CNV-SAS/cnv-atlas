import type { Database } from "@/types/database.generated";

// Tipos de dominio de nutraceuticos, derivados de la Database generada.
type Tables = Database["public"]["Tables"];

export type Nutraceutical = Tables["nutraceuticals"]["Row"];
export type NutraceuticalInsert = Tables["nutraceuticals"]["Insert"];
export type NutraceuticalInventory = Tables["nutraceutical_inventory"]["Row"];
export type NutraceuticalUsage = Tables["nutraceutical_usage"]["Row"];

// Catalogo con su stock resuelto, para los listados de la UI.
export type NutraceuticalWithStock = Nutraceutical & { stock: number | null };
