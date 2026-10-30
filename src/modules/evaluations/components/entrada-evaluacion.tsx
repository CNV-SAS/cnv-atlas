import { CheckCircle2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { Progress } from "@/components/ui/progress";
import { conOrigen } from "@/components/shared/volver-a-destino";
import { formatDateLong } from "@/lib/format/date";
import { BisImportForm } from "@/modules/bis/components/bis-import-form";
import type { BisImportEvaluation } from "@/modules/bis/data/bis-evaluations-reader";
import { BisConditionsCapture } from "@/modules/bis-intake/components/bis-conditions-capture";
import { BisConditionsReadonly } from "@/modules/bis-intake/components/bis-conditions-readonly";
import type { BisConditionsReadonly as BisConditionsReadonlyData } from "@/modules/bis-intake/data/bis-conditions-reader";
import type { BisConditionCatalog, BisIntakeRecord } from "@/modules/bis-intake/types";
import { CircunferenciasImportadas } from "@/modules/bis/components/circunferencias-importadas";
import { MedidasConTabla } from "@/modules/bis-intake/components/medidas-con-tabla";
import { SarcopeniaCard } from "@/modules/diagnoses/components/sarcopenia-card";
import { allCompositionRows } from "@/modules/diagnoses/data/composition-map";
import type { Composition } from "@/modules/diagnoses/data/composition-reader";
import { isAnswered } from "@/modules/clinical-pipeline/services/survey-completeness";

import { HojaImprimible, type EncabezadoDeHoja } from "@/components/shared/hoja-imprimible";
import { CompositionSection } from "@/modules/diagnoses/components/composition-section";

import { ConsentStatusCard } from "./consent-status-card";
import { SurveyReadonly } from "./survey-readonly";
import type { ConsentStatus } from "../data/consent-status-reader";
import type { SurveyDomain } from "../data/survey-answers-reader";

// Etapa de ENTRADA (pestana Evaluacion): que entro y se verifico antes del diagnostico. Orden
// consentimiento (la puerta) -> encuesta del paciente (solo lectura) -> composicion corporal cruda.
// La composicion reusa CompositionSection con showDiagnosis=false: muestra solo "que entro"
// (Variable, Valor, Referencia, Δ), SIN el veredicto (clasificacion OMS + columna Diagnostico), que
// es materia de Diagnostico. Lee de bis_raw_values (crudo). Presentacion pura desde readers RLS. Las
// condiciones de la toma BIS, la fuerza prensil y la meta de peso van en el sub-bloque B (Gildardo).
export function EntradaEvaluacion({
  panel,
  evaluationId,
  consentStatus,
  surveyDomains,
  composition,
  bisImportEval,
  bisCatalog,
  bisIntake,
  patientIsFemale,
  bisReadonly,
  diagnosticoGenerado,
  importada = false,
  identityConfirmationSlot = null,
  encabezado = null,
  correccionDeLaMedicion = null,
  avisoDeEdadDelEquipo = null,
  panelDeCalidadBiologica = null,
}: {
  /**
   * Cual de los DOS paneles se rinde. Desde el 2026-09-10 Encuesta y Antropometria & BIS son PESTAÑAS
   * propias (como en su archivo), no subpestañas de una etapa "Evaluacion": cada una se monta por su
   * lado y este componente sigue siendo el que sabe armarlas. Los dos paneles comparten datos y guardas
   * (el gate del import depende de las condiciones capturadas en Encuesta), por eso siguen viviendo
   * juntos aqui en vez de partirse en dos componentes que tendrian que volver a recibir lo mismo.
   */
  panel: "encuesta" | "antropometria";
  /**
   * EL ENCABEZADO DE LA HOJA (Gildardo, 2026-10-25: el boton de imprimir en TODAS las subpestañas).
   *
   * null = no se ofrece el boton, y es la misma regla que la prescripcion: una hoja que no dice de quien
   * es ni quien la firma no es un documento clinico, es un volante. Antes de emitir eso, no se ofrece.
   */
  encabezado?: EncabezadoDeHoja | null;
  /**
   * LA CORRECCION "la medicion no es de este paciente", MOVIDA AQUI (Gildardo, 2026-10-26).
   *
   * *"La correccion va en Antropometria y BIS, que es donde vive la toma, no en Diagnostico funcional."*
   * Y tiene razon: el acto es sobre la MEDICION. Quien se da cuenta de que el archivo era de otra persona
   * lo ve mirando la medicion, no leyendo el diagnostico, y tenia que cambiar de pestaña para arreglarlo.
   *
   * VA ARRIBA DE TODO (Santiago, 2026-10-28), no debajo de la medicion: estaba "abajo casi al final" y
   * no se encontraba. Lleva el aviso de medicion repetida DENTRO, en el mismo bloque, porque un aviso que
   * no trae su salida al lado obliga a buscarla.
   */
  correccionDeLaMedicion?: ReactNode;
  /**
   * EL AVISO DE SU ERROR 5: la edad de la ficha y la del equipo difieren en mas de un año.
   *
   * Va APARTE del bloque de la correccion aunque los dos encabecen la pestaña: son dos hechos distintos
   * con dos arreglos distintos (uno desliga la medicion, el otro manda a verificar la fecha de
   * nacimiento). Juntarlos en un bloque haria que una salida pareciera servir para el otro problema.
   */
  avisoDeEdadDelEquipo?: ReactNode;
  /**
   * EL CONTROL DE CALIDAD BIOLOGICO (su v12): las identidades fisicas que esta medicion viola.
   *
   * VA PRIMERO DE LOS TRES, y el orden no es cosmetico. Los otros dos preguntan DE QUIEN es esta
   * toma; este pregunta si la toma puede existir. Si la respuesta es que no, de quien sea da igual:
   * no hay cuerpo que describa. Asi que se lee antes.
   */
  panelDeCalidadBiologica?: ReactNode;
  evaluationId: string;
  /**
   * ¿La medicion llego importada del HTML? Solo ahi se pueden teclear la cintura y la cadera que falten: ese
   * tamizaje fue hace meses y no se puede repetir (Santiago, 2026-09-22). En una medicion tomada en Atlas la
   * regla sigue siendo volver a medir y re-importar el XLSX.
   */
  importada?: boolean;
  // ¿Ya se genero el diagnostico? Es lo que SELLA las medidas: despues de diagnosticar, cambiarlas no
  // es editar, es corregir, y va por el flujo que versiona. No se deriva de bisReadonly porque ese es
  // otro hecho (si hay condiciones capturadas), y confundirlos dejaria la edicion abierta en un caso.
  diagnosticoGenerado: boolean;
  consentStatus: ConsentStatus | null;
  surveyDomains: SurveyDomain[] | null;
  composition: Composition | null;
  // Confirmar identidad, DENTRO de la evaluacion (Santiago 2026-08-15, c): la accion se movio de la lista
  // aca, al INICIO de Encuesta, cuando la evaluacion esta en draft. null si ya esta confirmada (in_progress).
  // Lo arma la pagina (tiene los datos del pendiente + duplicados); este componente solo lo coloca.
  identityConfirmationSlot?: ReactNode;
  // Vista para importar BIS desde aqui (reusa el modulo bis del panel). null si la evaluacion no
  // esta in_progress (identidad sin confirmar) o ya no aplica.
  bisImportEval: BisImportEvaluation | null;
  // Sub-bloque B: catalogo activo de condiciones + captura ya guardada (si existe) + sexo, para la
  // captura de condiciones y el gate del import. null cuando la identidad no esta confirmada.
  bisCatalog: BisConditionCatalog | null;
  bisIntake: BisIntakeRecord | null;
  patientIsFemale: boolean;
  // Captura sellada en SOLO LECTURA (tras el diagnostico, ya no editable). null si no hay o si la
  // captura editable aplica.
  bisReadonly: BisConditionsReadonlyData | null;
}) {
  // Identidad confirmada (in_progress): se puede capturar condiciones e importar. La ausencia de
  // bisImportEval significa que aun no esta lista (o ya paso a diagnostico, otra rama).
  // LOS ENLACES DE ESTE BLOQUE LLEVAN DE DONDE SALEN: la encuesta y la correccion tienen como padre la
  // evaluacion "en general", y volver ahi obliga a buscar otra vez la pestaña. Ver `volver-a-destino.ts`.
  const origen = `/ani-bis-e/${evaluationId}?etapa=encuesta`;
  const identityConfirmed = bisImportEval != null;
  // Contador respondidas/total con el total REAL de preguntas del instrumento (no hardcodeado): el
  // reader devuelve todas las preguntas con answerValue null si no se respondio. Usa EL MISMO predicado
  // (isAnswered) que el gate, el aviso del paciente, el modo edicion y la previsualizacion: era el CUARTO
  // sitio que contaba distinto (contaba "Otra" pelada como respondida, y el porcentaje subia; Santiago §1
  // del 2026-08-20). El predicado unico es el unico blindaje contra que recaiga por quinta vez.
  const domains = surveyDomains ?? [];
  const total = domains.reduce((acc, d) => acc + d.questions.length, 0);
  const answered = domains.reduce(
    (acc, d) => acc + d.questions.filter((q) => isAnswered(q.answerValue)).length,
    0,
  );
  // Porcentaje de completitud de la encuesta (Gildardo 2026-08-17, b): junto al boton de ver/editar, con
  // barra. Antes solo estaba el conteo en texto; no se perdio al dividir en subpestañas, nunca hubo barra.
  const surveyPct = total > 0 ? Math.round((answered / total) * 100) : 0;
  // LAS QUE FALTAN, con su numero, su texto y su dominio, en el orden del instrumento. Se derivan de lo
  // mismo que el contador: si se contaran aparte, el numero y la lista podrian discrepar.
  const faltantes = domains.flatMap((d) =>
    d.questions
      .filter((q) => !isAnswered(q.answerValue))
      .map((q) => ({
        questionId: q.questionId,
        number: q.number,
        questionText: q.questionText,
        section: d.section,
      })),
  );


  // ASMI y AF para el diagnostico de sarcopenia (EWGSOP2): se leen de las filas de la composicion (ASMI =
  // MMEM/talla^2 computado; AF = columna del equipo). La fuerza prensil (dinamometria, criterio PRIMARIO) SI
  // se captura: es el campo `gripStrengthKg` de las condiciones de la toma BIS (editable o ya sellado). Se
  // cablea a la card (Gildardo 2026-08-17 §6). sexoM = paciente no femenino.
  const compRows = composition ? allCompositionRows(composition) : [];
  const sarcopeniaAsmi = compRows.find((r) => r.key === "asmi")?.value ?? null;
  const sarcopeniaAf = compRows.find((r) => r.key === "AF")?.value ?? null;
  const sarcopeniaFuerza = bisIntake?.gripStrengthKg ?? bisReadonly?.gripStrengthKg ?? null;

  // SUBPESTAÑA 1 · ENCUESTA: consentimiento + encuesta del paciente + condiciones de la toma BIS. Es lo
  // PRIMERO de la secuencia; la subpestaña 2 depende de que esto este hecho.
  const encuestaPanel = (
    <div className="flex flex-col gap-8">
      {/* Confirmar identidad (draft): PRIMERO en la secuencia. Habilita las condiciones de la toma y el
          import. Cuando ya esta confirmada, el slot es null y se ve el flujo normal. */}
      {identityConfirmationSlot}
      {consentStatus ? <ConsentStatusCard status={consentStatus} /> : null}

      {/* Resumen de la encuesta: estado (respondidas/total), sin desplegar las preguntas. El detalle
          completo, en solo lectura, vive en una pantalla aparte. */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Encuesta del paciente</h3>
          {/* "Ver o editar" (no solo "ver"): la pantalla deja editar (pre-diagnostico) o corregir versionado
              (con diagnostico). El boton decia "ver" cuando tambien edita (Santiago 2026-08-15, b). */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={conOrigen(`/ani-bis-e/${evaluationId}/encuesta`, origen)}
              className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              Ver o editar encuesta
            </Link>
            {/* DESCARGAR LAS RESPUESTAS (observación f). Es para que el profesional conserve las de SUS
                pacientes, asi que vive junto a la encuesta y no en un menu de exportaciones. Un enlace
                normal y no un boton con JavaScript: la descarga la resuelve el navegador, y asi funciona
                igual en un telefono. La descarga queda registrada en la auditoria (ver la ruta). */}
            {total > 0 ? (
              <a
                href={`/ani-bis-e/${evaluationId}/encuesta/csv`}
                className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                Descargar respuestas
              </a>
            ) : null}
          </div>
        </div>
        {total > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {answered} de {total} preguntas respondidas
              </span>
              <span className="font-semibold tabular-nums text-foreground">{surveyPct}%</span>
            </div>
            <Progress value={surveyPct} aria-label={`Encuesta ${surveyPct}% completada`} />
            {/* ═══ CUALES FALTAN, AQUI MISMO (Santiago, 2026-09-19) ═══

                SU PEDIDO: que el bloque diga las preguntas que quedaron sin responder sin tener que entrar
                a "Ver o editar". La barra decia CUANTAS y eso obliga a abrir la encuesta entera y
                recorrerla para encontrarlas, que con 60 preguntas es buscar una aguja.

                CADA UNA ENLAZA A SI MISMA, no a la pantalla: llegar a la encuesta y seguir buscando es la
                mitad del trabajo, no la solucion.

                EL PREDICADO ES EL MISMO (`isAnswered`) que el gate, el aviso del paciente y la
                previsualizacion: ya hubo cuatro sitios contando distinto, y el quinto no lo abrimos. */}
            {faltantes.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2">
                <span className="text-xs font-semibold text-clinical-warning">
                  {faltantes.length === 1
                    ? "Falta 1 pregunta por responder"
                    : `Faltan ${faltantes.length} preguntas por responder`}
                </span>
                <ul className="flex flex-col gap-1">
                  {faltantes.map((f) => (
                    <li key={f.questionId} className="text-xs leading-snug text-foreground">
                      <Link
                        href={conOrigen(`/ani-bis-e/${evaluationId}/encuesta/editar#p-${f.questionId}`, origen)}
                        className="underline-offset-2 hover:underline"
                      >
                        <span className="text-muted-foreground">{f.number}.</span> {f.questionText}
                      </Link>
                      <span className="text-muted-foreground"> · {f.section}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta evaluación aún no tiene respuestas de encuesta.
          </p>
        )}
      </section>

    </div>
  );

  // ═══ LAS CONDICIONES DE LA TOMA SE MUDAN A ANTROPOMETRIA Y BIS (v12 §3, 2026-10-30) ═══
  //
  // VIVIAN AL FINAL DE ENCUESTA, y no por descuido: son parte de lo que se CAPTURA, y la secuencia de
  // Atlas es Encuesta -> Antrop. & BIS, asi que entraban con el resto de lo que se pregunta al paciente.
  //
  // SU ARGUMENTO ES MEJOR Y ES EL MISMO DE SU CORRECCION DEL 25-OCT: *"se verifica justo antes de subir
  // la bioimpedancia"*. Placas, protesis, marcapasos, ayuno, ejercicio, diuretico, embarazo y ciclo no se
  // preguntan para el expediente: se preguntan porque CONDICIONAN ESA MEDICION, y el sitio donde eso se
  // lee es la pantalla donde se sube el archivo. Preguntarlas una pestaña antes las vuelve un tramite; al
  // lado del import son lo que son, la comprobacion previa.
  //
  // Y NO QUEDA EN LAS DOS, que es la unica forma de equivocarse aqui: dos sitios donde se capturan las
  // mismas respuestas es el hazard 4 de CLAUDE.md (dos superficies leyendo o escribiendo fuentes
  // distintas de lo mismo), y con un formulario que SELLA, la segunda copia es la que se queda sin
  // guardar. El candado de `bis-conditions` lo vigila en los dos sentidos.
  //
  // EL GATE NO SE TOCA: el boton de importar sigue exigiendo las condiciones guardadas, y ahora el aviso
  // que lo explica queda al lado del bloque que lo resuelve, no en otra pestaña.
  const condicionesDeLaToma =
    identityConfirmed && bisCatalog ? (
      <BisConditionsCapture
        evaluationId={evaluationId}
        catalog={bisCatalog}
        intake={bisIntake}
        patientIsFemale={patientIsFemale}
      />
    ) : bisReadonly ? (
      <BisConditionsReadonly data={bisReadonly} />
    ) : null;

  // SUBPESTAÑA 2 · ANTROPOMETRIA Y BIS: import del archivo + composicion corporal. (La sarcopenia y las
  // referencias entran en el siguiente paso.) Las condiciones de la toma viven AQUI desde el 2026-10-30 (v12 §3); lo que sigue dependiendo de Encuesta es la encuesta misma, y el aviso del gate lo dice.
  const antropometriaPanel = (
    <div className="flex flex-col gap-8">
      {/* EL CONTROL DE CALIDAD BIOLOGICO, LO PRIMERO DE TODO. Los dos bloques de abajo preguntan DE QUIEN
          es esta toma; este pregunta si la toma PUEDE EXISTIR, y si no puede, de quien sea da igual. Es
          tambien el unico de los tres que FRENA: mientras haya un hallazgo sin revisar, la composicion y el
          diagnostico de esta consulta describen un cuerpo que no existe. */}
      {composition ? panelDeCalidadBiologica : null}
      {/* EL AVISO Y SU SALIDA, LO PRIMERO DE LA PESTAÑA (Santiago, 2026-10-28). Si la toma de esta consulta
          puede no ser de este paciente, eso se lee ANTES de mirar sus cifras: todo lo de abajo describe un
          cuerpo que quizas no es el suyo. Solo con medicion: sin toma no hay nada que desligar. */}
      {composition ? correccionDeLaMedicion : null}
      {/* LA EDAD DE LA FICHA CONTRA LA DEL EQUIPO (su error 5), al lado del bloque anterior y por lo
          mismo: las dos son dudas sobre DE QUIEN es esta toma, y las dos se resuelven antes de leer las
          cifras. Esta no frena nada; avisa y dice donde mirar. */}
      {composition ? avisoDeEdadDelEquipo : null}
      {/* LAS CONDICIONES DE LA TOMA, ENCIMA DEL IMPORT (v12 §3). Debajo de los tres avisos y no arriba:
          esos tres hablan de una toma que YA ENTRO (si puede existir, de quien es, con que edad se
          calculo), y este checklist es la comprobacion de la que va a entrar. Cuando no hay medicion los
          tres son null, asi que en el estado en el que esto importa queda lo primero de la pestaña. */}
      {condicionesDeLaToma}
      {/* Seccion Medicion BIS SIEMPRE presente (no aparece/desaparece: eso confunde). Con medicion,
          muestra un mensaje de exito PERSISTENTE + la composicion; sin medicion, el import GATEADO
          (boton deshabilitado con explicacion en gris). Mismo criterio de "estados vacios limpios". */}
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-foreground">Medición BIS</h3>
        {composition ? (
          <div className="flex flex-col gap-3">
            {/* NEUTRO, NO VERDE CLINICO (2026-09-05). Que la medicion se haya importado es un estado de
                PROCESO; el verde de `clinical-optimal` significa un veredicto optimo SOBRE EL PACIENTE.
                Ya se corrigio dentro del formulario del import, y dejarlo aqui seria tener el criterio
                aplicado a medias en la misma pantalla. */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium text-foreground">
                Medición BIS importada
                {composition.measurementDate
                  ? ` · tomada el ${formatDateLong(composition.measurementDate)}`
                  : ""}
                .
              </span>
            </div>
            {/* EL REEMPLAZO, PEGADO AL AVISO Y COMO ENLACE (smoke de Santiago, 2026-09-05, segunda pasada).
                La primera version fue una seccion propia abajo, y era desproporcionada: importar el archivo
                equivocado es un caso RARO, no una parte del flujo. Aqui es un texto pulsable que abre el
                aviso y el selector EN SU SITIO, sin mover al profesional de donde esta.
                `details` nativo y no estado de cliente: este panel es de servidor, y un desplegable que no
                guarda nada no necesita hidratacion. */}
            {/* ═══ Y EL ROTULO NOMBRA EL ACTO, NO SOLO EL SINTOMA (v12 §1.3, 2026-10-30) ═══

                Decia solo *"¿Importaste el archivo equivocado?"*, y eso deja el acto SIN NOMBRE: quien
                viene buscando como quitar una toma mala (en su HTML hay un boton "Eliminar toma BIS") no
                reconoce esa pregunta como el sitio, y concluye que en Atlas no se puede. Es el patron de
                "un control que no se encuentra se reporta como que no existe".

                SE QUEDAN LAS DOS COSAS, el nombre y la pregunta: el nombre lo hace encontrable y la
                pregunta lo hace reconocible para quien llega por el sintoma. Y SIN SUBIRLE EL PESO
                VISUAL, que es la otra mitad de la decision del 2026-09-05: importar el archivo
                equivocado es un caso RARO, no una parte del flujo. */}
            {!diagnosticoGenerado && bisImportEval ? (
              <details className="no-print group -mt-1">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="size-3 transition-transform group-open:rotate-180" aria-hidden />
                  Reemplazar la toma de BIS · ¿importaste el archivo equivocado?
                </summary>
                <div className="pt-2">
                  <BisImportForm evaluation={bisImportEval} modoReemplazo />
                </div>
              </details>
            ) : null}
            {/* Y CUANDO YA HAY DIAGNOSTICO SE DICE DONDE ESTA EL CAMINO, en vez de no mostrar nada.
                Hasta hoy, una consulta con diagnostico no ofrecia aqui NADA sobre la toma, asi que quien
                descubria la toma mala despues de generar se quedaba sin pista: el reemplazo directo esta
                cerrado a proposito (el diagnostico esta sellado sobre esa medicion) y lo que corresponde
                es CORREGIR, que emite una version nueva y conserva la anterior. Una frase que nombra el
                camino cuesta menos que un profesional escribiendo a soporte. */}
            {diagnosticoGenerado ? (
              <p className="no-print -mt-1 text-xs text-muted-foreground">
                La toma ya no se reemplaza aquí: esta consulta tiene diagnóstico, y está sellado sobre esa
                medición. Si la toma quedó mal, se corrige la consulta desde el cierre del diagnóstico
                funcional: se emite una versión nueva y la actual queda registrada como reemplazada.
              </p>
            ) : null}
            {/* LAS MEDIDAS Y LA TABLA VAN JUNTAS desde el 2026-09-09, para que la tabla se recalcule
                MIENTRAS se escribe la meta y no al salir del campo. Los dos son componentes cliente pero
                los montaba este archivo, que es de SERVIDOR, asi que no tenian estado en comun. Ver
                `medidas-con-tabla.tsx`: es lo unico que los une, y el guardado no cambia. */}
            {importada && !diagnosticoGenerado ? (
              <CircunferenciasImportadas
                evaluationId={evaluationId}
                cintura={composition.cintura}
                cadera={composition.cadera}
              />
            ) : null}
            <MedidasConTabla
              evaluationId={evaluationId}
              composition={composition}
              corrections={composition.corrections ?? {}}
              pesoMetaKg={bisIntake?.weightGoalKg ?? bisReadonly?.weightGoalKg ?? null}
              fuerzaPrensilKg={sarcopeniaFuerza}
              sellada={diagnosticoGenerado}
              tituloTabla="Composición corporal (Niveles de Wang)"
            />
          </div>
        ) : !identityConfirmed || !bisImportEval ? (
          <p className="text-sm text-muted-foreground">
            Aún sin medición BIS. Confirma la identidad del paciente para poder importar la medición
            (XLSX de Biody Manager).
          </p>
        ) : (
          // SIEMPRE DISPONIBLE (Santiago, 2026-09-22): sin aviso previo ni boton deshabilitado. El boton
          // "Importar medición BIS" es el guardian: si faltan las condiciones, la encuesta o el archivo no
          // sirve, lo dice al pulsarlo y no deja pasar (`evaluarRequisitosDelImport`, en el servidor).
          <BisImportForm evaluation={bisImportEval} />
        )}
      </section>

      {/* Diagnostico de sarcopenia (EWGSOP2): fuerza + ASMI + AF. Solo con medicion (necesita ASMI/AF de la
          composicion). La fuerza prensil viene de las condiciones de la toma (gripStrengthKg); si el profesional
          no la registro, la card lo dice ("sin dato"), no lo inventa. */}
      {composition ? (
        <SarcopeniaCard
          asmi={sarcopeniaAsmi}
          af={sarcopeniaAf}
          sexoM={!patientIsFemale}
          fuerzaPrensil={sarcopeniaFuerza}
        />
      ) : null}
    </div>
  );

  // SIN TITULO PROPIO desde que son pestañas (2026-09-10). El `h2 "Entrada de la evaluacion"` existia
  // porque la pestaña de arriba decia "Evaluacion" y hacia falta decir que habia dentro. Ahora la pestaña
  // dice "Encuesta" o "Antrop. & BIS": repetirlo debajo es el mismo rotulo dos veces. Queda la linea que
  // SI aporta, que es la que dice para que sirve el panel.
  // ═══ LAS DOS HOJAS DE PAPEL DE ESTAS PESTAÑAS (Gildardo, 2026-10-25) ═══
  //
  // *"Hazlo ahora en TODAS las subpestañas, cada una con su hoja para papel (sin desplegables ni campos
  // vacios)."*
  //
  // Y ESO ES LO QUE DECIDE QUE SALE: estas dos pestañas son TALLERES. La de Encuesta es una barra de
  // progreso con enlaces a las preguntas que faltan, y la de Antropometria es un formulario de import con
  // campos editables. Marcarlas imprimibles tal cual habria puesto en el papel la barra, los enlaces y los
  // campos vacios, que es exactamente el aviso que el dimensionado llevaba.
  //
  // Asi que el papel se arma aparte, con lo GUARDADO, y REUSANDO los componentes que ya son documentos:
  //
  //   · Encuesta  -> `SurveyReadonly`, el MISMO bloque que pinta la pantalla de "Ver o editar encuesta",
  //     mas las condiciones de la toma selladas. No es una segunda redaccion de las respuestas: es la
  //     misma, y por eso no pueden decir cosas distintas.
  //   · Antropometria -> la tabla de Wang COMPLETA (`CompositionSection`), que ya es una tabla sin
  //     controles, con la fecha de la toma arriba.
  //
  // LO QUE NO LLEVA EL PAPEL DE LA ENCUESTA: las preguntas que faltan NO van como aviso. En pantalla son
  // trabajo por hacer (y cada una enlaza a si misma); en un documento serian un reproche impreso. Lo que
  // si va es la respuesta vacia de cada una, que es el hecho: "sin responder".
  const hojaDeLaEncuesta =
    surveyDomains && surveyDomains.length > 0 ? (
      <div className="solo-impresion flex-col gap-6">
        {consentStatus ? <ConsentStatusCard status={consentStatus} /> : null}
        <SurveyReadonly domains={surveyDomains} />
        {bisReadonly ? <BisConditionsReadonly data={bisReadonly} /> : null}
      </div>
    ) : null;

  const hojaDeLaAntropometria = composition ? (
    <div className="solo-impresion flex-col gap-6">
      {composition.measurementDate ? (
        <p className="text-sm text-foreground">
          Medición tomada el {formatDateLong(composition.measurementDate)}.
        </p>
      ) : null}
      {/* CON SU VEREDICTO (`showDiagnosis` por defecto) y SIN recortar a lo alterado: en la pantalla esta
          tabla es el dato crudo que entra, pero en papel es el registro de la medicion, y un registro que
          solo lista lo que esta mal no deja reconstruir la medicion. */}
      {/* SIN `pesoMetaKg`, y lo dijo un candado: la meta de peso es la REFERENCIA DE TRABAJO de la fila
          de Peso en la pantalla, y la decision de `composicion-a-peso-meta` es que NO llegue a un
          documento (ni a la historia clinica ni a su PDF). Esta hoja es un documento, asi que tampoco.

          Y no es un detalle de forma: la meta es un acuerdo con el paciente que puede cambiar, mientras el
          peso medido es un hecho de ese dia. Imprimir la una como referencia del otro ataria el registro de
          la medicion a una decision posterior. Donde SI va la meta es en la hoja de la prescripcion, con su
          procedencia al lado. */}
      <CompositionSection composition={composition} sexoM={!patientIsFemale} />
      {sarcopeniaFuerza != null ? (
        <p className="text-sm text-foreground">Fuerza prensil registrada: {sarcopeniaFuerza} kg.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Fuerza prensil: no se registró.</p>
      )}
    </div>
  ) : null;

  const contenido = panel === "encuesta" ? encuestaPanel : antropometriaPanel;
  const hoja = panel === "encuesta" ? hojaDeLaEncuesta : hojaDeLaAntropometria;

  const cuerpo = (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        {panel === "encuesta"
          ? "Lo que entró antes de medir: consentimiento, encuesta del paciente y condiciones de la toma."
          : "La medición y lo que sale de ella: medidas del profesional, importación BIS y composición corporal."}
      </p>
      {contenido}
    </div>
  );

  // SIN ENCABEZADO O SIN CONTENIDO GUARDADO NO HAY HOJA, y entonces tampoco boton: ofrecerlo sobre una
  // evaluacion sin encuesta ni medicion imprimiria una pagina con un encabezado y nada debajo.
  if (!encabezado || !hoja) return cuerpo;

  return (
    <HojaImprimible
      titulo={panel === "encuesta" ? "Encuesta del paciente" : "Antropometría y bioimpedancia"}
      encabezado={encabezado}
      etiquetaBoton={panel === "encuesta" ? "Imprimir la encuesta" : "Imprimir la medición"}
      queSale={
        panel === "encuesta"
          ? "Las respuestas del paciente tal como quedaron guardadas, con su consentimiento y las condiciones de la toma. No sale la barra de progreso ni los enlaces de la pantalla."
          : "La medición: su fecha, la composición corporal por niveles de Wang con sus referencias y la fuerza prensil. No salen el formulario de importación ni los campos editables."
      }
    >
      <div className="no-print">{cuerpo}</div>
      {hoja}
    </HojaImprimible>
  );
}
