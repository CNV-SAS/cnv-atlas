import { z } from "zod";

import { INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { DIAS_DEL_CICLO } from "@/clinical-engine/menu-ciclo";
import { TIEMPOS_DEF } from "@/clinical-engine/tiempos";

// Validaciones del protocolo de tratamiento (B13). Toda entrada externa pasa por Zod
// (ARCHITECTURE). Los ids se validan con z.guid(): z.uuid() de Zod 4 rechaza los UUIDs
// deterministas del seed. Nota (checkpoint 2): el objetivo calorico y la proteina ya NO se
// validan aqui como input del protocolo; el objetivo sale de la cadena (adj_*), no de un input manual.

const restriccionSchema = z
  .string()
  .trim()
  .min(1)
  .max(60, "Cada restricción es demasiado larga.");

const nutraceuticalLineSchema = z.object({
  nutraceuticalId: z.guid("Nutracéutico inválido."),
  dosage: z.string().trim().max(120, "La dosis es demasiado larga.").nullable(),
  durationDays: z.coerce
    .number()
    .int("La duración debe ser un número entero de días.")
    .min(1, "La duración mínima es un día.")
    .max(365, "La duración máxima es un año.")
    .nullable(),
});

const guidelineSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000, "La guía dietaria es demasiado larga.");

// Checkpoint 2.4/2.5: el "Protocolo de tratamiento" se desarmo. Cada seccion editable tiene su propia
// accion/firma/candado (objetivo -> cadena; nutraceuticos, restricciones, guias por separado); saveProtocol
// y su firma por secciones se retiraron. baseSignature es un string opaco: se compara por igualdad.

// Restricciones alimentarias (checkpoint 2.4): set completo + firma base del candado.
export const saveRestriccionesSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  restricciones: z.array(restriccionSchema).max(20, "Demasiadas restricciones."),
  baseSignature: z.string().max(4000).default(""),
});

export type SaveRestriccionesInput = z.infer<typeof saveRestriccionesSchema>;

// Guias dietarias (checkpoint 2.4): set completo + firma base del candado.
export const saveGuidelinesSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  guidelines: z.array(guidelineSchema).max(30, "Demasiadas guías dietarias."),
  baseSignature: z.string().max(8000).default(""),
});

export type SaveGuidelinesInput = z.infer<typeof saveGuidelinesSchema>;

// Objetivo del tratamiento nutricional (checkpoint 2.4, pieza 1): texto libre del profesional. Limite HOLGADO
// (un par de parrafos clinicos) pero ACOTADO: un campo sin limite es un campo que alguien llena con un
// documento entero. Vacio -> null (el textarea vacio no cuenta como objetivo).
export const saveObjetivoSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  objetivo: z
    .string()
    .trim()
    .max(4000, "El objetivo del tratamiento es demasiado largo (máximo 4000 caracteres).")
    .nullable()
    .default(null),
  baseSignature: z.string().max(4200).default(""),
});

export type SaveObjetivoInput = z.infer<typeof saveObjetivoSchema>;

// Lista de intercambio (CP1.2, POR ALIMENTO / opcion A). La validacion DERIVA los alimentos validos de
// INTER_TABLA_A (cuidado b: si la tabla cambia manana, esto se mueve solo, no hay lista escrita aparte).
// `porciones` va keyed por alimento (`sub`): rechaza forma incorrecta si trae una clave que no es un alimento
// conocido, o si no trae EXACTAMENTE los 21 alimentos (el contexto del desfase debe estar completo, como antes
// los 12 grupos). Cada valor es un entero de porciones en rango.
const ALL_SUBS: string[] = INTER_TABLA_A.map((r) => r.sub);
const ALL_SUBS_SET: Set<string> = new Set(ALL_SUBS);
const porcionesInt = z.number().int("Las porciones deben ser un entero.").min(0).max(50, "Porciones fuera de rango.");

function refinePorcionesPorAlimento(porciones: Record<string, number>, ctx: z.RefinementCtx, campo: string): void {
  const keys = Object.keys(porciones);
  for (const k of keys) {
    if (!ALL_SUBS_SET.has(k)) ctx.addIssue({ code: "custom", message: `Alimento desconocido en ${campo}: ${k}.` });
  }
  if (keys.length !== ALL_SUBS.length || ALL_SUBS.some((s) => !(s in porciones))) {
    ctx.addIssue({ code: "custom", message: `${campo} debe traer exactamente los ${ALL_SUBS.length} alimentos.` });
  }
}

export const saveIntercambioSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  intercambio: z
    .object({
      objetivoBase: z.number().finite().min(0),
      porciones: z.record(z.string(), porcionesInt),
    })
    .superRefine((val, ctx) => refinePorcionesPorAlimento(val.porciones, ctx, "La lista de intercambio")),
  baseSignature: z.string().max(4200).default(""),
});

export type SaveIntercambioInput = z.infer<typeof saveIntercambioSchema>;

