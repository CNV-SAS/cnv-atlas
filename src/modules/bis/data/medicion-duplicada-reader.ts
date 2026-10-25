import "server-only";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { bisMeasurements, bisRawValues, clinicalCorrections, evaluations } from "@/db/schema";

import {
  huellaDeLaMedicion,
  valorParaBuscarCandidatos,
  VARIABLES_DE_LA_HUELLA,
  type ValorCrudo,
} from "../services/huella-de-la-medicion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL FRENO: ¿ESTA MISMA TOMA YA ESTA EN LA BASE?  (Santiago, 2026-10-24)
//
// *"Que una misma medicion (por huella de los crudos) no se pueda importar a una segunda evaluacion, ni del
// mismo paciente ni de otro. Si hay una excepcion legitima (la copia del flujo de correccion), que sea la
// unica."*
//
// ═══ COMO BUSCA, Y POR QUE ASI ═══
//
//   1. CANDIDATOS POR INDICE: las mediciones que tienen el mismo valor de Re. Es una lectura del equipo con
//      varias cifras significativas, asi que esto deja dos o tres filas, no cuatrocientas.
//   2. COMPARA LA HUELLA COMPLETA EN TypeScript, con LA MISMA funcion que la construye. La alternativa era
//      escribir la comparacion en SQL, y entonces habria dos definiciones de "es la misma medicion" capaces
//      de divergir: la de la huella y la del freno.
//
// ═══ LAS DOS EXCEPCIONES, Y SOLO ESAS ═══
//
//   1. LA CADENA DE CORRECCION. Cuando una evaluacion se corrige, la nueva se queda con una COPIA de la
//      medicion (asi tiene que ser: la toma fisica ocurrio una vez). Esas dos evaluaciones estan unidas en
//      `clinical_corrections`, asi que el freno ignora un choque dentro de esa cadena.
//   2. LA MEDICION QUE CONSTA COMO DE OTRO PACIENTE (0226). Al corregir el caso 6, la toma se queda
//      colgada de la evaluacion reemplazada y marcada; si siguiera frenando, bloquearia al DUENO DE VERDAD
//      cuando importe su propio archivo. Era el agujero de la primera version del freno.
//
// Las dos son NOMBRADAS y verificables (una relacion y una marca auditada), no un permiso general:
// cualquier otro choque frena.
//
// ═══ LO QUE EL MENSAJE NO PUEDE DECIR ═══
//
// Si la medicion pertenece a OTRO paciente, el mensaje no dice a quien. Quien esta importando puede no tener
// acceso a esa historia clinica, y decirle el nombre seria filtrar PII de un tercero para avisarle de un
// error. Lo que necesita saber es que ESE archivo es de otra persona, y eso si se dice.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type MedicionYaRegistrada = {
  /** La medicion que ya tiene esos mismos crudos. */
  measurementId: string;
  evaluationId: string;
  /** Si la evaluacion que ya la tiene es del MISMO paciente (entonces se puede decir cual). */
  esDelMismoPaciente: boolean;
  /** 'AAAA-MM-DD' de la toma que ya esta registrada, o null si no la trae. */
  fechaDeLaMedicion: string | null;
  /** Vino de un lote del HTML (`import_batch_id` no nulo). */
  importada: boolean;
};

