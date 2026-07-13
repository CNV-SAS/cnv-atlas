import "server-only";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { clinicalAccessGrants, profiles } from "@/db/schema";
import type { AppRole } from "@/modules/auth/roles";

import type {
  AccessGrantStatus,
  AccessGrantType,
  AccessReasonCategory,
} from "../grant-rules";

// Lecturas de listado del flujo de grants. Van por owner y se gatean en el app-layer por
// policy: la bandeja de aprobacion une a profiles para mostrar el correo del solicitante,
// y direccion (que aprueba a admin) no puede leer profiles ajenos por RLS. El filtro
// explicito por userId/roles hace segura la lectura con owner. No se expone identidad de
// paciente aqui: solo el resource_id (uuid, seudonimo) para poder abrir el Nivel c luego.

export type MyGrantRow = {
  id: string;
  grantType: AccessGrantType;
  reasonCategory: AccessReasonCategory;
  status: AccessGrantStatus;
  resourceId: string | null;
  reason: string;
  requestedAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
};

export async function listMyRequests(userId: string): Promise<MyGrantRow[]> {
  const rows = await db
    .select({
      id: clinicalAccessGrants.id,
      grantType: clinicalAccessGrants.grantType,
      reasonCategory: clinicalAccessGrants.reasonCategory,
      status: clinicalAccessGrants.status,
      resourceId: clinicalAccessGrants.resourceId,
      reason: clinicalAccessGrants.reason,
      requestedAt: clinicalAccessGrants.requestedAt,
      decidedAt: clinicalAccessGrants.decidedAt,
      expiresAt: clinicalAccessGrants.expiresAt,
    })
    .from(clinicalAccessGrants)
    .where(eq(clinicalAccessGrants.requesterId, userId))
    .orderBy(desc(clinicalAccessGrants.requestedAt));

  return rows.map((r) => ({
    id: r.id,
    grantType: r.grantType as AccessGrantType,
    reasonCategory: r.reasonCategory as AccessReasonCategory,
    status: r.status as AccessGrantStatus,
    resourceId: r.resourceId,
    reason: r.reason,
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
  }));
}

export type ApprovalRow = {
  id: string;
  requesterEmail: string;
  grantType: AccessGrantType;
  reasonCategory: AccessReasonCategory;
  reason: string;
  resourceId: string | null;
  requestedAt: string;
};

// Solicitudes PENDIENTES que este usuario puede aprobar: su rol coincide con el
// approver_role del grant y no es el propio solicitante (nadie se autoaprueba).
export async function listApprovalQueue(
  userId: string,
  roles: readonly AppRole[],
): Promise<ApprovalRow[]> {
  if (roles.length === 0) return [];

  const rows = await db
    .select({
      id: clinicalAccessGrants.id,
      requesterEmail: profiles.email,
      grantType: clinicalAccessGrants.grantType,
      reasonCategory: clinicalAccessGrants.reasonCategory,
      reason: clinicalAccessGrants.reason,
      resourceId: clinicalAccessGrants.resourceId,
      requestedAt: clinicalAccessGrants.requestedAt,
    })
    .from(clinicalAccessGrants)
    .innerJoin(profiles, eq(profiles.id, clinicalAccessGrants.requesterId))
    .where(
      and(
        eq(clinicalAccessGrants.status, "pending"),
        inArray(clinicalAccessGrants.approverRole, roles as AppRole[]),
        ne(clinicalAccessGrants.requesterId, userId),
      ),
    )
    .orderBy(desc(clinicalAccessGrants.requestedAt));

  return rows.map((r) => ({
    id: r.id,
    requesterEmail: r.requesterEmail,
    grantType: r.grantType as AccessGrantType,
    reasonCategory: r.reasonCategory as AccessReasonCategory,
    reason: r.reason,
    resourceId: r.resourceId,
    requestedAt: r.requestedAt.toISOString(),
  }));
}
