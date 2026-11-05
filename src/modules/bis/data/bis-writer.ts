import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { bisImportLogs, bisMeasurements, bisRawValues, diagnoses, evaluations } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import type { DerivedValue } from "../services/derive-composition";
import type { BisRawValue } from "../types";

import {
  buscarLaMismaMedicion,
  mensajeDeLaMedicionDuplicada,
  type MedicionYaRegistrada,
  pideConfirmacion,
} from "./medicion-duplicada-reader";

// Escritura del import BIS en UNA transaccion de BD. Drizzle conecta como owner para
// poder dejar el audit INLINE (regla dura 8): bis_measurements, bis_raw_values, el log
// 'ok' y el evento bis.imported viajan juntos; si algo falla, no queda nada a medias.
// La autorizacion (que el profesional sea dueno de la evaluacion) se verifica antes,
// en el action, leyendo la evaluacion bajo RLS (regla dura 3).

// La evaluacion ya tiene una medicion: reimportar duplicaria datos clinicos. Se
// rechaza; el servicio la mapea a conflicto. No es un fallo de parseo ni de
// validacion, asi que no genera fila en bis_import_logs.
export class BisAlreadyImportedError extends Error {
  constructor(public readonly evaluationId: string) {
    super(`La evaluacion ${evaluationId} ya tiene una medicion BIS importada.`);
    this.name = "BisAlreadyImportedError";
  }
}

// ═══ ESTA MISMA TOMA YA ESTA EN LA BASE (Santiago, 2026-10-24) ═══
//
// No es un fallo del archivo ni de la validacion: el archivo esta perfecto y los numeros son buenos. Lo que
// pasa es que esos numeros YA cuelgan de otra evaluacion, asi que importarlos crearia una segunda copia de
// una toma que ocurrio una vez. De los 10 grupos reales medidos en produccion, 4 estaban repartidos entre
// pacientes DISTINTOS: el caso util no es "ya existe", es "este archivo es de otra persona".
export class MedicionDuplicadaError extends Error {
  constructor(public readonly choque: MedicionYaRegistrada) {
    super(mensajeDeLaMedicionDuplicada(choque));
    this.name = "MedicionDuplicadaError";
  }
}

// ═══ EL MOTIVO DE LA CONFIRMACION, Y POR QUE TIENE LARGO MINIMO (2026-11-05) ═══
//
// Una confirmacion sin motivo es un boton de "da igual": se pulsa sin leer y el registro queda con el acto
// y sin la razon, que es la mitad que sirve para revisarlo despues. El minimo no busca prosa, busca que
// quien confirma tenga que escribir algo propio: "ok" o "si" no explican nada a quien lo lea en marzo.
export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 500;

export class MotivoDeLaHuellaFaltaError extends Error {
  constructor() {
    super(
      `Para importar una medición que ya está en otra historia clínica hace falta el motivo (al menos ${MOTIVO_MINIMO} caracteres): queda registrado con tu nombre.`,
    );
    this.name = "MotivoDeLaHuellaFaltaError";
  }
}

export type BisWriteInput = {
  evaluationId: string;
  deviceId: string | null;
  deviceCalibrationDate: string | null; // 'YYYY-MM-DD' (snapshot al escanear)
  measurementDate: Date;
  values: BisRawValue[]; // MEDIDOS por el equipo (origin 'medido')
  // DERIVADOS de la composicion que el export corto no trae (EA1). Se insertan en la MISMA
  // transaccion que los medidos: si algo falla, no queda una medicion a medias.
  derivedValues: DerivedValue[];
  derivedFormulaVersion: string; // ESPECTRO_FORMULAS_V con la que se derivo (se sella por fila derivada)
  actorId: string;
  actorEmail: string;
  ip: string | null;
  /**
   * EL MOTIVO CON EL QUE SE CONFIRMA UNA MEDICION QUE YA ESTA EN OTRA HISTORIA (2026-11-05).
   *
   * Sin esto, el choque con un paciente real frena y se devuelve la peticion de confirmacion. Con esto,
   * entra y queda registrado: quien, cuando, con que motivo, y contra que otra consulta choca.
   */
  motivoDeLaHuella?: string | null;
};

export type BisWriteResult = {
  measurementId: string;
  valueCount: number;
  derivedCount: number;
  /**
   * EL CHOQUE QUE SE DEJO PASAR, si hubo. La superficie lo necesita para avisar: con un paciente de prueba
   * entra sin preguntar nada, y aun asi quien importa tiene que enterarse de que ese archivo ya estaba.
   */
  choqueAceptado: MedicionYaRegistrada | null;
};

