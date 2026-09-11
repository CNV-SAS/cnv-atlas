import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { alegraInvoiceState, paymentMethod, transactionStatus } from "./enums";
import { nutraceuticals } from "./nutraceuticals";
import { organizations, professionalProfiles } from "./organizations";
import { patients } from "./patients";

// Grupo 14: pagos y finanzas.

export const transactions = pgTable(
  "transactions",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    patientId: uuid("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    professionalId: uuid("professional_id").references(() => professionalProfiles.id, {
      onDelete: "set null",
    }),
    status: transactionStatus("status").notNull().default("pending"),
    // Medio de pago. Default 'wompi': las filas existentes son de la pasarela. El efectivo lo pone la
    // venta en efectivo. Un pago mixto = dos transacciones, una por medio (ver enum).
    paymentMethod: paymentMethod("payment_method").notNull().default("wompi"),
    amount: numeric("amount").notNull(),
    currency: text("currency").notNull().default("COP"),
    wompiTransactionId: text("wompi_transaction_id"),
    // Id INTERNO de Alegra. NO es el consecutivo: ese lo asigna Alegra al EMITIR y va en
    // `alegraInvoiceNumber`. Se guardaban como una sola cosa y son dos.
    alegraInvoiceId: text("alegra_invoice_id"),
    // ESTADO DE LA FACTURA (0129). Antes se inferia de `alegraInvoiceId IS NULL`, que significaba tres
    // cosas a la vez: nunca se intento, se intento y fallo, o no aplica.
    alegraInvoiceState: alegraInvoiceState("alegra_invoice_state"),
    alegraInvoiceNumber: text("alegra_invoice_number"), // el consecutivo, el que ve la DIAN y el paciente
    alegraEmittedAt: timestamp("alegra_emitted_at", { withTimezone: true }),
    // La cola de reintento es una CONSULTA sobre estas columnas, no una tabla: una tabla aparte seria una
    // segunda fuente del mismo hecho. El contador evita que un error permanente se vuelva un bucle.
    alegraAttempts: integer("alegra_attempts").notNull().default(0),
    alegraLastAttemptAt: timestamp("alegra_last_attempt_at", { withTimezone: true }),
    alegraLastError: text("alegra_last_error"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("transactions_professional_idx").on(t.professionalId)],
);

export const transactionItems = pgTable("transaction_items", {
  id: pk(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price").notNull(),
});

export const professionalRevenue = pgTable("professional_revenue", {
  id: pk(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  professionalId: uuid("professional_id")
    .notNull()
    .references(() => professionalProfiles.id),
  commissionRate: numeric("commission_rate").notNull(), // snapshot de la tasa aplicada
  commissionAmount: numeric("commission_amount").notNull(),
  createdAt: createdAt(),
});

export const cnvRevenue = pgTable("cnv_revenue", {
  id: pk(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  amount: numeric("amount").notNull(),
  createdAt: createdAt(),
});

// Idempotencia y auditoria de webhooks de pago.
export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: pk(),
    provider: text("provider").notNull(), // wompi, alegra
    externalId: text("external_id").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique("payment_webhook_events_provider_external_unique").on(t.provider, t.externalId)],
);
