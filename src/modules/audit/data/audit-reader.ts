import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura del registro de auditoria clinica para el panel admin. Todo por RLS: la policy
// clinical_audit_log_select solo deja leer a admin (regla dura 3). El log es append-only
// (sin UPDATE/DELETE, reforzado por trigger); esta vista es de solo lectura. Paginado por
// created_at desc, con filtro opcional por evento.

export type AuditEntry = {
  id: string;
  event: string;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: unknown;
  createdAt: string;
};

export type AuditPage = {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  event: string | null;
};

const PAGE_SIZE = 50;

export async function getAuditLog(
  opts: { page?: number; event?: string | null } = {},
): Promise<AuditPage> {
  const page = Math.max(1, opts.page ?? 1);
  const event = opts.event?.trim() || null;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("clinical_audit_log")
    .select("id, event, actor_email, entity_type, entity_id, payload, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (event) query = query.eq("event", event);

  const { data, count } = await query;

  return {
    entries: (data ?? []).map((r) => ({
      id: r.id,
      event: r.event,
      actorEmail: r.actor_email,
      entityType: r.entity_type,
      entityId: r.entity_id,
      payload: r.payload,
      createdAt: r.created_at,
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    event,
  };
}
