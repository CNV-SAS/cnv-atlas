import Link from "next/link";
import { redirect } from "next/navigation";

import { canViewAudit } from "@/modules/audit/policies/can-view-audit";
import { getAuditLog } from "@/modules/audit/data/audit-reader";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "Auditoria - Atlas" };

// Panel admin de auditoria (B14): vista de solo lectura del clinical_audit_log. La
// autorizacion va por policy (regla 3); la lectura, por RLS admin-only. El log es
// append-only, aqui nunca se escribe ni se borra.

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-CO");
}

function summarizePayload(payload: unknown): string {
  if (payload == null) return "";
  const s = JSON.stringify(payload);
  return s.length > 120 ? `${s.slice(0, 117)}...` : s;
}

function pageHref(page: number, event: string | null): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (event) params.set("event", event);
  return `/admin/auditoria?${params.toString()}`;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; event?: string }>;
}) {
  const user = await requireUser();
  if (!canViewAudit(user)) {
    redirect("/no-autorizado");
  }

  const sp = await searchParams;
  const pageNum = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const result = await getAuditLog({ page: pageNum, event: sp.event ?? null });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasPrev = result.page > 1;
  const hasNext = result.page < totalPages;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Auditoria</h1>
        <p className="text-muted-foreground">
          Registro de eventos clinicos criticos. Es append-only: no se edita ni se borra.
          {result.total > 0 ? ` ${result.total} eventos.` : ""}
        </p>
      </div>

      <form method="get" className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Filtrar por evento</span>
          <input
            name="event"
            defaultValue={result.event ?? ""}
            placeholder="ej. treatment.protocol_updated"
            className="w-72 rounded-lg border border-input bg-background p-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Filtrar
        </button>
        {result.event ? (
          <Link
            href="/admin/auditoria"
            className="rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Evento</th>
              <th className="px-3 py-2 font-semibold">Actor</th>
              <th className="px-3 py-2 font-semibold">Entidad</th>
              <th className="px-3 py-2 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {result.entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Sin eventos para este filtro.
                </td>
              </tr>
            ) : (
              result.entries.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmt(e.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">{e.event}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.actorEmail ?? "sistema"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.entityType ? `${e.entityType}${e.entityId ? `: ${e.entityId}` : ""}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {summarizePayload(e.payload)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Pagina {result.page} de {totalPages}
        </span>
        <div className="flex gap-2">
          {hasPrev ? (
            <Link
              href={pageHref(result.page - 1, result.event)}
              className="rounded-lg border border-input px-3 py-1.5 text-foreground"
            >
              Anterior
            </Link>
          ) : null}
          {hasNext ? (
            <Link
              href={pageHref(result.page + 1, result.event)}
              className="rounded-lg border border-input px-3 py-1.5 text-foreground"
            >
              Siguiente
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
