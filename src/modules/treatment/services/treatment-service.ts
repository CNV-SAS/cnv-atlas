import "server-only";

import { computeProtocoloEfectivo, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";
import { diaDelCiclo, diaInicioDerivado } from "@/clinical-engine/menu-ciclo";
import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";

import { menuSemanalSignature } from "../data/protocol-signature";
import { getTreatmentForApproval, getTreatmentProtocol } from "../data/treatment-reader";
import { requireNutricionista } from "./require-profession";
import {
  acknowledgeRestrictions as writeAcknowledge,
  addTreatmentNote,
  saveAdjustments as writeAdjustments,
  saveGuidelines as writeGuidelines,
  saveNutraceuticals as writeNutraceuticals,
  saveObjetivo as writeObjetivo,
  saveIntercambio as writeIntercambio,
  saveMenuSemanal as writeMenuSemanal,
  saveNutraDecision as writeNutraDecision,
  saveTiemposActivos as writeTiemposActivos,
  saveTiempos as writeTiempos,
  saveRestricciones as writeRestricciones,
  StaleAdjustmentsError,
  StaleGuidelinesError,
  StaleNutraceuticalsError,
  StaleObjetivoError,
  StaleIntercambioError,
  StaleMenuSemanalError,
  StaleTiemposActivosError,
  StaleTiemposError,
  StaleRestriccionesError,
  TreatmentStateError,
  writeApproveProtocol,
  writeReopenProtocol,
} from "../data/treatment-writer";
import type {
  AcknowledgeRestrictionsInput,
  AddNoteInput,
  ApproveProtocolInput,
  ReopenProtocolInput,
  SaveAdjustmentsInput,
  SaveGuidelinesInput,
  SaveNutraceuticalsInput,
  SaveObjetivoInput,
  SaveIntercambioInput,
  SaveMenuSemanalInput,
  SaveNutraDecisionInput,
  SaveTiemposActivosInput,
  SaveTiemposInput,
  SaveRestriccionesInput,
} from "../validations";

// Servicio del protocolo de tratamiento (la logica vive aqui; las actions son thin,
// regla 2). Deriva el treatmentId SIEMPRE de una lectura RLS por evaluationId (nunca se
// confia un treatmentId del formulario): si la evaluacion no es del profesional, el reader
// devuelve null y se corta con forbidden. El gate de diagnostico confirmado se verifica
// aqui y se re-chequea en el writer.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

// Guard de servidor contra editar un protocolo YA APROBADO (2026-08-22). Antes solo lo bloqueaba la UI
// (fieldset disabled), pero las actions son invocables directo: con DOS PESTAÑAS (una sin aprobar, otra que
// aprueba) el guardado de la vieja pisaba un plan aprobado sin querer, y el candado de firma NO lo atrapaba
// (aprobar no cambia los datos de la seccion). Se aplica a las SEIS escrituras de seccion; NO a
// acknowledgeRestrictions (el reconocimiento de restricciones ES un paso legitimo post-aprobacion; no
// gatea el menu, ver su nota abajo) ni a addNote (documentacion). La pregunta CLINICA -si el plan debe congelarse o seguir editable- sigue
// para Gildardo (BACKLOG); si dice editable, se relaja aqui Y en la UI. Hoy la UI ya lo bloquea; el servidor
// lo respalda.
const PROTOCOL_APPROVED_MSG =
  "El protocolo ya fue aprobado, por eso no se puede editar. Su prescripción es inmutable: para cambiarla se " +
  "corrige la evaluación (una versión nueva de toda la cadena), no se edita aquí.";

// Checkpoint 2.4: restricciones alimentarias, su propio camino de guardado. Solo nutricionista; ownership
// por lectura RLS del treatmentId via evaluationId. La lista alimenta el menu (una restriccion perdida por
// sobreescritura produce un plan que ignora una alergia): por eso el candado, como en nutraceuticos.
export async function saveRestricciones(
  input: SaveRestriccionesInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de editar las restricciones."));
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeRestricciones({
      treatmentId: protocol.treatmentId,
      restricciones: input.restricciones,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    if (e instanceof StaleRestriccionesError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió las restricciones en otra sesión (otra pestaña o dispositivo). Para no " +
            "borrar ese cambio no se guardó lo que hiciste. Recarga para ver la versión actual y vuelve a aplicarlo.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "Las restricciones están bloqueadas por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// Checkpoint 2.4 (pieza 1): objetivo del tratamiento nutricional, su propio camino de guardado.
export async function saveObjetivo(
  input: SaveObjetivoInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de editar el objetivo del tratamiento."));
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeObjetivo({
      treatmentId: protocol.treatmentId,
      objetivo: input.objetivo,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    if (e instanceof StaleObjetivoError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió el objetivo del tratamiento en otra sesión (otra pestaña o dispositivo). " +
            "Para no borrar ese cambio no se guardó lo que hiciste. Recarga para ver la versión actual y vuelve a aplicarlo.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "El objetivo está bloqueado por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// CP1.2: lista de intercambio, su propio camino de guardado. Solo el nutricionista (edita el plan nutricional).
export async function saveIntercambio(
  input: SaveIntercambioInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de editar la lista de intercambio."));
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeIntercambio({
      treatmentId: protocol.treatmentId,
      intercambio: input.intercambio,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    if (e instanceof StaleIntercambioError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió la lista de intercambio en otra sesión (otra pestaña o dispositivo). " +
            "Para no borrar ese cambio no se guardó lo que hiciste. Recarga para ver la versión actual y vuelve a aplicarlo.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "La lista de intercambio está bloqueada por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// CP2.2: distribucion por tiempos, su propio camino de guardado. Solo el nutricionista.
export async function saveTiempos(input: SaveTiemposInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de editar la distribución por tiempos."));
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeTiempos({
      treatmentId: protocol.treatmentId,
      tiempos: input.tiempos,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    if (e instanceof StaleTiemposError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió la distribución por tiempos en otra sesión (otra pestaña o dispositivo). " +
            "Para no borrar ese cambio no se guardó lo que hiciste. Recarga para ver la versión actual y vuelve a aplicarlo.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "La distribución por tiempos está bloqueada por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// CP-N1: la decision sobre los nutraceuticos. Se pregunta SIEMPRE, y "pendiente" es respuesta valida.
export async function saveNutraDecision(input: SaveNutraDecisionInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de registrar la decisión."));
  }
  // NO se bloquea tras aprobar: la decision del paciente puede llegar despues de aprobar el protocolo (de
  // hecho es lo normal), y es justo el caso que el "pendiente" contempla.
  if (!protocol.patientId) {
    return err(appError("internal", "No se pudo resolver el paciente de este tratamiento."));
  }
  try {
    await writeNutraDecision({
      treatmentId: protocol.treatmentId,
      patientId: protocol.patientId,
      decision: input.decision,
      reason: input.reason,
      note: input.note,
      contraindicationFor: input.contraindicationFor,
      ...actor,
    });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// CP2.3: tiempos de comida activos, su propio camino de guardado (partido de la distribucion el
// 2026-08-23). Mismos gates; candado independiente.
export async function saveTiemposActivos(input: SaveTiemposActivosInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de editar los tiempos de comida."));
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeTiemposActivos({
      treatmentId: protocol.treatmentId,
      activos: input.activos,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    if (e instanceof StaleTiemposActivosError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió los tiempos de comida en otra sesión (otra pestaña o dispositivo). Para no " +
            "borrar ese cambio no se guardó lo que hiciste. Recarga para ver la versión actual y vuelve a aplicarlo.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "Los tiempos de comida están bloqueados por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// CP4: menu semanal, su propio camino de guardado. Mismos gates y mismo candado que las demas secciones.
export async function saveMenuSemanal(input: SaveMenuSemanalInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de editar el menú semanal."));
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeMenuSemanal({
      treatmentId: protocol.treatmentId,
      menu: input.menu,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    if (e instanceof StaleMenuSemanalError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió el menú semanal en otra sesión (otra pestaña o dispositivo). Para no borrar " +
            "ese cambio no se guardó lo que hiciste. Recarga para ver la versión actual y vuelve a aplicarlo.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "El menú semanal está bloqueado por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// APLICAR CAMBIOS PROPUESTOS POR LA IA a la grilla del menu semanal.
//
// UNO A UNO SIGUE SIENDO LO PRINCIPAL: una sustitucion puede ser buena y la de al lado no, asi que la
// aceptacion es cambio a cambio. Lo que se agrego el 2026-08-31, a peticion de Santiago, es el ATAJO de
// aplicar todas las de una propuesta: con los botones individuales presentes, el global no obliga a nada,
// solo ahorra clics. Lo que se descarto en su momento era el global SOLO, que si obligaba a tragarse todo.
//
// NO HAY WRITER NUEVO NI FORMA NUEVA, y ese es el hallazgo que hizo esto barato: la grilla ya guarda
// `{diaInicio, celdas}` donde `celdas` son SOLO los overrides contra el ciclo. Una adaptacion de la IA ES
// un override. Asi que aplicar un cambio es escribir una celda por el camino que ya existe, con su
// candado de concurrencia, su auditoria y su firma.
//
// Y POR ESO "TODAS" ES UN SOLO GUARDADO, no un bucle sobre el de a uno. Un bucle haria N lecturas y N
// escrituras: la primera invalidaria la firma de la segunda, asi que o se salta el candado (inaceptable) o
// se cae a la mitad dejando la grilla aplicada por partes. Con una sola escritura hay una sola firma, un
// solo chequeo de concurrencia y una sola entrada de auditoria: se aplican todas o no se aplica ninguna.
//
// SOBRE LA FIRMA: se manda la que se acaba de leer en esta misma peticion. Si otra sesion escribio entre
// la lectura y la escritura, el candado rechaza y el profesional recarga, que es la conducta que ya tiene
// el guardado manual. No se computa una firma "fresca" para saltarse el candado: eso convertiria un merge
// en un pisotón silencioso.
export async function aplicarCambiosMenu(
  input: { evaluationId: string; cambios: { dia: number; tiempo: string; reemplazo: string }[] },
  actor: Actor,
): Promise<Result<void>> {
  if (input.cambios.length === 0) return ok(undefined);

  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));

  const guardado = protocol.menuSemanal;
  const diaInicio = guardado?.diaInicio ?? diaInicioDerivado(protocol.treatmentId);
  const celdas = { ...(guardado?.celdas ?? {}) };

  for (const cambio of input.cambios) {
    // MISMA REGLA QUE LA GRILLA: solo se guarda lo que DIFIERE del ciclo. Si el reemplazo coincidiera con
    // lo que el ciclo ya propone, guardarlo lo congelaria: la celda dejaria de seguir al ciclo si mañana
    // se propone otra semana.
    const delCiclo = (
      diaDelCiclo(diaInicio, cambio.dia) as unknown as Record<string, string | undefined>
    )[cambio.tiempo];
    if (cambio.reemplazo === delCiclo) {
      delete celdas[`${cambio.dia}_${cambio.tiempo}`];
    } else {
      celdas[`${cambio.dia}_${cambio.tiempo}`] = cambio.reemplazo;
    }
  }

  return saveMenuSemanal(
    {
      evaluationId: input.evaluationId,
      menu: { diaInicio, celdas },
      baseSignature: menuSemanalSignature({
        treatmentId: protocol.treatmentId,
        menu: guardado,
      }),
    },
    actor,
  );
}

/** Aplicar UN cambio: el de a uno delega en el de a varios, para que haya UNA sola regla de escritura. */
export async function aplicarCambioMenu(
  input: { evaluationId: string; dia: number; tiempo: string; reemplazo: string },
  actor: Actor,
): Promise<Result<void>> {
  const { evaluationId, ...cambio } = input;
  return aplicarCambiosMenu({ evaluationId, cambios: [cambio] }, actor);
}

// Checkpoint 2.4: guias dietarias, su propio camino de guardado.
export async function saveGuidelines(
  input: SaveGuidelinesInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de editar las guías dietarias."));
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeGuidelines({
      treatmentId: protocol.treatmentId,
      guidelines: input.guidelines,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    if (e instanceof StaleGuidelinesError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió las guías dietarias en otra sesión (otra pestaña o dispositivo). Para no " +
            "borrar ese cambio no se guardó lo que hiciste. Recarga para ver la versión actual y vuelve a aplicarlo.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "Las guías están bloqueadas por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// Checkpoint 2.3: prescripcion de nutraceuticos, su propio camino de guardado (partido de saveProtocol).
// Solo nutricionista (require-profession); ownership por lectura RLS del treatmentId via evaluationId.
export async function saveNutraceuticals(
  input: SaveNutraceuticalsInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(
      appError(
        "conflict",
        "El diagnóstico debe estar confirmado (aprueba el reporte) antes de prescribir nutracéuticos.",
      ),
    );
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeNutraceuticals({
      treatmentId: protocol.treatmentId,
      nutraceuticals: input.nutraceuticals,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    // Rechazo por concurrencia: otro profesional cambió la prescripción. Aviso (no error): no se pisó su
    // cambio y el trabajo del profesional sigue en pantalla para reaplicar.
    if (e instanceof StaleNutraceuticalsError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió la prescripción de nutracéuticos en otra sesión (otra pestaña o " +
            "dispositivo). Para no borrar ese cambio no se guardó lo que hiciste. Recarga para ver la versión " +
            "actual y vuelve a aplicar tu prescripción.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "La prescripción está bloqueada por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// T2 A2: ajustes del profesional sobre el sugerido. Ownership por lectura RLS (derivamos el
// treatmentId de la evaluacion; si no es del profesional, el reader devuelve null).
export async function saveAdjustments(
  input: SaveAdjustmentsInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(
      appError("conflict", "El diagnóstico debe estar confirmado antes de ajustar el protocolo."),
    );
  }
  if (protocol.approved) return err(appError("conflict", PROTOCOL_APPROVED_MSG));
  try {
    await writeAdjustments({
      treatmentId: protocol.treatmentId,
      adjGeb: input.adjGeb,
      adjPal: input.adjPal,
      adjKcalObj: input.adjKcalObj,
      adjProtGkg: input.adjProtGkg,
      adjFatPct: input.adjFatPct,
      adjPesoMeta: input.adjPesoMeta,
      baseSignature: input.baseSignature,
      ...actor,
    });
  } catch (e) {
    // Rechazo por concurrencia: otro profesional cambió la cadena calórica. Va como stale_write (aviso, no
    // error): no se pisó su cambio y el trabajo del profesional sigue en pantalla para reaplicar.
    if (e instanceof StaleAdjustmentsError) {
      return err(
        appError(
          "stale_write",
          "Otro profesional cambió los ajustes de la cadena calórica en otra sesión (otra pestaña o " +
            "dispositivo). Para no borrar ese cambio no se guardó lo que hiciste. Recarga para ver la versión " +
            "actual y vuelve a aplicar tus ajustes.",
        ),
      );
    }
    // lock_timeout (55P03): otra sesión tiene la fila bloqueada. No se guardó; reintentar en unos segundos.
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "Los ajustes están bloqueados por otra sesión en este momento. No se guardó; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// T2 A2: reconocimiento de las restricciones del modelo. NO es un gate: ninguna UI lo invoca y
// generateMenu no lo exige (decision 2026-08-23, opcion iii; ver BACKLOG). Queda como maquinaria
// construida y auditada, lista si algun dia se decide exigir la constancia.
export async function acknowledgeRestrictions(
  input: AcknowledgeRestrictionsInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado."));
  }
  try {
    await writeAcknowledge({ treatmentId: protocol.treatmentId, ...actor });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// T2 A3: aprobar el protocolo = sellar la prescripcion EFECTIVA (el acto mas cargado). Gates, y solo
// estos (ver la precondicion de T2b en BACKLOG sobre por que NO se gatea en diagnostico confirmado):
//   - canApproveProtocol (rol profesional; admin NO) -> lo verifica la action.
//   - Asignacion EXPLICITA: el profesional que aprueba es el asignado a la evaluacion (no solo RLS).
//   - status == 'draft' (no re-aprobar).
//   - protocol_suggested no nulo (no se aprueba lo que nunca se computo).
// Sella protocol_approved con el set efectivo (adj_* sobre los inputs sellados del sugerido), LAS DOS
// VERSIONES del motor (la de ahora y la del sugerido) + versionMismatch, y LAS DOS FECHAS (aprobacion
// y medicion BIS), para que la traza no se rompa si el motor subio entre el diagnostico y la aprobacion.
export async function approveProtocol(
  input: ApproveProtocolInput,
  actor: Actor,
): Promise<Result<void>> {
  const t = await getTreatmentForApproval(input.evaluationId);
  if (!t) return err(appError("not_found", "Tratamiento no encontrado."));

  // Chequeo EXPLICITO de asignacion (defensa en profundidad, no solo el read RLS): el
  // professional_profiles.id del actor debe ser el asignado a la evaluacion.
  const professionalId = await getProfessionalProfileIdByUser(actor.actorId);
  if (!professionalId || professionalId !== t.evaluationProfessionalId) {
    return err(appError("forbidden", "No estas asignado a este paciente."));
  }
  // Guard interino de ambito de practica: sin profesion configurada no se prescribe (aprobar es
  // el acto mas cargado). Va tras la asignacion para no filtrar existencia (ver require-profession.ts).
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (t.status !== "draft") {
    return err(appError("conflict", "El protocolo ya fue aprobado."));
  }
  if (!t.protocolSuggested) {
    return err(
      appError("conflict", "No se puede aprobar un protocolo que nunca se computo (sin sugerido)."),
    );
  }

  const suggested = t.protocolSuggested;
  const efectivo = computeProtocoloEfectivo(suggested, t.adjustments);
  const approvedAt = new Date();
  const versionApproved = PROTOCOL_ENGINE_VERSION;
  const versionSuggested = suggested.protocolEngineVersion;

  const protocolApproved = {
    protocolEngineVersionApproved: versionApproved,
    protocolEngineVersionSuggested: versionSuggested,
    versionMismatch: versionApproved !== versionSuggested,
    approvedAt: approvedAt.toISOString(),
    // La PROFESION con que se aprobo, SELLADA en el acto (no solo approved_by = quien). Es la condicion
    // que AUTORIZA la prescripcion nutricional (guard nutricionista); un acto clinico registra todas
    // las condiciones bajo las que se ejecuto (familia de emission_versions). Se lee, no se asume: si
    // manana la profesion del perfil cambia, este valor conserva la de la aprobacion (el momento de
    // cerrarlo es AHORA: protocol_approved es write-once, no se puede agregar despues).
    approvedProfession: prof.value.profession,
    bisMeasurementDate: t.bisMeasurementDate,
    fenotipo: suggested.fenotipo,
    estrategia: suggested.estrategia,
    protMin: suggested.protMin,
    protMax: suggested.protMax,
    protRef: suggested.protRef,
    restricciones: suggested.restricciones,
    examenes: suggested.examenes,
    suplementacion: suggested.suplementacion,
    pesoEfectivo: efectivo.pesoEfectivo,
    ajustes: t.adjustments,
    calorico: efectivo.calorico,
  };

  try {
    await writeApproveProtocol({
      treatmentId: t.treatmentId,
      protocolApproved,
      kcalObjetivo: efectivo.calorico.kcalObj,
      proteinaGramos: efectivo.calorico.protG,
      approvedAt,
      versionApproved,
      versionSuggested,
      ...actor,
    });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// REABRIR una prescripcion aprobada (Gildardo 2026-08-30 §6c).
//
// SU FORMULACION, que es la que gobierna el diseño: "El sellado no es un candado: es una consecuencia
// registrada. Un profesional que necesita corregir un plan aprobado tiene que poder hacerlo; lo que no
// puede es que el cambio no deje rastro ni le llegue al paciente que ya se lo llevo."
//
// De ahi salen las tres condiciones, y ninguna es opcional: (1) SE PUEDE, contra el candado anterior;
// (2) DEJA RASTRO, por eso el motivo es obligatorio y la aprobacion anterior se conserva entera en
// `treatment_approvals`; (3) LE LLEGA AL PACIENTE, que es lo que resuelve `avisarAlPaciente`: un
// tratamiento reemitido se avisa SIEMPRE, "porque cambia lo que la persona come".
//
// MISMOS GUARDS QUE APROBAR, y no por simetria: reabrir es el acto que DESHACE una prescripcion, asi que
// no puede exigir menos que hacerla. Asignacion explicita + profesion, en ese orden (la asignacion va
// primero para no filtrar existencia).
export async function reopenProtocol(
  input: ReopenProtocolInput,
  actor: Actor,
): Promise<Result<void>> {
  const t = await getTreatmentForApproval(input.evaluationId);
  if (!t) return err(appError("not_found", "Tratamiento no encontrado."));

  const professionalId = await getProfessionalProfileIdByUser(actor.actorId);
  if (!professionalId || professionalId !== t.evaluationProfessionalId) {
    return err(appError("forbidden", "No estas asignado a este paciente."));
  }
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (t.status !== "approved") {
    return err(appError("conflict", "Esta prescripción no está aprobada: no hay nada que reabrir."));
  }

  try {
    await writeReopenProtocol({
      treatmentId: t.treatmentId,
      reason: input.reason,
      ...actor,
    });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// Nota clinica del tratamiento: es DOCUMENTACION, no prescripcion. A proposito NO lleva el guard de
// profesion (a diferencia de las otras cinco escrituras): un profesional asignado al paciente puede
// documentar una observacion aunque su profesion no este configurada; bloquearlo por un campo
// administrativo vacio seria un gate de mas. El guard de profesion cubre solo los actos que crean o
// producen la prescripcion, no la documentacion clinica.
export async function addNote(input: AddNoteInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnóstico debe estar confirmado antes de agregar notas."));
  }
  try {
    await addTreatmentNote({ treatmentId: protocol.treatmentId, note: input.note, ...actor });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}
