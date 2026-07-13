import "server-only";

import { and, eq, gt, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { clinicalAccessGrants } from "@/db/schema";

// Tipos de grant (espejo del enum access_grant_type). Nivel (b) seudonimizado y
// Nivel (c) identificado.
export type AccessGrantType = "notes_pseudonymous" | "notes_identified";

// Gemelo TS de public.has_active_grant (0016). Se usa en el gate del Nivel (c),
// que lee con owner (Drizzle db) y por tanto NO tiene auth.uid(): el userId viene
// de requireUser en el action, nunca del cliente. Misma regla que el helper SQL:
// grant approved, del tipo pedido, no vencido (se compara contra now() de la BD para
// no depender del reloj del server de app) y del recurso pedido si se pasa uno. Sin
// resourceId el alcance es amplio (Nivel b). Devuelve solo un booleano; no expone
// las filas.
export async function hasActiveGrant(
  userId: string,
  grantType: AccessGrantType,
  resourceId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: clinicalAccessGrants.id })
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
    .limit(1);
  return rows.length > 0;
}
