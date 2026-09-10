import "server-only";

import { computeProtocoloEfectivo, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";
import type { ProtocoloAjustes, ProtocoloSnapshot } from "@/clinical-engine";
import { diaDelCiclo, diaInicioDerivado } from "@/clinical-engine/menu-ciclo";
import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { getProtKgPrescrito } from "@/modules/treatment/data/dieta-resumen-reader";

import { writeEmisionPrescripcion } from "../data/emisiones-writer";
import {
  guardarProtocolo as writeGuardarProtocolo,
  rotuloDeSeccion,
  StaleProtocoloError,
} from "../data/protocolo-writer";
import { menuSemanalSignature } from "../data/protocol-signature";
import { getTreatmentForApproval, getTreatmentProtocol } from "../data/treatment-reader";
import { getActorProfession } from "../data/actor-profession-reader";
import type { ProfesionNota } from "../data/treatment-view-types";
import { requireNutricionista } from "./require-profession";
import {
  acknowledgeRestrictions as writeAcknowledge,
  addTreatmentNote,
  saveNutraceuticals as writeNutraceuticals,
  saveMenuSemanal as writeMenuSemanal,
  saveNutraDecision as writeNutraDecision,
  StaleNutraceuticalsError,
  StaleMenuSemanalError,
  TreatmentStateError,
} from "../data/treatment-writer";
import type {
  AcknowledgeRestrictionsInput,
  AddNoteInput,
  EmitirPrescripcionInput,
  GuardarProtocoloInput,
  SaveNutraceuticalsInput,
  SaveMenuSemanalInput,
  SaveNutraDecisionInput,
} from "../validations";

// Servicio del protocolo de tratamiento (la logica vive aqui; las actions son thin,
// regla 2). Deriva el treatmentId SIEMPRE de una lectura RLS por evaluationId (nunca se
// confia un treatmentId del formulario): si la evaluacion no es del profesional, el reader
// devuelve null y se corta con forbidden. El gate de diagnostico confirmado se verifica
// aqui y se re-chequea en el writer.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

// ═══ EL GATE DE "DIAGNOSTICO CONFIRMADO" SE RETIRO DE ESTE ARCHIVO (2026-09-10) ═══
//
// ERA LA MISMA REGLA QUE YA SE HABIA RETIRADO EL 2026-09-09, y sobrevivio porque aquel barrido fue del
// WRITER y estas cinco comprobaciones viven en el SERVICIO. Dos capas, una barrida: el writer cambio
// `assertConfirmedDiagnosis` por `assertDiagnosisExists` en sus nueve sitios de llamada, y aqui quedaron
// cinco `if (!protocol.diagnosisConfirmed)` que nadie miro. Lo destapo el smoke: aplicar un cambio de la IA
// al menu contestaba "El diagnóstico debe estar confirmado antes de editar el menú semanal".
//
// EL ARGUMENTO QUE LO RETIRA (Gildardo via Santiago, 2026-09-09): **el diagnostico es del MODELO, no del
// profesional.** Nadie firma el resultado del motor; lo que si se firma es haber prescrito sobre el. Exigir
// una confirmacion manual antes de dejar prescribir ponia una firma en el sitio equivocado y bloqueaba el
// trabajo.
//
// EL GATE QUE QUEDA SIGUE SIENDO REAL, y es el que importa: sin diagnostico no hay protocolo que editar.
// Lo impone `getTreatmentProtocol` (que devuelve null si no hay) y lo RE-COMPRUEBA el writer dentro de la
// transaccion con su join, porque una guarda que solo vive en el servicio se salta invocando la accion.
//
// LAS CINCO ERAN: la decision de nutraceuticos, el menu semanal, la prescripcion de nutraceuticos, el
// reconocimiento de restricciones y las notas clinicas. La ultima era ademas la mas dificil de defender:
// bloquear una NOTA clinica por una confirmacion administrativa es un gate de mas sobre documentacion.

// SE RETIRO EL GUARD DE "PROTOCOLO YA APROBADO" (2026-09-09), y con el las OCHO comprobaciones que lo
// invocaban en las escrituras de seccion.
//
// POR QUE EXISTIA: aprobar CERRABA la prescripcion (trigger 0026), asi que un guardado posterior chocaba
// contra la base y la pantalla se veia editable mientras el servidor rechazaba. El guard adelantaba ese
// rechazo con un mensaje legible.
//
// POR QUE YA NO: la prescripcion no se cierra nunca. Emitir REGISTRA una copia de lo que salio y sigue
// permitiendo editar, que es la peticion de Santiago y ademas es lo que Gildardo escribio en su §6c ("el
// sellado no es un candado: es una consecuencia registrada"). Un guard que protege un estado que ya no
// existe no es prudencia: es una prohibicion sin motivo, y el profesional la vive como un sistema que le
// impide corregir.
//
// LO QUE SUSTITUYE A LA GARANTIA: la copia inmutable de cada emision. Antes, lo que el paciente recibio
// se conservaba porque nadie podia tocar la fila; ahora se conserva porque esta copiado aparte. Es mas
// fuerte, no mas debil: el congelado protegia solo mientras nadie reabriera.

// CP-N1: la decision sobre los nutraceuticos. Se pregunta SIEMPRE, y "pendiente" es respuesta valida.
export async function saveNutraDecision(input: SaveNutraDecisionInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
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

// CP4: menu semanal, su propio camino de guardado. Mismos gates y mismo candado que las demas secciones.
export async function saveMenuSemanal(input: SaveMenuSemanalInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
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
  try {
    await writeAcknowledge({ treatmentId: protocol.treatmentId, ...actor });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// `ViaDeAprobacion` SE RETIRO con la aprobacion (2026-09-09). Sus tres valores ("envio",
// "entrega_en_consulta", "manual") describian por que via se habia CERRADO la prescripcion. La via sigue
// registrandose, pero de la EMISION y con los nombres de lo que de verdad ocurre: "impresa" o "correo".
// Ver `emitirPrescripcion` mas abajo y la columna `via` de `prescription_emissions`.

/**
 * LA PRESCRIPCION EFECTIVA, ARMADA UNA SOLA VEZ.
 *
 * Existe porque hay DOS actos que sellan exactamente lo mismo (aprobar, que se esta retirando, y EMITIR,
 * que es el que queda) y armar el objeto dos veces es como se separan dos copias del mismo documento. Es
 * la misma leccion que ya nos costo el plan del paciente: una sola forma, dos presentaciones.
 *
 * NO INCLUYE LA VIA: cada acto la nombra a su manera (`aprobadoVia` en la aprobacion, `via` en la
 * emision) y la añade al objeto que devuelve esto. Meterla aqui obligaria a que las dos se llamaran
 * igual, que es una coincidencia y no un requisito.
 */
async function construirPrescripcionEfectiva(args: {
  evaluationId: string;
  suggested: ProtocoloSnapshot;
  adjustments: ProtocoloAjustes;
  bisMeasurementDate: string | null;
  /** `null` si el actor no tiene perfil profesional: se sella lo que hay, no se inventa. */
  profession: string | null;
  fecha: Date;
}): Promise<{
  payload: Record<string, unknown>;
  kcalObjetivo: number;
  proteinaGramos: number;
  versionApproved: string;
  versionSuggested: string;
}> {
  // LA PROTEINA DEL MOTOR TAMBIEN AQUI, y es donde mas importa: lo que se sella ES la prescripcion, y
  // tiene que ser la misma cifra que el profesional tenia delante. Un snapshot anterior al 2026-09-03 no
  // la trae sellada, asi que se resuelve en vivo con el mismo helper que usa la pantalla; los posteriores
  // la ignoran, porque manda lo sellado. Sin encuesta legible queda null y la cascada cae al minimo
  // poblacional, declarandolo en protFuente.
  const resultados = await getEvaluationResults(args.evaluationId);
  const protKgVigente = resultados
    ? await getProtKgPrescrito(
        args.evaluationId,
        resultados.snapshot.sexo,
        resultados.snapshot.indicators as unknown as Record<string, unknown>,
      )
    : null;
  const efectivo = computeProtocoloEfectivo(args.suggested, args.adjustments, { protKgVigente });
  const versionApproved = PROTOCOL_ENGINE_VERSION;
  const versionSuggested = args.suggested.protocolEngineVersion;

  return {
    kcalObjetivo: efectivo.calorico.kcalObj,
    proteinaGramos: efectivo.calorico.protG,
    versionApproved,
    versionSuggested,
    payload: {
      protocolEngineVersionApproved: versionApproved,
      protocolEngineVersionSuggested: versionSuggested,
      versionMismatch: versionApproved !== versionSuggested,
      approvedAt: args.fecha.toISOString(),
      // La PROFESION con que se prescribio, SELLADA en el acto (no solo quien). Es la condicion que
      // AUTORIZA la prescripcion nutricional; un acto clinico registra todas las condiciones bajo las que
      // se ejecuto. Se lee, no se asume: si mañana la profesion del perfil cambia, este valor conserva la
      // del acto, y el momento de cerrarlo es AHORA porque la copia es inmutable.
      approvedProfession: args.profession,
      bisMeasurementDate: args.bisMeasurementDate,
      fenotipo: args.suggested.fenotipo,
      estrategia: args.suggested.estrategia,
      protMin: args.suggested.protMin,
      protMax: args.suggested.protMax,
      protRef: args.suggested.protRef,
      restricciones: args.suggested.restricciones,
      examenes: args.suggested.examenes,
      suplementacion: args.suggested.suplementacion,
      pesoEfectivo: efectivo.pesoEfectivo,
      ajustes: args.adjustments,
      calorico: efectivo.calorico,
    },
  };
}

/**
 * EMITIR: registrar que esta prescripcion SALIO hacia el paciente (Santiago, 2026-09-09).
 *
 * QUE LO DIFERENCIA DE APROBAR, que es todo. Aprobar hacia dos cosas pegadas: sellaba Y cerraba. Emitir
 * solo SELLA: guarda una copia inmutable de lo que salio, con su fecha y su via, y la prescripcion sigue
 * abierta. Sin bloqueo, sin reapertura con motivo, sin un boton que parezca un tramite.
 *
 * Y CONSERVA LO UNICO QUE EL CANDADO PROTEGIA. El plan impreso, el del correo y la historia clinica se
 * arman los tres del protocolo VIVO, asi que solo eran estables porque el trigger congelaba los ajustes al
 * aprobar. Con la copia, esos documentos dejan de depender del estado vivo, que es la garantia de verdad:
 * saber que recibio el paciente.
 *
 * MISMOS GUARDS QUE APROBAR, y no por simetria: emitir es el acto por el que un plan sale de la clinica
 * hacia una persona. Asignacion explicita + profesion, en ese orden (la asignacion va primero para no
 * filtrar existencia).
 *
 * SE PUEDE EMITIR VARIAS VECES, a proposito: se imprime, se corrige, se vuelve a imprimir, se envia. Cada
 * salida es un hecho distinto y el paciente puede acabar con dos papeles. Por eso NO hay gate de "ya
 * emitida": eso volveria a ser un candado.
 */
export async function emitirPrescripcion(
  input: EmitirPrescripcionInput,
  actor: Actor,
  via: "impresa" | "correo",
): Promise<Result<void>> {
  const t = await getTreatmentForApproval(input.evaluationId);
  if (!t) return err(appError("not_found", "Tratamiento no encontrado."));

  const professionalId = await getProfessionalProfileIdByUser(actor.actorId);
  if (!professionalId || professionalId !== t.evaluationProfessionalId) {
    return err(appError("forbidden", "No estas asignado a este paciente."));
  }
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!t.protocolSuggested) {
    return err(
      appError("conflict", "No se puede emitir una prescripción que nunca se computó (sin sugerido)."),
    );
  }

  const sellada = await construirPrescripcionEfectiva({
    evaluationId: input.evaluationId,
    suggested: t.protocolSuggested,
    adjustments: t.adjustments,
    bisMeasurementDate: t.bisMeasurementDate,
    profession: prof.value.profession,
    fecha: new Date(),
  });

  try {
    await writeEmisionPrescripcion({
      treatmentId: t.treatmentId,
      prescripcion: { ...sellada.payload, via },
      kcalObjetivo: sellada.kcalObjetivo,
      proteinaGramos: sellada.proteinaGramos,
      via,
      ...actor,
    });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// `approveProtocol` y `reopenProtocol` SE RETIRARON (2026-09-09), y las dos por la misma razon.
//
// APROBAR hacia DOS cosas pegadas: sellaba la prescripcion efectiva Y la cerraba (a partir de ahi el
// trigger 0026 la congelaba entera). Solo la primera mitad hacia falta, y ahora la hace `emitirPrescripcion`
// de aqui arriba, que guarda la copia sin cerrar nada.
//
// REABRIR existia SOLO para deshacer ese cierre. Sin cierre no hay nada que reabrir, asi que desaparece
// con el, y con ella el motivo obligatorio que Santiago vivia como un tramite para corregir una coma.
//
// LO QUE NO SE PIERDE, que es lo que habia que verificar antes de tocar esto: `treatment_approvals` sigue
// existiendo con las aprobaciones anteriores del modelo viejo, y la migracion 0115 las copia a
// `prescription_emissions`. Ninguna prescripcion que un paciente recibio desaparece del sistema, que es
// justo el daño que Gildardo nombra al autorizar la reapertura en su §6c.

// Nota clinica del tratamiento: es DOCUMENTACION, no prescripcion. A proposito NO lleva el guard de
// profesion (a diferencia de las otras cinco escrituras): un profesional asignado al paciente puede
// documentar una observacion aunque su profesion no este configurada; bloquearlo por un campo
// administrativo vacio seria un gate de mas. El guard de profesion cubre solo los actos que crean o
// producen la prescripcion, no la documentacion clinica.
export async function addNote(input: AddNoteInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  // LA PROFESION SE LEE, NO SE PIDE (§8: "cada rol escribe lo suyo"). Viene del perfil del actor, no de un
  // campo del formulario: si viajara en el FormData, un profesional podria firmar la nota de otro rol. Y NO
  // se exige (a diferencia de las escrituras de prescripcion): esto es DOCUMENTACION, y bloquear una nota
  // clinica por un campo administrativo vacio seria un gate de mas. Sin profesion configurada, la nota
  // entra sin ella y la pantalla lo dice.
  const { profession } = await getActorProfession(actor.actorId);
  try {
    await addTreatmentNote({
      treatmentId: protocol.treatmentId,
      note: input.note,
      profession: (profession as ProfesionNota | null) ?? null,
      ...actor,
    });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// ═══ UN SOLO GUARDADO PARA TODO EL PROTOCOLO (Santiago, 2026-09-09) ═══
//
// MISMOS GUARDS QUE LAS SIETE ESCRITURAS QUE SUSTITUYE, ni uno mas ni uno menos: lectura RLS por
// evaluationId (si la evaluacion no es del profesional, el reader devuelve null) y el guard de profesion.
// El gate clinico (que exista diagnostico) se re-chequea DENTRO de la transaccion del writer, porque una
// guarda que solo vive en el servicio se puede saltar invocando la accion directamente.
//
// EL TODO-O-NADA VIVE EN EL WRITER, no aqui: una transaccion. Si la quinta seccion falla, no se guarda
// ninguna. Encadenar los siete servicios habria dado el peor resultado posible, cuatro guardadas y tres
// no, y el profesional sin saber cuales.
export async function guardarProtocolo(
  input: GuardarProtocoloInput,
  actor: Actor,
): Promise<Result<{ guardadas: string[] }>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);

  try {
    const { guardadas } = await writeGuardarProtocolo({
      treatmentId: protocol.treatmentId,
      editable: input.editable,
      firmas: input.firmas,
      ...actor,
    });
    return ok({ guardadas: guardadas.map(rotuloDeSeccion) });
  } catch (e) {
    if (e instanceof StaleProtocoloError) {
      // EL AVISO NOMBRA LAS SECCIONES, y por eso el error las trae en vez de solo decir que algo cambio:
      // "recarga" sin decir QUE cambio obliga a comparar la pantalla entera contra lo que uno recuerda.
      //
      // Y NO SE REFRESCA LA PANTALLA con este aviso (`useFormToastRefreshOnSuccess` no refresca en
      // warning): traeria el cambio del otro profesional y DESCARTARIA lo que este escribio, que es justo
      // lo que el rechazo preserva para que lo pueda reaplicar.
      return err(
        appError(
          "stale_write",
          `Otro profesional cambió ${e.secciones.join(", ")} en otra sesión (otra pestaña o dispositivo). ` +
            "Para no borrar ese cambio no se guardó NADA de lo que hiciste. Recarga para ver la versión " +
            "actual y vuelve a aplicarlo.",
        ),
      );
    }
    if ((e as { code?: string })?.code === "55P03") {
      return err(
        appError(
          "stale_write",
          "El tratamiento está bloqueado por otra sesión en este momento. No se guardó nada; espera unos segundos e intenta de nuevo.",
        ),
      );
    }
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
}
