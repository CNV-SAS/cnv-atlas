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
  adjustmentSignature,
  guidelinesSignature,
  intercambioSignature,
  menuSemanalSignature,
  nutraceuticalsSignature,
  objetivoSignature,
  restriccionesSignature,
  tiemposSignature,
} from "./protocol-signature";
import type { IntercambioSaved, MenuSemanalSaved, TiemposSaved } from "./treatment-view-types";

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

// Rechazo por concurrencia de las secciones editables (misma familia: la seccion se reemplaza en bloque, un
// guardado con estado viejo borraria el cambio ajeno). El servicio traduce cada una a su aviso.
export class StaleRestriccionesError extends Error {
  constructor() {
    super("Las restricciones cambiaron desde que se cargaron.");
    this.name = "StaleRestriccionesError";
  }
}

export class StaleGuidelinesError extends Error {
  constructor() {
    super("Las guías dietarias cambiaron desde que se cargaron.");
    this.name = "StaleGuidelinesError";
  }
}

export class StaleObjetivoError extends Error {
  constructor() {
    super("El objetivo del tratamiento cambió desde que se cargó.");
    this.name = "StaleObjetivoError";
  }
}

export class StaleIntercambioError extends Error {
  constructor() {
    super("La lista de intercambio cambió desde que se cargó.");
    this.name = "StaleIntercambioError";
  }
}

export class StaleTiemposError extends Error {
  constructor() {
    super("La distribución por tiempos cambió desde que se cargó.");
    this.name = "StaleTiemposError";
  }
}

export class StaleMenuSemanalError extends Error {
  constructor() {
    super("El menú semanal cambió desde que se cargó.");
    this.name = "StaleMenuSemanalError";
  }
}

// Rechazo por concurrencia en saveAdjustments (los seis ajustes son una unidad). El servicio lo traduce a
// un aviso "otro profesional cambió la cadena".
export class StaleAdjustmentsError extends Error {
  constructor() {
    super("Los ajustes cambiaron desde que se cargaron.");
    this.name = "StaleAdjustmentsError";
  }
}

// Rechazo por concurrencia en saveNutraceuticals (misma familia). El servicio lo traduce a un aviso
// "otro profesional cambió la prescripción de nutracéuticos".
export class StaleNutraceuticalsError extends Error {
  constructor() {
    super("La prescripción de nutracéuticos cambió desde que se cargó.");
    this.name = "StaleNutraceuticalsError";
  }
}

type NutraceuticalLine = {
  nutraceuticalId: string;
  dosage: string | null;
  durationDays: number | null;
};

// NATURALEZA de treatment_diet_guidelines (y treatment_nutraceuticals) segun el estado: ANTES de aprobar
// (draft) estas tablas hijas SON autoritativas; un guardado que las reemplaza con estado viejo las PIERDE
// sin rastro. DESPUES de aprobar, lo autoritativo es el jsonb sellado (protocol_approved, inmutable por el
// trigger 0026). Por eso el candado de abajo importa sobre todo en borrador.

export type SaveRestriccionesWrite = {
  treatmentId: string;
  restricciones: string[];
  // Firma de las restricciones que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Restricciones alimentarias (checkpoint 2.4): reemplaza el arreglo treatments.restricciones. Camino propio
// con candado, como saveNutraceuticals: la lista ALIMENTA EL MENU, y una restriccion que se pierda por
// sobreescritura produce un plan que ignora una alergia. Lock de la fila + recompute de la firma bajo lock.
export async function saveRestricciones(input: SaveRestriccionesWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    await tx.execute(sql`set local lock_timeout = '3s'`);
    const [locked] = await tx
      .select({ restr: treatments.restricciones })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .for("update")
      .limit(1);
    if (!locked) throw new TreatmentStateError("Tratamiento no encontrado.");
    const current = restriccionesSignature({
      treatmentId: input.treatmentId,
      restricciones: locked.restr ?? [],
    });
    if (current !== input.baseSignature) throw new StaleRestriccionesError();
    await tx
      .update(treatments)
      .set({ restricciones: input.restricciones })
      .where(eq(treatments.id, input.treatmentId));
    await recordAudit(tx, {
      event: "treatment.restricciones_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: { restricciones_count: input.restricciones.length },
      ip: input.ip,
    });
  });
}

