import "server-only";

import { appError, err, ok, type Result } from "@/core/errors";
import { sendReportEmail } from "@/lib/email/resend";

import { getHistoriaClinicaDoc } from "../data/hc-documento-reader";
import { getPatientContactForEvaluation, writeHcDelivery } from "../data/hc-entregas-writer";
import { renderHistoriaClinicaPdf } from "./render-report";

// ENTREGARLE LA HISTORIA CLINICA AL PACIENTE.
//
// SU DERECHO Y QUIEN LO CUMPLE: el paciente tiene derecho a su historia clinica completa (Resolucion 1995,
// Ley 1581), y quien se la entrega es SU PROFESIONAL, no CNV (Anexo 3, clausula 13). Esto es la herramienta
// con la que la entrega, no un envio automatico: lo dispara el profesional, sobre el paciente que se la
// pidio.
//
// EL ORDEN ES EL DE `sendReport`, y por la misma razon (D4, la accion externa hacia afuera):
// componer -> renderizar -> ENVIAR -> y solo si el correo sale, registrar la entrega. Si el correo falla,
// no queda un registro diciendo que se entrego algo que nunca salio.
//
// NO SE GUARDA EL PDF. Se regenera del mismo lector cuando haga falta, y almacenar una copia de la
// historia clinica en cada entrega multiplicaria las copias de PHI sin ganar nada.

export type EntregarHcInput = {
  evaluationId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function entregarHistoriaClinica(
  input: EntregarHcInput,
): Promise<Result<{ enviadaA: string }>> {
  const contacto = await getPatientContactForEvaluation(input.evaluationId);
  if (!contacto) return err(appError("not_found", "Evaluación no encontrada."));
  if (!contacto.email) {
    // Se dice QUE falta y DONDE se arregla: un "no se pudo enviar" a secas deja al profesional sin saber
    // si el problema es suyo, del paciente o del sistema.
    return err(
      appError(
        "validation",
        "El paciente no tiene un correo registrado, así que no hay a dónde enviarle su historia clínica. " +
          "Regístralo en su ficha y vuelve a intentarlo.",
      ),
    );
  }

  const hc = await getHistoriaClinicaDoc(input.evaluationId);
  if (!hc) return err(appError("not_found", "Esta evaluación no tiene historia clínica."));

  const pdf = await renderHistoriaClinicaPdf(hc);

  const enviado = await sendReportEmail({
    to: contacto.email,
    subject: "Tu historia clínica",
    text:
      `Hola ${hc.paciente}. Adjuntamos tu historia clínica de la consulta del ${hc.fechaConsulta}, ` +
      `que solicitaste a tu profesional. Si tienes dudas, escríbele.`.trim(),
    pdf: { filename: "historia-clinica.pdf", content: pdf },
  });
  if (!enviado.ok) return enviado;

  // El registro va DESPUES del correo, y con su rastro inline en la misma transaccion (regla dura 8).
  await writeHcDelivery({
    evaluationId: input.evaluationId,
    patientId: contacto.patientId,
    sentTo: contacto.email,
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    ip: input.ip,
  });

  return ok({ enviadaA: contacto.email });
}
