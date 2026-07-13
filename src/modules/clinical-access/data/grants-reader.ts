import "server-only";

import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { clinicalAccessGrants } from "@/db/schema";

// Tipos de grant (espejo del enum access_grant_type). Nivel (b) seudonimizado y
// Nivel (c) identificado.
export type AccessGrantType = "notes_pseudonymous" | "notes_identified";

export type ActiveGrant = {
  id: string;
  grantType: AccessGrantType;
  resourceId: string | null;
  expiresAt: Date;
};

// Devuelve el grant activo del usuario para el tipo/recurso pedido, o null. Espejo
// TS de public.has_active_grant (0016): approved, no vencido (expires_at > now() de la
// BD, para no depender del reloj del server), y del recurso pedido si se pasa uno; sin
// resourceId el alcance es amplio (Nivel b). El userId viene de requireUser, nunca del
// cliente (owner no tiene auth.uid()). Si hubiera varios, toma el de expiracion mas
// lejana. Es la fuente del id del grant para registrar access.used.
export async function getActiveGrant(
  userId: string,
  grantType: AccessGrantType,
  resourceId?: string,
): Promise<ActiveGrant | null> {
  const [row] = await db
    .select({
      id: clinicalAccessGrants.id,
      grantType: clinicalAccessGrants.grantType,
      resourceId: clinicalAccessGrants.resourceId,
      expiresAt: clinicalAccessGrants.expiresAt,
    })
    .from(clinicalAccessGrants)
    .where(
      and(
        eq(clinicalAccessGrants.requesterId, userId),
        eq(clinicalAccessGrants.grantType, grantType),
        eq(clinicalAccessGrants.status, "approved"),
        isNotNull(clinicalAccessGrants.expiresAt),
        gt(clinicalAccessGrants.expiresAt, sql`now()`),
        resourceId ? eq(clinicalAccessGrants.resourceId, resourceId) : undefined,
      ),
    )
    .orderBy(desc(clinicalAccessGrants.expiresAt))
    .limit(1);

  if (!row || !row.expiresAt) return null;
  return {
    id: row.id,
    grantType: row.grantType as AccessGrantType,
    resourceId: row.resourceId,
    expiresAt: row.expiresAt,
  };
}

// Booleano de conveniencia sobre getActiveGrant, para gates que no necesitan el id.
export async function hasActiveGrant(
  userId: string,
  grantType: AccessGrantType,
  resourceId?: string,
): Promise<boolean> {
  return (await getActiveGrant(userId, grantType, resourceId)) !== null;
}
