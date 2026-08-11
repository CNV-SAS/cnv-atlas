import "server-only";

import { db } from "@/db";
import { sendConsentCopyEmail } from "@/lib/email/resend";
import { recordAudit } from "@/modules/audit/log";

import { buildConsentCopyEmail } from "./consent-copy";
import { buildConsentInstance, type ConsentInstanceData } from "./consent-instance";
import { maskEmail } from "./otp/otp-service";
import type { ConsentType } from "./validations";

// Envio de la COPIA del consentimiento (B7) DESPUES del commit del intake. Es transparencia, no
// requisito de validez: se ejecuta fuera del camino de respuesta (el llamador usa `after`), un fallo
// de envio NO revierte ni invalida nada, y el intento (exito o fallo) se registra en la traza con
// marca de tiempo y destino ENMASCARADO (dictamen). Rama menor: va al representante (evidenciario) y,
// si el menor registro correo, tambien a el (asintio; le corresponde saber que autorizo su representante).

export type ConsentCopyRecipient = { email: string; role: "titular" | "representante" | "menor" };

export type SendConsentCopyInput = {
  patientId: string;
  acceptedAt: number; // hora del servidor de la aceptacion
  granted: ConsentType[]; // autorizaciones marcadas (para el resumen del encabezado)
  consentVersion: string;
  consentTemplate: string; // plantilla congelada (se personaliza a instancia aqui)
  instance: ConsentInstanceData; // datos para construir la instancia (rama, firma, profesional, etc.)
  recipients: ConsentCopyRecipient[];
  resumeUrl?: string | null; // enlace para continuar/retomar la encuesta (reorganizacion del intake)
};

export async function sendConsentCopy(input: SendConsentCopyInput): Promise<void> {
  if (input.recipients.length === 0) return; // sin destino no hay copia (no deberia pasar: correo obligatorio)

  // La copia lleva la INSTANCIA personalizada (no la plantilla): rama que aplica, firma con los datos del
  // titular y bloque del profesional. La plantilla y el hash no se tocan.
  const instanceMarkdown = buildConsentInstance(input.consentTemplate, input.instance);
  const { subject, html, text } = buildConsentCopyEmail({
    acceptedAt: input.acceptedAt,
    granted: input.granted,
    consentVersion: input.consentVersion,
    instanceMarkdown,
    resumeUrl: input.resumeUrl ?? null,
  });

  const results: { masked_destination: string; role: string; ok: boolean }[] = [];
  for (const r of input.recipients) {
    const sent = await sendConsentCopyEmail(r.email, subject, html, text);
    results.push({ masked_destination: maskEmail(r.email), role: r.role, ok: sent.ok });
  }

  // Fallo total (ningun destinatario recibio) -> evento de fallo; de resto, enviado. En ambos casos se
  // registra por destinatario (enmascarado) para poder reintentar despues a quien no recibio.
  const allFailed = results.every((r) => !r.ok);
  await db.transaction((tx) =>
    recordAudit(tx, {
      event: allFailed ? "consent.copy_failed" : "consent.copy_sent",
      actorId: null,
      actorEmail: null,
      entityType: "patient",
      entityId: input.patientId,
      payload: { sent_at: input.acceptedAt, recipients: results },
      ip: null,
    }),
  );
}
