import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { type DbTransaction, db } from "@/db";
import {
  diagnoses,
  evaluations,
  patientProfessionalRelationships,
  professionalProfiles,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// REASIGNAR UN PACIENTE A OTRO PROFESIONAL  ·  pieza reutilizable, no un script de un solo uso
//
// ═══ DE DONDE SALE ═══
//
// La regla dura 14 ya lo pedia: *"Ninguna cuenta clinica se recicla. Offboarding = desactivar y
// reasignar."* Hasta hoy la segunda mitad de esa frase no existia en ninguna parte. El caso concreto que
// la trae son los pacientes del 13 de octubre que entraron por el enlace de un profesional cubriendo las
// citas de otra (Santiago, 2026-10-24), pero la pieza no sabe nada de ese dia: reasigna un paciente.
//
// ═══ SON DOS COSAS LAS QUE SE MUEVEN, NO UNA ═══
//
//   · EL ACCESO    -> `patient_professional_relationships`. Lo lee `is_patient_of`, que gobierna las
//                     policies de patients, patient_profiles, patient_consents, evaluations y las demas.
//                     Si no se mueve, el profesional nuevo NO PUEDE ABRIR LA FICHA.
//   · LA ATRIBUCION -> `evaluations.professional_id`. Lo leen el guard de editar la encuesta, el flujo de
//                     correccion y la comision. Si no se mueve, la consulta sigue siendo del anterior
//                     aunque el nuevo la vea.
//
// Mover solo lo primero da acceso sin atribucion; solo lo segundo, atribucion sin acceso. Las dos van en
// la MISMA transaccion, siempre.
//
// ═══ LA FILA VIEJA NO SE BORRA ═══
//
// Pasa a `status = 'reasignada'`. Textual de Santiago: *"el hecho de que [el profesional] atendio a [la
// paciente] tiene que seguir en la base, no solo en auditoria"*. Y la restriccion unica es
// `(patient_id, professional_id)`, no `(patient_id)`, asi que un paciente PUEDE tener dos filas: la
// historica y la activa. Desde la 0223 `is_patient_of` exige `status = 'active'`, que es lo que hace que
// la fila historica no de acceso.
//
// ═══ LO QUE NO SE TOCA, Y CADA RAZON ═══
//
//   · `diagnoses.confirmed_by` / `confirmed_at` / `confirmed_profession`: quien firmo un diagnostico es un
//     hecho que ocurrio. Reescribirlo diria que lo firmo alguien que no lo firmo. Decision de Santiago,
//     2026-10-24: *"El confirmed_by del diagnostico de esa paciente SE QUEDA"*.
//   · `patient_consents.declared_by` de las firmas presenciales con QR: registra que ESE profesional
//     declaro, ESE dia, que el paciente firmo delante de el. Es evidencia de un acto, no una asignacion.
//   · El consentimiento NO se repite: `patient_consents` no tiene columna de profesional, el
//     `document_hash` es sobre la PLANTILLA, y la clausula §2.1 habla del profesional "que le atiende" en
//     generico. Cambia quien atiende, la frase sigue siendo cierta.
//
// ═══ Y EL RASTRO VA INLINE, EN LA MISMA TRANSACCION (regla dura 8) ═══
//
// UN asiento en `clinical_audit_log`, que es el unico log que este sistema tiene, y lleva las dos preguntas
// que alguien hara: quien pudo ver esta historia clinica y desde cuando, y quien ejecuto el movimiento y con
// que motivo. El motivo es OBLIGATORIO: una reasignacion sin motivo es indistinguible de un error.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type ReasignacionDePaciente = {
  patientId: string;
  /** `professional_profiles.id` de destino. */
  haciaProfesionalId: string;
  /** Obligatorio. Lo valida el schema antes de llegar aqui. */
  motivo: string;
};

export type ActorDeLaReasignacion = {
  actorId: string;
  actorEmail: string | null;
  ip?: string | null;
};

export type ResultadoDeLaReasignacion =
  | {
      estado: "reasignado";
      /** Los profesionales que quedaron como historicos (normalmente uno). */
      desdeProfesionalIds: string[];
      /** Cuantas evaluaciones cambiaron de atribucion. */
      evaluacionesMovidas: number;
      /** Cuantas de ellas ya tenian un diagnostico firmado (su `confirmed_by` NO se movio). */
      conDiagnosticoFirmado: number;
    }
  /** El paciente ya estaba asignado a ese profesional y a nadie mas: no habia nada que mover. */
  | { estado: "sin-cambio" }
  | { estado: "profesional-no-existe" };

export async function reasignarPaciente(
  datos: ReasignacionDePaciente,
  actor: ActorDeLaReasignacion,
): Promise<ResultadoDeLaReasignacion> {
  return db.transaction((tx) => reasignarPacienteEn(tx, datos, actor));
}

