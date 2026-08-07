import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  diagnoses,
  treatmentDietGuidelines,
  treatmentNotes,
  treatmentNutraceuticals,
  treatments,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import {
  changedSections,
  protocolSectionSignatures,
  type SectionKey,
  type SectionSignatures,
} from "./protocol-signature";

// Escritura del protocolo de tratamiento (Drizzle owner, para el audit INLINE, regla 8).
// La autorizacion (ownership) se verifica ANTES en el action leyendo el tratamiento bajo
// RLS (treatment-reader); aqui el treatmentId ya llega autorizado. El gate clinico
// (diagnostico confirmado) se re-chequea dentro de la transaccion: el protocolo no se
// edita sobre un diagnostico sin confirmar (decision de B13).

// Fallo de estado del protocolo (diagnostico sin confirmar, tratamiento ausente). Revierte
// la transaccion entera; el action lo mapea a un mensaje.
export class TreatmentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TreatmentStateError";
  }
}

// El protocolo cambio (en otra sesion/pestana/dispositivo) desde que el cliente lo cargó. Lleva las
// secciones que difieren para que el mensaje diga QUE cambió. Revierte la transaccion: NO se pisa el
// cambio ajeno (saveProtocol reemplaza en bloque; una escritura ciega borraria la prescripcion entera).
export class StaleProtocolError extends Error {
  constructor(public readonly sections: SectionKey[]) {
    super("El protocolo cambio desde que se cargo.");
    this.name = "StaleProtocolError";
  }
}

type NutraceuticalLine = {
  nutraceuticalId: string;
  dosage: string | null;
  durationDays: number | null;
};

export type SaveProtocolWrite = {
  treatmentId: string;
  kcalObjetivo: number | null;
  proteinaGramos: number | null;
  restricciones: string[];
  nutraceuticals: NutraceuticalLine[];
  guidelines: string[];
  // Firma por seccion del protocolo que el cliente CARGÓ (candado de concurrencia).
  baseSignatures: SectionSignatures;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// NATURALEZA DE treatment_nutraceuticals / treatment_diet_guidelines segun el estado del tratamiento
// (no es evidente leyendo solo el esquema): ANTES de aprobar (status='draft') estas tablas hijas SON la
// prescripcion autoritativa; un guardado que las reemplaza con estado viejo la PIERDE de verdad, sin
// rastro. DESPUES de aprobar, lo autoritativo es el jsonb sellado (treatments.protocol_approved, inmutable
// por el trigger 0026); estas tablas quedan como COPIA DE TRABAJO (editable por diseno para el generador de
// menu). Por eso el candado de abajo importa sobre todo en borrador.
//
// Guarda el protocolo completo en una transaccion: objetivos + reemplazo del set de nutraceuticos +
// reemplazo del set de guias. Un solo audit treatment.protocol_updated.
export async function saveProtocol(input: SaveProtocolWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);

    // 0. Candado de concurrencia. Lock de la fila (FOR UPDATE) para SERIALIZAR dos guardados del mismo
    // tratamiento: sin el, dos sesiones leen la misma firma vieja y ambas escriben (la ultima pisa). Con el
    // lock, la segunda espera, re-lee la firma ya cambiada, y se rechaza. Se compara la firma actual (bajo
    // lock) contra la base que trajo el cliente; si alguna seccion difiere, alguien mas la cambió: se aborta
    // sin pisar, diciendo QUE cambió. saveProtocol REEMPLAZA en bloque, asi que una escritura ciega no
    // corrompe un campo: borra el protocolo entero.
    const [locked] = await tx
      .select({ kcal: treatments.kcalObjetivo, prot: treatments.proteinaGramos, restr: treatments.restricciones })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .for("update")
      .limit(1);
    if (!locked) throw new TreatmentStateError("Tratamiento no encontrado.");
    const curNutras = await tx
      .select({
        nutraceuticalId: treatmentNutraceuticals.nutraceuticalId,
        dosage: treatmentNutraceuticals.dosage,
        durationDays: treatmentNutraceuticals.durationDays,
      })
      .from(treatmentNutraceuticals)
      .where(eq(treatmentNutraceuticals.treatmentId, input.treatmentId));
    const curGuides = await tx
      .select({ text: treatmentDietGuidelines.guidelineText })
      .from(treatmentDietGuidelines)
      .where(eq(treatmentDietGuidelines.treatmentId, input.treatmentId));
    const current = protocolSectionSignatures({
      treatmentId: input.treatmentId,
      kcalObjetivo: locked.kcal,
      proteinaGramos: locked.prot,
      restricciones: locked.restr ?? [],
      nutraceuticals: curNutras,
      guidelines: curGuides,
    });
    const changed = changedSections(input.baseSignatures, current);
    if (changed.length) throw new StaleProtocolError(changed);

    // 1. Objetivos del protocolo.
    await tx
      .update(treatments)
      .set({
        kcalObjetivo: input.kcalObjetivo,
        proteinaGramos: input.proteinaGramos,
        restricciones: input.restricciones,
      })
      .where(eq(treatments.id, input.treatmentId));

    // 2. Set de nutraceuticos: reemplazo total (el formulario envia el estado deseado).
    await tx
      .delete(treatmentNutraceuticals)
      .where(eq(treatmentNutraceuticals.treatmentId, input.treatmentId));
    if (input.nutraceuticals.length) {
      await tx.insert(treatmentNutraceuticals).values(
        input.nutraceuticals.map((n) => ({
          treatmentId: input.treatmentId,
          nutraceuticalId: n.nutraceuticalId,
          dosage: n.dosage,
          durationDays: n.durationDays,
        })),
      );
    }

    // 3. Set de guias dietarias: reemplazo total.
    await tx
      .delete(treatmentDietGuidelines)
      .where(eq(treatmentDietGuidelines.treatmentId, input.treatmentId));
    if (input.guidelines.length) {
      await tx.insert(treatmentDietGuidelines).values(
        input.guidelines.map((text) => ({
          treatmentId: input.treatmentId,
          guidelineText: text,
        })),
      );
    }

    // DETECTOR de perdida de prescripcion: nutraceuticals_count/guidelines_count por guardado NO son
    // redundantes. Como saveProtocol REEMPLAZA en bloque, un guardado que baja el conteo de positivo a 0 es
    // la huella de un borrado (p. ej. un panel pegado-vacio que guardo encima). Sirvio para verificar que el
    // sintoma del smoke 2026-08-07 fue solo display, no perdida de dato (ningun tratamiento paso de >0 a 0).
    // No quitar por parecer redundantes.
    await recordAudit(tx, {
      event: "treatment.protocol_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: {
        kcal_objetivo: input.kcalObjetivo,
        proteina_g: input.proteinaGramos,
        restricciones_count: input.restricciones.length,
        nutraceuticals_count: input.nutraceuticals.length,
        guidelines_count: input.guidelines.length,
      },
      ip: input.ip,
    });
  });
}

