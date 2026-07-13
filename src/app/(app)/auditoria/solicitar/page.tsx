import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { RequestAccessForm } from "@/modules/clinical-access/components/request-access-form";
import { RevokeControl } from "@/modules/clinical-access/components/revoke-control";
import { listMyRequests } from "@/modules/clinical-access/data/grants-list-reader";
import {
  GRANT_STATUS_LABEL,
  GRANT_TYPE_LABEL,
  REASON_CATEGORY_LABEL,
} from "@/modules/clinical-access/labels";
import { canRequestAccess } from "@/modules/clinical-access/policies/can-request-access";

export const metadata = { title: "Solicitar acceso - Atlas" };

// Solicitud de acceso a las notas + estado de mis solicitudes. Autorizacion por policy
// (admin/soporte). La solicitud queda pendiente hasta que la apruebe el rol que
// corresponde (soporte -> admin, admin -> direccion).

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("es-CO") : "";
}

export default async function RequestAccessPage() {
  const user = await requireUser();
  if (!canRequestAccess(user)) {
    redirect("/no-autorizado");
  }

  const requests = await listMyRequests(user.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Solicitar acceso</h1>
        <p className="text-muted-foreground">
          Acceso a las notas narrativas con causa, minimizado y registrado. Cada solicitud la
          aprueba un tercero, nunca tu mismo.
        </p>
      </div>

      <RequestAccessForm />

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-foreground">Mis solicitudes</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Solicitada</th>
                <th className="px-3 py-2 font-semibold">Nivel</th>
                <th className="px-3 py-2 font-semibold">Motivo</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">Vence</th>
                <th className="px-3 py-2 font-semibold">Accion</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No has solicitado accesos.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {fmt(r.requestedAt)}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {GRANT_TYPE_LABEL[r.grantType]}
                      <span className="block text-xs text-muted-foreground">
                        {REASON_CATEGORY_LABEL[r.reasonCategory]}
                      </span>
                    </td>
                    <td className="max-w-xs px-3 py-2 text-muted-foreground">{r.reason}</td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {GRANT_STATUS_LABEL[r.status]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {fmt(r.expiresAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {r.status === "approved" && r.grantType === "notes_identified" && r.resourceId ? (
                          <Link
                            href={`/auditoria/paciente/${r.resourceId}`}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                          >
                            Abrir
                          </Link>
                        ) : null}
                        {r.status === "approved" && r.grantType === "notes_pseudonymous" ? (
                          <Link
                            href="/auditoria/notas"
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                          >
                            Abrir
                          </Link>
                        ) : null}
                        {r.status === "pending" || r.status === "approved" ? (
                          <RevokeControl grantId={r.id} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