export async function writeBisMeasurement(input: BisWriteInput): Promise<BisWriteResult> {
  return db.transaction(async (tx) => {
    // EL PORTON PASA DE "¿YA HAY MEDICION?" A "¿YA HAY DIAGNOSTICO?" (cotejo 2026-09-05, punto 6).
    //
    // LA INCONSISTENCIA QUE CIERRA, y la encontro Santiago: si el xlsx no parsea o no valida, no se
    // persiste nada y el profesional puede elegir otro archivo. Si parsea, queda bloqueado para siempre.
    // O sea que el sistema dejaba reintentar cuando el archivo era INSERVIBLE y bloqueaba cuando era
    // SERVIBLE PERO DEL PACIENTE EQUIVOCADO, que es el caso que de verdad importa. El porton preguntaba
    // "¿parseo?" cuando lo que decide es "¿ya se emitio algo sobre esto?".
    //
    // DESPUES DEL DIAGNOSTICO SIGUE BLOQUEADO, y eso no cambia: ahi hay un snapshot sellado, un
    // tratamiento y puede haber un reporte enviado. Ese caso se resuelve reiniciando la evaluacion
    // (bloque aparte, BACKLOG), no pisando la medicion por debajo de un diagnostico ya emitido.
    const [diagnostico] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .limit(1);
    if (diagnostico) throw new BisAlreadyImportedError(input.evaluationId);

    // ═══ EL FRENO DE LA MEDICION REPETIDA, Y VA ANTES DEL BORRADO ═══
    //
    // El orden importa: si se frenara despues, la medicion que ya tenia esta evaluacion ya estaria borrada.
    // La transaccion lo revertiria, pero depender de eso para no destruir un registro clinico es apoyarse
    // en el seguro en vez de en la cerradura.
    //
    // EL PACIENTE SE LEE DE LA EVALUACION, no se recibe: asi no hay forma de que quien llama diga un
    // paciente y la evaluacion sea de otro, que es justo la clase de defecto que esto persigue.
    const [laEvaluacion] = await tx
      .select({ patientId: evaluations.patientId })
      .from(evaluations)
      .where(eq(evaluations.id, input.evaluationId))
      .limit(1);
    //
    // ═══ Y DESDE EL 2026-11-05 NO FRENA: PIDE CONFIRMACION (ver la cabecera del lector) ═══
    //
    // Con un paciente de PRUEBA entra sin preguntar (no hay historia clinica que proteger) y se avisa.
    // Con uno REAL hace falta el motivo; sin el, se devuelve la peticion de confirmacion, que NO es un
    // rechazo: la pantalla la convierte en el campo del motivo y su boton.
    let choqueAceptado: MedicionYaRegistrada | null = null;
    if (laEvaluacion) {
      const choque = await buscarLaMismaMedicion(tx, {
        evaluationId: input.evaluationId,
        patientId: laEvaluacion.patientId,
        valores: input.values,
      });
      if (choque) {
        const motivo = (input.motivoDeLaHuella ?? "").trim();
        if (pideConfirmacion(choque)) {
          if (motivo === "") throw new MedicionDuplicadaError(choque);
          if (motivo.length < MOTIVO_MINIMO) throw new MotivoDeLaHuellaFaltaError();
        }
        choqueAceptado = choque;
      }
    }

    // Y LA VIEJA SE REEMPLAZA DE VERDAD: se borra ANTES de insertar, en la misma transaccion. Dejarla
    // convertiria "una medicion por evaluacion" en dos, y todo lo que lee la medicion elige "la primera"
    // o "la ultima" sin que nadie lo haya decidido. El borrado arrastra sus valores por la FK en cascada.
    const previas = await tx
      .delete(bisMeasurements)
      .where(eq(bisMeasurements.evaluationId, input.evaluationId))
      .returning({ id: bisMeasurements.id });

    const [measurement] = await tx
      .insert(bisMeasurements)
      .values({
        evaluationId: input.evaluationId,
        deviceId: input.deviceId,
        measurementDate: input.measurementDate,
        deviceCalibrationDate: input.deviceCalibrationDate,
      })
      .returning({ id: bisMeasurements.id });

    // Crudos como pares nombre+valor. numeric se inserta como string para no perder precision
    // (convencion del proyecto, ver payments-writer). Medidos y derivados van en el MISMO insert
    // (misma transaccion, condicion 2): 'medido' es lo que trajo el equipo; 'derivado' lo que
    // reconstruyo la derivacion de composicion, con la version de la formula sellada por fila.
    const rows = [
      ...input.values.map((v) => ({
        measurementId: measurement.id,
        variableName: v.variableName,
        value: String(v.value),
        origin: "medido" as const,
        derivedFormulaVersion: null,
      })),
      ...input.derivedValues.map((v) => ({
        measurementId: measurement.id,
        variableName: v.variableName,
        value: String(v.value),
        origin: "derivado" as const,
        derivedFormulaVersion: input.derivedFormulaVersion,
      })),
    ];
    if (rows.length > 0) {
      await tx.insert(bisRawValues).values(rows);
    }

    // Log 'ok' INLINE: el registro del import exitoso es atomico con la medicion.
    await tx.insert(bisImportLogs).values({
      evaluationId: input.evaluationId,
      status: "ok",
      errorDetail: null,
    });

    // Audit inline (regla dura 8). Sin PII: solo ids y conteos. derived_count > 0 senala que ese archivo
    // venia CORTO (composicion reconstruida): sirve para saber despues que equipos exportan incompleto.
    await recordAudit(tx, {
      event: "bis.imported",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "bis_measurement",
      entityId: measurement.id,
      payload: {
        evaluation_id: input.evaluationId,
        variable_count: input.values.length,
        derived_count: input.derivedValues.length,
        // QUE FUE UN REEMPLAZO Y SOBRE CUAL, que es lo que hace auditable el porton nuevo: sin esto, un
        // reimport se ve igual que un import y no hay forma de saber que hubo una medicion antes.
        // Y NO VA EL NOMBRE DEL ARCHIVO (decision de Santiago, 2026-09-05). El rastro de QUE medicion se
        // reemplazo ya identifica el acto, y el nombre del xlsx suele traer el nombre del paciente: seria
        // meter PII en un log de auditoria que se conserva y se consulta por otras razones.
        replaced_measurement_ids: previas.map((m) => m.id),
      },
      ip: input.ip,
    });

    // ═══ EL ACTO DE IMPORTAR SOBRE UNA MEDICION QUE YA ESTABA, CON SU MOTIVO (2026-11-05) ═══
    //
    // VA EN SU PROPIO EVENTO y no como un campo de `bis.imported`: es un acto distinto, con su propia
    // gravedad, y la bandeja de administracion lo lee por el nombre del evento. Mezclado dentro del
    // import normal habria que recorrer todos los imports para encontrar los pocos que importan.
    //
    // INLINE, en la MISMA transaccion (regla dura 8 y 16): si el import se revierte, el acto no existio.
    // Un rastro escrito por fuera podria quedar afirmando una confirmacion que nunca se aplico.
    //
    // SIN PII, como todo el rastro: ids, la fecha de la otra toma y el motivo que escribio el profesional.
    // El motivo lo escribe una persona, asi que podria traer un nombre: se acota el largo y se deja
    // constancia de que es texto libre suyo, igual que los demas motivos del sistema.
    if (choqueAceptado) {
      await recordAudit(tx, {
        event: "bis.huella_repetida_confirmada",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "bis_measurement",
        entityId: measurement.id,
        payload: {
          evaluation_id: input.evaluationId,
          // CONTRA QUE CHOCA: la otra consulta y su medicion, para poder mirar las dos.
          otra_evaluacion_id: choqueAceptado.evaluationId,
          otra_medicion_id: choqueAceptado.measurementId,
          otra_fecha: choqueAceptado.fechaDeLaMedicion,
          del_mismo_paciente: choqueAceptado.esDelMismoPaciente,
          otro_paciente_es_de_prueba: choqueAceptado.esDePrueba,
          // Con un paciente de prueba no se pide motivo, y entonces no hay motivo que registrar: se dice
          // que no se pidio, en vez de dejar un hueco que se lea como "no lo escribio".
          motivo: choqueAceptado.esDePrueba
            ? null
            : (input.motivoDeLaHuella ?? "").trim().slice(0, MOTIVO_MAXIMO),
          confirmacion_requerida: !choqueAceptado.esDePrueba,
        },
        ip: input.ip,
      });
    }

    return {
      measurementId: measurement.id,
      valueCount: input.values.length,
      derivedCount: input.derivedValues.length,
      choqueAceptado,
    };
  });
}

export type BisImportFailureStatus = "parse_failed" | "validation_failed";

// Registra un import fallido en bis_import_logs (su proposito explicito). No es
// transaccional: no hay medicion que acompanar. El detalle nunca lleva PII (solo
// describe estructura o nombres de variable y valores fuera de rango). Se acota el
// largo por prudencia.
export async function logBisImportFailure(input: {
  evaluationId: string | null;
  status: BisImportFailureStatus;
  errorDetail: string;
}): Promise<void> {
  await db.insert(bisImportLogs).values({
    evaluationId: input.evaluationId,
    status: input.status,
    errorDetail: input.errorDetail.slice(0, 2000),
  });
}
