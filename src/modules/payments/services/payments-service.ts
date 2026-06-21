import { randomUUID } from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { baseFromTotal } from "@/core/iva";
import { createAlegraInvoice } from "@/lib/alegra/client";
import { computeIntegritySignature } from "@/lib/wompi/signatures";
import type { CurrentUser } from "@/modules/auth/roles";
import { listNutraceuticals } from "@/modules/nutraceuticals/data/nutraceuticals-repository";

import type { CheckoutView } from "../data/checkout-reader";
import * as repo from "../data/payments-repository";
import {
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

// Crea el checkout: resuelve el profesional para la comision, sella los precios
// desde el catalogo (nunca los toma del cliente), crea la transaccion pending con
// sus items y devuelve el link 24h que el profesional comparte con el paciente.
export async function createCheckout(
  input: CreateCheckoutInput,
  user: CurrentUser,
): Promise<CheckoutCreated> {
  // El profesional que crea la venta cobra la comision; si lo crea un admin, se
  // usa el profesional asignado al paciente. Puede quedar null (todo va a CNV).
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
    if (!n) throw new CheckoutError("Uno de los nutraceuticos no existe.");
    if (n.unit_price == null) {
      throw new CheckoutError(`El nutraceutico "${n.name}" no tiene precio configurado.`);
    }
    const unitPrice = Number(n.unit_price);
    lines.push({ nutraceuticalId: n.id, quantity: it.quantity, unitPrice });
    amount += unitPrice * it.quantity;
  }
  amount = Math.round(amount * 100) / 100;
  if (amount <= 0) throw new CheckoutError("El monto del checkout debe ser mayor a cero.");

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
  if (!integritySecret || !publicKey) {
    throw new Error("Faltan NEXT_PUBLIC_WOMPI_PUBLIC_KEY o WOMPI_INTEGRITY_SECRET");
  }
  const amountInCents = Math.round(Number(view.amount) * 100);
  const reference = view.id;
  const currency = view.currency;
  const signature = computeIntegritySignature({
    reference,
    amountInCents,
    currency,
    integritySecret,
  });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    publicKey,
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

// Factura en Alegra, best-effort y guardada por alegra_invoice_id null. No revienta
// el webhook: el pago ya quedo sellado. Si falla, la factura se reintenta (Wompi
// reenvia) o queda para un job post-MVP (BACKLOG: sync con Alegra). En B6 se usan
// los IDs de cliente/item de prueba del sandbox; el mapeo real va en un bloque
// posterior cuando el catalogo de Alegra este configurado.
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
