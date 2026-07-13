import { redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { DecisionControls } from "@/modules/clinical-access/components/decision-controls";
import { listApprovalQueue } from "@/modules/clinical-access/data/grants-list-reader";
import { GRANT_LIMITS } from "@/modules/clinical-access/grant-rules";
import { GRANT_TYPE_LABEL, REASON_CATEGORY_LABEL } from "@/modules/clinical-access/labels";
import { canApproveAccess } from "@/modules/clinical-access/policies/can-approve-access";

export const metadata = { title: "Aprobaciones de acceso - Atlas" };

// Bandeja de aprobacion de solicitudes de acceso. Autorizacion por policy (admin/direccion);
// solo aparecen las solicitudes cuyo approver_role coincide con el rol del usuario y que no
// solicito el mismo (nadie se autoaprueba). El acceso identificado se aprueba por su causa;
// no se muestra la identidad del paciente aqui (solo que es un acceso puntual).

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-CO");
}

export default async function ApprovalsPage() {
  const user = await requireUser();
  if (!canApproveAccess(user)) {
    redirect("/no-autorizado");
  }

  const queue = await listApprovalQueue(user.id, user.roles);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Aprobaciones de acceso
        </h1>
        <p className="text-muted-foreground">
          Solicitudes pendientes que te toca decidir. Al aprobar, el acceso vence
          automaticamente segun la duracion (con tope duro por nivel).
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Solicitada</th>
              <th className="px-3 py-2 font-semibold">Solicitante</th>
              <th className="px-3 py-2 font-semibold">Nivel</th>
              <th className="px-3 py-2 font-semibold">Motivo</th>
              <th className="px-3 py-2 font-semibold">Decision</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No hay solicitudes pendientes.
                </td>
              </tr>
            ) : (
              queue.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmt(r.requestedAt)}
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.requesterEmail}</td>
                  <td className="px-3 py-2 text-foreground">
                    {GRANT_TYPE_LABEL[r.grantType]}
                    <span className="block text-xs text-muted-foreground">
                      {REASON_CATEGORY_LABEL[r.reasonCategory]}
                      {r.resourceId ? " - paciente puntual" : ""}
                    </span>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">{r.reason}</td>
                  <td className="px-3 py-2">
                    <DecisionControls
                      grantId={r.id}
                      defaultHours={GRANT_LIMITS[r.grantType].defaultHours}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
