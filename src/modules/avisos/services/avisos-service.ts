import "server-only";

import { createHash } from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { formatDateTime } from "@/lib/format/date";
import { sendAvisoEmail } from "@/lib/email/resend";

import * as repo from "../data/avisos-repository";
import { armarResumen, type Franja } from "../resumen";

// ═══ LOS AVISOS: el resumen diario y el aviso al Integrante (Bloque A) ═══
//
// NINGUNO DE LOS DOS LANZA hacia quien los llama. El resumen lo dispara una tarea programada: un error se registra
// en su fila y en Sentry. El aviso al Integrante corre dentro del webhook de Wompi, que tiene que responder 200
// porque el pago ya se sello: un correo que falla no puede hacer que Wompi reintente el pago.

function enlaceAPagos(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/pagos`;
}

/**
 * La llave de idempotencia de un correo: el mismo envio (dia, franja, destinatarios y texto) reintentado no llega dos
 * veces. Si el contenido cambio entre el fallo y el reintento, es otro correo y sale.
 */
// LA LLAVE LLEVA EL ID DE LA CORRIDA, NO EL DIA Y LA FRANJA (smoke del Bloque A, 2026-09-16). Con dia y franja, el
// resumen de las 7 a. m. y un reenvio posterior del mismo dia eran "el mismo correo" para Resend, que respondia con
// el id del original y NO lo mandaba: Atlas decia "enviado" con razon (Resend acepto) y el correo no salia. Con el
// id de la corrida, un reintento de la MISMA corrida sigue sin duplicar, y una corrida nueva si sale.
function claveDeEnvio(prefijo: string, to: string[], asunto: string, cuerpo: string): string {
  const huella = createHash("sha256").update(JSON.stringify([[...to].sort(), asunto, cuerpo])).digest("hex").slice(0, 32);
  return `${prefijo}:${huella}`;
}

function diaEnColombia(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(fecha);
}

export type ResultadoDelResumen =
  | { estado: "ya_enviado" }
  | { estado: "sin_envio"; motivo: string }
  | { estado: "enviado"; destinatarios: number; escalamiento: number };

/**
 * EL RESUMEN DE UNA FRANJA. Se reclama primero (una sola vez por dia y franja), se arma con lo pendiente y con lo
 * avisado la vez anterior, y se envia solo si hay algo que lo amerite.
 */
export async function enviarResumen(franja: Franja, ahora: Date = new Date()): Promise<ResultadoDelResumen> {
  const dia = diaEnColombia(ahora);
  const envioId = await repo.reclamarEnvio(dia, franja);
  if (!envioId) return { estado: "ya_enviado" };

  try {
    const [pendientes, anteriores] = await Promise.all([
      repo.listarPendientesDeAccion(),
      repo.clavesDelEnvioAnterior(dia, franja),
    ]);
    const r = armarResumen({ pendientes, anteriores, ahora, franja, enlace: enlaceAPagos() });

    if (!r.enviar) {
      await repo.cerrarEnvio(dia, franja, { claves: r.claves, enviado: false, motivo: r.motivoSiNo, destinatarios: 0 });
      return { estado: "sin_envio", motivo: r.motivoSiNo ?? "" };
    }

    const para = await repo.destinatarios("pendientes_ventas");
    if (para.length === 0) {
      // UN CONTROL SIN DESTINATARIO ES EL MISMO PROBLEMA QUE UN PANEL QUE NADIE MIRA. No se marca como avisado:
      // lo pendiente sigue siendo "nuevo" el dia que alguien tenga la marca.
      Sentry.captureMessage("Hay pendientes de ventas y NADIE tiene la marca para recibirlos", {
        level: "error",
        tags: { area: "avisos-sin-destinatario" },
        extra: { franja, conteo: r.conteo },
      });
      await repo.cerrarEnvio(dia, franja, { claves: [], enviado: false, motivo: "Sin destinatarios con la marca.", destinatarios: 0 });
      return { estado: "sin_envio", motivo: "Sin destinatarios con la marca." };
    }

    const envio = await sendAvisoEmail(para, r.asunto, r.cuerpo, claveDeEnvio(`avisos:${envioId}`, para, r.asunto, r.cuerpo));
    if (!envio.ok) throw new Error(envio.error.message);

    let escalamiento = 0;
    if (r.escalamiento.enviar) {
      const esc = (await repo.destinatarios("escalamiento_ventas")).filter((e) => !para.includes(e));
      if (esc.length > 0) {
        const e = await sendAvisoEmail(
          esc,
          r.escalamiento.asunto,
          r.escalamiento.cuerpo,
          claveDeEnvio(`avisos:${envioId}:escalamiento`, esc, r.escalamiento.asunto, r.escalamiento.cuerpo),
        );
        if (e.ok) escalamiento = esc.length;
        else Sentry.captureMessage(`No salió el correo de escalamiento: ${e.error.message}`, { level: "error", tags: { area: "avisos" } });
      }
    }
    await repo.cerrarEnvio(dia, franja, { claves: r.claves, enviado: true, motivo: null, destinatarios: para.length + escalamiento });
    return { estado: "enviado", destinatarios: para.length, escalamiento };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "avisos", franja } });
    // Queda escrito por que no salio, y la fila queda LIBRE para reintentar (`reclamarEnvio`): correr la tarea otra
    // vez lo envia, no responde "ya_enviado". Las claves NO se guardan: si no salio, lo pendiente sigue siendo nuevo.
    await repo
      .cerrarEnvio(dia, franja, { claves: [], enviado: false, motivo: `Falló: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), destinatarios: 0 })
      .catch(() => {});
    return { estado: "sin_envio", motivo: "Falló el envío; ver Sentry." };
  }
}

/**
 * EL AVISO AL INTEGRANTE cuando un pago de su venta entra en revision (Santiago, 2026-09-15: es quien sabe que
 * paso, y sin esto no se entera de nada). Una vez por venta. Sin datos del paciente.
 */
export async function avisarAlIntegranteDeRevision(transactionId: string): Promise<void> {
  try {
    const d = await repo.datosDelAvisoAlIntegrante(transactionId);
    // Sin profesional (la vendio un administrador) no hay a quien avisar: lo ve Direccion en su resumen.
    if (!d || d.avisado) return;
    if (!(await repo.marcarIntegranteAvisado(transactionId))) return;
    const texto = [
      `Hola, ${d.nombre}.`,
      "",
      `Llegó un pago sobre un link de pago que ya estaba anulado: la venta del ${formatDateTime(d.fecha)} por ${Number(d.monto).toLocaleString("es-CO")} COP (${d.productos}).`,
      "",
      "Puede ser un cobro doble (el paciente también pagó en efectivo) o una segunda compra. Tú sabes qué pasó en la consulta.",
      "",
      // Se cuenta en la pestana Tratamiento, no en Pagos: alli el Integrante solo ve la lista, sin el formulario.
      `Entra a Atlas, abre la pestaña Tratamiento de la evaluación de ese paciente y usa "Cuéntale a CNV qué pasó en la consulta". En Pagos ves la venta con su fecha y su monto: ${enlaceAPagos()}`,
      "",
      "No entregues el producto de esa venta hasta que CNV la resuelva.",
    ].join("\n");
    const r = await sendAvisoEmail([d.email], "Atlas · Un pago de tu venta necesita que nos cuentes qué pasó", texto, `aviso-integrante:${transactionId}`);
    if (!r.ok) {
      Sentry.captureMessage(`No salió el aviso al Integrante: ${r.error.message}`, {
        level: "error",
        tags: { area: "aviso-integrante", transactionId },
      });
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "aviso-integrante", transactionId } });
  }
}
