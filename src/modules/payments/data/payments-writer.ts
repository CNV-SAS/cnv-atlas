import "server-only";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { baseFromTotal } from "@/core/iva";
import {
  cnvRevenue,
  paymentWebhookEvents,
  professionalProfiles,
  professionalRevenue,
  transactionItems,
  transactions,
} from "@/db/schema";

// Escrituras financieras de B6. Drizzle conecta como owner (BYPASSA RLS) a
// proposito: son escrituras server-side de sistema-de-registro y las tablas solo
// tienen policy de SELECT. El sellado del pago, la comision y el ingreso van en UNA
// transaccion de BD (db.transaction) para que nunca queden a medias.

// Tipo de la transaccion de BD (evita `any`, se mantiene con la version de Drizzle).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Contabilidad COMPARTIDA del sellado: comision del profesional (tasa snapshot) + ingreso de CNV, dentro
// de la transaccion de BD dada. La usan el sellado del webhook de Wompi y la venta en EFECTIVO: UN solo
// camino contable, no dos. amount es PVP con IVA; la comision y el ingreso van sobre la BASE sin IVA (el
// IVA es recaudo, no ingreso; decision de B6, ver core/iva).
async function sealAccounting(
  tx: Tx,
  t: { id: string; amount: string; professionalId: string | null },
): Promise<void> {
  const base = baseFromTotal(Number(t.amount));
  let commission = 0;
  if (t.professionalId) {
    const [prof] = await tx
      .select({ rate: professionalProfiles.commissionRate })
      .from(professionalProfiles)
      .where(eq(professionalProfiles.id, t.professionalId));
    const rate = Number(prof?.rate ?? 0);
    commission = Math.round(base * rate * 100) / 100;
    await tx.insert(professionalRevenue).values({
      transactionId: t.id,
      professionalId: t.professionalId,
      commissionRate: String(rate), // snapshot de la tasa del momento
      commissionAmount: String(commission),
    });
  }
  // El resto de la base (sin IVA) es ingreso de CNV.
  await tx.insert(cnvRevenue).values({
    transactionId: t.id,
    amount: String(Math.round((base - commission) * 100) / 100),
  });
}

export type NewOrderLine = {
  nutraceuticalId: string;
  quantity: number;
  unitPrice: number;
};

export type NewTransaction = {
  organizationId: string;
  patientId: string;
  professionalId: string | null;
  amount: number;
  currency: string;
  idempotencyKey: string;
  items: NewOrderLine[];
};

// Crea la transaccion (pending) y sus items en una sola transaccion de BD.
export async function createTransactionWithItems(
  input: NewTransaction,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .insert(transactions)
      .values({
        organizationId: input.organizationId,
        patientId: input.patientId,
        professionalId: input.professionalId,
        amount: String(input.amount),
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
      })
      .returning({ id: transactions.id });
    if (input.items.length > 0) {
      await tx.insert(transactionItems).values(
        input.items.map((it) => ({
          transactionId: t.id,
          nutraceuticalId: it.nutraceuticalId,
          quantity: it.quantity,
          unitPrice: String(it.unitPrice),
        })),
      );
    }
    return { id: t.id };
  });
}

export type WebhookRecord = { isNew: boolean; alreadyProcessed: boolean };

// Registra el evento de webhook con el gate de idempotencia unique(provider,
// external_id). Si ya existia, informa si ya fue procesado (processed_at no nulo).
// Este es el control que hace que un webhook duplicado produzca un solo efecto.
export async function recordWebhookEvent(
  provider: string,
  externalId: string,
  payload: unknown,
): Promise<WebhookRecord> {
  const inserted = await db
    .insert(paymentWebhookEvents)
    .values({ provider, externalId, payload })
    .onConflictDoNothing({
      target: [paymentWebhookEvents.provider, paymentWebhookEvents.externalId],
    })
    .returning({ id: paymentWebhookEvents.id });
  if (inserted.length > 0) return { isNew: true, alreadyProcessed: false };

  const [existing] = await db
    .select({ processedAt: paymentWebhookEvents.processedAt })
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.provider, provider),
        eq(paymentWebhookEvents.externalId, externalId),
      ),
    );
  return { isNew: false, alreadyProcessed: existing?.processedAt != null };
}

