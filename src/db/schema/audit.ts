import { index, inet, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { accessGrantStatus, accessGrantType, accessReasonCategory, appRole } from "./enums";
import { modelVersions } from "./model-registry";
import { profiles } from "./organizations";
import { patients } from "./patients";

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

// Mecanismo unico de permisos temporales (grants) para el acceso auditado a las
// notas narrativas (bloque auditoria/control de calidad). A diferencia de
// clinical_audit_log, esta tabla es MUTABLE: el grant cambia de estado
// (pending -> approved/denied/revoked). Los tres eventos inmutables (solicitado,
// aprobado/negado, usado) van a clinical_audit_log, inline. La expiracion NO es un
// estado: se evalua por expires_at > now() en el gate has_active_grant. Ni el
// Nivel (b) es monitoreo continuo (Clausula 17 del Anexo 3): tope duro 90d, la
// renovacion es un grant nuevo, no una extension.
export const clinicalAccessGrants = pgTable(
  "clinical_access_grants",
  {
    id: pk(),
    grantType: accessGrantType("grant_type").notNull(),
    reasonCategory: accessReasonCategory("reason_category").notNull(),
    status: accessGrantStatus("status").notNull().default("pending"),
    // Quien solicita (admin o soporte).
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => profiles.id),
    // Rol que debe aprobar, calculado al solicitar (soporte -> admin; admin ->
    // direccion). Se guarda para que la RLS del inbox y la separacion
    // solicitante/aprobador sean explicitas y auditables.
    approverRole: appRole("approver_role").notNull(),
    // Quien decidio efectivamente (nunca el mismo solicitante). Null mientras pending.
    approverId: uuid("approver_id").references(() => profiles.id),
    // Nivel (c): paciente objetivo. Nivel (b): null (alcance amplio, sin paciente).
    resourceId: uuid("resource_id").references(() => patients.id),
    reason: text("reason").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("clinical_access_grants_requester_idx").on(t.requesterId),
    index("clinical_access_grants_status_idx").on(t.status),
    index("clinical_access_grants_resource_idx").on(t.resourceId),
  ],
);
