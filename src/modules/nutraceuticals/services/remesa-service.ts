import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  CnvRemesa,
  EligibleProfessional,
  PendingRemesa,
  RemesableProduct,
  RemesaStatus,
  UnbackedReception,
} from "../remesa-types";
// Re-export para el código de servidor que ya importa estos tipos desde el service. La definición vive en
// remesa-types (neutro) para no dejar este módulo `server-only` al alcance del cliente.
export type {
  CnvRemesa,
  EligibleProfessional,
  PendingRemesa,
  RemesableProduct,
  RemesaStatus,
  UnbackedReception,
} from "../remesa-types";

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
    .select("id, license, profiles!profile_id(full_name)")
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

// A quién se le puede declarar una remesa: los que pueden SOSTENER consignación. Por el invariante del
// modelo, el nutricionista es quien tiene el producto físico y lo entrega; se incluye además a cualquiera
// que YA tenga movimientos de inventario (por si un no-nutricionista sostiene stock). NO tiene sentido
// declararle a un psicólogo que no vende. RLS: admin/soporte leen professional_profiles.
export async function getEligibleProfessionalsForRemesa(): Promise<EligibleProfessional[]> {
  const supabase = await createSupabaseServerClient();
  const { data: profs, error } = await supabase
    .from("professional_profiles")
    .select("id, license, profession, profiles!profile_id(full_name)");
  if (error) throw new Error(`remesa-service: profesionales elegibles: ${error.message}`);
  const { data: mov } = await supabase.from("nutraceutical_stock_movements").select("professional_id");
  const withStock = new Set((mov ?? []).map((m) => m.professional_id));
  return (profs ?? [])
    .filter((p) => p.profession === "nutricionista" || withStock.has(p.id))
    .map((p) => ({
      professionalId: p.id,
      name:
        one(p.profiles as { full_name?: string } | { full_name?: string }[] | null)?.full_name ||
        p.license ||
        "Integrante",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Productos que se pueden enviar en consignación: los en_consultorio (los solo_tienda los compra el
// paciente en la tienda; no van en la vitrina del integrante).
export async function getRemesableProducts(): Promise<RemesableProduct[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceuticals")
    .select("id, name")
    .eq("commercial_availability", "en_consultorio")
    .order("name");
  if (error) throw new Error(`remesa-service: productos: ${error.message}`);
  return (data ?? []).map((p) => ({ id: p.id, name: p.name }));
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
}): Promise<{
  ok: boolean;
  message?: string;
  declared?: number; // lo que CNV declaró
  reported?: number; // lo que el integrante dijo que llegó
  balanceApplied?: number; // lo que subió el saldo (min de los dos)
  difference?: number; // reportado − declarado (con signo)
}> {
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

  // Asimetría (decisión del plan): el saldo sube por lo CONFIRMADO cuando es MENOR (el integrante tiene lo
  // que tiene, se acepta a su palabra), y solo por lo DECLARADO cuando es MAYOR (el excedente NO infla el
  // saldo sin que CNV lo reconozca; si es real, lo reconcilia el conteo/sobrante que ya existe). `delta` es el
  // efecto en el saldo (el min); `reported_quantity` guarda lo que dijo que llegó, para ver la dirección.
  const balanceDelta = Math.min(input.actualQuantity, remesa.delta);
  const { error } = await supabase.from("nutraceutical_stock_movements").insert({
    professional_id: profId,
    nutraceutical_id: remesa.nutraceutical_id,
    delta: balanceDelta,
    reported_quantity: input.actualQuantity,
    type: "recepcion",
    reason: "Recepción de remesa (consignación)",
    lote: input.lote,
    remesa_id: remesa.id,
    created_by: input.userId,
  });
  // El índice único (una recepción por remesa) o el trigger de coherencia devuelven error si algo no cuadra.
  if (error) return { ok: false, message: "No se pudo confirmar la remesa (¿ya estaba confirmada?)." };
  // difference = reportado − declarado (con signo): <0 faltó, >0 sobró (el excedente no entró al saldo).
  return {
    ok: true,
    declared: remesa.delta,
    reported: input.actualQuantity,
    balanceApplied: balanceDelta,
    difference: input.actualQuantity - remesa.delta,
  };
}

// === READERS ===

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

  // Recepciones que respaldan cada remesa (una por remesa por el índice único). Se usa lo REPORTADO
  // (reported_quantity, lo que dijo el integrante que llegó), no el delta del saldo, para ver la dirección.
  const { data: recs } = await supabase
    .from("nutraceutical_stock_movements")
    .select("remesa_id, delta, reported_quantity")
    .eq("type", "recepcion")
    .not("remesa_id", "is", null);
  const reportedByRemesa = new Map(
    (recs ?? []).map((r) => [r.remesa_id as string, r.reported_quantity ?? r.delta]),
  );
  const names = await professionalNames(supabase, [...new Set(remesas.map((r) => r.professional_id))]);

  return remesas.map((r) => {
    const reported = reportedByRemesa.has(r.id) ? (reportedByRemesa.get(r.id) as number) : null;
    const status: RemesaStatus =
      reported == null
        ? "enviada"
        : reported === r.delta
          ? "confirmada"
          : reported < r.delta
            ? "confirmada_faltante"
            : "confirmada_sobrante";
    return {
      remesaId: r.id,
      professionalId: r.professional_id,
      professionalName: names.get(r.professional_id) ?? "Integrante",
      nutraceuticalName: one(r.nutraceuticals as { name?: string } | { name?: string }[] | null)?.name ?? "",
      declaredQuantity: r.delta,
      receivedQuantity: reported,
      difference: reported == null ? null : reported - r.delta,
      status,
      declaredAt: r.created_at,
    };
  });
}

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
