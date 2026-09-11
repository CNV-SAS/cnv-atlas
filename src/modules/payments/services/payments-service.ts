import { randomUUID } from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { baseFromTotal } from "@/core/iva";
import { missingEnvMessage } from "@/lib/env/missing-env";
import { createAlegraInvoice } from "@/lib/alegra/client";
import { computeIntegritySignature } from "@/lib/wompi/signatures";
import type { CurrentUser } from "@/modules/auth/roles";
import { listNutraceuticals } from "@/modules/nutraceuticals/data/nutraceuticals-repository";

import type { CheckoutView } from "../data/checkout-reader";
import * as repo from "../data/payments-repository";
import {
  createPaidCashTransaction,
  createTransactionWithItems,
  markTransactionFailed,
  markWebhookProcessed,
  recordWebhookEvent,
  sealPaidTransaction,
  setAlegraInvoiceId,
  type NewOrderLine,
  type SealedTransaction,
} from "../data/payments-writer";
import type { CreateCheckoutInput, WompiEventInput } from "../validations";

// Servicio de pagos (la logica vive aqui; las actions y el route handler son thin).
// Asume que el caller ya autorizo (policy) y, en el webhook, que la firma HMAC ya
// fue verificada por el handler.

const WOMPI_PROVIDER = "wompi";

// Error esperable de creacion de checkout (nutraceutico sin precio o inexistente).
// La action lo mapea a un AppError de validacion.
export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type CheckoutCreated = { transactionId: string; checkoutUrl: string };

// Resuelve una venta ANTES de cobrarla, comun al checkout (Wompi) y a la venta en efectivo: el profesional
// para la comision (el que la crea; si es admin, el asignado al paciente; null => todo va a CNV) y las
// lineas con el precio SELLADO desde el catalogo (nunca del cliente). CNV vende: el precio lo pone CNV.
async function resolveSale(
  input: CreateCheckoutInput,
  user: CurrentUser,
): Promise<{ professionalId: string | null; lines: NewOrderLine[]; amount: number }> {
  let professionalId = await repo.getProfessionalProfileIdByUser(user.id);
  if (!professionalId) {
    professionalId = await repo.getProfessionalIdForPatient(input.patientId);
  }

  const catalog = await listNutraceuticals();
  const byId = new Map(catalog.map((n) => [n.id, n]));
  const lines: NewOrderLine[] = [];
  let amount = 0;
  for (const it of input.items) {
    const n = byId.get(it.nutraceuticalId);
    if (!n) throw new CheckoutError("Uno de los nutracéuticos no existe.");
    if (n.unit_price == null) {
      throw new CheckoutError(`El nutracéutico "${n.name}" no tiene precio configurado.`);
    }
    // ═══ LA DISPONIBILIDAD SE COMPRUEBA AQUI, NO SOLO EN LA PANTALLA (2026-09-11) ═══
    //
    // La pagina de /pagos ya filtra el catalogo, pero un filtro de formulario es una comodidad, no una
    // garantia: la accion recibe ids y se puede invocar con cualquiera. La regla vive donde se decide la
    // venta (regla 2: ninguna logica de negocio en pages).
    //
    // Y ES LA MISMA REGLA QUE YA APLICA LA ENTREGA (`recordDespacho`). Que existiera en un lado y no en el
    // otro es como un producto marcado `no_disponible` podia venderse: la bandera gateaba media puerta.
    if (n.commercial_availability !== "en_consultorio") {
      throw new CheckoutError(
        n.commercial_availability === "solo_tienda"
          ? `"${n.name}" lo compra el paciente en la tienda, no se cobra aquí.`
          : `"${n.name}" no está disponible para la venta.`,
      );
    }
    const unitPrice = Number(n.unit_price);
    lines.push({ nutraceuticalId: n.id, quantity: it.quantity, unitPrice });
    amount += unitPrice * it.quantity;
  }
  amount = Math.round(amount * 100) / 100;
  if (amount <= 0) throw new CheckoutError("El monto de la venta debe ser mayor a cero.");
  return { professionalId, lines, amount };
}

