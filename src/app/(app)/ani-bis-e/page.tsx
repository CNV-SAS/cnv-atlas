import { redirect } from "next/navigation";

import { TituloPantalla, TituloSeccion } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { BisImportForm } from "@/modules/bis/components/bis-import-form";
import { listEvaluationsForBisImport } from "@/modules/bis/data/bis-evaluations-reader";
import { PipelineRunner } from "@/modules/clinical-pipeline/components/pipeline-runner";
import { listEvaluationsForDiagnosis } from "@/modules/clinical-pipeline/data/pipeline-evaluations-reader";
import { AwaitingSurveyList } from "@/modules/evaluations/components/awaiting-survey-list";
import { CortesVigentes } from "@/modules/model-registry/components/cortes-vigentes";
import { MotorHoy } from "@/modules/model-registry/components/motor-hoy";
import { listAwaitingSurveyEvaluations } from "@/modules/evaluations/data/evaluations-repository";
import {
  canConfirmIdentity,
  canEmitFollowupLink,
} from "@/modules/evaluations/policies/can-manage-evaluations";

export const metadata = { title: "Modelo ANI-BIS-E - Atlas" };

// Panel del profesional: evaluaciones recien llegadas de la encuesta, pendientes de
// confirmar la identidad del paciente. Para las iniciales se recomputan los posibles
// duplicados (con score) para que el profesional decida con la informacion a la vista.
export default async function EvaluacionesPage() {
  const user = await requireUser();
  if (!canConfirmIdentity(user) && !canEmitFollowupLink(user)) {
    redirect("/no-autorizado");
  }

  // TRES CONSULTAS Y NO CINCO: al retirar las dos colas que /pacientes y /reportes ya cubren, sus
  // lecturas se van con ellas. Dejarlas "por si acaso" seria pagar dos consultas en cada carga por datos
  // que nadie mira.
  const [bisPending, diagnosisPending, awaitingSurvey] = await Promise.all([
    listEvaluationsForBisImport(),
    listEvaluationsForDiagnosis(),
    listAwaitingSurveyEvaluations(),
  ]);
  // Tiempo de request (pagina dinamica) para la antiguedad de los shells sin responder.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* ═══ QUE ES ESTA PANTALLA DESPUES DE LA COLUMNA DE PENDIENTES (Santiago, 2026-09-10) ═══

          LA PREGUNTA ERA SI SOBRABA, y con los conteos delante la respuesta es que sobra la MITAD.

          LO QUE HACIA, contado en produccion: por confirmar (53), encuestas sin responder (12), BIS por
          importar (4), diagnosticos por generar (0) y reportes por aprobar (16). La columna de /pacientes
          dice EXACTAMENTE lo mismo, paciente por paciente y con su destino, porque son los mismos seis
          pasos de la misma secuencia.

          PERO NO ES REDUNDANTE ENTERA, y esa es la parte que la salva: hay trabajo que es POR LOTE y que
          /pacientes no puede hacer. Subir un XLSX y emparejarlo con su evaluacion no es un acto sobre un
          paciente que se abre: es una tarea de cola, con el archivo delante. Entrar paciente por paciente
          para importar cuatro mediciones es peor que una lista.

          ASI QUE SE QUEDA LO QUE ES DE LOTE Y SE VA LO QUE ES POR PACIENTE:
            · SE VA "por confirmar" (53). Su unica accion era ABRIR la evaluacion, y la identidad se
              confirma sola al abrirla desde el 2026-09-09. Una cola de 53 que pide "revisar y confirmar"
              algo que ya no se confirma a mano es una lista que enseña a ignorar las listas.
            · SE VA "reportes por aprobar" (16). Eso es /reportes, y ahora tambien una tarjeta del tablero
              que lleva alli.
            · SE VA el enlace de consultorio, que desde hoy vive junto a "nuevo paciente" en /pacientes,
              que es donde se empieza a un paciente.
            · SE QUEDAN las tres de lote: importar BIS, generar diagnostico y las encuestas sin responder.

          Y LA ENTRADA DEL SIDEBAR SE QUEDA: retirarla obligaria a importar el BIS desde algun sitio que
          no existe.

          ── Y LO QUE ENTRA EN SU SITIO (Santiago, 2026-09-10, "B con A dentro") ────────────────────────

          Con la mitad retirada, lo que quedaba eran tres colas de lote, y eso no llena una entrada del
          sidebar. Lo que la llena es lo OTRO que esta pantalla puede ser y ninguna otra es: el TALLER DEL
          MODELO. Su razon, y es la que decide: "hoy nadie puede responder desde Atlas con que version del
          motor se esta diagnosticando. Eso ya nos costo rondas de averiguarlo por consulta."

          Asi que la pantalla tiene dos mitades y las dos son del modelo: con QUE se diagnostica (la
          version, sus modificaciones autorizadas, los cortes vigentes) y el trabajo de lote que lo
          aplica. El nombre no hay que buscarlo: es el del modelo, y ya lo era. */}
      {/* ═══ EL TITULO VUELVE AL NOMBRE DEL MODELO (Santiago, 2026-09-10) ═══

          Lo puse en "Bandeja de trabajo" por lo que la pantalla HACIA, y el rotulo del sidebar con el.
          Santiago revirtio el del sidebar con una razon que vale igual para el titulo: el nombre no es de
          la pantalla, es del MODELO, y es como Gildardo y los profesionales lo llaman. El titulo y el
          rotulo vuelven a decir lo mismo. */}
      <TituloPantalla
        titulo="Modelo ANI-BIS-E"
        descripcion="Con qué se está diagnosticando hoy, y el trabajo que se hace por lote y no paciente por paciente. Para trabajar a un paciente concreto, ve a la lista de pacientes."
      />

      {/* ═══ EL TALLER VA ANTES QUE LAS COLAS, y no es orden de importancia ═══

          Es lo unico de esta pantalla que se consulta SIN una tarea delante: las colas de abajo son
          trabajo (importar, generar), estas dos secciones son una RESPUESTA. Quien entra a importar un
          XLSX baja; quien entra a saber con que version se diagnostica, no tendria que buscar.

          Y LA RAZON POR LA QUE EXISTEN (Santiago): "hoy nadie puede responder desde Atlas con que version
          del motor se esta diagnosticando. Eso ya nos costo rondas de averiguarlo por consulta." Se
          verifico antes de construirlo: `engine_version` aparecia en DOS sitios de la interfaz y los dos
          dentro de un texto de fallo (el diagnostico viejo que no puede mostrarse, y el seguimiento que
          cruza dos versiones). La version solo se veia cuando algo iba mal. */}
      <MotorHoy />
      <CortesVigentes />

      <hr className="border-border" />

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <TituloSeccion>Mediciones BIS por importar</TituloSeccion>
          <p className="text-muted-foreground">
            Sube el XLSX exportado de Biody Manager para cada evaluacion con la
            identidad ya confirmada.
          </p>
        </header>

        {bisPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay evaluaciones listas para importar BIS.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {bisPending.map((e) => (
              <BisImportForm key={e.evaluationId} evaluation={e} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <TituloSeccion>Generar diagnostico</TituloSeccion>
          <p className="text-muted-foreground">
            Con la medicion BIS importada, genera indicadores, diagnostico y reporte con
            el motor real ANI-BIS-E. Luego revisa los resultados y la Diana.
          </p>
        </header>

        {diagnosisPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay evaluaciones listas para generar diagnostico.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {diagnosisPending.map((e) => (
              <PipelineRunner key={e.evaluationId} evaluation={e} />
            ))}
          </div>
        )}
      </section>

      {/* Seguimiento operativo (NO accion clinica): shells firmados sin responder. Al fondo y discreto
          para no competir con las cuatro colas de arriba. Se oculta solo si esta vacia. */}
      <AwaitingSurveyList items={awaitingSurvey} nowMs={nowMs} />
    </div>
  );
}
