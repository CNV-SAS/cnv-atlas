import { idDeRuta } from "@/lib/routing/id-de-ruta";
import { Panel } from "@/components/shared/panel";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { VolverA } from "@/components/shared/volver-a";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { getEvaluationHeaderForSession, getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { formatDate } from "@/lib/format/date";
import { SurveyEditForm } from "@/modules/evaluations/components/survey-edit-form";
import { getSurveyFormForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { instrumentoDeLaConsulta } from "@/modules/evaluations/data/instrumento-de-la-consulta";
import { canRegistrarEncuestaDelPaciente } from "@/modules/evaluations/policies/can-manage-evaluations";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";

export const metadata = { title: "Completar encuesta - Atlas" };

// (a) Edicion/completado de la encuesta por el profesional, ANTES del diagnostico. Se llega desde el
// boton "Completar respuestas" de la vista de solo lectura (entrar a editar es DELIBERADO). Si la
// evaluacion YA tiene diagnostico, editar una respuesta sellada es el flujo de CORRECCION (versionado):
// se redirige alli, no se edita directo. La RLS del reader impone que sea su paciente (404).
export default async function EditarEncuestaPage({ params }: { params: Promise<{ id: string }> }) {
  // LA FORMA DEL ID, ANTES DE PREGUNTARLE A LA BASE: un texto que no es un id da 404, no un 500
  // (`lib/routing/id-de-ruta.ts`, caso de Sentry del 2026-11-05).
  const id = idDeRuta((await params).id);
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const [header, results, domains, instrumento] = await Promise.all([
    getEvaluationHeaderForSession(id),
    getEvaluationResults(id),
    // EL LECTOR DEL FORMULARIO, no el de las respuestas: trae el instrumento aunque la evaluacion no
    // tenga ni una respuesta (las 15 consultas del lote del HTML). El otro devuelve null en ese caso y
    // esta pantalla rendia un formulario sin ninguna pregunta.
    getSurveyFormForEvaluation(id),
    // EL INSTRUMENTO, PARA DECIRLO (trazabilidad de su §2.7). La vista de lectura ya lo dice; aqui hacia
    // mas falta todavia, porque esta pantalla es la que ARMA la encuesta: si alguna vez vuelve a armar
    // la de linea base sobre un seguimiento, el rotulo es lo que lo delata.
    instrumentoDeLaConsulta(id),
  ]);
  if (!header) notFound();
  // Ya diagnosticada: no se edita directo, se corrige (version nueva).
  if (results) redirect(`/ani-bis-e/${id}/corregir`);

  // ═══ EL FORMULARIO NO SE ABRE SI LA ENCUESTA AUN SE ESPERA (Santiago, 2026-10-22) ═══
  //
  // ESTE ES EL GUARD QUE DE VERDAD CIERRA EL CASO, y va aqui y no en los enlaces: a esta pantalla se
  // llega desde cuatro sitios (el boton de ver/editar, cada pregunta que falta en la pestaña Encuesta,
  // la puerta del diagnostico y el historial), y arreglar los enlaces uno por uno deja el quinto abierto.
  // El writer ya rechazaba este estado; el defecto era que la pantalla lo descubria DESPUES de que la
  // profesional llenara el formulario, y el trabajo se perdia.
  //
  // SE MANDA A LA PUERTA QUE SI LLEVA, con el mismo borrador ya cargado. Y solo a quien la puede abrir:
  // responder la encuesta es un acto de la consulta y lo hace el profesional que atiende, asi que a
  // admin o soporte se les DICE donde esta en vez de mandarlos a un "no autorizado".
  if (header.status === "awaiting_survey") {
    if (canRegistrarEncuestaDelPaciente(user)) redirect(`/ani-bis-e/${id}/responder-encuesta`);
    return (
      <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
        <TituloPantalla
          volver={<VolverA padre={`/ani-bis-e/${id}/encuesta`} />}
          titulo="La encuesta todavía se está esperando"
          descripcion={`${header.patientName} · ${header.documentLabel} · ${formatDate(header.evaluationDate)}`}
        />
        <Panel>
          <p className="max-w-prose text-sm text-muted-foreground">
            El paciente firmó y su enlace sigue abierto, así que las respuestas que ya hay son un borrador
            suyo y todavía no se editan aquí. Quien la atiende puede continuarla con él desde la consulta
            (&ldquo;Responder la encuesta con el paciente&rdquo;), y al enviarla la evaluación queda lista
            para confirmar y diagnosticar.
          </p>
        </Panel>
      </div>
    );
  }

  const backHref = `/ani-bis-e/${id}/encuesta`;

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      <TituloPantalla
        volver={<VolverA padre={backHref} />}
        titulo="Completar la encuesta"
        descripcion={`${header.patientName} · ${header.documentLabel} · ${formatDate(header.evaluationDate)} · Instrumento: ${instrumento}`}
      />

      {/* En superficie, igual que la vista de lectura: el formulario estaba suelto sobre el gris. */}
      <Panel>
        <SurveyEditForm evaluationId={id} domains={domains} backHref={backHref} />
      </Panel>
    </div>
  );
}
