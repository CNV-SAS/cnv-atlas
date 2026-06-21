import { randomBytes } from "node:crypto";

// Tokens y validez de los links de la encuesta (B7). El token es opaco: no codifica
// nada, solo mapea en servidor a una fila de survey_links.

// Colchon del link de seguimiento: 30 dias (MVP.md, link de seguimiento pre-llenado).
export const FOLLOWUP_TTL_DAYS = 30;

// Token opaco de alta entropia (32 bytes => 256 bits, base64url). Imposible de
// adivinar; no lleva PII ni estructura.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

// Fecha de expiracion de un link de seguimiento a partir de su creacion.
export function followupExpiry(createdAtMs: number): Date {
  return new Date(createdAtMs + FOLLOWUP_TTL_DAYS * 24 * 60 * 60 * 1000);
}

// Un link sirve si no se ha consumido y no esta vencido. Los links iniciales no
// expiran ni se consumen (expiresAt/consumedAt en null), asi que siempre sirven.
export function isLinkUsable(
  link: { consumedAt: string | null; expiresAt: string | null },
  nowMs: number,
): boolean {
  if (link.consumedAt) return false;
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= nowMs) return false;
  return true;
}