export type SaveGuidelinesWrite = {
  treatmentId: string;
  guidelines: string[];
  // Firma de las guias que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Guias dietarias (checkpoint 2.4): reemplaza el set de treatment_diet_guidelines. Camino propio con candado.
export async function saveGuidelines(input: SaveGuidelinesWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    await tx.execute(sql`set local lock_timeout = '3s'`);
    const [locked] = await tx
      .select({ id: treatments.id })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .for("update")
      .limit(1);
    if (!locked) throw new TreatmentStateError("Tratamiento no encontrado.");
    const curGuides = await tx
      .select({ text: treatmentDietGuidelines.guidelineText })
      .from(treatmentDietGuidelines)
      .where(eq(treatmentDietGuidelines.treatmentId, input.treatmentId));
    const current = guidelinesSignature({
      treatmentId: input.treatmentId,
      guidelines: curGuides.map((g) => g.text),
    });
    if (current !== input.baseSignature) throw new StaleGuidelinesError();
    await tx
      .delete(treatmentDietGuidelines)
      .where(eq(treatmentDietGuidelines.treatmentId, input.treatmentId));
    if (input.guidelines.length) {
      await tx.insert(treatmentDietGuidelines).values(
        input.guidelines.map((text) => ({ treatmentId: input.treatmentId, guidelineText: text })),
      );
    }
    await recordAudit(tx, {
      event: "treatment.guidelines_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: { guidelines_count: input.guidelines.length },
      ip: input.ip,
    });
  });
}

export type SaveObjetivoWrite = {
  treatmentId: string;
  objetivo: string | null;
  // Firma del objetivo que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Objetivo del tratamiento nutricional (checkpoint 2.4, pieza 1): texto libre en treatments.objetivo_texto.
// Camino propio con candado, como las demas secciones editables.
export async function saveObjetivo(input: SaveObjetivoWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    await tx.execute(sql`set local lock_timeout = '3s'`);
    const [locked] = await tx
      .select({ obj: treatments.objetivoTexto })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .for("update")
      .limit(1);
    if (!locked) throw new TreatmentStateError("Tratamiento no encontrado.");
    const current = objetivoSignature({ treatmentId: input.treatmentId, objetivo: locked.obj });
    if (current !== input.baseSignature) throw new StaleObjetivoError();
    await tx
      .update(treatments)
      .set({ objetivoTexto: input.objetivo })
      .where(eq(treatments.id, input.treatmentId));
    await recordAudit(tx, {
      event: "treatment.objetivo_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: { objetivo_len: (input.objetivo ?? "").length },
      ip: input.ip,
    });
  });
}

export type SaveIntercambioWrite = {
  treatmentId: string;
  intercambio: IntercambioSaved;
  // Firma del intercambio que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Guarda la lista de intercambio (CP1.2): jsonb en treatments.intercambio_porciones. Camino propio con candado
// como las demas secciones editables; REEMPLAZA EN BLOQUE, asi que la firma que carga el cliente es la base del
// candado (rechaza si otro profesional lo cambio). El baseSignature "" corresponde a null (nunca guardado).
export async function saveIntercambio(input: SaveIntercambioWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    await tx.execute(sql`set local lock_timeout = '3s'`);
    const [locked] = await tx
      .select({ inter: treatments.intercambioPorciones })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .for("update")
      .limit(1);
    if (!locked) throw new TreatmentStateError("Tratamiento no encontrado.");
    const current = intercambioSignature({
      treatmentId: input.treatmentId,
      intercambio: (locked.inter as IntercambioSaved | null) ?? null,
    });
    if (current !== input.baseSignature) throw new StaleIntercambioError();
    await tx
      .update(treatments)
      .set({ intercambioPorciones: input.intercambio })
      .where(eq(treatments.id, input.treatmentId));
    await recordAudit(tx, {
      event: "treatment.intercambio_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: {
        objetivo_base: input.intercambio.objetivoBase,
        alimentos_con_porcion: Object.values(input.intercambio.porciones).filter((n) => n > 0).length,
      },
      ip: input.ip,
    });
  });
}

export type SaveMenuSemanalWrite = {
  treatmentId: string;
  menu: MenuSemanalSaved;
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Guarda el menu semanal (CP4): jsonb en treatments.menu_semanal. Mismo patron con candado; REEMPLAZA EN
// BLOQUE. Se persiste diaInicio ademas de las celdas: el dia de arranque es parte del plan, no un detalle
// de render (si no, el menu cambiaria al recargar).
export async function saveMenuSemanal(input: SaveMenuSemanalWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    await tx.execute(sql`set local lock_timeout = '3s'`);
    const [locked] = await tx
      .select({ m: treatments.menuSemanal })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .for("update")
      .limit(1);
    if (!locked) throw new TreatmentStateError("Tratamiento no encontrado.");
    const current = menuSemanalSignature({
      treatmentId: input.treatmentId,
      menu: (locked.m as MenuSemanalSaved | null) ?? null,
    });
    if (current !== input.baseSignature) throw new StaleMenuSemanalError();
    await tx
      .update(treatments)
      .set({ menuSemanal: input.menu })
      .where(eq(treatments.id, input.treatmentId));
    await recordAudit(tx, {
      event: "treatment.menu_semanal_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      // Se auditan CIFRAS, no el contenido del menu: es texto libre del profesional y el log no es su copia.
      payload: {
        dia_inicio: input.menu.diaInicio,
        celdas_editadas: Object.values(input.menu.celdas).filter((v) => String(v).trim().length > 0).length,
      },
      ip: input.ip,
    });
  });
}

