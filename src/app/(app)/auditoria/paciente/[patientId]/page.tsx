import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";
import { VolverA } from "@/components/shared/volver-a";

import { getClientIp } from "@/core/http/client-ip";
import { formatDateTime } from "@/lib/format/date";
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
  return formatDateTime(iso);
}

const SOURCE_LABEL: Record<string, string> = {
  evaluation: "Evaluación",
  diagnosis: "Diagnóstico",
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
          {/* Se llega SOLO desde /auditoria/solicitar (unico enlace entrante), asi que ahi vuelve. Sin
              esto era un callejon: se entraba y no habia salida hacia la lista de solicitudes. */}

          <TituloPantalla
            volver={<VolverA href="/auditoria/solicitar">Volver a las solicitudes</VolverA>}
            titulo="Acceso identificado"
            descripcion="Acceso excepcional a la historia narrativa de un paciente, con identidad."
          />
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
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
      {/* EL TITULO ES EL PACIENTE (el registro; la seccion la dice la barra superior) y la descripcion
          lleva lo que NO se ve en ninguna parte de la pantalla: que este permiso VENCE, cuando, y que el
          acceso queda registrado. En una superficie de acceso excepcional eso no es un adorno: es el
          recordatorio de que lo que se hace aqui deja rastro. */}
      <TituloPantalla
        volver={<VolverA href="/auditoria/solicitar">Volver a las solicitudes</VolverA>}
        titulo={heading}
        descripcion={`${view.patient.documentType} ${view.patient.documentNumber}. Tu permiso vence el ${fmt(expiresAt.toISOString())}. Este acceso queda registrado.`}
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
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
