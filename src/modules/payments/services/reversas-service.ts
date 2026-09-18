import "server-only";

import * as Sentry from "@sentry/nextjs";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import * as writer from "../data/reversas-writer";

// ═══ LAS REVERSAS DE VENTA (Bloque 3b, sesion 1) ═══
//
// Un contracargo es un HECHO QUE LLEGA, no una decision de CNV: el paciente desconoce el pago ante su banco y el
// banco debita. Lo que Atlas hace es enterarse, registrarlo y, si se pierde, sacar esa venta de las cifras.
//
// Abrir NO mueve el ingreso (contabilidad, 2026-09-16): la disputa se puede ganar y la factura sigue siendo
// valida mientras viva. Perder si lo mueve, y ademas deja pendiente la nota credito manual en Alegra.

export type AperturaManual = {
  transactionId: string;
  referenciaDeLaDisputa: string | null;
  montoDebitado: string | null;
  debitadoEn: string | null;
  nota: string | null;
  actorId: string;
};

/** La abre una persona de CNV, cuando llega el correo de disputa de Wompi. */
export async function abrirContracargo(e: AperturaManual): Promise<{ id: string } | { yaHabiaUna: true }> {
  const id = await writer.abrirReversa({
    transactionId: e.transactionId,
    tipo: "contracargo",
    referenciaDeLaDisputa: e.referenciaDeLaDisputa,
    montoDebitado: e.montoDebitado,
    debitadoEn: e.debitadoEn,
    nota: e.nota,
    actorId: e.actorId,
  });
  return id ? { id } : { yaHabiaUna: true };
}

/**
 * EL `VOIDED` SOBRE UNA VENTA YA PAGADA, que hasta hoy se ignoraba en silencio: el webhook lo marcaba procesado y
 * no hacia nada, con la factura viva, el inventario descontado y la comision sellada.
 *
 * Distingue TRES desenlaces, y la diferencia importa: "abierta" es noticia y alerta; "ya_estaba" es el cotejo
 * volviendo a ver el mismo caso cada dia, y ahi callar es lo correcto; "no_aplica" es el rechazo normal de un
 * link que nadie llego a pagar, que no es una reversa y lo maneja quien llama.
 */
export type DesenlaceDeAnulacion = "abierta" | "ya_estaba" | "no_aplica";

export async function abrirPorAnulacionDeWompi(
  txId: string,
  estadoEnWompi: string,
  wompiTxId: string | null,
): Promise<DesenlaceDeAnulacion> {
  const [venta] = await db.execute<{ status: string }>(sql`
    select status::text as status from transactions where id = ${txId}`);
  if (!venta || venta.status !== "paid") return "no_aplica";

  const id = await writer.abrirReversa({
    transactionId: txId,
    tipo: "anulacion_wompi",
    referenciaDeLaDisputa: wompiTxId,
    montoDebitado: null,
    debitadoEn: null,
    nota: `Wompi reportó la transacción como ${estadoEnWompi} sobre una venta que aquí estaba pagada.`,
    actorId: null,
  });
  // SOLO AL ABRIRLO (Santiago, 2026-09-18). El cotejo vuelve a ver la misma venta cada dia hasta que se resuelva,
  // y alertar en cada corrida hace crecer el error sin parar hasta que deja de significar algo. Nivel ERROR
  // cuando SI es nuevo: el dinero de una venta ya facturada dejo de estar, y eso necesita a alguien hoy.
  if (id) {
    Sentry.captureMessage(`Wompi reportó ${estadoEnWompi} sobre una venta pagada: se abrió una reversa`, {
      level: "error",
      tags: { area: "reversa-de-venta", transactionId: txId },
      extra: { referenciaDeWompi: wompiTxId },
    });
  }
  return id ? "abierta" : "ya_estaba";
}

export async function resolverReversa(e: {
  reversaId: string;
  resultado: "ganada" | "perdida";
  referenciaDeLaRespuesta: string | null;
  actorId: string;
}): Promise<{ revirtio: boolean }> {
  const r = await writer.resolverReversa(e);
  if (r.revirtio) {
    // Queda escrito en Sentry porque es plata saliendo de las cifras, y porque el patron (varias perdidas
    // seguidas, o del mismo Integrante) dice mas que cada caso suelto.
    Sentry.captureMessage("Disputa perdida: se revirtieron ingreso y comisión de la venta", {
      level: "warning",
      tags: { area: "reversa-de-venta", transactionId: r.transactionId },
    });
  }
  return { revirtio: r.revirtio };
}

export const registrarNotaCreditoDeReversa = writer.registrarNotaCreditoDeReversa;
export const listarReversas = writer.listarReversas;
