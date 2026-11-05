import "server-only";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { bisMeasurements, bisRawValues, clinicalCorrections, evaluations, patients } from "@/db/schema";

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
// ═══ Y DESDE EL 2026-11-05 YA NO FRENA: AVISA (Santiago) ═══
//
// *"No pude terminar el smoke porque mi archivo de pruebas coincide con un paciente del 13-jul, y el freno
// dice «No se importa». Y me va a pasar igual en el smoke comercial, que se hace con pacientes que cuentan
// como reales hasta que se marcan al final."*
//
// Un freno sin salida no es un guard: detiene a una persona. Y este detenia a quien tiene que PROBAR el
// sistema, que es el peor momento para detenerlo, porque el smoke es lo unico que atrapa la clase de
// defecto que no ve ningun test. Asi que ahora el choque tiene TRES desenlaces segun con QUIEN choca:
//
//   1. SOLO CON PACIENTES DE PRUEBA -> no frena nada. Avisa y sigue, igual que el aviso de la lista: un
//      paciente de prueba no tiene historia clinica que proteger.
//   2. CON UN PACIENTE REAL -> avisa, pide CONFIRMACION EXPLICITA CON MOTIVO, deja seguir, lo REGISTRA en
//      el rastro clinico y le avisa a quien administra. No bloquea, porque el caso legitimo existe (dos
//      tomas identicas hasta el ultimo decimal son improbables, no imposibles) y porque el sistema no
//      puede saber cual de los dos es.
//   3. El AVISO DE MEDICION REPETIDA sigue saliendo despues, en la consulta, hasta que se corrija. Esa es
//      la parte que no cambia: el freno se abre, la señal se queda.
//
// LO QUE NO SE PIERDE AL ABRIRLO: el acto queda con nombre, motivo y fecha, y la administracion se entera
// sin que nadie se lo cuente. Un freno que nadie puede saltar se salta por fuera del sistema (pidiendo
// que alguien borre la otra medicion) y entonces no queda rastro de nada.
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
  /**
   * LA OTRA CONSULTA ES DE UN PACIENTE DE PRUEBA.
   *
   * Decide el desenlace: con un paciente de prueba no hay historia clinica que proteger, asi que el choque
   * es un aviso y nada mas. Con uno REAL hace falta confirmacion con motivo. Es la unica pregunta que
   * separa "esto detiene un smoke" de "esto protege a un paciente".
   */
  esDePrueba: boolean;
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
      // SI EL OTRO PACIENTE ES DE PRUEBA (2026-11-05): es lo que decide si el choque frena o solo avisa.
      esDePrueba: patients.cuentaComoDePrueba,
      variableName: bisRawValues.variableName,
      value: bisRawValues.value,
    })
    .from(bisMeasurements)
    .innerJoin(evaluations, eq(evaluations.id, bisMeasurements.evaluationId))
    .innerJoin(patients, eq(patients.id, evaluations.patientId))
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
      esDePrueba: boolean;
      measurementDate: Date | null;
      importBatchId: string | null;
      valores: ValorCrudo[];
    }
  >();
  for (const f of filas) {
    const actual = porMedicion.get(f.measurementId) ?? {
      evaluationId: f.evaluationId,
      patientId: f.patientId,
      esDePrueba: f.esDePrueba,
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

  // ═══ CUAL CHOQUE SE REPORTA, Y EL ORDEN ES LA MITAD DE LA DECISION ═══
  //
  // Primero el de OTRO paciente REAL: es el caso grave (un dato de salud en la historia de otra persona) y
  // el que exige confirmacion con motivo. Despues cualquier otro real. Y solo si no hay ninguno real, uno
  // de prueba, que es el que no frena nada.
  //
  // IMPORTA QUE ESTE ORDEN SEA ASI Y NO EL DE LLEGADA: si el archivo choca con un paciente de prueba Y con
  // uno real, reportar el de prueba dejaria pasar el import sin confirmacion sobre un choque que SI toca
  // una historia clinica. El desenlace lo decide el choque mas grave, no el primero que aparezca.
  const reales = deVerdad.filter(([, x]) => !x.esDePrueba);
  const [measurementId, m] =
    reales.find(([, x]) => x.patientId !== input.patientId) ?? reales[0] ?? deVerdad[0];

  return {
    measurementId,
    evaluationId: m.evaluationId,
    esDelMismoPaciente: m.patientId === input.patientId,
    fechaDeLaMedicion: m.measurementDate ? m.measurementDate.toISOString().slice(0, 10) : null,
    importada: m.importBatchId != null,
    esDePrueba: m.esDePrueba,
  };
}

/**
 * El mensaje para quien esta importando. Nunca nombra al otro paciente (ver la cabecera).
 *
 * TRES DESENLACES, TRES TEXTOS, y cada uno dice QUE PASA AHORA, no solo que se encontro. Un aviso que
 * describe un hallazgo sin decir que hacer con el deja a quien importa adivinando.
 */
export function mensajeDeLaMedicionDuplicada(choque: MedicionYaRegistrada): string {
  const cuando = choque.fechaDeLaMedicion ? ` del ${choque.fechaDeLaMedicion}` : "";

  // 1 · SOLO DE PRUEBA: no frena. Se dice para que nadie crea que el dato entro limpio, y se sigue.
  if (choque.esDePrueba) {
    return (
      `Esta misma medición ya está registrada en una consulta de un paciente de PRUEBA${cuando}. Se ` +
      "importa igual: un paciente de prueba no tiene historia clínica que proteger. Si esperabas que " +
      "este archivo fuera de un paciente real, revísalo antes de diagnosticar."
    );
  }

  // 2 · MISMO PACIENTE, REAL: pide confirmacion. El camino limpio existe (el flujo de correccion), asi
  // que se nombra primero; pero no se bloquea, porque dos tomas identicas hasta el ultimo decimal son
  // improbables, no imposibles.
  if (choque.esDelMismoPaciente) {
    return (
      `Esta misma medición ya está registrada en otra consulta de este paciente${cuando}, con los mismos ` +
      "valores del equipo hasta el último decimal, así que no parece una toma nueva. Si quieres cambiar " +
      "la medición de esa consulta, se hace por el flujo de corrección; si de verdad hay una toma nueva, " +
      "vuelve a exportarla desde Biody Manager. Si aun así es correcto importarla aquí, escribe el motivo " +
      "y confírmalo: queda registrado."
    );
  }

  // 3 · OTRO PACIENTE, REAL: el caso grave. Se dice lo que esta en juego y se pide confirmacion con
  // motivo. Ya no dice "No se importa": decirlo era detener a quien prueba el sistema, y el acto
  // confirmado queda con nombre, motivo y aviso a la administracion.
  return (
    `Esta misma medición ya está registrada en la historia clínica de OTRO paciente${cuando}, con los ` +
    "mismos valores del equipo hasta el último decimal. Lo más probable es que el archivo sea de otra " +
    "persona, y si se usa para un diagnóstico, ese diagnóstico describiría a alguien más. Avísale a CNV " +
    "con este mensaje. Si estás seguro de que esta medición es de este paciente, escribe el motivo y " +
    "confírmalo: queda registrado y la administración recibe el aviso."
  );
}

/**
 * ¿Este choque exige confirmacion explicita, o solo se avisa?
 *
 * UNA SOLA FUENTE para la pregunta, porque la contestan TRES sitios (el escritor, que decide si frena; el
 * servicio, que decide que Result devuelve; y la pantalla, que decide si pide el motivo). Tres copias de
 * esta condicion es como una superficie acaba pidiendo un motivo que el escritor no exige, o al reves.
 */
export function pideConfirmacion(choque: MedicionYaRegistrada): boolean {
  return !choque.esDePrueba;
}
