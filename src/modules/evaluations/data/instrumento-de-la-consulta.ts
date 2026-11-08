import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { evaluations, patients, surveyInstruments } from "@/db/schema";

import { CODIGO_LINEA_BASE, instrumentoParaLaConsulta } from "../instrumento";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE INSTRUMENTO LE TOCA A ESTA CONSULTA  ·  EL CABLE QUE FALTABA  ·  2026-11-08
//
// ═══ QUE PASABA SIN ESTO ═══
//
// Las cuatro acciones de la encuesta y sus tres pantallas llamaban a `getActiveSurvey()` sin codigo, o
// sea SIEMPRE la linea base. Con la CNV-S aplicandose a alguien, el formulario le habria mostrado el
// Modulo S y el envio lo habria descartado: `readAnswersFromForm` solo conserva las respuestas de las
// preguntas del instrumento que la accion consulto, y el Modulo S no esta en la linea base. El paciente
// las contesta y no se guardan, sin un solo error.
//
// ═══ POR QUE UN LECTOR Y NO UN PARAMETRO MAS EN CADA SITIO ═══
//
// Porque el dato que decide (que el paciente cuente como de prueba) NO esta en la pantalla ni en el
// formulario: esta en la base. Pasarlo desde el cliente seria dejar que quien contesta la encuesta
// influya en que cuestionario se le aplica.
//
// ═══ Y SI NO SE PUEDE RESOLVER, SE DEVUELVE LA LINEA BASE ═══
//
// Nunca se falla y nunca se devuelve la CNV-S a ciegas. El peor caso tiene que ser *"se le aplica la
// encuesta completa"*, que es lo que pasaba ayer y lo que siempre es correcto: un paciente que responde
// de mas no pierde ningun dato, y uno al que se le aplica la CNV-S sin poder confirmar su linea base
// pierde cuatro items para siempre.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El ID del instrumento que hay que SELLAR en un shell nuevo, o `null` para la linea base.
 *
 * `null` y no "el id de CNV v2.0" a proposito: el nulo dice la verdad (no se eligio instrumento, se
 * aplica el de siempre), y escribir un codigo afirmaria una eleccion que nadie hizo. Es la misma regla
 * que la columna.
 */
async function idDelInstrumento(codigo: string): Promise<string | null> {
  if (codigo === CODIGO_LINEA_BASE) return null;
  const [fila] = await db
    .select({ id: surveyInstruments.id })
    .from(surveyInstruments)
    .where(eq(surveyInstruments.codigo, codigo))
    .limit(1);
  return fila?.id ?? null;
}

/** Si el paciente cuenta como de prueba (con su derivada, 0202/0203). `false` si no existe. */
async function cuentaComoDePrueba(patientId: string): Promise<boolean> {
  const [p] = await db
    .select({ dePrueba: patients.cuentaComoDePrueba })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return Boolean(p?.dePrueba);
}

/**
 * EL INSTRUMENTO QUE LE TOCA A UN SHELL CREADO DESDE UN ENLACE, para sellarlo (0243).
 *
 * SE RESUELVE CON EL TIPO DEL **ENLACE**, no con el de la consulta que va a salir. Con el enlace
 * generico del consultorio la cedula se escribe DESPUES de pintar la pagina, asi que la consulta puede
 * acabar siendo un seguimiento mientras el paciente vio la encuesta completa. La pagina publica resuelve
 * esto mismo con los mismos dos datos, asi que las dos llegan al mismo resultado por construccion.
 */
export async function instrumentoDelEnlace(link: {
  type: "inicial" | "seguimiento";
  patientId?: string | null;
}): Promise<string | null> {
  return idDelInstrumento(await codigoDelInstrumentoDelEnlace(link));
}

/**
 * EL MISMO CALCULO, PERO EL CODIGO, para la pagina publica: ella no sella nada, PINTA.
 *
 * Son dos funciones sobre un solo calculo y no dos calculos: la pagina y el sellado tienen que llegar al
 * mismo instrumento por construccion, porque entre las dos no hay ninguna vuelta al servidor donde se
 * pudiera notar una diferencia.
 */
export async function codigoDelInstrumentoDelEnlace(link: {
  type: "inicial" | "seguimiento";
  patientId?: string | null;
}): Promise<string> {
  const esEnlaceDeSeguimiento = link.type === "seguimiento" && Boolean(link.patientId);
  if (!esEnlaceDeSeguimiento) return instrumentoParaLaConsulta("inicial", false);
  const dePrueba = await cuentaComoDePrueba(link.patientId as string);
  return instrumentoParaLaConsulta("seguimiento", dePrueba);
}

/**
 * EL INSTRUMENTO DE UN SEGUIMIENTO QUE SE ABRE SIN ENLACE GENERICO, para sellarlo.
 *
 * Son los dos caminos en que la consulta ES un seguimiento desde el primer momento: el enlace de
 * seguimiento del paciente y el que abre la profesional desde la ficha. En los dos, la pantalla ya sabe
 * lo que es, asi que no hay el desfase del enlace del consultorio.
 */
export async function instrumentoDeUnSeguimiento(patientId: string): Promise<string | null> {
  const dePrueba = await cuentaComoDePrueba(patientId);
  return idDelInstrumento(instrumentoParaLaConsulta("seguimiento", dePrueba));
}

// ── LOS DOS LECTORES: SE LEE EL SELLO, NO SE VUELVE A DEDUCIR ─────────────────────────────────────
//
// Es la mitad que de verdad cierra el defecto. Si una pantalla o una accion volviera a deducirlo del
// tipo de la consulta, podria llegar a un instrumento DISTINTO del que se le pinto al paciente, y
// ninguna de las dos fallaria: el formulario mostraria un cuestionario y el envio guardaria otro.

/** El codigo del instrumento SELLADO en una consulta. `CNV v2.0` cuando no hay sello o no se encuentra. */
export async function instrumentoDeLaConsulta(evaluationId: string): Promise<string> {
  const [fila] = await db
    .select({ codigo: surveyInstruments.codigo })
    .from(evaluations)
    .leftJoin(surveyInstruments, eq(surveyInstruments.id, evaluations.surveyInstrumentId))
    .where(eq(evaluations.id, evaluationId))
    .limit(1);
  return fila?.codigo ?? CODIGO_LINEA_BASE;
}

/**
 * El codigo del instrumento SELLADO en la consulta que abre un token de encuesta.
 *
 * SE EXIGE `awaiting_survey`, igual que `getSurveyProgress`: un token que ya no abre la encuesta no
 * tiene instrumento que servir, y devolver uno invitaria a pintar un formulario sobre una consulta
 * cerrada. Sin coincidencia se devuelve la linea base y el llamador falla donde ya fallaba.
 */
export async function instrumentoPorTokenDeEncuesta(resumeToken: string): Promise<string> {
  const [fila] = await db
    .select({ codigo: surveyInstruments.codigo })
    .from(evaluations)
    .leftJoin(surveyInstruments, eq(surveyInstruments.id, evaluations.surveyInstrumentId))
    .where(and(eq(evaluations.resumeToken, resumeToken), eq(evaluations.status, "awaiting_survey")))
    .limit(1);
  return fila?.codigo ?? CODIGO_LINEA_BASE;
}
