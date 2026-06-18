import { index, inet, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { modelVersions } from "./model-registry";
import { profiles } from "./organizations";

// Grupo 16: gobernanza. clinical_audit_log es append-only: sin UPDATE/DELETE,
// reforzado por trigger (sub-tarea 4) y RLS. Se escribe inline en la transaccion,
// nunca por el bus (principio 5, regla dura 8).

export const clinicalAuditLog = pgTable(
  "clinical_audit_log",
  {
    id: pk(),
    actorId: uuid("actor_id").references(() => profiles.id),
    actorEmail: text("actor_email"),
    event: text("event").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payload: jsonb("payload"),
    modelVersionId: uuid("model_version_id").references(() => modelVersions.id),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("clinical_audit_actor_idx").on(t.actorId),
    index("clinical_audit_event_idx").on(t.event),
    index("clinical_audit_entity_idx").on(t.entityType, t.entityId),
    index("clinical_audit_created_idx").on(t.createdAt.desc()),
  ],
);
