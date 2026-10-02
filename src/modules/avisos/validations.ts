import { z } from "zod";

import { TIPOS_SIN_SALIDA } from "./resumen";

// Validaciones de los avisos (Bloque A). Modulo neutro.

const dbUuid = z.guid();
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export const enGestionSchema = z.object({
  tipo: z.enum(["revision", "sin_documento", "nota_credito", "reversa"]),
  transactionId: dbUuid,
  nota: z.string().trim().min(5, "Escribe en una frase qué se está haciendo.").max(500),
  hasta: z.string().regex(DIA, "Elige hasta qué fecha."),
});

// ═══ DESCARTAR UN PENDIENTE SIN SALIDA (0205) ═══
//
// EL MOTIVO ES OBLIGATORIO Y CON CUERPO (10 caracteres, los mismos que exige el CHECK de la base). Descartar
// apaga un control sobre dinero y sobre unidades fisicas; "ok" no le explica nada a quien audite esto en marzo.
export const descarteSchema = z.object({
  tipo: z.enum(TIPOS_SIN_SALIDA),
  transactionId: dbUuid,
  motivo: z
    .string()
    .trim()
    .min(10, "Escribe por qué se descarta: queda firmado con tu nombre.")
    .max(500),
});

export const reactivarDescarteSchema = z.object({
  tipo: z.enum(TIPOS_SIN_SALIDA),
  transactionId: dbUuid,
});

export const marcaSchema = z.object({
  profileId: dbUuid,
  tipo: z.enum(["pendientes_ventas", "escalamiento_ventas"]),
  poner: z.enum(["si", "no"]),
});

export type AvisoFormState = { error: string | null; success: string | null; warning: string | null };
