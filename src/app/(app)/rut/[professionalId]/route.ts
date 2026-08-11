import { NextResponse } from "next/server";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";
import { requireUser } from "@/modules/auth/session";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { downloadRutPdf, getRutPath } from "@/modules/professionals/data/rut-storage";
import { canVerifyTaxStatus } from "@/modules/professionals/policies/can-verify-tax-status";

// Acceso interno al RUT de un integrante (documento de identidad tributaria: privado). Solo lo ve el
// PROPIO integrante o quien verifica (rol verificador); nadie más. Se TRANSMITE por esta ruta (que exige
// sesion via proxy + requireUser), NO se redirige a una URL firmada de Storage: una URL firmada funciona
// sin sesion durante su TTL y, si se comparte, expone el documento. Asi el cliente solo tiene /rut/[id],
// siempre protegido. El acceso QUEDA REGISTRADO (auditoría). Node runtime (audit + service role).
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

  // Transmite los bytes por nuestra ruta (nunca la URL firmada). Nunca como HTML (visor/adjunto).
  const pdf = await downloadRutPdf(path);
  if (!pdf) return new NextResponse("RUT no disponible", { status: 500 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="rut.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
