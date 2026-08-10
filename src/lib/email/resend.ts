import "server-only";

import { Resend } from "resend";

import { appError, err, ok, type Result } from "@/core/errors";

// Cliente Resend y envio de correos transaccionales. Server-side (la API key nunca
// llega al cliente). Toda llamada externa con timeout explicito (regla dura 10).
//
// El SDK de Resend (6.x) no acepta AbortSignal en emails.send, asi que acotamos la
// espera con AbortSignal.timeout via Promise.race. No cancela la peticion subyacente
// (el SDK no lo permite), pero bota el await dentro del limite, que es lo que la regla
// exige observar.

const SEND_TIMEOUT_MS = 15_000;

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const signal = AbortSignal.timeout(ms);
      signal.addEventListener(
        "abort",
        () => reject(new Error(`Resend: timeout tras ${ms} ms`)),
        { once: true },
      );
    }),
  ]);
}

export type ReportEmailInput = {
  to: string;
  subject: string;
  text: string;
  pdf: { filename: string; content: Buffer };
};

// Envia el reporte al paciente con el PDF adjunto. Devuelve Result: el envio es una
// accion externa hacia afuera, no hace throw para errores esperables (config faltante,
// fallo del proveedor, timeout); el llamador decide (no marca enviado si falla).
export async function sendReportEmail(input: ReportEmailInput): Promise<Result<{ id: string }>> {
  const resend = getClient();
  if (!resend) {
    return err(appError("internal", "El servicio de correo no esta configurado."));
  }
  const from = process.env.EMAIL_FROM;
  if (!from) {
    return err(appError("internal", "Falta la dirección de envio (EMAIL_FROM)."));
  }
  // Reply-To a un buzon que SI se lee (soporte): el From es una direccion de solo-envio. Si un paciente
  // responde el reporte, la respuesta debe llegar a alguien. Solo se agrega si esta configurada.
  const replyTo = process.env.EMAIL_REPLY_TO;

  try {
    const res = await withTimeout(
      resend.emails.send({
        from,
        ...(replyTo ? { replyTo } : {}),
        to: input.to,
        subject: input.subject,
        text: input.text,
        attachments: [{ filename: input.pdf.filename, content: input.pdf.content }],
      }),
      SEND_TIMEOUT_MS,
    );
    if (res.error) {
      return err(appError("internal", `No se pudo enviar el correo: ${res.error.message}`));
    }
    return ok({ id: res.data?.id ?? "" });
  } catch (e) {
    return err(appError("internal", e instanceof Error ? e.message : "Error enviando el correo."));
  }
}

// Codigo de verificacion (OTP) del consentimiento (B7). Mismo remitente verificado que el reporte,
// pero ASUNTO DISTINTO y sin adjunto: llega antes que la copia del consentimiento y no debe confundirse
// con ella. El correo NO revela para que sesion es (solo el codigo), y el codigo no se registra en la
// traza (solo el hecho de haberse validado). Texto plano, corto.
export async function sendConsentOtpEmail(to: string, code: string): Promise<Result<{ id: string }>> {
  const resend = getClient();
  if (!resend) return err(appError("internal", "El servicio de correo no esta configurado."));
  const from = process.env.EMAIL_FROM;
  if (!from) return err(appError("internal", "Falta la dirección de envio (EMAIL_FROM)."));
  const replyTo = process.env.EMAIL_REPLY_TO;
  try {
    const res = await withTimeout(
      resend.emails.send({
        from,
        ...(replyTo ? { replyTo } : {}),
        to,
        subject: `Tu código de verificación de Atlas: ${code}`,
        text:
          `Tu código de verificación para firmar el consentimiento en Atlas es: ${code}\n\n` +
          `Ingrésalo en la pantalla para continuar. El código vence en 10 minutos.\n` +
          `Si no solicitaste este código, ignora este correo.`,
      }),
      SEND_TIMEOUT_MS,
    );
    if (res.error) return err(appError("internal", `No se pudo enviar el código: ${res.error.message}`));
    return ok({ id: res.data?.id ?? "" });
  } catch (e) {
    return err(appError("internal", e instanceof Error ? e.message : "Error enviando el código."));
  }
}

// Copia del consentimiento (B7). Mismo remitente verificado, ASUNTO DISTINTO al del codigo (llega
// minutos despues y no debe confundirse) y sin adjunto: el texto integro va en el cuerpo. Es
// transparencia, no requisito de validez: el llamador NO revierte nada si esto falla, solo lo registra.
export async function sendConsentCopyEmail(
  to: string,
  subject: string,
  text: string,
): Promise<Result<{ id: string }>> {
  const resend = getClient();
  if (!resend) return err(appError("internal", "El servicio de correo no esta configurado."));
  const from = process.env.EMAIL_FROM;
  if (!from) return err(appError("internal", "Falta la dirección de envio (EMAIL_FROM)."));
  const replyTo = process.env.EMAIL_REPLY_TO;
  try {
    const res = await withTimeout(
      resend.emails.send({
        from,
        ...(replyTo ? { replyTo } : {}),
        to,
        subject,
        text,
      }),
      SEND_TIMEOUT_MS,
    );
    if (res.error) return err(appError("internal", `No se pudo enviar la copia: ${res.error.message}`));
    return ok({ id: res.data?.id ?? "" });
  } catch (e) {
    return err(appError("internal", e instanceof Error ? e.message : "Error enviando la copia."));
  }
}