export async function markWebhookProcessed(
  provider: string,
  externalId: string,
): Promise<void> {
  await db
    .update(paymentWebhookEvents)
    .set({ processedAt: new Date() })
    .where(
      and(
        eq(paymentWebhookEvents.provider, provider),
        eq(paymentWebhookEvents.externalId, externalId),
      ),
    );
}

export type SealedTransaction = {
  id: string;
  amount: string;
  currency: string;
  patientId: string | null;
  professionalId: string | null;
};

// Sella el pago en UNA transaccion: pasa la transaccion de pending->paid (guardado
// por status='pending', asi solo sella una vez), sella la comision con la tasa
// vigente del profesional como snapshot y registra el ingreso de CNV. Devuelve la
// transaccion si la sello; null si ya no estaba pending (no hace nada, idempotente).
export async function sealPaidTransaction(
  txId: string,
  wompiTransactionId: string,
): Promise<SealedTransaction | null> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(transactions)
      .set({ status: "paid", wompiTransactionId, updatedAt: new Date() })
      .where(and(eq(transactions.id, txId), eq(transactions.status, "pending")))
      .returning({
        id: transactions.id,
        amount: transactions.amount,
        currency: transactions.currency,
        patientId: transactions.patientId,
        professionalId: transactions.professionalId,
      });
    if (updated.length === 0) return null; // ya sellada u otro estado: idempotente
    const t = updated[0];
    await sealAccounting(tx, t);
    return t;
  });
}

// Venta en EFECTIVO: crea la transaccion YA pagada (el efectivo se paga en el momento) con su medio,
// items y contabilidad, todo en UNA transaccion de BD (vendido-y-pagado no queda a medias). Reusa la
// MISMA contabilidad que el webhook de Wompi (sealAccounting). Idempotente por idempotency_key: un doble
// envio no crea ni sella dos veces (onConflictDoNothing + re-lectura). El efectivo es dinero de CNV que
// el integrante custodia; eso lo refleja payment_method='efectivo' (la liquidacion suma lo custodiado).
export async function createPaidCashTransaction(input: NewTransaction): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(transactions)
      .values({
        organizationId: input.organizationId,
        patientId: input.patientId,
        professionalId: input.professionalId,
        status: "paid",
        paymentMethod: "efectivo",
        amount: String(input.amount),
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({ target: transactions.idempotencyKey })
      .returning({
        id: transactions.id,
        amount: transactions.amount,
        professionalId: transactions.professionalId,
      });
    if (inserted.length === 0) {
      // Doble envio (misma idempotency_key): ya se creo y sello. Se re-lee y no se vuelve a sellar.
      const [existing] = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.idempotencyKey, input.idempotencyKey));
      return { id: existing.id };
    }
    const t = inserted[0];
    if (input.items.length > 0) {
      await tx.insert(transactionItems).values(
        input.items.map((it) => ({
          transactionId: t.id,
          nutraceuticalId: it.nutraceuticalId,
          quantity: it.quantity,
          unitPrice: String(it.unitPrice),
        })),
      );
    }
    await sealAccounting(tx, t);
    return { id: t.id };
  });
}

export async function markTransactionFailed(
  txId: string,
  wompiTransactionId: string,
): Promise<void> {
  await db
    .update(transactions)
    .set({ status: "failed", wompiTransactionId, updatedAt: new Date() })
    .where(and(eq(transactions.id, txId), eq(transactions.status, "pending")));
}

export async function setAlegraInvoiceId(
  txId: string,
  alegraInvoiceId: string,
): Promise<void> {
  // Guardado por alegra_invoice_id null para no pisar una factura ya creada.
  await db
    .update(transactions)
    .set({ alegraInvoiceId, updatedAt: new Date() })
    .where(and(eq(transactions.id, txId), isNull(transactions.alegraInvoiceId)));
}