export type AddNoteWrite = {
  treatmentId: string;
  note: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Agrega una nota clinica al tratamiento (append-only) con audit inline.
export async function addTreatmentNote(input: AddNoteWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    const [note] = await tx
      .insert(treatmentNotes)
      .values({ treatmentId: input.treatmentId, note: input.note })
      .returning({ id: treatmentNotes.id });
    await recordAudit(tx, {
      event: "treatment.note_added",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: { note_id: note.id },
      ip: input.ip,
    });
  });
}

// --- T2 A2: ajustes del profesional y reconocimiento de restricciones ---

export type SaveAdjustmentsWrite = {
  treatmentId: string;
  adjGeb: number | null;
  adjPal: number | null;
  adjKcalObj: number | null;
  adjProtGkg: number | null;
  adjFatPct: number | null;
  adjPesoMeta: number | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Guarda los ajustes del profesional sobre el protocolo sugerido, SOLO en borrador. Owner
// client + audit inline. Si el protocolo ya esta aprobado, el trigger de inmutabilidad lo
// congela; aqui se ataja antes con un error limpio. Los numeric van como string a Drizzle.
export async function saveAdjustments(input: SaveAdjustmentsWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertDraft(tx, input.treatmentId);
    await tx
      .update(treatments)
      .set({
        adjGeb: input.adjGeb,
        adjPal: input.adjPal != null ? String(input.adjPal) : null,
        adjKcalObj: input.adjKcalObj,
        adjProtGkg: input.adjProtGkg != null ? String(input.adjProtGkg) : null,
        adjFatPct: input.adjFatPct,
        adjPesoMeta: input.adjPesoMeta != null ? String(input.adjPesoMeta) : null,
      })
      .where(eq(treatments.id, input.treatmentId));
    await recordAudit(tx, {
      event: "treatment.adjustments_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: {
        adj_geb: input.adjGeb,
        adj_pal: input.adjPal,
        adj_kcal_obj: input.adjKcalObj,
        adj_prot_gkg: input.adjProtGkg,
        adj_fat_pct: input.adjFatPct,
        adj_peso_meta: input.adjPesoMeta,
      },
      ip: input.ip,
    });
  });
}

