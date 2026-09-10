import { redirect } from "next/navigation";

import { TituloPantalla, TituloSeccion } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { BisImportForm } from "@/modules/bis/components/bis-import-form";
import { listEvaluationsForBisImport } from "@/modules/bis/data/bis-evaluations-reader";
import { PipelineRunner } from "@/modules/clinical-pipeline/components/pipeline-runner";
import { listEvaluationsForDiagnosis } from "@/modules/clinical-pipeline/data/pipeline-evaluations-reader";
import { AwaitingSurveyList } from "@/modules/evaluations/components/awaiting-survey-list";
import { listAwaitingSurveyEvaluations } from "@/modules/evaluations/data/evaluations-repository";
import {
  canConfirmIdentity,
  canEmitFollowupLink,
} from "@/modules/evaluations/policies/can-manage-evaluations";

export const metadata = { title: "Evaluaciones - Atlas" };

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

          Y LA ENTRADA DEL SIDEBAR SE QUEDA, con otro nombre. Retirarla obligaria a importar el BIS desde
          algun sitio que no existe. Lo que cambia es el rotulo: "Modelo ANI-BIS-E" se leia como "la lista
          de evaluaciones", que es justo lo que ahora es /pacientes. */}
      <TituloPantalla
        titulo="Bandeja de trabajo"
        descripcion="Lo que se hace por lote y no paciente por paciente. Para trabajar a un paciente concreto, ve a la lista de pacientes."
      />

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
