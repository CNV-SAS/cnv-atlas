import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Remesa / consignación CNV → integrante (E2). La remesa es un movimiento type=remesa que DECLARA un envío
// (no mueve el saldo del integrante; el trigger lo excluye). La recepción es el integrante confirmando que
// recibió (+N, con remesa_id que la respalda). Una recepción con remesa_id NULL = NO respaldada = discrepancia
// visible. La confirmación captura la cantidad REAL (puede diferir de la declarada); la diferencia queda
// registrada, sin resolver todavía (la regla de quién responde se difiere, D-009 del plan de remesa).

// Corte para el grandfathering (plan de remesa, decisión b): las recepciones SIN remesa creadas ANTES del
// lanzamiento del mecanismo son históricas (legítimas bajo el modelo viejo), NO discrepancias. Solo las
// posteriores se marcan "no respaldadas". Se fija a la fecha de lanzamiento del mecanismo.
export const REMESA_LAUNCH_ISO = "2026-08-09T00:00:00.000Z";

type Supa = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function ownProfessionalId(supabase: Supa, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

function one<T>(rel: T | T[] | null | undefined): T | undefined {
  return Array.isArray(rel) ? rel[0] : (rel ?? undefined);
}

// Nombre legible del integrante (professional_profiles -> profiles.full_name) para el lado CNV.
async function professionalNames(supabase: Supa, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await supabase
    .from("professional_profiles")
    .select("id, license, profiles(full_name)")
    .in("id", ids);
  for (const p of data ?? []) {
    const name = one(p.profiles as { full_name?: string } | { full_name?: string }[] | null)?.full_name;
    out.set(p.id, name || p.license || "Integrante");
  }
  return out;
}

// === WRITERS ===

// Declarar una remesa (admin/soporte). Inserta un movimiento type=remesa dirigido al integrante. La RLS
// (WITH CHECK type=remesa AND admin/soporte) lo permite; el trigger del saldo lo excluye (no mueve inventario).
export async function declareRemesa(input: {
  actorId: string;
  professionalId: string; // destino
  nutraceuticalId: string;
  quantity: number; // declarada
  lote: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, message: "La cantidad declarada debe ser un entero mayor que cero." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("nutraceutical_stock_movements").insert({
    professional_id: input.professionalId,
    nutraceutical_id: input.nutraceuticalId,
    delta: input.quantity, // la remesa NO mueve el saldo (trigger la excluye); delta = lo declarado, para el cotejo
    type: "remesa",
    reason: "Remesa declarada por CNV (consignación)",
    lote: input.lote,
    created_by: input.actorId,
  });
  if (error) return { ok: false, message: "No se pudo declarar la remesa." };
  return { ok: true };
}

// Confirmar una remesa (el integrante). Inserta una recepción (+ cantidad REAL) ligada a la remesa. La
// cantidad puede diferir de la declarada: si CNV mandó diez y llegaron ocho, se registran ocho, y la
// diferencia queda visible (sin resolver). El trigger de coherencia valida que la remesa sea suya y del mismo
// producto; el índice único impide confirmarla dos veces. Devuelve la diferencia para el aviso.
export async function confirmRemesa(input: {
  userId: string;
  remesaId: string;
  actualQuantity: number;
  lote: string | null;
}): Promise<{ ok: boolean; message?: string; difference?: number }> {
  if (!Number.isInteger(input.actualQuantity) || input.actualQuantity < 0) {
    return { ok: false, message: "La cantidad recibida debe ser un entero (cero o más)." };
  }
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, input.userId);
  if (!profId) return { ok: false, message: "No tienes un perfil profesional." };

  // La remesa tiene que existir, ser suya y ser type=remesa (la RLS ya acota a lo suyo; se lee para la
  // cantidad declarada y el producto). Sin ella, no se confirma.
  const { data: remesa } = await supabase
    .from("nutraceutical_stock_movements")
    .select("id, professional_id, nutraceutical_id, delta, type")
    .eq("id", input.remesaId)
    .maybeSingle();
  if (!remesa || remesa.type !== "remesa" || remesa.professional_id !== profId) {
    return { ok: false, message: "Remesa no encontrada o no es tuya." };
  }

  const { error } = await supabase.from("nutraceutical_stock_movements").insert({
    professional_id: profId,
    nutraceutical_id: remesa.nutraceutical_id,
    delta: input.actualQuantity, // recepción: lo que REALMENTE llegó (puede diferir de lo declarado)
    type: "recepcion",
    reason: "Recepción de remesa (consignación)",
    lote: input.lote,
    remesa_id: remesa.id,
    created_by: input.userId,
  });
  // El índice único (una recepción por remesa) o el trigger de coherencia devuelven error si algo no cuadra.
  if (error) return { ok: false, message: "No se pudo confirmar la remesa (¿ya estaba confirmada?)." };
  return { ok: true, difference: input.actualQuantity - remesa.delta };
}

// === READERS ===

export type PendingRemesa = {
  remesaId: string;
  nutraceuticalId: string;
  nutraceuticalName: string;
  declaredQuantity: number;
  lote: string | null;
  declaredAt: string;
};

// (a) Remesas dirigidas al integrante, PENDIENTES de confirmar (sin recepción que las respalde). Para
// mostrarlas arriba en "Mi inventario": sin avisos, es como se entera de que le mandaron algo.
export async function getPendingRemesasForOwn(userId: string): Promise<PendingRemesa[] | null> {
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, userId);
  if (!profId) return null;

  const { data: remesas, error } = await supabase
    .from("nutraceutical_stock_movements")
    .select("id, nutraceutical_id, delta, lote, created_at, nutraceuticals(name)")
    .eq("professional_id", profId)
    .eq("type", "remesa")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`remesa-service: pendientes: ${error.message}`);
  if (!remesas || remesas.length === 0) return [];

  // Cuáles ya tienen recepción (confirmadas): se excluyen de las pendientes.
  const { data: recs } = await supabase
    .from("nutraceutical_stock_movements")
    .select("remesa_id")
    .eq("professional_id", profId)
    .eq("type", "recepcion")
    .not("remesa_id", "is", null);
  const confirmed = new Set((recs ?? []).map((r) => r.remesa_id));

  return remesas
    .filter((r) => !confirmed.has(r.id))
    .map((r) => ({
      remesaId: r.id,
      nutraceuticalId: r.nutraceutical_id,
      nutraceuticalName: one(r.nutraceuticals as { name?: string } | { name?: string }[] | null)?.name ?? "",
      declaredQuantity: r.delta,
      lote: r.lote,
      declaredAt: r.created_at,
    }));
}