// EL CUERPO RECIBE LA TRANSACCION, NO LA ABRE. De ahi sale la pasada en lote de mas abajo: los 25
// movimientos entran en UNA sola transaccion llamando a ESTA misma funcion, sin una segunda escritura de la
// regla. Un lote a medias seria justo el defecto que la transaccion existe para evitar: unos pacientes con
// el acceso movido y otros no, sin que nadie sepa cuales.
async function reasignarPacienteEn(
  tx: DbTransaction,
  { patientId, haciaProfesionalId, motivo }: ReasignacionDePaciente,
  actor: ActorDeLaReasignacion,
): Promise<ResultadoDeLaReasignacion> {
  // EL DESTINO TIENE QUE EXISTIR Y NO ESTAR DE PRUEBA. Reasignar a una cuenta de demostracion dejaria al
  // paciente fuera de todas las cifras por el trigger de la 0202, en silencio.
  const [destino] = await tx
    .select({ id: professionalProfiles.id, isTest: professionalProfiles.isTest })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.id, haciaProfesionalId))
    .limit(1);
  if (!destino || destino.isTest) return { estado: "profesional-no-existe" };

  // LAS RELACIONES SE LEEN CON LA FILA BLOQUEADA: se lee quien era y se escribe a continuacion, asi que
  // sin el candado cabe otra reasignacion en medio y el rastro afirmaria un origen que ya no era.
  const actuales = await tx
    .select({ professionalId: patientProfessionalRelationships.professionalId })
    .from(patientProfessionalRelationships)
    .where(
      and(
        eq(patientProfessionalRelationships.patientId, patientId),
        eq(patientProfessionalRelationships.status, "active"),
      ),
    )
    .for("update");

  const desdeProfesionalIds = actuales
    .map((r) => r.professionalId)
    .filter((id) => id !== haciaProfesionalId);

  const yaEstaba = actuales.some((r) => r.professionalId === haciaProfesionalId);
  if (desdeProfesionalIds.length === 0 && yaEstaba) return { estado: "sin-cambio" };

  // 1 · LAS ACTIVAS QUE NO SON EL DESTINO PASAN A HISTORICAS. No se borran.
  if (desdeProfesionalIds.length > 0) {
    await tx
      .update(patientProfessionalRelationships)
      .set({ status: "reasignada" })
      .where(
        and(
          eq(patientProfessionalRelationships.patientId, patientId),
          eq(patientProfessionalRelationships.status, "active"),
          sql`${patientProfessionalRelationships.professionalId} <> ${haciaProfesionalId}`,
        ),
      );
  }

  // 2 · EL DESTINO QUEDA ACTIVO. `on conflict` porque la fila puede existir ya como historica (el
  // paciente vuelve con quien lo atendio antes), y entonces se reactiva en vez de duplicarse: la
  // restriccion unica es (patient_id, professional_id).
  await tx
    .insert(patientProfessionalRelationships)
    .values({ patientId, professionalId: haciaProfesionalId, status: "active" })
    .onConflictDoUpdate({
      target: [
        patientProfessionalRelationships.patientId,
        patientProfessionalRelationships.professionalId,
      ],
      set: { status: "active" },
    });

  // 3 · LA ATRIBUCION DE LAS EVALUACIONES. TODAS las vigentes, incluida la que ya tiene diagnostico: la
  // decision de Santiago es que `professional_id` dice quien atiende y `confirmed_by` quien firmo, y son
  // dos preguntas distintas. Las retiradas (la consulta que no ocurrio) y las reemplazadas por una
  // correccion se quedan como estan: son registros cerrados de lo que paso.
  const movidas = await tx
    .update(evaluations)
    .set({ professionalId: haciaProfesionalId })
    .where(
      and(
        eq(evaluations.patientId, patientId),
        isNull(evaluations.supersededAt),
        isNull(evaluations.retiradaAt),
        sql`${evaluations.professionalId} <> ${haciaProfesionalId}`,
      ),
    )
    .returning({ id: evaluations.id });

  // CUANTAS LLEVABAN UN DIAGNOSTICO FIRMADO, para poder DECIRLO en la pantalla y en el rastro: es la
  // parte que no se mueve, y quien reasigna tiene que saber que esa firma se queda donde esta.
  let conDiagnosticoFirmado = 0;
  if (movidas.length > 0) {
    const firmados = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(
        and(
          sql`${diagnoses.evaluationId} in ${movidas.map((m) => m.id)}`,
          sql`${diagnoses.confirmedBy} is not null`,
        ),
      );
    conDiagnosticoFirmado = firmados.length;
  }

  // 4 · EL RASTRO, inline en la transaccion (regla dura 8). La pregunta que tiene que poder contestar
  // dentro de un ano: QUIEN pudo ver esta historia clinica, desde cuando, hasta cuando y por que dejo de
  // poder. Por eso el asiento lleva el origen, el destino, el motivo y LA LISTA de evaluaciones que
  // cambiaron de atribucion (no solo cuantas: el conteo no deja reconstruir cual).
  //
  // Y LLEVA `conDiagnosticoFirmado` A PROPOSITO: es la parte que NO se movio. Un rastro que solo dice lo
  // que cambio deja creer que cambio todo.
  await recordAudit(tx, {
    event: "patient.reasignado",
    actorId: actor.actorId,
    actorEmail: actor.actorEmail,
    entityType: "patient",
    entityId: patientId,
    payload: {
      desdeProfesionalIds,
      haciaProfesionalId,
      motivo,
      evaluacionesMovidas: movidas.map((m) => m.id),
      conDiagnosticoFirmado,
    },
    ip: actor.ip ?? null,
  });

  return {
    estado: "reasignado",
    desdeProfesionalIds,
    evaluacionesMovidas: movidas.length,
    conDiagnosticoFirmado,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA PASADA EN LOTE  ·  LA MISMA PIEZA, UNA SOLA TRANSACCION  (Santiago, 2026-10-24)
//
// ═══ POR QUE EXISTE, Y POR QUE NO ES UN SCRIPT ═══
//
// El caso que la trae son los 25 pacientes del 13 de octubre que entraron por el enlace de un profesional
// cubriendo la agenda de otra: 25 filas con el MISMO destino y el MISMO motivo. Textual de Santiago:
// *"Mueve los 25 en una sola pasada con la pieza, el mismo motivo para todos"*. Y el caso que la vuelve
// permanente es el de la regla dura 14: cuando un integrante se va, sus pacientes se reasignan TODOS, y
// teclear el motivo noventa veces no es una garantia, es una invitacion a escribir cualquier cosa.
//
// ═══ TODO O NADA, Y ESO ES LO IMPORTANTE ═══
//
// Los movimientos van en UNA transaccion. Si el paciente 13 falla, los doce anteriores se revierten. Un
// lote a medias dejaria a unos pacientes con el acceso movido y a otros no, y nadie sabria cuales: es el
// mismo defecto que la transaccion de un solo paciente existe para evitar, un nivel mas arriba.
//
// ═══ EL RASTRO SIGUE SIENDO POR PACIENTE ═══
//
// Un asiento por paciente, cada uno con su motivo, porque la pregunta que alguien hara dentro de un ano es
// sobre UNA historia clinica, no sobre el lote. El lote es como se escribio, no lo que paso.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type ResultadoDelLote = {
  /** Cuantos cambiaron de manos de verdad. */
  reasignados: number;
  /** Ya estaban con ese profesional: no habia nada que mover. No es un error. */
  sinCambio: number;
  evaluacionesMovidas: number;
  conDiagnosticoFirmado: number;
};

