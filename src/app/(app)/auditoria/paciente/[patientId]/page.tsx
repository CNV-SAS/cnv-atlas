import { redirect } from "next/navigation";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";
import { accessIdentifiedNotes } from "@/modules/clinical-access/services/access-identified-notes";
import { canAuditNotes } from "@/modules/clinical-access/policies/can-audit-notes";

export const metadata = { title: "Acceso identificado - Atlas" };

// Vista de acceso IDENTIFICADO (Nivel c) a las notas de un paciente. Excepcional: exige
// un grant notes_identified vigente y con scope a este paciente, registra access.used al
// abrir y muestra la identidad del paciente junto a su narrativa. No es RLS relajada: el
// service resuelve todo por owner y auditando. La puerta de la pantalla es la policy
// (admin/soporte); el permiso real es el grant.

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-CO");
}

const SOURCE_LABEL: Record<string, string> = {
  evaluation: "Evaluacion",
  diagnosis: "Diagnostico",
  treatment: "Tratamiento",
};

export default async function IdentifiedAccessPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const user = await requireUser();
  if (!canAuditNotes(user)) {
    redirect("/no-autorizado");
  }

  const { patientId } = await params;
  const ip = await getClientIp();
  const result = await accessIdentifiedNotes({
    userId: user.id,
    actorEmail: user.email,
    patientId,
    ip: ip === "unknown" ? null : ip,
  });

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Acceso identificado
          </h1>
          <p className="text-muted-foreground">
            Acceso excepcional a la historia narrativa de un paciente, con identidad.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          {result.error.message}
        </div>
      </div>
    );
  }

  const { view, expiresAt } = result.value;
  const fullName = `${view.patient.firstName} ${view.patient.lastName}`.trim();
  const heading = fullName || `${view.patient.documentType} ${view.patient.documentNumber}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{heading}</h1>
        <p className="text-muted-foreground">
          {view.patient.documentType} {view.patient.documentNumber}. Acceso identificado
          excepcional; tu permiso vence el {fmt(expiresAt.toISOString())}. Este acceso
          queda registrado.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Origen</th>
              <th className="px-3 py-2 font-semibold">Nota</th>
            </tr>
          </thead>
          <tbody>
            {view.notes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  Este paciente no tiene notas narrativas.
                </td>
              </tr>
            ) : (
              view.notes.map((n) => (
                <tr key={`${n.source}-${n.id}`} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmt(n.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {SOURCE_LABEL[n.source] ?? n.source}
                  </td>
                  <td className="px-3 py-2 text-foreground">{n.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