export async function buscarLaMismaMedicion(
  tx: DbTransaction,
  input: {
    /** La evaluacion a la que se esta importando: sus propias mediciones no cuentan como choque. */
    evaluationId: string;
    /** El paciente de esa evaluacion, para poder decir si el choque es suyo o de otra historia. */
    patientId: string;
    valores: readonly ValorCrudo[];
  },
): Promise<MedicionYaRegistrada | null> {
  const huella = huellaDeLaMedicion(input.valores);
  const paraBuscar = valorParaBuscarCandidatos(input.valores);
  // NO SE PUEDE COMPARAR -> NO SE FRENA. Frenar por no poder comparar seria frenar lo que no se sabe.
  if (huella === null || paraBuscar === null) return null;

  const candidatos = await tx
    .selectDistinct({ measurementId: bisRawValues.measurementId })
    .from(bisRawValues)
    .where(
      and(
        eq(bisRawValues.variableName, VARIABLES_DE_LA_HUELLA[0]),
        sql`${bisRawValues.value} = ${String(paraBuscar)}::numeric`,
      ),
    );
  if (candidatos.length === 0) return null;

  const ids = candidatos.map((c) => c.measurementId);
  const filas = await tx
    .select({
      measurementId: bisMeasurements.id,
      evaluationId: bisMeasurements.evaluationId,
      measurementDate: bisMeasurements.measurementDate,
      importBatchId: bisMeasurements.importBatchId,
      patientId: evaluations.patientId,
      variableName: bisRawValues.variableName,
      value: bisRawValues.value,
    })
    .from(bisMeasurements)
    .innerJoin(evaluations, eq(evaluations.id, bisMeasurements.evaluationId))
    .innerJoin(bisRawValues, eq(bisRawValues.measurementId, bisMeasurements.id))
    .where(
      and(
        inArray(bisMeasurements.id, ids),
        inArray(bisRawValues.variableName, VARIABLES_DE_LA_HUELLA),
        sql`${bisMeasurements.evaluationId} <> ${input.evaluationId}`,
        // LA MEDICION QUE CONSTA COMO DE OTRO PACIENTE NO FRENA (0226). Es la segunda excepcion, y es
        // la razon de ser de esa marca: cuando se corrige el caso 6, la toma se queda colgada de la
        // evaluacion reemplazada, y sin esto el freno bloquearia al DUENO DE VERDAD al importar su
        // propio archivo, diciendole que es de otra persona. Cierto, pero al reves.
        //
        // Y no es un permiso general como lo seria ignorar todas las reemplazadas: la marca la puso el
        // profesional asignado, con motivo, en una correccion auditada y write-once.
        isNull(bisMeasurements.noEsDelPacienteAt),
      ),
    );

  // Se agrupan los crudos por medicion para poder construir SU huella con la misma funcion.
  const porMedicion = new Map<
    string,
    {
      evaluationId: string;
      patientId: string;
      measurementDate: Date | null;
      importBatchId: string | null;
      valores: ValorCrudo[];
    }
  >();
  for (const f of filas) {
    const actual = porMedicion.get(f.measurementId) ?? {
      evaluationId: f.evaluationId,
      patientId: f.patientId,
      measurementDate: f.measurementDate,
      importBatchId: f.importBatchId,
      valores: [],
    };
    actual.valores.push({ variableName: f.variableName, value: f.value });
    porMedicion.set(f.measurementId, actual);
  }

  const choques = [...porMedicion.entries()].filter(
    ([, m]) => huellaDeLaMedicion(m.valores) === huella,
  );
  if (choques.length === 0) return null;

  // LA EXCEPCION DE LA CADENA DE CORRECCION, y solo esa: la evaluacion nueva se queda con una copia de la
  // medicion de la vieja, y las dos estan unidas en `clinical_corrections`.
  const enLaCadena = await tx
    .select({
      oldEvaluationId: clinicalCorrections.oldEvaluationId,
      newEvaluationId: clinicalCorrections.newEvaluationId,
    })
    .from(clinicalCorrections)
    .where(
      or(
        eq(clinicalCorrections.oldEvaluationId, input.evaluationId),
        eq(clinicalCorrections.newEvaluationId, input.evaluationId),
      ),
    );
  const parientes = new Set<string>();
  for (const c of enLaCadena) {
    parientes.add(c.oldEvaluationId);
    parientes.add(c.newEvaluationId);
  }

  const deVerdad = choques.filter(([, m]) => !parientes.has(m.evaluationId));
  if (deVerdad.length === 0) return null;

  // SI HAY VARIOS, SE AVISA DEL DE OTRO PACIENTE PRIMERO: es el caso grave (un dato de salud en la historia
  // de otra persona), y el que quien importa tiene que escalar en vez de resolver solo.
  const [measurementId, m] =
    deVerdad.find(([, x]) => x.patientId !== input.patientId) ?? deVerdad[0];

  return {
    measurementId,
    evaluationId: m.evaluationId,
    esDelMismoPaciente: m.patientId === input.patientId,
    fechaDeLaMedicion: m.measurementDate ? m.measurementDate.toISOString().slice(0, 10) : null,
    importada: m.importBatchId != null,
  };
}

/** El mensaje para quien esta importando. Nunca nombra al otro paciente (ver la cabecera). */
export function mensajeDeLaMedicionDuplicada(choque: MedicionYaRegistrada): string {
  const cuando = choque.fechaDeLaMedicion ? ` del ${choque.fechaDeLaMedicion}` : "";
  if (choque.esDelMismoPaciente) {
    return (
      `Esta misma medición ya está registrada en otra consulta de este paciente${cuando}, con los mismos ` +
      "valores del equipo hasta el último decimal, así que no es una toma nueva. Si quieres cambiar la " +
      "medición de esa consulta, se hace por el flujo de corrección; si de verdad hay una toma nueva, " +
      "vuelve a exportarla desde Biody Manager."
    );
  }
  return (
    `Esta misma medición ya está registrada en la historia clínica de OTRO paciente${cuando}, con los ` +
    "mismos valores del equipo hasta el último decimal. Lo más probable es que el archivo sea de otra " +
    "persona. No se importa: avísale a CNV con este mensaje para que se revise, porque si ya se usó para " +
    "un diagnóstico hay que corregirlo."
  );
}
