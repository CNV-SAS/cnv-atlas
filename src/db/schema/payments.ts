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
import { organizations, professionalProfiles, profiles } from "./organizations";
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
    // EL PAGO REGISTRADO EN ALEGRA (0134). Es un hecho propio y no se deduce de la factura: seis ventas del
    // smoke quedaron con la factura bien emitida y el pago fallido, y como el panel solo miraba el estado
    // de la FACTURA, no las mostro. Nulo en una venta facturada = el paciente figura "por cobrar".
    alegraPaymentId: text("alegra_payment_id"),
    // EL MODO DEL PAGO (0135): con que llaves de Wompi estaba el sistema al CREAR la venta, CORREGIDO al sellar
    // con el ambiente que declara el evento de Wompi (Bloque 3): un link creado antes de un cambio de llaves y
    // pagado despues se cobra con las llaves nuevas, y el evento es quien lo sabe.
    // Un pago de prueba solo se factura en sandbox y uno real solo en produccion: es lo que impide que una
    // venta del smoke se convierta en factura electronica real al pasar Alegra a produccion.
    wompiEnv: text("wompi_env").notNull(),
    // De que ambiente es la FACTURA. `alegraInvoiceId` es un id interno y la factura 7 del sandbox no es la
    // factura 7 de produccion: releer una en el otro ambiente leeria el documento de otra persona.
    alegraEnv: text("alegra_env"),
    // El instrumento con que pago el paciente. Wompi lo mandaba y el esquema del webhook lo tiraba.
    paymentMethodType: text("payment_method_type"),
    // CREDIT | DEBIT. Wompi dice "CARD" para las dos en el tipo y separa esto en otro campo (0136).
    paymentCardType: text("payment_card_type"),
    alegraCufe: text("alegra_cufe"),
    // ── LA VENTA MUEVE INVENTARIO (Bloque 3, 0139) ──────────────────────────────────────────────────
    // Nulo en todas: una venta anterior al Bloque 3 no mueve inventario y no se le descuenta hacia atras.
    treatmentId: uuid("treatment_id"),
    // De donde sale el producto, sellado al crear la venta.
    locationId: uuid("location_id"),
    deliveryMode: text("delivery_mode"), // en_consulta | domicilio
    operatedAt: timestamp("operated_at", { withTimezone: true }),
    // reservado | pendiente | descontado | sin_saldo | fallido | liberado. NULL = anterior al Bloque 3.
    stockState: text("stock_state"),
    stockLastError: text("stock_last_error"),
    // ── LA ENTREGA, LA ANULACION Y LA REVISION (Bloque 3, sesion 2, 0140) ─────────────────────────────
    // pendiente | entregado. NULL = anterior a la sesion 2. Solo una venta pagada se entrega, y entregar no
    // mueve inventario: ya se movio al sellar.
    fulfillmentState: text("fulfillment_state"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deliveredBy: uuid("delivered_by").references(() => profiles.id, { onDelete: "restrict" }),
    // Un link ANULADO queda `failed` como uno rechazado, y estas columnas son lo que los distingue: un pago
    // aprobado que llega sobre un link anulado es casi seguro un cobro doble.
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => profiles.id, { onDelete: "restrict" }),
    // pago_sobre_link_anulado. Mientras no tenga resolucion, la venta no se descuenta ni se factura.
    reviewReason: text("review_reason"),
    reviewResolution: text("review_resolution"), // segunda_compra | devuelto
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id, { onDelete: "restrict" }),
    alegraLegalStatus: text("alegra_legal_status"),
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

// LAS RESERVAS DEL CHECKOUT PENDIENTE (D3, 0139). No mueven el saldo: restan de lo DISPONIBLE mientras
// esten vivas (sin liberar, sin consumir y sin vencer). Vencen con el link de pago.
export const inventoryReservations = pgTable("inventory_reservations", {
  id: pk(),
  transactionItemId: uuid("transaction_item_id")
    .notNull()
    .references(() => transactionItems.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull(),
  lotId: uuid("lot_id").notNull(),
  nutraceuticalId: uuid("nutraceutical_id")
    .notNull()
    .references(() => nutraceuticals.id),
  quantity: integer("quantity").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: createdAt(),
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
