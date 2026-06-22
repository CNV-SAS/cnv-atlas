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
    return err(appError("internal", "Falta la direccion de envio (EMAIL_FROM)."));
  }

  try {
    const res = await withTimeout(
      resend.emails.send({
        from,
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
