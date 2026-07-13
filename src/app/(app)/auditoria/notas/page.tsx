import { redirect } from "next/navigation";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";
import { recordAccessUsed } from "@/modules/clinical-access/data/access-log-writer";
import { getActiveGrant } from "@/modules/clinical-access/data/grants-reader";
import { getPseudonymousNotes } from "@/modules/clinical-access/data/notes-audit-reader";
import { canAuditNotes } from "@/modules/clinical-access/policies/can-audit-notes";

export const metadata = { title: "Auditoria de notas - Atlas" };

// Pantalla de auditoria rutinaria Nivel (b): revisa las notas narrativas SEUDONIMIZADAS
// (sin identidad del paciente) para verificar la correcta aplicacion del modelo. La
// autorizacion de la pantalla va por policy (admin/soporte); el contenido lo gobierna la
// RLS (grant notes_pseudonymous activo + precondicion Anexo 3). Al abrir con un grant
// activo se registra access.used, el tercer evento del ciclo.

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-CO");
}

const SOURCE_LABEL: Record<string, string> = {
  evaluation: "Evaluacion",
  diagnosis: "Diagnostico",
  treatment: "Tratamiento",
};

export default async function NotesAuditPage() {
  const user = await requireUser();
  if (!canAuditNotes(user)) {
    redirect("/no-autorizado");
  }

  const grant = await getActiveGrant(user.id, "notes_pseudonymous");

  if (!grant) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Auditoria de notas
          </h1>
          <p className="text-muted-foreground">
            Revision seudonimizada de las notas narrativas, sin identidad del paciente.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          No tienes un permiso de auditoria activo. Solicita un permiso de auditoria
          seudonimizada y espera su aprobacion para ver las notas.
        </div>
      </div>
    );
  }

  // Uso efectivo del grant (tercer evento). Se registra antes de mostrar el contenido.
  const ip = await getClientIp();
  await recordAccessUsed({
    grantId: grant.id,
    grantType: "notes_pseudonymous",
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });

  const notes = await getPseudonymousNotes();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Auditoria de notas
        </h1>
        <p className="text-muted-foreground">
          Revision seudonimizada de las notas narrativas, sin identidad del paciente. Tu
          permiso vence el {fmt(grant.expiresAt.toISOString())}. Este acceso queda
          registrado.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Origen</th>
              <th className="px-3 py-2 font-semibold">Referencia</th>
              <th className="px-3 py-2 font-semibold">Nota</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No hay notas visibles bajo tu permiso actual.
                </td>
              </tr>
            ) : (
              notes.map((n) => (
                <tr key={`${n.source}-${n.id}`} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmt(n.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {SOURCE_LABEL[n.source] ?? n.source}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {n.sourceId}
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