// Distribucion por tiempos (CP2.2). Validacion mas estricta que el intercambio: TRES partes. activos y las
// celdas se cotejan contra TIEMPOS_DEF (tiempos conocidos) e INTER_TABLA_A (alimentos existentes), derivados de
// las constantes (cuidado a). Reglas duras: al menos un tiempo activo (cuidado b: sin ninguno el reparto no
// tiene donde ir), base.porciones trae los 21 alimentos. Todo POR ALIMENTO (celdas keyed por sub), coherente
// con el intercambio por-alimento.
const MEAL_IDS: Set<string> = new Set(TIEMPOS_DEF.map((t) => t.id));
const boolMapSchema = z.record(z.string(), z.boolean());

// Tiempos de comida ACTIVOS: su propio schema, su propio guardado. Reglas: solo tiempos conocidos, y AL
// MENOS UNO activo (un plan sin ninguna comida no es un plan; DIV-13).
export const saveTiemposActivosSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  activos: boolMapSchema.superRefine((val, ctx) => {
    for (const k of Object.keys(val)) {
      if (!MEAL_IDS.has(k)) ctx.addIssue({ code: "custom", message: `Tiempo de comida desconocido: ${k}.` });
    }
    if (!Object.values(val).some(Boolean)) {
      ctx.addIssue({ code: "custom", message: "Debe haber al menos un tiempo de comida activo." });
    }
  }),
  baseSignature: z.string().max(6000).default(""),
});
export type SaveTiemposActivosInput = z.infer<typeof saveTiemposActivosSchema>;

export const saveTiemposSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  tiempos: z
    .object({
      celdas: z.record(z.string(), z.record(z.string(), porcionesInt)),
      base: z.object({ porciones: z.record(z.string(), porcionesInt), activos: boolMapSchema }),
    })
    .superRefine((val, ctx) => {
      const badMeal = (m: string) => !MEAL_IDS.has(m);
      // celdas: alimentos existentes y tiempos conocidos.
      for (const s of Object.keys(val.celdas)) {
        if (!ALL_SUBS_SET.has(s)) {
          ctx.addIssue({ code: "custom", message: `Alimento inválido en las celdas: ${s}.` });
        }
        for (const m of Object.keys(val.celdas[s])) {
          if (badMeal(m)) ctx.addIssue({ code: "custom", message: `Tiempo inválido en las celdas: ${m}.` });
        }
      }
      // base.porciones: los 21 alimentos (el contexto del desfase debe estar completo).
      refinePorcionesPorAlimento(val.base.porciones, ctx, "base.porciones");
      for (const k of Object.keys(val.base.activos)) {
        if (badMeal(k)) ctx.addIssue({ code: "custom", message: `Tiempo desconocido en base: ${k}.` });
      }
    }),
  baseSignature: z.string().max(6000).default(""),
});

export type SaveTiemposInput = z.infer<typeof saveTiemposSchema>;

// Menu semanal (CP4). Texto libre del profesional, asi que lo que se valida es el CONTINENTE, no el
// contenido: que la clave sea "dia_tiempo" con dia 0-6 y un tiempo conocido, que el dia de arranque este
// dentro del ciclo, y un TOPE de tamaño por celda y en total (regla dura: toda entrada externa con limite
// de payload; sin el, una celda podria traer un texto arbitrario a un jsonb).
const MENU_CELDA_MAX = 500;
const MENU_CELDAS_MAX = 7 * TIEMPOS_DEF.length;

export const saveMenuSemanalSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  menu: z
    .object({
      diaInicio: z.number().int().min(0).max(DIAS_DEL_CICLO - 1),
      celdas: z.record(z.string(), z.string().max(MENU_CELDA_MAX, "Ese texto del menú es demasiado largo.")),
    })
    .superRefine((val, ctx) => {
      const claves = Object.keys(val.celdas);
      if (claves.length > MENU_CELDAS_MAX) {
        ctx.addIssue({ code: "custom", message: "El menú trae más celdas de las que tiene la semana." });
      }
      for (const k of claves) {
        const [dia, ...resto] = k.split("_");
        const tiempo = resto.join("_");
        const d = Number(dia);
        if (!Number.isInteger(d) || d < 0 || d > 6 || !MEAL_IDS.has(tiempo)) {
          ctx.addIssue({ code: "custom", message: `Celda de menú inválida: ${k}.` });
        }
      }
    }),
  baseSignature: z.string().max(6000).default(""),
});

export type SaveMenuSemanalInput = z.infer<typeof saveMenuSemanalSchema>;

// Prescripcion de nutraceuticos (checkpoint 2.3): set completo + firma base del candado. El set se
// reemplaza por completo (el formulario envia el estado final deseado).
export const saveNutraceuticalsSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  nutraceuticals: z
    .array(nutraceuticalLineSchema)
    .max(30, "Demasiados nutracéuticos en la prescripción."),
  // Firma de la prescripcion que el cliente cargó (candado de concurrencia; ver nutraceuticalsSignature).
  baseSignature: z.string().max(4000).default(""),
});