export type AcknowledgeRestrictionsWrite = {
  treatmentId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Reconocimiento del profesional de las restricciones del MODELO (gate del generador de menu,
// Opcion B). Depende de que protocol_suggested EXISTA: sus restricciones son las que se
// reconocen (ajuste conocido: la operacion no tiene cobertura end-to-end hasta A3, que sella
// protocol_suggested; se ejercita en test contra un protocol_suggested insertado a mano). Los
// restrictions_ack_* NO los congela el trigger: el reconocimiento puede ocurrir al ir a
// generar el menu, despues de aprobar el protocolo.
export async function acknowledgeRestrictions(
  input: AcknowledgeRestrictionsWrite,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ suggested: treatments.protocolSuggested })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .limit(1);
    if (!row) throw new TreatmentStateError("Tratamiento no encontrado.");
    if (row.suggested == null) {
      throw new TreatmentStateError(
        "El protocolo aun no se ha generado; no hay restricciones del modelo que reconocer.",
      );
    }
    await tx
      .update(treatments)
      .set({ restrictionsAckAt: sql`now()`, restrictionsAckBy: input.actorId })
      .where(eq(treatments.id, input.treatmentId));
    await recordAudit(tx, {
      event: "treatment.restrictions_acknowledged",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: {},
      ip: input.ip,
    });
  });
}

// --- T2 A3: aprobacion del protocolo (sella el set efectivo) ---

export type ApproveProtocolWrite = {
  treatmentId: string;
  protocolApproved: unknown; // jsonb efectivo (lo arma el service; incluye las dos versiones y fechas)
  kcalObjetivo: number;
  proteinaGramos: number;
  approvedAt: Date;
  versionApproved: string;
  versionSuggested: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Sella la prescripcion EFECTIVA en la transicion draft -> approved. Owner client + audit inline.
// Re-chequea DENTRO de la transaccion (TOCTOU) el borrador y que exista el sugerido: no se aprueba
// lo que ya se aprobo ni lo que nunca se computo. El UPDATE dispara el trigger 0026, pero como
// OLD.status='draft' la rama de congelado no aplica y protocol_suggested no cambia: pasa. A partir de
// aqui (OLD.status='approved') el trigger congela la prescripcion.
export async function writeApproveProtocol(input: ApproveProtocolWrite): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: treatments.status, suggested: treatments.protocolSuggested })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .limit(1);
    if (!row) throw new TreatmentStateError("Tratamiento no encontrado.");
    if (row.status !== "draft") {
      throw new TreatmentStateError(
        "El protocolo ya fue aprobado; para cambiarlo se genera una corrección (versión nueva).",
      );
    }
    if (row.suggested == null) {
      throw new TreatmentStateError(
        "No se puede aprobar un protocolo que nunca se computo (protocol_suggested nulo).",
      );
    }
    await tx
      .update(treatments)
      .set({
        status: "approved",
        protocolApproved: input.protocolApproved,
        approvedBy: input.actorId,
        approvedAt: input.approvedAt,
        kcalObjetivo: input.kcalObjetivo,
        proteinaGramos: input.proteinaGramos,
      })
      .where(eq(treatments.id, input.treatmentId));
    await recordAudit(tx, {
      event: "protocol.approved",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: {
        kcal_objetivo: input.kcalObjetivo,
        proteina_g: input.proteinaGramos,
        version_approved: input.versionApproved,
        version_suggested: input.versionSuggested,
        version_mismatch: input.versionApproved !== input.versionSuggested,
      },
      ip: input.ip,
    });
  });
}

// Gate de estado: los ajustes solo se editan en borrador. Un protocolo aprobado es inmutable.
async function assertDraft(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  treatmentId: string,
): Promise<void> {
  const [row] = await tx
    .select({ status: treatments.status })
    .from(treatments)
    .where(eq(treatments.id, treatmentId))
    .limit(1);
  if (!row) throw new TreatmentStateError("Tratamiento no encontrado.");
  if (row.status !== "draft") {
    throw new TreatmentStateError(
      "El protocolo ya fue aprobado; para cambiarlo se genera una corrección (versión nueva).",
    );
  }
}

// Gate clinico compartido: el protocolo solo se edita sobre un diagnostico confirmado.
// Une treatment -> diagnosis y verifica confirmed_at. Lanza si falta o no esta confirmado.
async function assertConfirmedDiagnosis(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  treatmentId: string,
): Promise<void> {
  const [row] = await tx
    .select({ confirmedAt: diagnoses.confirmedAt })
    .from(treatments)
    .innerJoin(diagnoses, eq(treatments.diagnosisId, diagnoses.id))
    .where(eq(treatments.id, treatmentId))
    .limit(1);
  if (!row) throw new TreatmentStateError("Tratamiento no encontrado.");
  if (!row.confirmedAt) {
    throw new TreatmentStateError(
      "El diagnóstico debe estar confirmado (aprueba el reporte) antes de editar el protocolo.",
    );
  }
}