export type RemesaStatus = "enviada" | "confirmada" | "confirmada_con_diferencia";
export type CnvRemesa = {
  remesaId: string;
  professionalId: string;
  professionalName: string;
  nutraceuticalName: string;
  declaredQuantity: number;
  receivedQuantity: number | null; // null si aún no confirmada
  status: RemesaStatus;
  declaredAt: string;
};

// (c) El lado CNV: todas las remesas declaradas con su estado (enviada / confirmada / confirmada con
// diferencia). Sin esto, CNV declara y no sabe qué pasó. RLS: admin/soporte ven todos los movimientos.
export async function getRemesasForCnv(): Promise<CnvRemesa[]> {
  const supabase = await createSupabaseServerClient();
  const { data: remesas, error } = await supabase
    .from("nutraceutical_stock_movements")
    .select("id, professional_id, delta, created_at, nutraceuticals(name)")
    .eq("type", "remesa")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`remesa-service: cnv remesas: ${error.message}`);
  if (!remesas || remesas.length === 0) return [];

  // Recepciones que respaldan cada remesa (una por remesa por el índice único).
  const { data: recs } = await supabase
    .from("nutraceutical_stock_movements")
    .select("remesa_id, delta")
    .eq("type", "recepcion")
    .not("remesa_id", "is", null);
  const receivedByRemesa = new Map((recs ?? []).map((r) => [r.remesa_id as string, r.delta]));
  const names = await professionalNames(supabase, [...new Set(remesas.map((r) => r.professional_id))]);

  return remesas.map((r) => {
    const received = receivedByRemesa.has(r.id) ? (receivedByRemesa.get(r.id) as number) : null;
    const status: RemesaStatus =
      received == null ? "enviada" : received === r.delta ? "confirmada" : "confirmada_con_diferencia";
    return {
      remesaId: r.id,
      professionalId: r.professional_id,
      professionalName: names.get(r.professional_id) ?? "Integrante",
      nutraceuticalName: one(r.nutraceuticals as { name?: string } | { name?: string }[] | null)?.name ?? "",
      declaredQuantity: r.delta,
      receivedQuantity: received,
      status,
      declaredAt: r.created_at,
    };
  });
}

export type UnbackedReception = {
  movementId: string;
  professionalId: string;
  professionalName: string;
  nutraceuticalName: string;
  quantity: number;
  lote: string | null;
  receivedAt: string;
};

// (d) El hueco que este bloque cierra: recepciones NO respaldadas (remesa_id NULL) creadas DESPUÉS del
// lanzamiento (las previas son históricas, grandfathered). Visibles para CNV: una recepción sin remesa puede
// tapar un faltante; hacerla visible la desnuda. RLS: admin/soporte.
export async function getUnbackedReceptionsForCnv(): Promise<UnbackedReception[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceutical_stock_movements")
    .select("id, professional_id, delta, lote, created_at, nutraceuticals(name)")
    .eq("type", "recepcion")
    .is("remesa_id", null)
    .gte("created_at", REMESA_LAUNCH_ISO)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`remesa-service: no respaldadas: ${error.message}`);
  if (!data || data.length === 0) return [];
  const names = await professionalNames(supabase, [...new Set(data.map((r) => r.professional_id))]);
  return data.map((r) => ({
    movementId: r.id,
    professionalId: r.professional_id,
    professionalName: names.get(r.professional_id) ?? "Integrante",
    nutraceuticalName: one(r.nutraceuticals as { name?: string } | { name?: string }[] | null)?.name ?? "",
    quantity: r.delta,
    lote: r.lote,
    receivedAt: r.created_at,
  }));
}
