import { sql } from "drizzle-orm";
import { boolean, date, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { profiles } from "./organizations";
import { transactions } from "./payments";

// ═══ LOS AVISOS (Bloque A, migracion 0145) ═══
//
// Atlas avisa de lo que pide accion humana; no espera a que alguien entre a /pagos. Ver el plan 3.7.

/** Quien recibe cada tipo de aviso. Solo admin, direccion o soporte (lo exige un trigger). */
export const notificationSubscriptions = pgTable(
  "notification_subscriptions",
  {
    id: pk(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // pendientes_ventas | escalamiento_ventas
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [unique("notification_subscriptions_una_por_tipo").on(t.profileId, t.kind)],
);

/** "En gestion hasta": historial; la ultima fila de cada (tipo, venta) es la vigente. */
export const pendingFollowups = pgTable(
  "pending_followups",
  {
    id: pk(),
    kind: text("kind").notNull(), // revision | sin_documento | nota_credito
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    untilDate: date("until_date").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [index("pending_followups_vigente_idx").on(t.kind, t.transactionId, t.createdAt.desc())],
);

/**
 * DESCARTAR UN PENDIENTE QUE NO TIENE SALIDA (0205). Dos de los seis tipos no se pueden cerrar con ningun acto
 * en Atlas ("sin saldo" se arregla contando la vitrina; "pagada sin despachar" se entrego por fuera), y "en
 * gestion hasta" solo pospone. El descarte los calla en el correo CON MOTIVO Y RESPONSABLE, y CADUCA: guarda la
 * huella del hecho y deja de aplicar si el hecho cambia. La huella la calcula `huella_del_pendiente` en la base,
 * nunca este lado: calculada en dos sitios, divergiria y el descarte no aplicaria o no caducaria nunca.
 */
export const pendingDiscards = pgTable(
  "pending_discards",
  {
    id: pk(),
    kind: text("kind").notNull(), // sin_saldo | por_despachar
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    factFingerprint: text("fact_fingerprint").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => profiles.id, { onDelete: "restrict" }),
  },
  // UNO VIGENTE por (tipo, venta). PARCIAL a proposito: los revocados se acumulan y son el historial, asi que
  // sin la condicion este indice prohibiria descartar dos veces la misma venta en toda su vida.
  (t) => [
    uniqueIndex("pending_discards_uno_vigente")
      .on(t.kind, t.transactionId)
      .where(sql`revoked_at is null`),
  ],
);

/** Cada envio del resumen: lo NUEVO se mide contra el anterior, y un dia y una franja se envian una vez. */
export const alertDigestRuns = pgTable(
  "alert_digest_runs",
  {
    id: pk(),
    runDate: date("run_date").notNull(),
    slot: text("slot").notNull(), // am | pm
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
    itemKeys: text("item_keys").array().notNull().default([]),
    sent: boolean("sent").notNull(),
    reason: text("reason"),
    recipients: integer("recipients").notNull().default(0),
  },
  (t) => [unique("alert_digest_runs_uno_por_franja").on(t.runDate, t.slot)],
);
