import "server-only";

import type { EngineOutput } from "@/clinical-engine";
import { runEngine } from "@/clinical-engine";

import { buildEngineInput } from "../services/build-engine-input";
import { readActiveModel, readPipelineInputs } from "./pipeline-reader";

// SIMULA el diagnóstico de una evaluación CON LA CIENCIA QUE RIGE HOY, sin escribir nada.
//
// PARA QUE EXISTE. Su §12b dice que la reemisión es obligatoria cuando el paciente CAMBIA DE BANDA, y que
// "el criterio es el RESULTADO, no el tipo de cambio". Saber el resultado exige calcularlo: sin esto solo
// podríamos decir qué VERSIÓN se movió, que es exactamente lo que él dice que NO decide.
//
// NO ESCRIBE, Y ESO ES LA MITAD DEL DISEÑO. Un diagnóstico emitido con ciencia anterior sigue siendo
// válido y no se reescribe solo: recalcular en silencio borra el rastro, que es lo que él prohibió en la
// otra mitad de la misma instrucción. Esto solo MIRA, para poder decirle al profesional si tiene que
// reemitir. La reemisión sigue siendo un acto suyo.
//
// DEVUELVE null Y NO LANZA. Es una lectura de apoyo para un aviso, no un camino crítico: si los insumos
// no alcanzan (evaluación sin BIS, sin encuesta, sin modelo activo) o el motor no puede correr, el
// llamador se queda sin comparación y cae a "solo marcar", que es la conducta ya vigente. Hacerla lanzar
// tumbaría la página de una evaluación vieja por un aviso.
export async function simularConCienciaDeHoy(
  evaluationId: string,
): Promise<EngineOutput | null> {
  try {
    const [inputs, model] = await Promise.all([
      readPipelineInputs(evaluationId),
      readActiveModel(),
    ]);
    if (!inputs || !model || !inputs.hasBis) return null;

    const engineInput = buildEngineInput(
      {
        sex: inputs.sex,
        birthDate: inputs.birthDate,
        surveyAnswers: inputs.surveyAnswers,
        expectedFieldKeys: inputs.expectedFieldKeys,
        bisRaw: inputs.bisRaw,
        gripStrengthKg: inputs.gripStrengthKg,
      },
      { version: model.versionName, rulesVersion: model.rulesVersion },
      new Date(),
    );
    return runEngine(engineInput);
  } catch {
    // Silencioso A PROPOSITO, y es la excepción a la regla de no tragarse errores: el consumidor es un
    // aviso informativo. Un fallo aquí no puede impedir que el profesional vea el diagnóstico que ya
    // existe. Lo que NO hace es afirmar "al día": devolver null lleva al llamador a "solo marcar".
    return null;
  }
}
