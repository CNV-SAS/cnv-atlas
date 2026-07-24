import { z } from "zod";

import { appError, err, ok, type Result } from "@/core/errors";

import { computeContraindicated } from "./services/contraindication";
import type { BisConditionAnswer, BisConditionAnswers, BisConditionCatalog } from "./types";

// Rango numerico de la respuesta principal por clave. DECISION (Santiago): NO vive en el catalogo
// (YAGNI; ver BACKLOG). Hoy solo la semana del ciclo (1-6). Es el limite AUTORITATIVO server-side;
// el input del UI lo refuerza con min/max, pero la validacion real esta aqui.
const PRIMARY_RANGES: Record<string, { min: number; max: number }> = {
  semana_ciclo: { min: 1, max: 6 },
};

// Cotas clinicas holgadas de los detalles numericos (evitan valores absurdos sin ser pedantes).
const DETAIL_RANGES: Record<string, { min: number; max: number }> = {
  embarazo: { min: 1, max: 10 }, // mes de gestacion
  menstruacion: { min: 1, max: 31 }, // dia del periodo
};

const answerInput = z.object({
  value: z.union([z.boolean(), z.number()]),
  detail: z.union([z.string(), z.number()]).optional(),
  acknowledged: z.boolean().optional(),
});

// z.guid() (no z.uuid()): Zod 4 rechaza los UUIDs fijos del seed con .uuid() (memoria del proyecto).
export const saveBisConditionsSchema = z.object({
  evaluationId: z.guid(),
  answers: z.record(z.string(), answerInput),
  weightGoalKg: z.number().positive().max(500).nullable().optional(),
  gripStrengthKg: z.number().positive().max(200).nullable().optional(),
});

export type SaveBisConditionsInput = z.infer<typeof saveBisConditionsSchema>;

export type ValidatedBisCapture = {
  answers: BisConditionAnswers;
  contraindicated: boolean;
  warnings: string[]; // claves de advertencias reconocidas
};

// Validacion semantica de la captura CONTRA el catalogo activo (la forma ya paso por Zod). Pura y
// testeable. Reglas:
//  - Toda respuesta debe corresponder a una condicion del catalogo.
//  - El bloque general es OBLIGATORIO (incluye el marcapasos, base del gate del import); el bloque
//    femenino es opcional (la UI lo muestra solo a mujeres) pero se valida si viene.
//  - El tipo de value respeta input_type; los numericos respetan su rango.
//  - requiresDetail && value===true exige el detalle (con su tipo/rango).
//  - Advertencia && value===true exige reconocimiento explicito del profesional; se sella
//    acknowledgedAt con nowIso (pasa de "el sistema mostro" a "el profesional reconocio").
export function validateBisConditionsCapture(
  catalog: BisConditionCatalog,
  input: SaveBisConditionsInput,
  nowIso: string,
  patientIsFemale: boolean,
): Result<ValidatedBisCapture> {
  const byKey = new Map(catalog.conditions.map((c) => [c.key, c]));
  const fields: Record<string, string> = {};
  const sealed: BisConditionAnswers = {};

  // Una condicion es OBLIGATORIA si es si/no y aplica al paciente (general siempre; femenina solo si
  // es mujer). Las numericas (semana del ciclo) son OPCIONALES: el dato puede no estar disponible, a
  // diferencia de las si/no que siempre se pueden responder. "sin responder" != "no" para una
  // compuerta de seguridad.
  const isRequired = (c: (typeof catalog.conditions)[number]): boolean =>
    c.inputType === "boolean" && (c.scope === "general" || patientIsFemale);

  for (const key of Object.keys(input.answers)) {
    if (!byKey.has(key)) fields[key] = "Condicion desconocida.";
  }

  for (const c of catalog.conditions) {
    const raw = input.answers[c.key];
    if (raw == null) {
      if (isRequired(c)) fields[c.key] = "Responde esta condicion.";
      continue;
    }

    if (c.inputType === "boolean") {
      if (typeof raw.value !== "boolean") {
        fields[c.key] = "Responde Si o No.";
        continue;
      }
    } else if (c.inputType === "number") {
      const r = PRIMARY_RANGES[c.key];
      if (
        typeof raw.value !== "number" ||
        !Number.isInteger(raw.value) ||
        (r && (raw.value < r.min || raw.value > r.max))
      ) {
        fields[c.key] = r ? `Debe ser un numero entre ${r.min} y ${r.max}.` : "Ingresa un numero valido.";
        continue;
      }
    } else {
      // text como respuesta principal no se usa en v1.
      fields[c.key] = "Tipo de respuesta no soportado.";
      continue;
    }

    const answer: BisConditionAnswer = { value: raw.value };

    if (c.requiresDetail && raw.value === true) {
      if (raw.detail == null || raw.detail === "") {
        fields[c.key] = `Falta el detalle${c.detailLabel ? `: ${c.detailLabel}` : ""}.`;
        continue;
      }
      if (c.detailType === "number") {
        const n = typeof raw.detail === "number" ? raw.detail : Number(raw.detail);
        const dr = DETAIL_RANGES[c.key];
        if (!Number.isInteger(n) || (dr && (n < dr.min || n > dr.max))) {
          fields[c.key] = `Detalle invalido${dr ? ` (${dr.min}-${dr.max})` : ""}.`;
          continue;
        }
        answer.detail = n;
      } else {
        answer.detail = String(raw.detail).trim().slice(0, 200);
      }
    }

    if (c.kind === "advertencia" && raw.value === true) {
      if (raw.acknowledged !== true) {
        fields[c.key] = "Debes reconocer la advertencia para continuar.";
        continue;
      }
      answer.acknowledgedAt = nowIso;
    }

    sealed[c.key] = answer;
  }

  if (Object.keys(fields).length > 0) {
    return err(appError("validation", "Revisa las condiciones de la toma BIS.", fields));
  }

  const contraindicated = computeContraindicated(catalog.conditions, sealed);
  const warnings = catalog.conditions
    .filter((c) => c.kind === "advertencia" && sealed[c.key]?.value === true)
    .map((c) => c.key);

  return ok({ answers: sealed, contraindicated, warnings });
}