// Crea el checkout: sella los precios desde el catalogo, crea la transaccion pending con sus items y
// devuelve el link 24h que el profesional comparte con el paciente. El pago lo sella el webhook.
export async function createCheckout(
  input: CreateCheckoutInput,
  user: CurrentUser,
): Promise<CheckoutCreated> {
  const { professionalId, lines, amount } = await resolveSale(input, user);
  const { id } = await createTransactionWithItems({
    organizationId: user.organizationId,
    patientId: input.patientId,
    professionalId,
    amount,
    currency: "COP",
    idempotencyKey: randomUUID(),
    items: lines,
  });

  return { transactionId: id, checkoutUrl: buildCheckoutUrl(id) };
}

export type CashSaleCreated = { transactionId: string; amount: number };

// Venta en EFECTIVO: el integrante recauda dinero de CNV en el momento. Misma resolucion de venta y mismo
// sellado contable que el checkout (CNV vende, integrante recauda; comision + ingreso sobre la base sin
// IVA), pero la transaccion nace YA pagada (createPaidCashTransaction). idempotencyKey lo trae el cliente
// (uno por intento) para que un doble-clic no cobre dos veces. La factura de Alegra NO se emite aqui:
// espera el cableado con la regla contable (CNV factura al paciente); hoy la venta se sella internamente.
export async function registerCashSale(
  input: CreateCheckoutInput,
  user: CurrentUser,
  idempotencyKey: string,
): Promise<CashSaleCreated> {
  const { professionalId, lines, amount } = await resolveSale(input, user);
  const { id } = await createPaidCashTransaction({
    organizationId: user.organizationId,
    patientId: input.patientId,
    professionalId,
    amount,
    currency: "COP",
    idempotencyKey,
    items: lines,
  });
  return { transactionId: id, amount };
}

