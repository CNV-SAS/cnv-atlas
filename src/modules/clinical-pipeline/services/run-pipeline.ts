import "server-only";

import * as Sentry from "@sentry/nextjs";

import { ClinicalInputError, computeProtocolo, runEngine, type ProtocoloSnapshot } from "@/clinical-engine";
import { resolveRutasContent } from "@/clinical-engine/rutas-content";
import { appError, err, ok, type Result } from "@/core/errors";
import { qcBiologicoDeLaConsulta } from "@/modules/bis/data/qc-biologico-reader";
import { getSealedValidityCaveats } from "@/modules/bis-intake/data/bis-conditions-reader";
import {
  circunferenciasParaDiagnosticar,
  condicionesParaDiagnosticar,
  insumosDelMotorParaDiagnosticar,
  mensajeDelInsumoClinico,
} from "@/modules/bis-intake/services/import-gate";

import { readActiveModel, readEfrContent, readPipelineInputs } from "../data/pipeline-reader";
import { PipelineAlreadyRunError, writePipeline } from "../data/pipeline-writer";
import { restriccionesDeLaEncuesta } from "@/modules/treatment/services/restricciones-de-la-encuesta";
import { buildEngineInput, edadParaDiagnosticar, sexoParaDiagnosticar } from "./build-engine-input";
import { formatIncompleteSurveyMessage } from "./survey-completeness";

// Orquesta la propagacion: leer insumos -> armar EngineInput -> runEngine (stub) ->
// persistir, todo mapeado a Result (el action no hace throw). La re-propagacion se
// mapea a conflicto. La autorizacion y el ownership ya se verificaron en el action.