export type LoteDeReasignacion = {
  patientIds: string[];
  haciaProfesionalId: string;
  motivo: string;
};

export async function reasignarPacientesEnLote(
  { patientIds, haciaProfesionalId, motivo }: LoteDeReasignacion,
  actor: ActorDeLaReasignacion,
): Promise<ResultadoDelLote | { estado: "profesional-no-existe" }> {
  // EL MISMO PACIENTE DOS VECES EN LA LISTA no es un error de quien pulsa (dos casillas, un id): se
  // colapsa. Sin esto, la segunda pasada sobre la misma fila daria "sin-cambio" y el informe mentiria.
  const unicos = [...new Set(patientIds)];

  return db.transaction(async (tx) => {
    const total: ResultadoDelLote = {
      reasignados: 0,
      sinCambio: 0,
      evaluacionesMovidas: 0,
      conDiagnosticoFirmado: 0,
    };
    for (const patientId of unicos) {
      const r = await reasignarPacienteEn(tx, { patientId, haciaProfesionalId, motivo }, actor);
      // EL DESTINO MALO ABORTA EL LOTE ENTERO. Es la misma respuesta para los 25 (no depende del paciente),
      // asi que seguir con los demas solo serviria para repetir el mismo fallo veinticuatro veces.
      if (r.estado === "profesional-no-existe") throw new DestinoInvalido();
      if (r.estado === "sin-cambio") {
        total.sinCambio += 1;
        continue;
      }
      total.reasignados += 1;
      total.evaluacionesMovidas += r.evaluacionesMovidas;
      total.conDiagnosticoFirmado += r.conDiagnosticoFirmado;
    }
    return total;
  }).catch((e: unknown) => {
    if (e instanceof DestinoInvalido) return { estado: "profesional-no-existe" as const };
    throw e;
  });
}

// SE LANZA PARA REVERTIR LA TRANSACCION Y SE ATRAPA FUERA: dentro de `db.transaction` un `return` no
// revierte nada, y el destino invalido tiene que dejar la base como estaba. No sale de este archivo.
class DestinoInvalido extends Error {}
