import "server-only";

import { ColaDelProveedorError } from "@/lib/ai/reintento-tope";
import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { computeProtocoloEfectivo, isEngineOutput } from "@/clinical-engine";
import { diaInicioDerivado, semanaEfectiva } from "@/clinical-engine/menu-ciclo";
import { TIEMPOS_DEF } from "@/clinical-engine/tiempos";
import { resolveAiConfig } from "@/lib/ai/config";
import { getActivePrompt } from "@/lib/ai/prompts";
import { AiError, generateText } from "@/lib/ai/provider";
import { reportServerError } from "@/lib/observability/report-error";
import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";

import { getTreatmentProtocol } from "../data/treatment-reader";
import { recordMenuSuggestion, type MenuSuggestionStatus } from "../data/menu-writer";
import { requireNutricionista } from "./require-profession";
import { getPrescripcionNutricional, getProtKgPrescrito } from "../data/dieta-resumen-reader";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { patronDeclarado } from "./patron-declarado";

import {
  buildMenuAdaptarPrompt,
  MENU_PROMPT_KEY,
  MENU_PROMPT_VERSION,
  parseCambiosMenu,
  verificarCita,
} from "../ai/prompts/menu.v4";

// ADAPTACION del menu por IA (contrato v4, su §13). LA IA YA NO COMPONE: recibe la semana que el
// profesional tiene delante (el ciclo de 21 dias con sus ediciones) y devuelve SOLO las celdas que
// incumplen una restriccion, con la sustitucion y su motivo.
//
// Y NO SE LLAMA SI NO HAY RESTRICCIONES, que es literalmente su instruccion: "la IA solo lo adapta CUANDO
// HAY RESTRICCIONES". Sin ninguna, el ciclo YA es el menu correcto y llamar al modelo seria gastar por
// nada y abrir la puerta a que cambie algo que no habia que cambiar.
//
// (Historico) Arma el contrato SOLO con
// variables clinicas y objetivos (barrera PII estructural, regla 15): fenotipo, sector,
// rutas y los objetivos del protocolo; jamas nombre, documento ni contacto. Llama a la
// infra de B12 (provider con timeout + fallback) y persiste SIEMPRE una fila en
// ai_menu_suggestions (exito o fallo) para dejar procedencia. La sugerencia es un borrador:
// nunca se aplica al protocolo automaticamente, el profesional decide.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

function classifyFailure(e: unknown): MenuSuggestionStatus {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /timeout|timed out|abort/i.test(msg) ? "timeout" : "provider_error";
}

// `sin_restricciones` NO es un estado de sugerencia (no hubo intento, no hay fila que registrar): es una
// respuesta del servicio. Por eso el Result lo lleva aparte del enum de la tabla.
export type ResultadoAdaptacion = MenuSuggestionStatus | "sin_restricciones" | "truncado";

/**
 * TOPE DE SALIDA DE ESTA LLAMADA, y es propio porque el trabajo tambien lo es.
 *
 * EL DEFECTO (smoke Santiago, 2026-09-10): con DOS restricciones el menu fallaba con "Respuesta
 * invalida" y el JSON se veia bien formado. Lo estaba: llegaba CORTADO. Verificado en la fila de
 * produccion (texto que termina a media cadena, 29 llaves abiertas contra 27 cerradas, `JSON.parse`
 * rompiendo en la posicion 4037), no razonado.
 *
 * ESTA LLAMADA ES LA MAS LARGA DE ATLAS: una semana entera de sustituciones, y su tamaño crece con las
 * restricciones del paciente (1 restriccion -> 8 entradas; una compuesta -> 14; dos -> 28-30). El
 * borrador de criterio, que comparte el proveedor, escribe parrafos y no se acerca. Un tope unico
 * obligaba a elegir entre los dos.
 *
 * EL DOBLE DEL PEOR CASO MEDIDO, a proposito: el modelo devuelve UNA ENTRADA POR RESTRICCION
 * INCUMPLIDA (por eso una celda que rompe dos sale dos veces), asi que el trabajo se multiplica por el
 * numero de restricciones y no por el de celdas.
 */
const MAX_TOKENS_MENU = 8192;