export type RunPipelineInput = {
  evaluationId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type RunPipelineOutput = {
  diagnosisId: string;
  treatmentId: string;
  reportId: string;
  indicatorCount: number;
};

export async function runClinicalPipeline(
  input: RunPipelineInput,
): Promise<Result<RunPipelineOutput>> {
  const inputs = await readPipelineInputs(input.evaluationId);
  if (!inputs) return err(appError("not_found", "Evaluación no encontrada."));
  if (!inputs.hasBis) {
    return err(appError("validation", "La evaluación no tiene una medición BIS importada."));
  }
  if (!inputs.surveyVersionId) {
    return err(appError("validation", "La evaluación no tiene respuestas de encuesta."));
  }
  // Fail-loud (dfi.complete, regla 7): sin la lista declarada por la version no se puede medir
  // completitud, y NO se sella un complete que no se pudo evaluar. Es error de integridad (una
  // version siempre declara sus field_key), no un caso normal: se falla, no se cae a un default.
  if (inputs.expectedFieldKeys.length === 0) {
    return err(
      appError(
        "internal",
        "La versión de la encuesta no declara field_key; no se puede medir la completitud del diagnóstico.",
      ),
    );
  }

  // GATE de encuesta COMPLETA (Gildardo §1, 2026-08-13): NO se sella un diagnostico con encuesta
  // incompleta. Predicado = las 64 preguntas de la version respondidas (no solo las 13 del diagnostico;
  // §7 del 12, "no hay poda"). Es un precondicion: si la encuesta no esta completa, no se corre el motor
  // ni se sella. El aviso dice CUANTAS faltan y POR DOMINIO; `incompleteSurvey` marca el error para que el
  // action ofrezca el enlace a completarla. El guardado por partes del intake es otro flujo y NO se toca.
  // (La suspension Q28 queda como red, inalcanzable por esta via: el gate hace imposible sellar uno nuevo
  // incompleto.)
  if (inputs.surveyGaps.length > 0) {
    return err(
      appError("validation", formatIncompleteSurveyMessage(inputs.surveyGaps), {
        incompleteSurvey: "1",
      }),
    );
  }

  // LAS CONDICIONES DE LA TOMA, TAMBIEN AQUI (2026-09-22). Despues de la encuesta: si faltan las dos, se
  // dice primero la encuesta, con su lista por dominio, como hasta ahora. El boton "Importar medición BIS" ya las exige,
  // pero una medicion que llega por otro camino (la de un paciente importado del HTML) no pasa por el. Sin
  // este gate se diagnosticaria como si la toma no tuviera ningun reparo, que no es lo mismo que "no se
  // registraron". Es la misma regla del boton, en el sitio que ningun camino puede saltarse.
  const condiciones = condicionesParaDiagnosticar(inputs.bisConditions);
  if (!condiciones.allowed) return err(appError("validation", condiciones.message));

  // Y LA CINTURA Y LA CADERA, por la misma razon: la regla de negocio las exige y su guarda vivia solo en el
  // boton del XLSX. Un importado del HTML sin cadera se diagnosticaba igual.
  const circunferencias = circunferenciasParaDiagnosticar(inputs.circunferencias, inputs.importada);
  if (!circunferencias.allowed) return err(appError("validation", circunferencias.message));

  // Y LOS INSUMOS DEL MOTOR (2026-09-23). El lector de la fila ya los exige y LANZA, pero esa excepcion
  // hablaba de columnas de Excel y llegaba a la pantalla como "Algo salió mal". Mirarlos aqui convierte un
  // 500 en una frase que dice que falta y por que no se puede escribir a mano.
  const insumos = insumosDelMotorParaDiagnosticar(Object.keys(inputs.bisRaw), inputs.importada);
  if (!insumos.allowed) return err(appError("validation", insumos.message));

  // ═══ EL CORTA-PISO DEL CONTROL DE CALIDAD BIOLOGICO (su v12, 2026-10-29) ═══
  //
  // Su diseño dice *"la navegacion no deja salir de Antropometria"*, y en Atlas eso se cumple AQUI y no en
  // una pestaña: desde que se quito el boton de generar, el diagnostico se genera al ENTRAR a su pestaña
  // (Santiago, 2026-10-28). Un candado de navegacion seria saltable escribiendo la URL; este no.
  //
  // Es la misma estructura que las cinco puertas de arriba, y por la misma razon: la regla se mira donde
  // ningun camino puede saltarsela.
  //
  // LO QUE FRENA Y LO QUE NO:
  //   · frena GENERAR un diagnostico nuevo sobre una medicion fisicamente imposible;
  //   · NO frena la reemision por recalibracion cientifica, que no pasa por aqui. Es deliberado: esa no
  //     toma una medicion nueva, recalcula una ya emitida, y bloquearla dejaria esas consultas desfasadas
  //     para siempre sin que nadie pueda ponerlas al dia.
  //
  // SE USA EL MISMO LECTOR QUE PINTA EL PANEL, nunca una segunda comprobacion: si el gate midiera por su
  // cuenta, la pantalla podria decir que todo esta bien y el servidor negarse, que es el hazard 4 (dos
  // partes de la pantalla diciendo cosas opuestas porque leen fuentes distintas).
  const qc = await qcBiologicoDeLaConsulta(input.evaluationId);
  if (qc.hallazgos.length > 0 && !qc.visto) {
    return err(
      appError(
        "validation",
        qc.hallazgos.length === 1
          ? `La medición de esta consulta no es físicamente posible: ${qc.hallazgos[0].texto} Corrige el dato o vuelve a subir el Excel; si la medición es correcta tal como está, déjalo registrado en Antropometría y BIS.`
          : `La medición de esta consulta tiene ${qc.hallazgos.length} valores que no son físicamente posibles. Revísalos en Antropometría y BIS: corrige el dato, vuelve a subir el Excel, o déjalo registrado si la medición es correcta tal como está.`,
        // La bandera manda la salida a Antropometria y BIS, que es el unico sitio donde esto se resuelve.
        { qcBiologico: "1" },
      ),
    );
  }

  // Y EL SEXO, que es la QUINTA puerta y la que faltaba (Sentry, 2026-10-10). `normalizeSex` LANZA, y esta
  // llamada estaba fuera de todo try: la peticion moria con un 500 y el panel quedaba roto. Es el mismo
  // hueco que tenian las condiciones, la cintura y los insumos, y se cierra igual: la regla se mira aqui,
  // donde ningun camino puede saltarsela. Ver `sexoParaDiagnosticar`.
  const sexo = sexoParaDiagnosticar(inputs.sex);
  if (!sexo.allowed) {
    return err(
      appError(
        "validation",
        sexo.message,
        // La bandera es la que decide si el panel OFRECE la salida, y solo la lleva el caso que la ficha
        // puede arreglar. Un enlace que no resuelve nada es peor que ninguno.
        sexo.enLaFicha ? { faltaElSexo: "1" } : undefined,
      ),
    );
  }

  // Y LA EDAD, que es la SEXTA puerta y se abre por lo mismo que la del sexo (Gildardo, EB-BIS v7, tabla 1
  // errores 3 y 4; Santiago, 2026-10-24). `computeAge` devolvia 0 ante una fecha ausente o ilegible y ese 0
  // entraba al motor por cuatro sitios: inventaba el IAE, perdia la clasificacion de capacitancia y se
  // volvia 30 en el GEB de la cadena calorica. Ahora LANZA, asi que hace falta la puerta: un dato que falta
  // no es un fallo del sistema. Se mide a la fecha de la MEDICION, no a la de hoy.
  const edad = edadParaDiagnosticar(
    inputs.birthDate,
    inputs.measurementDate ? new Date(inputs.measurementDate) : new Date(),
  );
  if (!edad.allowed) {
    return err(
      appError(
        "validation",
        edad.message,
        // La bandera decide si el panel OFRECE la salida, y solo la lleva el caso que la ficha resuelve.
        edad.enLaFicha ? { faltaLaFechaDeNacimiento: "1" } : undefined,
      ),
    );
  }

  const model = await readActiveModel();
  if (!model) return err(appError("internal", "No hay una versión del modelo activa."));

  const engineInput = buildEngineInput(
    {
      sex: inputs.sex,
      birthDate: inputs.birthDate,
      measurementDate: inputs.measurementDate,
      surveyAnswers: inputs.surveyAnswers,
      expectedFieldKeys: inputs.expectedFieldKeys,
      bisRaw: inputs.bisRaw,
      gripStrengthKg: inputs.gripStrengthKg,
    },
    { version: model.versionName, rulesVersion: model.rulesVersion },
    new Date(),
  );

  // ═══ UN DATO MALO NO TUMBA LA PANTALLA (Sentry, 2026-10-02) ═══
  //
  // `runEngine` LANZA `ClinicalInputError` cuando un insumo esta fuera de rango fisiologico, y esta llamada
  // estaba fuera de todo `try`: la excepcion salia de la accion, la peticion moria con un 500, el render de
  // los Server Components se caia y la pantalla quedaba rota hasta navegar. En Sentry, 19 eventos del mismo
  // caso (`C=16.22`, rango 0,3-8): alguien lo intento diecinueve veces porque no veia ninguna explicacion.
  //
  // EL FRENO ES CORRECTO Y NO SE TOCA: ese valor no es fisiologico y no debe entrar al motor (y el rango es de
  // Gildardo, congelado). Lo que estaba mal es que un dato rechazado se tratara como un fallo del sistema.
  //
  // SE TRADUCE, NO SE REPITE LA REGLA: las puertas de arriba miran lo que FALTA y no los rangos. Agregar una
  // cuarta puerta que los repita seria la misma regla en dos sitios, capaz de divergir del motor. El motor
  // sigue siendo el unico que decide; aqui solo se convierte su grito en una frase con salida.
  let output: ReturnType<typeof runEngine>;
  try {
    output = runEngine(engineInput);
  } catch (e) {
    if (e instanceof ClinicalInputError) {
      return err(appError("validation", mensajeDelInsumoClinico(e, inputs.importada)));
    }
    throw e; // inesperado: que suba
  }

  // Protocolo sugerido (T2 A3): PURO, se computa aqui (fuera de la transaccion) y se SELLA en
  // writePipeline. Un fallo del protocolo NO degrada el diagnostico: se sella protocol_suggested =
  // null. Se elige NULL, no un objeto de error, porque el trigger permite null -> valor: el backfill
  // sigue posible tras arreglar el bug (un objeto de error, congelado, cerraria esa via). El
  // profesional lo maneja en T2b (mensaje explicito). En la practica no se alcanza: peso/talla son
  // ENGINE_REQUIRED. RASTRO del fallo, para que uno sistematico no sea invisible: (1) audit log
  // protocol.compute_failed, durable y queryable en BD (lo escribe writePipeline inline, regla 8), y
  // (2) Sentry, la ALERTA en prod (un console.error en Vercel rota y nadie lo mira). El motivo es de
  // nivel motor (nombres de campo/rango), no PII, y Sentry ademas scrubbea.
  let protocolSuggested: ProtocoloSnapshot | null = null;
  let protocolFailMotive: string | null = null;
  try {
    protocolSuggested = computeProtocolo(engineInput, output);
    if (!protocolSuggested) {
      protocolFailMotive = "computeProtocolo devolvio null (sin composición mínima: peso/talla)";
    }
  } catch (e) {
    protocolFailMotive = e instanceof Error ? e.message : String(e);
    Sentry.captureException(e, {
      tags: { area: "protocol-compute", evaluationId: input.evaluationId },
    });
    console.error(`[pipeline] computeProtocolo fallo (evaluacion ${input.evaluationId}):`, e);
  }

  // (ii) Contenido clinico del estado EFR, leido del registry por BANDAS al diagnosticar, para
  // CONGELARLO en el snapshot: la vista de resultados no re-deriva evidencia del registry vivo.
  // Es REQUERIDO: un estado con bandas validas siempre existe en el registry; si faltara, es un
  // problema de integridad del registry y se falla fuerte (no se persiste un snapshot a medias).
  const efrContent = await readEfrContent(model.id, output.efrPhenotype.bands);
  if (!efrContent) {
    return err(
      appError("internal", "El registry no tiene el contenido del estado EFR diagnosticado."),
    );
  }

  // Caveats de validez (de las condiciones de la toma BIS selladas), para congelarlos en el
  // snapshot: bajo que condicion(es) que comprometen la validez se hizo la medicion.
  const validityCaveats = await getSealedValidityCaveats(input.evaluationId);

  // Contenido de las rutas de atencion ACTIVAS (verbatim de Gildardo), para congelarlo en el
  // snapshot: lo que se prescribio ese dia. Se resuelve de dfi.rutas (ids) al contenido.
  const rutasContent = resolveRutasContent(output.dfi.rutas);

  try {
    const written = await writePipeline({
      evaluationId: input.evaluationId,
      patientId: inputs.patientId,
      evaluationType: inputs.evaluationType,
      output,
      efrContent,
      validityCaveats,
      rutasContent,
      protocolSuggested,
      protocolFailMotive,
      // LA PRECARGA DE RESTRICCIONES sale de las MISMAS respuestas que alimentan el motor, ya leidas: no
      // hay una segunda lectura de la encuesta que pudiera ver otra version.
      restriccionesIniciales: restriccionesDeLaEncuesta(
        inputs.surveyAnswers.map((a) => ({ fieldKey: a.fieldKey, valor: a.value })),
      ),
      surveyVersionId: inputs.surveyVersionId,
      modelVersionId: model.id,
      indicatorDefIdByCode: model.indicatorDefIdByCode,
      phenotypeIdByKey: model.phenotypeIdByKey,
      frSectorIdByKey: model.frSectorIdByKey,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
    });
    return ok(written);
  } catch (e) {
    if (e instanceof PipelineAlreadyRunError) {
      return err(appError("conflict", "Esta evaluación ya tiene un diagnóstico generado."));
    }
    throw e; // inesperado: que suba (lo captura el action / Sentry)
  }
}