export type SaveTiemposWrite = {
  treatmentId: string;
  tiempos: TiemposSaved;
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Guarda la distribucion por tiempos (CP2.2): jsonb en treatments.tiempos. Mismo patron con candado que las
// demas; REEMPLAZA EN BLOQUE. baseSignature "" corresponde a null (nunca guardado).
export async function saveTiempos(input: SaveTiemposWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    await tx.execute(sql`set local lock_timeout = '3s'`);
    const [locked] = await tx
      .select({ t: treatments.tiempos })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .for("update")
      .limit(1);
    if (!locked) throw new TreatmentStateError("Tratamiento no encontrado.");
    const current = tiemposSignature({
      treatmentId: input.treatmentId,
      tiempos: (locked.t as TiemposSaved | null) ?? null,
    });
    if (current !== input.baseSignature) throw new StaleTiemposError();
    await tx.update(treatments).set({ tiempos: input.tiempos }).where(eq(treatments.id, input.treatmentId));
    await recordAudit(tx, {
      event: "treatment.tiempos_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: {
        activos: Object.entries(input.tiempos.activos).filter(([, v]) => v).length,
        overrides: Object.keys(input.tiempos.celdas).length,
      },
      ip: input.ip,
    });
  });
}

export type SaveNutraceuticalsWrite = {
  treatmentId: string;
  nutraceuticals: NutraceuticalLine[];
  // Firma de la prescripcion que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Guarda la PRESCRIPCION de nutraceuticos (checkpoint 2.3): reemplaza el set de treatment_nutraceuticals.
// Camino propio, separado de saveProtocol, con su candado: como REEMPLAZA EN BLOQUE, un guardado con estado
// viejo borraria lo que otro profesional acaba de prescribir. Mismo patron que saveAdjustments (lock de la
// fila + recompute de la firma bajo el lock + rechazo si difiere).
export async function saveNutraceuticals(input: SaveNutraceuticalsWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    await tx.execute(sql`set local lock_timeout = '3s'`);
    const [locked] = await tx
      .select({ id: treatments.id })
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
    const current = nutraceuticalsSignature({
      treatmentId: input.treatmentId,
      nutraceuticals: curNutras,
    });
    if (current !== input.baseSignature) throw new StaleNutraceuticalsError();

    // Reemplazo total del set (el formulario envia el estado deseado).
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
    await recordAudit(tx, {
      event: "treatment.nutraceuticals_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: { nutraceuticals_count: input.nutraceuticals.length },
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
  // Firma de los seis ajustes que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
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

    // Candado de concurrencia (misma razon que en saveProtocol): saveAdjustments ESCRIBE LAS SEIS
    // columnas adj_* de golpe, asi que dos guardados del mismo tratamiento se pisan (el ultimo gana) y el
    // ajuste que otro profesional acaba de fijar se pierde sin rastro. Se lockea la fila (FOR UPDATE), se
    // recomputa la firma actual bajo el lock y, si difiere de la que trajo el cliente, se rechaza sin pisar.
    await tx.execute(sql`set local lock_timeout = '3s'`);
    const [locked] = await tx
      .select({
        geb: treatments.adjGeb,
        pal: treatments.adjPal,
        kcalObj: treatments.adjKcalObj,
        protGkg: treatments.adjProtGkg,
        fatPct: treatments.adjFatPct,
        pesoMeta: treatments.adjPesoMeta,
      })
      .from(treatments)
      .where(eq(treatments.id, input.treatmentId))
      .for("update")
      .limit(1);
    if (!locked) throw new TreatmentStateError("Tratamiento no encontrado.");
    // Number() en TODO (los numeric vuelven string, los integer numero): misma normalizacion que el reader,
    // sin la cual la firma divergiria por scale y rechazaria guardados legitimos.
    const current = adjustmentSignature({
      treatmentId: input.treatmentId,
      adjGeb: locked.geb != null ? Number(locked.geb) : null,
      adjPal: locked.pal != null ? Number(locked.pal) : null,
      adjKcalObj: locked.kcalObj != null ? Number(locked.kcalObj) : null,
      adjProtGkg: locked.protGkg != null ? Number(locked.protGkg) : null,
      adjFatPct: locked.fatPct != null ? Number(locked.fatPct) : null,
      adjPesoMeta: locked.pesoMeta != null ? Number(locked.pesoMeta) : null,
    });
    if (current !== input.baseSignature) throw new StaleAdjustmentsError();

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

// Reconocimiento del profesional de las restricciones del MODELO. Depende de que protocol_suggested
// EXISTA: sus restricciones son las que se reconocen (se ejercita en test contra un protocol_suggested
// insertado a mano). Los restrictions_ack_* NO los congela el trigger: el reconocimiento podria ocurrir
// despues de aprobar el protocolo.
// NO CABLEADO (decision 2026-08-23, opcion iii; ver BACKLOG): se diseño como gate del generador de menu
// y hoy no gatea nada, porque ninguna UI llama esta escritura y generateMenu no la exige. Con menu.v2 las
// restricciones del modelo ya llegan al prompt, asi que el reconocimiento seria constancia, no proteccion.
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