export async function generateMenu(
  evaluationId: string,
  actor: Actor,
): Promise<Result<{ status: ResultadoAdaptacion }>> {
  const [protocol, results] = await Promise.all([
    getTreatmentProtocol(evaluationId),
    getEvaluationResults(evaluationId),
  ]);
  if (!protocol || !results) return err(appError("not_found", "Tratamiento no encontrado."));
  // Guard interino de ambito de practica: sin profesion configurada no se escribe (generar el
  // menu persiste una sugerencia). Ver require-profession.ts.
  const prof = await requireNutricionista(actor.actorId);
  if (!prof.ok) return err(prof.error);
  // SIN GATE DE CONFIRMACION (2026-09-09), igual que el resto de la prescripcion: que `protocol` exista
  // significa que hay diagnostico.
  // El objetivo YA NO es un input manual (checkpoint 2, colapso de los dos objetivos): sale de la CADENA
  // CALORICA, fuente unica. Se recomputa el efectivo con los ajustes del profesional sobre el snapshot
  // sellado, la MISMA funcion que sella la aprobacion. La cadena SIEMPRE produce un objetivo (kcalObj =
  // override ?? GET de mantenimiento), asi que el viejo bloqueo "objetivo nulo" ya no aplica; lo que si
  // puede faltar es el snapshot (tratamiento pre-snapshot): sin el no hay cadena que computar. Guarda
  // defensiva contra el null-deref, no un gate de "guarda el objetivo".
  if (!protocol.protocolSuggested) {
    return err(
      appError("conflict", "El protocolo aún no se ha calculado; no se puede generar el menú."),
    );
  }
  // El menu se arma desde el snapshot; si es de una era anterior del motor no tiene la forma
  // esperada (fenotipo/sector/rutas). Se bloquea con un mensaje claro en vez de tronar.
  //
  // SUBIO AQUI (barrido del 2026-09-06): estaba DESPUES de la cadena, y la cadena ahora necesita los
  // indicadores del snapshot para resolver la proteina del motor. El orden es el mismo que tiene la
  // pagina: primero se comprueba que el diagnostico sirve, despues se calcula sobre el.
  if (!isEngineOutput(results.snapshot)) {
    return err(
      appError(
        "conflict",
        "El diagnóstico de esta evaluación tiene un formato anterior. Realiza una nueva evaluación para generar el menu.",
      ),
    );
  }

  // LA PROTEINA DEL MOTOR, para los snapshots anteriores al sellado del 2026-09-03 (barrido del
  // 2026-09-06). Faltaba, y a diferencia de los otros dos sitios del mismo barrido aqui SI mueve una
  // cifra que viaja: `efectivo.calorico.protG` es el objetivo de proteina que se le manda al modelo en
  // `proteinaGramos`. Sin esta opcion la cadena cae a `protMin` y el menu se armaba contra un gramaje
  // distinto del que el nutricionista tiene delante y del que el paciente recibe en su plan.
  const protKgVigente = await getProtKgPrescrito(
    evaluationId,
    results.snapshot.sexo,
    results.snapshot.indicators as unknown as Record<string, unknown>,
  );

  const efectivo = computeProtocoloEfectivo(protocol.protocolSuggested, {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    deficit: protocol.adjDeficit,
    // El peso meta que gobierna, de su sitio unico (migracion 0095): el menu se arma sobre las mismas
    // calorias y los mismos gramos de proteina que ve el nutricionista.
    pesoMeta: protocol.pesoMetaFijado,
  }, { protKgVigente });

  // Prompt de sistema: prefiere la version activa en BD (editable por admin, B14); si no hay,
  // cae al texto canonico en codigo. La procedencia guardada refleja la version usada.
  const activePrompt = await getActivePrompt(MENU_PROMPT_KEY);
  // Procedencia con las DOS versiones, que son independientes: "@N" es la del texto de SISTEMA (la
  // que el admin edita en BD; 1 si no hay ninguna activa) y "+uM" la del CONTRATO en codigo (el
  // mensaje de usuario, menu.vM.ts). Antes solo se guardaba la del sistema, asi que un cambio del
  // contrato -como el bloque de restricciones del modelo, v2- habria quedado registrado como si el
  // prompt no hubiera cambiado.
  const promptVersion = `${MENU_PROMPT_KEY}@${activePrompt?.version ?? 1}+u${MENU_PROMPT_VERSION}`;

  const { structural, frSector, dfi } = results.snapshot;
  // Contrato PII-free: solo objetivos y variables clinicas seudonimizadas. El texto de
  // sistema es lo unico parametrizable; el mensaje de usuario se arma dentro de buildMenuPrompt.
  // PATRON ALIMENTARIO declarado (3.2b de Gildardo del 26): sin esto el generador le propone carne a un
  // vegano. Es leer un campo de la encuesta, no una tabla de exclusiones (ver patron-declarado).
  const dominios = await getSurveyAnswersForEvaluation(evaluationId);
  const patron = patronDeclarado(
    (dominios ?? []).flatMap((d) => d.questions.map((q) => ({ fieldKey: q.fieldKey, valor: q.answerValue }))),
  );

  // LAS RESTRICCIONES QUE VIAJAN AL MODELO SALEN DEL MOTOR QUE GOBIERNA (Gildardo, respuesta a la ronda
  // del 2026-08-23: "motorTratNutri gobierna la prescripcion nutricional... los 2.300 del otro motor son
  // el corte viejo"). Hasta el 2026-08-31 salian de protocol_suggested, que las sella desde
  // atlas-protocolo: al generador de menus de un hipertenso se le decia "Sodio < 2300 mg/dia".
  //
  // Se lee al vuelo, no del snapshot sellado, y es deliberado: el snapshot conserva lo que se computo al
  // diagnosticar (historia), y la prescripcion que gobierna hoy es la del motor vigente. Sellar una segunda
  // copia crearia otra vez dos fuentes de lo mismo, que es el defecto que esto cierra.
  const prescripcion = await getPrescripcionNutricional(
    evaluationId,
    results.snapshot.sexo,
    results.snapshot.indicators as unknown as Record<string, unknown>,
    // La MISMA cadena efectiva que ya se computo arriba para el prompt: el menu se arma sobre las calorias
    // y los gramos de proteina que el nutricionista tiene delante, no sobre los que el motor calcularia por
    // su cuenta con su peso por defecto.
    efectivo.pesoEfectivo,
    Math.round(efectivo.calorico.kcalObj),
    efectivo.calorico.pal,
  );
  // Fallback al snapshot si la evaluacion no tiene encuesta legible: sin ella el motor no puede correr, y
  // quedarse sin restricciones apagaria la IA en vez de adaptarla.
  const restriccionesModelo = prescripcion
    ? prescripcion.limites.concat(prescripcion.atributos.map((a) => ({ nombre: a, valor: "", ref: "" })))
    : (protocol.protocolSuggested.restricciones ?? []);

  // GATE: sin NINGUNA restriccion la IA no entra. Es su instruccion literal ("la IA solo lo adapta cuando
  // hay restricciones") y ademas es lo prudente: sin restricciones el ciclo YA es el menu correcto, y
  // llamar al modelo solo abriria la puerta a que cambie algo que no habia que cambiar.
  //
  // No es un error: es una respuesta. Por eso vuelve `ok` con su propio estado y NO deja fila en
  // ai_menu_suggestions (no hubo intento que dejar en procedencia).
  const hayRestricciones =
    restriccionesModelo.length > 0 || protocol.restricciones.length > 0 || patron.length > 0;
  if (!hayRestricciones) return ok({ status: "sin_restricciones" as const });

  // LA SEMANA QUE SE ADAPTA ES LA QUE EL PROFESIONAL TIENE DELANTE, no una recien sacada del ciclo: si
  // el ya edito celdas, adaptar el ciclo crudo propondria sustituir cosas que en pantalla dicen otra cosa.
  // El calculo es el MISMO que usa la grilla (semanaEfectiva), no una copia.
  const guardado = protocol.menuSemanal;
  const diaInicio = guardado?.diaInicio ?? diaInicioDerivado(protocol.treatmentId);
  const activos = protocol.tiemposActivos;
  const tiempos = TIEMPOS_DEF.filter((t) => activos?.[t.id] ?? true).map((t) => t.id);
  const base = semanaEfectiva(diaInicio, guardado?.celdas ?? {}, tiempos);

  const messages = buildMenuAdaptarPrompt(
    {
      kcalObjetivo: efectivo.calorico.kcalObj,
      proteinaGramos: efectivo.calorico.protG,
      // Las DOS listas, separadas: las del MODELO son la salida del motor con su referencia clinica y son
      // no negociables; las del PROFESIONAL son aditivas. Fundirlas perderia ambas cosas.
      restriccionesModelo,
      restriccionesProfesional: protocol.restricciones,
      fenotipoEstructural: structural.nombre,
      sectorFuncional: frSector.nombre,
      rutasAtencion: dfi.rutas,
      patronAlimentario: patron,
      base,
    },
    activePrompt?.content,
  );

  let config;
  try {
    config = await resolveAiConfig();
  } catch (e) {
    // Con la IA bien configurada (B14), un fallo aqui es inesperado (p. ej. leer la config de la BD):
    // que deje rastro en vez de leerse como "no configurada" a secas.
    reportServerError("generateMenu.resolveConfig", e);
    return err(appError("internal", "La IA no esta configurada. Contacta al administrador."));
  }

  try {
    const completion = await generateText(messages, config, { maxTokens: MAX_TOKENS_MENU });

    // Se parsea a la forma del contrato v4: una lista de CAMBIOS, no un menu. Si no parsea, la
    // sugerencia queda `parse_failed` y LA GRILLA SE QUEDA CON EL CICLO, que es la conducta correcta:
    // el ciclo no es un plan B, es la base.
    const parsed = parseCambiosMenu(completion.text);

    // VERIFICACION DE LA CITA, por cambio. No bloquea: juzgar si una preparacion incumple una restriccion
    // es contenido clinico y lo decide el profesional. Lo que si se puede es decirle CUALES cambios citan
    // una restriccion que de verdad se envio, para que sepa a cual mirar primero. El cambio que no
    // corresponde (una celda que no chocaba con nada) cae aqui como `citaVerificada: false`.
    const todasLasRestricciones = [
      ...restriccionesModelo.map((r) => r.nombre),
      ...protocol.restricciones,
      ...patron,
    ];
    const menuJson = parsed
      ? {
          cambios: parsed.cambios.map((c) => ({
            ...c,
            citaVerificada: verificarCita(c.motivo, todasLasRestricciones),
          })),
        }
      : null;
    await recordMenuSuggestion({
      treatmentId: protocol.treatmentId,
      provider: completion.provider,
      model: completion.model,
      promptVersion,
      generatedText: completion.text,
      rawResponse: {
        provider: completion.provider,
        model: completion.model,
        latency_ms: completion.latencyMs,
        // La procedencia dice si el proveedor la corto. En la BD el estado sigue siendo
        // `parse_failed` (es un enum de Postgres y ampliarlo pide migracion); el matiz vive aqui y en
        // lo que se le dice al profesional.
        truncado: completion.truncado,
      },
      menuJson,
      status: menuJson ? "success" : "parse_failed",
      latencyMs: completion.latencyMs,
      ...actor,
    });
    // TRES DESENLACES Y NO DOS: un texto CORTADO no es un texto malo. Decirlos igual manda a buscar un
    // defecto de formato donde lo que hubo fue falta de espacio.
    if (menuJson) return ok({ status: "success" as const });
    return ok({ status: completion.truncado ? ("truncado" as const) : ("parse_failed" as const) });
  } catch (e) {
    // Persistir el fallo tambien (procedencia). El proveedor/modelo del intento primario;
    // el mensaje de error nunca contiene PII (el prompt no la lleva).
    const status = classifyFailure(e);
    await recordMenuSuggestion({
      treatmentId: protocol.treatmentId,
      provider: config.provider,
      model: config.model,
      promptVersion,
      generatedText: null,
      menuJson: null,
      rawResponse: {
        error: e instanceof AiError ? e.message : String(e),
        source: config.source,
        // LA COLA SE REGISTRA COMO COLA. En la BD el estado sigue siendo `provider_error` (es un enum de
        // Postgres), pero sin este dato la fila no distingue "el proveedor esta saturado" de "el proveedor
        // esta roto", que son dos cosas muy distintas cuando alguien mira el historial.
        ...(e instanceof ColaDelProveedorError
          ? { cola: true, espera_pedida_s: e.segundos }
          : {}),
      },
      status,
      latencyMs: null,
      ...actor,
    });
    // UNA COLA NO ES UN FALLO DE CONFIGURACION (Santiago, 2026-09-10). El arreglo se hizo en el borrador
    // de criterio y ESTE CAMINO SE QUEDO CON EL TEXTO VIEJO, que es por lo que Santiago volvio a verlo:
    // los dos servicios llaman al mismo proveedor y cada uno redacta su propio mensaje.
    //
    // Con config explicita del admin (source "db") no hay fallback: el fallo del proveedor elegido se
    // refleja tal cual, nombrandolo, para que quede claro que su config esta rota. Pero una cola no lo es.
    const message =
      e instanceof ColaDelProveedorError
        ? `El proveedor de IA está en cola por límite de uso${
            e.segundos != null ? ` (pide ${Math.ceil(e.segundos)} s)` : ""
          }. Vuelve a intentarlo en unos segundos; no hay nada que configurar. La grilla se queda con el menú del ciclo.`
        : config.source === "db"
          ? `El proveedor de IA configurado (${config.provider}) fallo al generar el menu. Avisa al administrador para revisar la configuracion.`
          : "No se pudo generar el menu. Intenta de nuevo.";
    return err(appError("internal", message));
  }
}
