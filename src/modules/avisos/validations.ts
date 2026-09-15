import { z } from "zod";

// Validaciones de los avisos (Bloque A). Modulo neutro.

const dbUuid = z.guid();
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export const enGestionSchema = z.object({
  tipo: z.enum(["revision", "sin_documento", "nota_credito"]),
  transactionId: dbUuid,
  nota: z.string().trim().min(5, "Escribe en una frase qué se está haciendo.").max(500),
  hasta: z.string().regex(DIA, "Elige hasta qué fecha."),
});

export const marcaSchema = z.object({
  profileId: dbUuid,
  tipo: z.enum(["pendientes_ventas", "escalamiento_ventas"]),
  poner: z.enum(["si", "no"]),
});

export type AvisoFormState = { error: string | null; success: string | null; warning: string | null };
