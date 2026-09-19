import "server-only";
import {
  resolverLoteDeRecepcion,
  ubicacionDelProfesional,
} from "./ubicacion-y-lote";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { recordCount, type CountLineInput, type CountResult } from "../data/count-writer";
import { saldoPorProducto } from "../saldo-por-producto";

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
  // UNA FILA POR LOTE desde la 0121: se suman. Un mapa directo dejaba solo el ultimo lote.
  const stockByNutra = saldoPorProducto(inv ?? []);

  // ── EL CATALOGO SE PIDE ACOTADO, NO ENTERO (2026-09-19) ────────────────────────────────────────
  //
  // Se pedia la tabla completa y se filtraba en memoria. PostgREST corta en 1000 filas SIN AVISAR, asi
  // que con un catalogo grande los productos del final (por nombre) desaparecian del inventario del
  // profesional aunque tuviera existencias: un saldo que no se ve es un saldo que no se vende y que nadie
  // cuadra. Salio a la luz en la base local, con 3.084 productos.
  //
  // LO QUE SE PIDE es exactamente lo que esta pantalla muestra: lo que tiene saldo, mas los
  // `en_consultorio` (que salen con 0 para poder recibir).
  const idsConSaldo = [...stockByNutra.keys()];
  const catalogo = supabase.from("nutraceuticals").select("id, name, indication, commercial_availability");
  const { data: cat, error: cErr } = await (idsConSaldo.length
    ? catalogo.or(`commercial_availability.eq.en_consultorio,id.in.(${idsConSaldo.join(",")})`)
    : catalogo.eq("commercial_availability", "en_consultorio")
  ).order("name");
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

  // DESDE LA MIGRACION 0121 el saldo va por (ubicacion, producto, lote), asi que una recepcion necesita
  // las dos cosas. La ubicacion del Integrante es unica; el lote se resuelve del codigo que escribio (y se
  // crea si no existia: esta reconociendo mercancia que TIENE, negarsela alejaria el saldo de la vitrina).
  const locationId = await ubicacionDelProfesional(supabase, profId);
  if (!locationId) return { ok: false, message: "No tienes una ubicación de inventario asignada." };
  const { lotId, message: msgLote } = await resolverLoteDeRecepcion(
    supabase,
    input.nutraceuticalId,
    input.lote,
  );
  if (!lotId) return { ok: false, message: msgLote ?? "No se pudo resolver el lote." };

  const { error } = await supabase.from("nutraceutical_stock_movements").insert({
    professional_id: profId,
    location_id: locationId,
    lot_id: lotId,
    nutraceutical_id: input.nutraceuticalId,
    delta: input.quantity, // recepcion: positivo
    type: "recepcion",
    reason: "Recepción de producto en consignación",
    lote: input.lote,
    created_by: input.userId,
  });
  if (error) return { ok: false, message: "No se pudo registrar la recepción." };
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
  // UNA FILA POR LOTE desde la 0121: se suman, igual que en `getOwnInventory`.
  const saldo = saldoPorProducto(data ?? []);
  const out: Record<string, number> = {};
  for (const id of nutraceuticalIds) out[id] = saldo.get(id) ?? 0;
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

// Registra el CONTEO fisico del profesional (T3b-3 ST2): resuelve su perfil, delega en el writer
// transaccional (sesion + lineas + apertura de casos). Devuelve el resumen (casos abiertos, sobrantes,
// cuadraron) para el aviso. null si el usuario no es profesional.
export async function recordOwnCount(
  userId: string,
  lines: CountLineInput[],
  note: string | null,
): Promise<CountResult | null> {
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, userId);
  if (!profId) return null;
  return recordCount({ professionalId: profId, actorId: userId, note, lines, now: new Date() });
}
