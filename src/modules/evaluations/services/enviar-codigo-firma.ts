import "server-only";

import type { LimitResult } from "@/core/rate-limit";
import { sendConsentOtpEmail } from "@/lib/email/resend";
import { generateOtpCode, maskEmail, storeOtp } from "@/modules/consent/otp/otp-service";

import { otpSendSchema } from "../validations";

// ENVIO DEL CODIGO DE FIRMA, compartido por las DOS superficies que lo piden.
//
// POR QUE EXISTE. El envio se pedia solo desde el enlace publico, y su action arrancaba exigiendo el
// token del enlace. En presencial no hay enlace (el profesional esta creando al paciente en su pantalla),
// asi que devolvia "Link invalido" y bloqueaba la firma entera: sin codigo no se firma.
//
// LA ALTERNATIVA ERA UNA SEGUNDA COPIA DEL ENVIO, y es justo el defecto que ya nos mordio antes: el
// segundo constructor del mismo insumo hereda los defectos que el primero ya resolvio, y aqui lo que
// heredaria mal es la evidencia de la firma (la hora del SERVIDOR, el enmascarado del destino, el fallo
// en voz alta si no hay almacen). Eso no puede divergir entre dos caminos que producen la misma prueba.
//
// LO QUE CAMBIA ENTRE LAS DOS Y POR ESO ENTRA POR PARAMETRO: quien autoriza (el token del enlace, o la
// sesion del profesional) y SOBRE QUE se cuenta el limite. Nada mas. El destino, el codigo, el almacen y
// el correo son identicos, y por eso viven aqui una sola vez.
export type EnvioCodigo =
  | { ok: true; maskedDestination: string; remaining: number | null }
  | { ok: false; error: string };

export async function enviarCodigoDeFirma(input: {
  sessionId: string;
  /** Rama de edad: decide el destino (mayor -> paciente; menor -> representante) y el mensaje del fallo. */
  ageBranch: "mayor" | "menor";
  /** Correo destino YA resuelto por rama. El servicio no lo elige: solo lo valida y lo usa. */
  destino: string;
  /** El limite y su ancla los decide la superficie. Se evalua DESPUES de validar la forma. */
  limitar: () => Promise<LimitResult>;
}): Promise<EnvioCodigo> {
  const parsed = otpSendSchema.safeParse({ sessionId: input.sessionId, email: input.destino });
  if (!parsed.success) {
    return {
      ok: false,
      error:
        input.ageBranch === "menor"
          ? "Necesitamos el correo del representante para enviar el código de verificación."
          : "Necesitamos tu correo para enviarte el código de verificación.",
    };
  }

  // EL LIMITE VA DESPUES DE LA VALIDACION DE FORMA, no antes: un correo mal escrito no puede gastar uno
  // de los cinco envios (el paciente lo corrige y vuelve a pedirlo, que es el camino normal).
  const limit = await input.limitar();
  if (!limit.success) {
    return { ok: false, error: "Enviaste demasiados códigos. Espera unos minutos e intenta de nuevo." };
  }

  const code = generateOtpCode();
  const masked = maskEmail(parsed.data.email);
  const stored = await storeOtp(parsed.data.sessionId, code, {
    channel: "email",
    maskedDestination: masked,
    // Hora del SERVIDOR (epoch-ms), no del cliente: es prueba del envio y no puede falsearse.
    sentAt: Date.now(),
  });
  if (!stored) {
    // Sin almacen (Upstash ausente o caido) no hay OTP: no se debe dejar pasar la firma en silencio.
    return {
      ok: false,
      error:
        "La verificación no está disponible en este momento. No es un problema de tus datos: intenta de nuevo en unos minutos y, si continúa, avisa a tu profesional.",
    };
  }

  const sent = await sendConsentOtpEmail(parsed.data.email, code);
  if (!sent.ok) {
    return { ok: false, error: "No pudimos enviar el código. Revisa el correo e intenta de nuevo." };
  }

  return { ok: true, maskedDestination: masked, remaining: limit.remaining };
}
