import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Servicio del inventario en CONSIGNACION del profesional (T3b-1, "Mi inventario"). Lecturas del saldo
// y el historial del propio profesional, y el registro de una RECEPCION (un movimiento). El saldo lo
// mueve el trigger; aqui solo se inserta el movimiento (la RLS acota a que sea del profesional).

export type InventoryLine = {
  nutraceuticalId: string;
  name: string;
  indication: string | null;
  commercialAvailability: string; // en_consultorio | solo_tienda | no_disponible
  stock: number;
};

export type MovementRow = {
  id: string;
  createdAt: string;
  type: string;
  delta: number;
  reason: string | null;
  lote: string | null;
  nutraceuticalName: string;
};

type Supa = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function ownProfessionalId(supabase: Supa, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

// El embed de PostgREST puede tipar la relacion como objeto o arreglo; se resuelve a un nombre legible.
function nutraName(rel: unknown): string {
  if (Array.isArray(rel)) return (rel[0] as { name?: string } | undefined)?.name ?? "";
  return (rel as { name?: string } | null)?.name ?? "";
}

// El inventario del profesional: productos con saldo != 0 (sea cual sea su estado comercial, es producto
// de CNV bajo su custodia) MAS los en_consultorio con saldo 0 (para poder recibir). null si el usuario no
// es profesional.
export async function getOwnInventory(userId: string): Promise<InventoryLine[] | null> {
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, userId);
  if (!profId) return null;

  const { data: inv, error: iErr } = await supabase
    .from("nutraceutical_inventory")
    .select("nutraceutical_id, stock_quantity")
    .eq("professional_id", profId);
  if (iErr) throw new Error(`inventory-service: saldos: ${iErr.message}`);
  const stockByNutra = new Map((inv ?? []).map((r) => [r.nutraceutical_id, r.stock_quantity]));

  const { data: cat, error: cErr } = await supabase
    .from("nutraceuticals")
    .select("id, name, indication, commercial_availability")
    .order("name");
  if (cErr) throw new Error(`inventory-service: catalogo: ${cErr.message}`);

  return (cat ?? [])
    .map((c) => ({
      nutraceuticalId: c.id,
      name: c.name,
      indication: c.indication ?? null,
      commercialAvailability: c.commercial_availability,
      stock: stockByNutra.get(c.id) ?? 0,
    }))
    .filter((l) => l.stock !== 0 || l.commercialAvailability === "en_consultorio");
}

// El historial de movimientos del profesional. Es tambien su EVIDENCIA ante un faltante, asi que se
// devuelve legible (producto, tipo, delta con signo, lote, motivo, fecha). Mas reciente primero.
export async function getOwnMovements(userId: string): Promise<MovementRow[] | null> {
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, userId);
  if (!profId) return null;

  const { data, error } = await supabase
    .from("nutraceutical_stock_movements")
    .select("id, created_at, type, delta, reason, lote, nutraceuticals(name)")
    .eq("professional_id", profId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`inventory-service: movimientos: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id,
    createdAt: m.created_at,
    type: m.type,
    delta: m.delta,
    reason: m.reason,
    lote: m.lote,
    nutraceuticalName: nutraName(m.nutraceuticals),
  }));
}

// Registra una RECEPCION (reconocimiento de custodia): un movimiento +N. El trigger construye el saldo.
// La RLS rechaza si el professional_id no es el del usuario. Devuelve el error de BD si lo hay.
export async function recordReception(input: {
  userId: string;
  nutraceuticalId: string;
  quantity: number;
  lote: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, input.userId);
  if (!profId) return { ok: false, message: "No tienes un perfil profesional." };

  const { error } = await supabase.from("nutraceutical_stock_movements").insert({
    professional_id: profId,
    nutraceutical_id: input.nutraceuticalId,
    delta: input.quantity, // recepcion: positivo
    type: "recepcion",
    reason: "Recepcion de producto en consignacion",
    lote: input.lote,
    created_by: input.userId,
  });
  if (error) return { ok: false, message: "No se pudo registrar la recepcion." };
  return { ok: true };
}

// Saldo del profesional para un conjunto de productos (para mostrar y avisar de negativo en el despacho).
export async function getOwnStockByIds(
  userId: string,
  nutraceuticalIds: string[],
): Promise<Record<string, number>> {
  if (nutraceuticalIds.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, userId);
  if (!profId) return {};
  const { data } = await supabase
    .from("nutraceutical_inventory")
    .select("nutraceutical_id, stock_quantity")
    .eq("professional_id", profId)
    .in("nutraceutical_id", nutraceuticalIds);
  const out: Record<string, number> = {};
  for (const id of nutraceuticalIds) out[id] = 0;
  for (const r of data ?? []) out[r.nutraceutical_id] = r.stock_quantity;
  return out;
}

// Historial de DESPACHOS de un tratamiento (entregas a ese paciente). Es dato clinico (liga al
// tratamiento/paciente): lo ve el profesional del paciente; la RLS de movimientos ya lo acota a que sea
// suyo. Mas reciente primero.
export async function getDespachosForTreatment(treatmentId: string): Promise<MovementRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceutical_stock_movements")
    .select("id, created_at, type, delta, reason, lote, nutraceuticals(name)")
    .eq("treatment_id", treatmentId)
    .eq("type", "despacho")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`inventory-service: despachos: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id,
    createdAt: m.created_at,
    type: m.type,
    delta: m.delta,
    reason: m.reason,
    lote: m.lote,
    nutraceuticalName: nutraName(m.nutraceuticals),
  }));
}

