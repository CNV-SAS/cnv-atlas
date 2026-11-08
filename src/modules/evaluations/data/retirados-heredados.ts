import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { evaluations } from "@/db/schema";

import { insumosDeLaCnvs } from "./insumos-de-la-cnvs";
import { instrumentoDeLaConsulta } from "./instrumento-de-la-consulta";
import type { SurveyAnswer } from "./intake-writer";
import { getActiveSurvey } from "./survey-reader";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS ITEMS `retirar` CONSERVAN EL VALOR DE LA LINEA BASE  ·  v15 tabla 3  ·  2026-11-08
//
// ═══ EL CABLE QUE FALTABA, Y SE VIO MIDIENDO ANTES DEL SMOKE ═══
//
// El formulario FILTRA los cuatro `retirar` (sus items 35, 38, 41 y 63): no se le vuelven a preguntar al
// paciente, que es lo que su tabla 3 dice. Y su comentario decia que llegaban *"para que el envio sepa
// cuales arrastrar"*... y nadie los arrastraba: ningun input, ninguna copia en el servidor. O sea que una
// consulta CNV-S nacia SIN esas cuatro respuestas.
//
// Y UNA DE LAS CUATRO ALIMENTA EL DIAGNOSTICO. Medido contra la base: `d5_38` (familiares cercanos con
// estas enfermedades) tiene `used_in_diagnosis = true`, y la version del cuestionario declara 29 campos
// del diagnostico. Sin heredarla, TODA consulta CNV-S habria salido con *"Encuesta incompleta: faltan 1
// de 29 respuestas que usa el diagnostico"*, y el gate de emision la habria frenado. El primer smoke
// habria terminado en un seguimiento imposible de diagnosticar, con el defecto escondido en un item que
// nadie puede ver en pantalla porque no se presenta.
//
// ═══ POR QUE SE HEREDA EN EL SERVIDOR Y NO CON UN CAMPO OCULTO ═══
//
// Porque al paciente NO se le esta preguntando. Un `input hidden` haria que el dato viaje por el
// navegador de quien no lo contesto hoy, y lo que vale para los `confirmar` (ahi el paciente SI decide,
// pulsando "Sin cambios") no vale aqui. La herencia es una regla del instrumento, asi que la aplica
// quien conoce el instrumento.
//
// ═══ Y SOLO SE HEREDA LO QUE EXISTE ═══
//
// Sin respuesta anterior no se inventa nada: el item se queda sin responder y la encuesta sale incompleta
// por el camino de siempre, que es exactamente el caso de las 162 consultas importadas (la pregunta 42
// del documento de dudas, cuya salida A recomendamos: encuesta completa otra vez). Rellenar un vacio con
// un valor por defecto convertiria "nunca se le pregunto" en una respuesta clinica.
//
// NO HACE FALTA COLUMNA PARA SABER QUE SE HEREDO: la consulta sella su instrumento, y el instrumento dice
// que ese item era `retirar`. El hecho se deriva, y por eso no se guarda dos veces.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export async function retiradosHeredados(input: {
  resumeToken: string;
  /** Los `questionId` que el envio YA trae: lo que el paciente contesto hoy nunca se pisa. */
  yaRespondidas: Set<string>;
}): Promise<SurveyAnswer[]> {
  const [ev] = await db
    .select({
      id: evaluations.id,
      patientId: evaluations.patientId,
      instrumentoId: evaluations.surveyInstrumentId,
    })
    .from(evaluations)
    .where(eq(evaluations.resumeToken, input.resumeToken))
    .limit(1);
  // LINEA BASE: ni una consulta ni una ida mas a la base. Es el 99,9 % de lo que existe hoy.
  if (!ev?.instrumentoId) return [];

  const survey = await getActiveSurvey(await instrumentoDeLaConsulta(ev.id));
  const retirados = (survey?.questions ?? []).filter(
    (q) => q.comportamiento === "retirar" && q.fieldKey,
  );
  if (retirados.length === 0) return [];

  const { anteriores } = await insumosDeLaCnvs({ patientId: ev.patientId, excluyendo: ev.id });
  const heredadas: SurveyAnswer[] = [];
  for (const q of retirados) {
    if (input.yaRespondidas.has(q.id)) continue;
    const valor = (anteriores[q.fieldKey as string] ?? "").trim();
    if (valor === "") continue;
    heredadas.push({ questionId: q.id, answerValue: valor });
  }
  return heredadas;
}