export type SaveNutraceuticalsInput = z.infer<typeof saveNutraceuticalsSchema>;

// Ajustes del profesional sobre el protocolo sugerido (T2 A2), apartados B/D + peso meta de
// Nivel V. Todos opcionales (ajusta algunos, ninguno o todos); acotados a rangos clinicos
// razonables para atajar errores obvios. El valor efectivo (ajuste ?? sugerido) y los
// derivados los resuelve el service; la UI nunca escribe kcal_objetivo/proteina_g directo.
const optInt = (min: number, max: number, msg: string) =>
  z.coerce.number().int(msg).min(min, msg).max(max, msg).nullable();
const optNum = (min: number, max: number, msg: string) =>
  z.coerce.number().min(min, msg).max(max, msg).nullable();

export const saveAdjustmentsSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  adjGeb: optInt(500, 4000, "El gasto basal ajustado está fuera de rango."),
  adjPal: optNum(1, 2.5, "El factor de actividad está fuera de rango."),
  adjKcalObj: optInt(500, 6000, "El objetivo calórico ajustado está fuera de rango."),
  adjProtGkg: optNum(0, 4, "La proteína g/kg ajustada está fuera de rango."),
  adjFatPct: optInt(0, 100, "El porcentaje de grasa ajustado está fuera de rango."),
  adjPesoMeta: optNum(20, 400, "El peso meta está fuera de rango."),
  // Firma de los seis ajustes que el cliente cargó (candado de concurrencia; ver adjustmentSignature).
  // String opaco: se compara por igualdad, no se interpreta. Default "" para llamadas viejas sin firma.
  baseSignature: z.string().max(200).default(""),
});

export type SaveAdjustmentsInput = z.infer<typeof saveAdjustmentsSchema>;

// Reconocimiento de las restricciones del modelo (gate del generador de menu, Opcion B).
export const acknowledgeRestrictionsSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
});

export type AcknowledgeRestrictionsInput = z.infer<typeof acknowledgeRestrictionsSchema>;

// Aprobar el protocolo (T2 A3): convierte el sugerido + ajustes en la prescripcion efectiva y la
// sella. No lleva mas payload que la evaluacion: los adj_* ya estan guardados (saveAdjustments) y el
// set efectivo se recomputa en el service; el profesional nunca escribe el efectivo directo.
export const approveProtocolSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
});

export type ApproveProtocolInput = z.infer<typeof approveProtocolSchema>;

// Nota clinica del tratamiento: append-only (treatment_notes lleva su timestamp).
export const addNoteSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  note: z.string().trim().min(1, "La nota no puede estar vacía.").max(2000, "La nota es demasiado larga."),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;

// DECISION SOBRE LOS NUTRACEUTICOS (CP-N1, 2026-08-24).
//
// Reglas que el schema impone, y por que cada una:
//  - "no" EXIGE razon: un "no" sin razon no sirve para nada (ni a direccion ni al siguiente profesional).
//  - "otra" y las DOS del profesional exigen TEXTO: en las del profesional porque el motivo es el dato
//    (sobre todo el clinico, que se guarda como contraindicacion del paciente); en "otra" porque si no,
//    "otra" se vuelve el cajon donde muere la informacion.
//  - "si" y "pendiente" NO llevan razon: pedirla seria pedir explicacion por decidir bien o por no haber
//    decidido todavia.
export const NUTRA_DECISION_REASONS = [
  "profesional_clinica",
  "profesional_no_clinica",
  "costo",
  "lo_piensa",
  "ya_toma_otros",
  "otra",
] as const;

const REASONS_CON_TEXTO = new Set(["profesional_clinica", "profesional_no_clinica", "otra"]);

export const saveNutraDecisionSchema = z
  .object({
    evaluationId: z.guid("Evaluación inválida."),
    decision: z.enum(["si", "no", "pendiente"]),
    reason: z.enum(NUTRA_DECISION_REASONS).nullish().transform((v) => v ?? null),
    note: z.string().trim().max(1000).nullish().transform((v) => (v ? v : null)),
    // Producto al que aplica el descarte clinico, si fue de uno concreto.
    contraindicationFor: z.guid().nullish().transform((v) => v ?? null),
  })
  .superRefine((val, ctx) => {
    if (val.decision === "no" && !val.reason) {
      ctx.addIssue({ code: "custom", message: "Indica por qué no los adquiere." });
    }
    if (val.decision !== "no" && val.reason) {
      ctx.addIssue({ code: "custom", message: "La razón solo aplica cuando la respuesta es no." });
    }
    if (val.reason && REASONS_CON_TEXTO.has(val.reason) && !val.note) {
      ctx.addIssue({ code: "custom", message: "Esa razón necesita que escribas el motivo." });
    }
  });

export type SaveNutraDecisionInput = z.infer<typeof saveNutraDecisionSchema>;