// Registra un DESPACHO (entrega al paciente): un movimiento -N ligado al tratamiento. Condiciones:
//  (1) solo productos en_consultorio (los solo_tienda los compra el paciente en la tienda);
//  (2) descuenta el stock (via el trigger);
//  (3) NO impide sin stock: permite el negativo, y devuelve el saldo resultante para AVISAR y que la
//      discrepancia quede visible (un inventario que miente en silencio es peor que uno negativo).
// Guard: el tratamiento debe ser del profesional del paciente (ademas la RLS acota el movimiento a su
// propio inventario).
export async function recordDespacho(input: {
  userId: string;
  treatmentId: string;
  nutraceuticalId: string;
  quantity: number;
}): Promise<{ ok: boolean; message?: string; resultingStock?: number }> {
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, input.userId);
  if (!profId) return { ok: false, message: "No tienes un perfil profesional." };

  // Guard: el tratamiento es de este profesional (treatment -> diagnosis -> evaluation.professional_id).
  const { data: t } = await supabase.from("treatments").select("diagnosis_id").eq("id", input.treatmentId).maybeSingle();
  if (!t) return { ok: false, message: "Tratamiento no encontrado." };
  const { data: d } = await supabase.from("diagnoses").select("evaluation_id").eq("id", t.diagnosis_id).maybeSingle();
  const { data: e } = d ? await supabase.from("evaluations").select("professional_id").eq("id", d.evaluation_id).maybeSingle() : { data: null };
  if (!e || e.professional_id !== profId) return { ok: false, message: "No estas asignado a este paciente." };

  // Condicion 1: solo en_consultorio.
  const { data: prod } = await supabase.from("nutraceuticals").select("commercial_availability, name").eq("id", input.nutraceuticalId).maybeSingle();
  if (!prod) return { ok: false, message: "Producto no encontrado." };
  if (prod.commercial_availability !== "en_consultorio") {
    return { ok: false, message: `"${prod.name}" no se entrega en consultorio (el paciente lo compra en la tienda).` };
  }

  // Movimiento despacho: -N, ligado al tratamiento. El trigger descuenta el saldo (permite negativo).
  const { error } = await supabase.from("nutraceutical_stock_movements").insert({
    professional_id: profId,
    nutraceutical_id: input.nutraceuticalId,
    delta: -input.quantity,
    type: "despacho",
    reason: "Entrega al paciente",
    treatment_id: input.treatmentId,
    created_by: input.userId,
  });
  if (error) return { ok: false, message: "No se pudo registrar la entrega." };

  // Saldo resultante (para el aviso de negativo / discrepancia visible).
  const { data: inv } = await supabase
    .from("nutraceutical_inventory")
    .select("stock_quantity")
    .eq("professional_id", profId)
    .eq("nutraceutical_id", input.nutraceuticalId)
    .maybeSingle();
  return { ok: true, resultingStock: inv?.stock_quantity ?? -input.quantity };
}
