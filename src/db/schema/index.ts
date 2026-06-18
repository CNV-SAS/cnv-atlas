// Barrel del esquema Drizzle. drizzle.config (schema) y el cliente db (src/db/index.ts)
// importan desde aqui. Cada grupo de DATABASE.md vive en su archivo.
//
// _auth.ts (auth.users) NO se reexporta a proposito: Drizzle no debe gestionar el
// schema auth de Supabase; solo se usa como destino de FK.

export * from "./enums";
export * from "./organizations"; // grupo 1
export * from "./patients"; // grupo 2
export * from "./model-registry"; // grupo 3
export * from "./survey"; // grupo 4
export * from "./evaluations"; // grupo 5
export * from "./bis"; // grupo 6
export * from "./indicators"; // grupo 7
export * from "./diagnoses"; // grupo 8
export * from "./treatments"; // grupo 9
export * from "./followups"; // grupo 10
export * from "./reports"; // grupo 11
export * from "./comodato"; // grupo 12
export * from "./nutraceuticals"; // grupo 13
export * from "./payments"; // grupo 14
export * from "./research"; // grupo 15
export * from "./audit"; // grupo 16
export * from "./ai"; // grupo 17
