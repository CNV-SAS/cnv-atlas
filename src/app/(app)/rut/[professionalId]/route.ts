import { NextResponse } from "next/server";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/session";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { createSignedRutUrl, getRutPath } from "@/modules/professionals/data/rut-storage";
import { canVerifyTaxStatus } from "@/modules/professionals/policies/can-verify-tax-status";

// Acceso interno al RUT de un integrante (documento de identidad tributaria: privado). Solo lo ve el
// PROPIO integrante o quien verifica (rol verificador); nadie más, y nunca por adivinar la ruta (el path
// va con un uuid y el acceso se valida aquí antes de firmar). El acceso QUEDA REGISTRADO (auditoría): es
// un documento sensible-adyacente y saber quién lo abrió importa. Node runtime (audit + service role).
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ professionalId: string }> },
) {
  const { professionalId } = await params;
  const user = await requireUser();

  const ownProfessionalId = await getProfessionalProfileIdByUser(user.id);
  const isOwner = ownProfessionalId != null && ownProfessionalId === professionalId;
  const isVerifier = canVerifyTaxStatus(user);
  if (!isOwner && !isVerifier) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const path = await getRutPath(professionalId);
  if (!path) return new NextResponse("RUT no disponible", { status: 404 });

  // Auditoría del acceso (barato: un insert). Registra quién abrió el RUT de quién y en qué calidad.
  await db.transaction((tx) =>
    recordAudit(tx, {
      event: "professional.rut_viewed",
      actorId: user.id,
      actorEmail: user.email,
      entityType: "professional_profile",
      entityId: professionalId,
      payload: { as: isOwner ? "owner" : "verifier" },
      ip: null,
    }),
  );

  const signed = await createSignedRutUrl(path);
  if (!signed) return new NextResponse("RUT no disponible", { status: 500 });
  return NextResponse.redirect(signed);
}
