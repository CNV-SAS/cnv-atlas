import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  diagnoses,
  patientContraindications,
  treatmentNotes,
  treatmentNutraceuticals,
  treatments,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import {
  menuSemanalSignature,
  nutraceuticalsSignature,
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

export type SaveObjetivoWrite = {
  treatmentId: string;
  objetivo: string | null;
  // Firma del objetivo que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type SaveIntercambioWrite = {
  treatmentId: string;
  intercambio: IntercambioSaved;
  // Firma del intercambio que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export class StaleTiemposActivosError extends Error {
  constructor() {
    super("Los tiempos de comida cambiaron desde que se cargaron.");
    this.name = "StaleTiemposActivosError";
  }
}

export type SaveNutraDecisionWrite = {
  treatmentId: string;
  patientId: string;
  decision: "si" | "no" | "pendiente";
  reason: string | null;
  note: string | null;
  // Cuando la razon es clinica, el motivo se guarda ADEMAS como contraindicacion del paciente.
  contraindicationFor: string | null; // nutraceuticalId, si el descarte fue de un producto concreto
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Guarda la decision sobre los nutraceuticos (CP-N1) y, si la razon es CLINICA, la contraindicacion del
// PACIENTE, en la MISMA transaccion. Las dos juntas a proposito: si se guardara la decision comercial y
// fallara la contraindicacion, quedaria registrado que se descarto por alergia sin que la alergia exista
// en ninguna parte, que es el peor de los dos estados posibles.
//
// Sin candado de firma: no es un set que se reemplace en bloque como el resto de las secciones, es UNA
// decision con su fecha. Si dos profesionales la responden a la vez, la ultima gana y las dos quedan en el
// audit log; no hay trabajo que se pueda perder.
export async function saveNutraDecision(input: SaveNutraDecisionWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertDiagnosisExists(tx, input.treatmentId);
    await tx
      .update(treatments)
      .set({
        nutraceuticalDecision: input.decision,
        nutraceuticalDecisionReason: input.reason as never,
        nutraceuticalDecisionNote: input.note,
        nutraceuticalDecisionAt: sql`now()`,
        nutraceuticalDecisionBy: input.actorId,
      })
      .where(eq(treatments.id, input.treatmentId));

    if (input.reason === "profesional_clinica" && input.note) {
      await tx.insert(patientContraindications).values({
        patientId: input.patientId,
        nutraceuticalId: input.contraindicationFor,
        source: "descarte_nutraceutico",
        reason: input.note,
        recordedBy: input.actorId,
      });
    }

    await recordAudit(tx, {
      event: "treatment.nutraceutical_decision",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      // Se audita la decision y su razon (dato comercial). El MOTIVO en texto libre NO va al log: cuando es
      // clinico es dato del paciente y ya queda en su contraindicacion, con su propio control de acceso.
      payload: {
        decision: input.decision,
        reason: input.reason,
        contraindicacion_registrada: input.reason === "profesional_clinica" && Boolean(input.note),
      },
      ip: input.ip,
    });
  });
}

export type SaveTiemposActivosWrite = {
  treatmentId: string;
  activos: Record<string, boolean>;
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

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
    await assertDiagnosisExists(tx, input.treatmentId);
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
    await assertDiagnosisExists(tx, input.treatmentId);
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
  /** Profesion con la que se escribe (null si el actor no la tiene configurada). Se SELLA en el acto. */
  profession: "medico" | "psicologo" | "deportologo" | "nutricionista" | null;
  treatmentId: string;
  note: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Agrega una nota clinica al tratamiento (append-only) con audit inline.
export async function addTreatmentNote(input: AddNoteWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertDiagnosisExists(tx, input.treatmentId);
    const [note] = await tx
      .insert(treatmentNotes)
      .values({ treatmentId: input.treatmentId, note: input.note, profession: input.profession })
      .returning({ id: treatmentNotes.id });
    await recordAudit(tx, {
      event: "treatment.note_added",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: { note_id: note.id, profession: input.profession },
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
  adjDeficit: number | null;
  // El peso meta viaja con los otros cinco porque el formulario es UNO, pero se guarda en OTRA TABLA
  // (`evaluation_bis_intake`, migracion 0095): el peso meta es del paciente, no del tratamiento.
  pesoMetaFijado: number | null;
  // Firma de los seis ajustes que el cliente CARGÓ (candado de concurrencia).
  baseSignature: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

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

// `writeApproveProtocol` Y `writeReopenProtocol` SE RETIRARON (2026-09-09).
//
// El primero ponia `status = 'approved'`, y a partir de ese momento el trigger 0026 congelaba la
// prescripcion entera; el segundo existia solo para deshacerlo. Los dos desaparecen juntos porque los dos
// pertenecen al mismo mecanismo: sellar CERRANDO.
//
// LO QUE SELLA AHORA: `emisiones-writer.ts`, que guarda una copia inmutable de lo que salio hacia el
// paciente y NO toca el estado del tratamiento. La garantia es mas fuerte, no mas debil: el congelado
// protegia solo mientras nadie reabriera, y la copia protege siempre.
//
// `treatment_approvals` se conserva con las aprobaciones del modelo viejo, y la migracion 0115 las copia a
// `prescription_emissions`: ninguna prescripcion que un paciente recibio desaparece del sistema.

// Gate clinico compartido: el protocolo solo se edita sobre un diagnostico que EXISTE.
//
// ANTES EXIGIA `confirmed_at` (2026-09-09, cambio pedido por Gildardo y razonado por Santiago). El
// argumento que lo sostiene: **el diagnostico es del MODELO, no del profesional.** Nadie firma el
// resultado del motor; lo que si se firma es haber prescrito sobre el. Exigir una confirmacion manual
// antes de dejar prescribir ponia una firma en el sitio equivocado y bloqueaba el trabajo.
//
// LA CONFIRMACION NO DESAPARECE: se recoge donde hay un acto de verdad, al emitir (enviar el reporte o
// declarar la entrega en consulta). Ver `reports-writer.ts`, que ya la sellaba asi desde antes para quien
// no la hubiera hecho a mano.
//
// EL GATE QUE QUEDA SIGUE SIENDO REAL: sin diagnostico no hay protocolo que editar, y el join lo
// comprueba. Un tratamiento huerfano no existe (el pipeline los crea juntos), pero el dia que algo lo
// intente, esto lo para.
async function assertDiagnosisExists(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  treatmentId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: diagnoses.id })
    .from(treatments)
    .innerJoin(diagnoses, eq(treatments.diagnosisId, diagnoses.id))
    .where(eq(treatments.id, treatmentId))
    .limit(1);
  if (!row) throw new TreatmentStateError("Tratamiento no encontrado.");
}