function buildCheckoutUrl(transactionId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}/checkout/${transactionId}`;
}

// ----- Parametros del redirect a Wompi (los consume la pagina publica) -----

export type WompiCheckoutParams = {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
  redirectUrl: string;
};

// Arma los campos del Web Checkout por redirect, incluida la firma de integridad.
// El reference es el id de la transaccion (lo devuelve Wompi en el webhook).
export function buildWompiCheckoutParams(view: CheckoutView): WompiCheckoutParams {
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
  const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
  const missing = missingEnvMessage({
    NEXT_PUBLIC_WOMPI_PUBLIC_KEY: publicKey,
    WOMPI_INTEGRITY_SECRET: integritySecret,
  });
  if (missing) throw new Error(missing);
  // missingEnvMessage ya lanzo si faltaba alguna; el `!` es solo para el narrowing de TS.
  const amountInCents = Math.round(Number(view.amount) * 100);
  const reference = view.id;
  const currency = view.currency;
  const signature = computeIntegritySignature({
    reference,
    amountInCents,
    currency,
    integritySecret: integritySecret!,
  });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    publicKey: publicKey!,
    currency,
    amountInCents,
    reference,
    signature,
    redirectUrl: `${base}/checkout/${reference}/resultado`,
  };
}

// ----- Procesamiento del webhook de Wompi -----

export type WebhookOutcome = {
  handled: boolean;
  duplicate: boolean;
  sealed: boolean;
};

// Mapea el estado de Wompi al estado interno de la transaccion.
function mapWompiStatus(status: string): "paid" | "failed" | "ignore" {
  switch (status) {
    case "APPROVED":
      return "paid";
    case "DECLINED":
    case "VOIDED":
    case "ERROR":
      return "failed";
    default:
      return "ignore"; // PENDING u otros: no se actua todavia
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Procesa un evento de Wompi ya verificado (HMAC) y parseado (Zod). La idempotencia
// la da recordWebhookEvent (unique provider+external_id): un duplicado produce un
// solo efecto. El sellado del pago es ademas idempotente por status='pending'.
export async function processWompiWebhook(event: WompiEventInput): Promise<WebhookOutcome> {
  const tx = event.data.transaction;
  const txId = tx.reference; // el reference es el id de nuestra transaccion
  const wompiTxId = tx.id;
  // external_id por (transaccion, estado): reintentos del mismo estado colisionan.
  const externalId = `${wompiTxId}:${tx.status}`;

  const record = await recordWebhookEvent(WOMPI_PROVIDER, externalId, event);
  if (!record.isNew && record.alreadyProcessed) {
    return { handled: true, duplicate: true, sealed: false };
  }

  if (!UUID_RE.test(txId)) {
    // reference que no es una transaccion nuestra: se marca procesado y se ignora.
    await markWebhookProcessed(WOMPI_PROVIDER, externalId);
    return { handled: true, duplicate: false, sealed: false };
  }

  const internal = mapWompiStatus(tx.status);
  if (internal === "ignore") {
    await markWebhookProcessed(WOMPI_PROVIDER, externalId);
    return { handled: true, duplicate: false, sealed: false };
  }

  if (internal === "failed") {
    await markTransactionFailed(txId, wompiTxId);
    await markWebhookProcessed(WOMPI_PROVIDER, externalId);
    return { handled: true, duplicate: false, sealed: false };
  }

  // paid: sella el pago (comision + ingreso) y luego intenta la factura en Alegra.
  const sealed = await sealPaidTransaction(txId, wompiTxId);
  await markWebhookProcessed(WOMPI_PROVIDER, externalId);
  if (sealed) await tryCreateAlegraInvoice(sealed);

  return { handled: true, duplicate: false, sealed: Boolean(sealed) };
}

// Factura en Alegra, best-effort. No revienta el webhook: el pago ya quedo sellado.
//
// ═══ ESTE COMENTARIO DECIA DOS COSAS FALSAS Y SE CORRIGEN AQUI (2026-09-11) ═══
//
// Decia: "si falla, la factura se reintenta (Wompi reenvia) o queda para un job post-MVP".
//
//   · WOMPI NO REENVIA. Solo reintenta el webhook si NO le respondimos 200, y le respondemos 200 porque
//     el pago SI se sello. La factura fallida no vuelve por ahi.
//   · Y EL JOB NUNCA SE CONSTRUYO. No hay cola, no hay cron, y la ruta del webhook de Alegra
//     (api/webhooks/alegra/) es una carpeta VACIA, asi que tampoco llega nada de vuelta de Alegra.
//
// CONSECUENCIA REAL HOY: un pago cobrado cuya factura falla se queda sin documento PARA SIEMPRE, y no lo
// detecta nadie salvo que alguien mire Sentry. El estado ya se puede registrar (columnas de la 0129); lo
// que falta es que esta funcion lo escriba y que algo barra la cola. Es el Bloque 2a.
//
// Y LO QUE MANDA HOY A ALEGRA TAMPOCO ES LO QUE SE VENDIO: el MISMO cliente por defecto para todo
// paciente, UN item generico con cantidad 1 y el total como precio, y en BORRADOR (nunca se manda
// status:'open', asi que nunca recibe consecutivo). La tabla transaction_items SI tiene las lineas de
// verdad, con su producto, su cantidad y su precio unitario: el dato existe en Atlas y se descarta al
// facturar.
async function tryCreateAlegraInvoice(sealed: SealedTransaction): Promise<void> {
  const clientId = Number(process.env.ALEGRA_DEFAULT_CLIENT_ID ?? 0);
  const itemId = Number(process.env.ALEGRA_DEFAULT_ITEM_ID ?? 0);
  if (!clientId || !itemId) return; // sin IDs de sandbox: se omite la factura

  try {
    const today = isoDate();
    // Alegra recibe el precio BASE sin IVA y el item lleva el impuesto referenciado
    // por id (ALEGRA_IVA_TAX_ID): sin ese tax explicito Alegra factura con IVA en 0
    // aunque el item lo tenga configurado. sealed.amount es PVP con IVA incluido.
    const ivaTaxId = Number(process.env.ALEGRA_IVA_TAX_ID ?? 0);
    const item = {
      id: itemId,
      price: baseFromTotal(Number(sealed.amount)),
      quantity: 1,
      ...(ivaTaxId ? { tax: [{ id: ivaTaxId }] } : {}),
    };
    const invoice = await createAlegraInvoice({
      clientId,
      items: [item],
      date: today,
      dueDate: today,
    });
    await setAlegraInvoiceId(sealed.id, invoice.id);
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "alegra-invoice", transactionId: sealed.id } });
  }
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10); // yyyy-MM-dd
}
