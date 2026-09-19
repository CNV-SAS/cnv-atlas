import { NextResponse } from "next/server";

import { db } from "@/db";
import { formatDate } from "@/lib/format/date";
import { recordAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/session";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import {
  nombreDelArchivo,
  respuestasACsv,
} from "@/modules/evaluations/services/exportar-respuestas";
import { getHcHeaderForEvaluation } from "@/modules/reports/data/hc-header-reader";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";

// DESCARGAR LAS RESPUESTAS DE LA ENCUESTA (observación f de Gildardo).
//
// POR QUE UNA RUTA Y NO UNA ACTION: lo que se devuelve es un ARCHIVO, y una server action devuelve datos
// para una pantalla. Aquí el navegador hace lo que sabe hacer con un `Content-Disposition: attachment`.
//
// EL ALCANCE LO PONE LA RLS, no un filtro escrito aquí: los dos lectores consultan con la sesión del
// profesional, así que una evaluación ajena simplemente no existe para ellos. La policy `canViewPatients`
// es la misma que gatea ver la ficha, porque esto es exactamente eso: ver lo que el paciente respondió.
//
// Y QUEDA REGISTRADO. Es la respuesta a la mitad que faltaba de esta observación: no basta con poder
// descargar, tiene que constar quién se llevó una copia de las respuestas de un paciente y cuándo. Un
// archivo que sale de la clínica sin rastro es justo lo que la auditoría clínica existe para impedir.
//
// Node runtime: audit inline con Drizzle.
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canViewPatients(user)) return new NextResponse("No autorizado", { status: 403 });

  const [domains, header] = await Promise.all([
    getSurveyAnswersForEvaluation(id),
    getHcHeaderForEvaluation(id),
  ]);
  // Sin cabecera, la evaluación no es suya (la RLS no la alcanza) o no existe: para quien llama es lo
  // mismo, y decir cuál de las dos sería contar que existe un paciente ajeno.
  if (!header) return new NextResponse("Evaluación no disponible", { status: 404 });
  if (!domains || domains.length === 0) {
    return new NextResponse("Esta evaluación todavía no tiene respuestas de encuesta", { status: 404 });
  }

  const preguntas = domains.reduce((n, d) => n + d.questions.length, 0);
  const procedencia = {
    paciente: header.paciente,
    documento: header.documento ?? "",
    fecha: formatDate(header.fechaConsulta),
    profesional: header.profesional,
    evaluationId: id,
  };
  const csv = respuestasACsv(domains, procedencia);

  await db.transaction((tx) =>
    recordAudit(tx, {
      event: "survey.answers_exported",
      actorId: user.id,
      actorEmail: user.email,
      entityType: "evaluation",
      entityId: id,
      payload: { preguntas: preguntas },
      ip: null,
    }),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreDelArchivo(procedencia)}"`,
      // Datos de un paciente: no se cachean en ningún sitio intermedio.
      "Cache-Control": "private, no-store",
    },
  });
}
