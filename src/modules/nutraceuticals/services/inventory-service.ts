import "server-only";
import {
  resolverLoteDeRecepcion,
  ubicacionDelProfesional,
} from "./ubicacion-y-lote";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  estadoDeLaVentanaDeConteo,
  recordCount,
  type CountLineInput,
  type CountResult,
} from "../data/count-writer";
import type { EstadoDelConteo } from "../ventana-de-conteo";
import { saldoPorProducto } from "../saldo-por-producto";

// Servicio del inventario en CONSIGNACION del profesional (T3b-1, "Mi inventario"). Lecturas del saldo
// y el historial del propio profesional, y el registro de una RECEPCION (un movimiento). El saldo lo
// mueve el trigger; aqui solo se inserta el movimiento (la RLS acota a que sea del profesional).

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL CATALOGO SE LEE POR TANDAS Y PAGINADO  ·  2026-11-15
//
// ═══ EL REMEDIO DEL 19 DE SEPTIEMBRE SE PASO DE SU PROPIO LIMITE ═══
//
// Ese dia se cambio "pedir la tabla entera y filtrar en memoria" por "pedir solo lo que hace falta",
// porque PostgREST corta en MIL filas sin avisar y los productos del final desaparecian del inventario
// del profesional aunque tuviera existencias. El remedio fue un `id.in.(...)` con todos los ids que
// tienen saldo, SIN TOPE. Y un `in` sin tope viaja en la URL: con unos cientos de productos con saldo,
// la URL se pasa de largo y PostgREST responde **`URI too long`**. O sea que el remedio de la
// truncacion silenciosa se convirtio en un fallo ruidoso un poco mas alla.
//
// MEDIDO: una uuid con su coma son 37 caracteres y el limite tipico de URL son 8 a 16 KB, asi que
// revienta entre 200 y 400 ids. El catalogo real tiene 125 productos, asi que no era urgente; pero en la
// base local ya se alcanzo (20.059 filas que dejaba un test sin limpiar) y ponia rojo a
// `saldo-por-lote-db`, un test que no tiene nada que ver con esto.
//
// ═══ LAS DOS COSAS A LA VEZ, PORQUE SON EL MISMO DEFECTO VISTO DESDE DOS LADOS ═══
//
//   · TANDAS de ids, para que la URL no crezca con el catalogo;
//   · PAGINACION con un orden estable, para que ninguna de las dos consultas se corte en mil sin decirlo
//     (la de los `en_consultorio` tampoco la tenia).
//
// Paginar sin un `order by` estable no define que trae cada pagina: el motor puede devolver la misma
// fila dos veces y perder otra. Se ordena por `id`, que es unico. EL ORDEN QUE SE VE no cambia: esta
// funcion ya ordenaba en memoria al final (primero lo que tiene saldo, despues por nombre), asi que el
// `order("name")` de la consulta era decorativo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Las columnas del catalogo que esta pantalla usa. En un solo sitio: se piden en dos consultas. */
const COLUMNAS_DEL_CATALOGO = "id, name, indication, commercial_availability, is_test, unit_price";
/** El tope de PostgREST por consulta. Se pagina de mil en mil. */
const PAGINA_DEL_CATALOGO = 1000;
/** Cuantos ids caben en un `in` sin arriesgar la URL: 150 x 37 caracteres son ~5,5 KB. */
const IDS_POR_TANDA = 150;

type FilaDelCatalogo = {
  id: string;
  name: string;
  indication: string | null;
  commercial_availability: string;
  is_test: boolean | null;
  unit_price: number | string | null;
};

export type InventoryLine = {
  nutraceuticalId: string;
  name: string;
  indication: string | null;
  commercialAvailability: string; // en_consultorio | solo_tienda | no_disponible
  stock: number;
  /**
   * Producto de PRUEBA. La LISTA los muestra MARCADOS y la CIFRA de la tarjeta los excluye, igual que con
   * los pacientes de prueba: si la lista los escondiera, su saldo desapareceria sin poder cuadrarlo, y si la
   * cifra los contara, la tarjeta y la de Direccion dirian numeros distintos del mismo hecho (smoke del
   * 2026-09-29: 1.903 contra 1.820).
   */
  esDePrueba: boolean;
  /**
   * ═══ EL PVP Y LOS LOTES, EN LA PANTALLA DONDE SE BUSCAN (Santiago, 2026-10-03) ═══
   *
   * Los Integrantes entran a su inventario a mirar el precio, y no estaba: habia que irse a /pagos o al
   * tratamiento. "Es valido que su primer instinto vaya a ser verlo en inventario", y lo es: el precio es un
   * atributo del producto que tienen en la mano.
   *
   * Y LOS LOTES CON SU VENCIMIENTO, por lo mismo y por algo mas: el saldo ya se guarda POR LOTE (una fila
   * por lote desde la 0121) y la pantalla lo sumaba en un solo numero. Quien tiene que sacar la caja del
   * estante necesita saber CUAL sale primero, que es justo lo que decide el descuento (FEFO). Mostrar solo
   * el total obliga a adivinarlo.
   */
  pvp: number | null;
  lotes: { codigo: string; vence: string | null; cantidad: number }[];
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

  // EL LOTE VIENE EN LA MISMA FILA QUE EL SALDO, no en una segunda consulta: el saldo ya vive POR LOTE y
  // pedirlo aparte abriria la puerta a que el total y su desglose no sumen, que es el defecto que ya pagamos
  // en el tablero de Direccion.
  const { data: inv, error: iErr } = await supabase
    .from("nutraceutical_inventory")
    .select("nutraceutical_id, stock_quantity, lots(code, expires_on)")
    .eq("professional_id", profId);
  if (iErr) throw new Error(`inventory-service: saldos: ${iErr.message}`);

  // Los lotes de cada producto, sin los que estan en cero: un lote agotado existe porque alguna vez hubo
  // unidades, y listarlo diria que hay producto de ese lote cuando no queda ninguno.
  const lotesPorNutra = new Map<string, { codigo: string; vence: string | null; cantidad: number }[]>();
  for (const f of inv ?? []) {
    const cantidad = Number(f.stock_quantity) || 0;
    if (cantidad === 0) continue;
    const lote = (Array.isArray(f.lots) ? f.lots[0] : f.lots) as { code?: string; expires_on?: string } | null;
    const lista = lotesPorNutra.get(f.nutraceutical_id) ?? [];
    lista.push({ codigo: lote?.code ?? "sin lote", vence: lote?.expires_on ?? null, cantidad });
    lotesPorNutra.set(f.nutraceutical_id, lista);
  }
  // Ordenados por vencimiento: el primero es el que sale primero (FEFO), que es lo que se va a buscar aqui.
  for (const lista of lotesPorNutra.values()) {
    lista.sort((a, b) => (a.vence ?? "9999").localeCompare(b.vence ?? "9999"));
  }
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
  // ── Y EL PRODUCTO DE PRUEBA NO SE OFRECE SI NO TIENE SALDO (Santiago, 2026-10-02) ──
  //
  // Salia en la vitrina de integrantes REALES, en cero y marcado. Un producto que nadie puede vender y del
  // que no hay nada solo ocupa sitio en la pantalla donde se cuenta el inventario.
  //
  // PERO SI TIENE SALDO SE MUESTRA, y esa mitad importa igual: esconder unidades que estan en su vitrina
  // haria que la pantalla contradijera el conteo fisico, y es la pantalla que existe PARA contar. Asi que
  // la regla es "con saldo siempre; sin saldo solo los reales".
  const idsConSaldo = [...stockByNutra.keys()];

  // SE JUNTAN POR ID EN UN MAPA, no concatenando listas: un producto `en_consultorio` que ADEMAS tiene
  // saldo sale en las dos consultas, y duplicarlo pondria la misma fila dos veces en la pantalla.
  const porId = new Map<string, FilaDelCatalogo>();
  const paginar = async (
    etiqueta: string,
    acotar: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ) => {
    for (let desde = 0; ; desde += PAGINA_DEL_CATALOGO) {
      const { data, error } = await acotar(desde, desde + PAGINA_DEL_CATALOGO - 1);
      if (error) throw new Error(`inventory-service: catalogo (${etiqueta}): ${error.message}`);
      const filas = (data ?? []) as FilaDelCatalogo[];
      for (const f of filas) porId.set(f.id, f);
      if (filas.length < PAGINA_DEL_CATALOGO) return;
    }
  };

  // 1 · LOS OFRECIBLES: los que el profesional puede llegar a tener, con su precio, aunque esten en cero.
  await paginar("ofrecibles", (desde, hasta) =>
    supabase
      .from("nutraceuticals")
      .select(COLUMNAS_DEL_CATALOGO)
      .eq("commercial_availability", "en_consultorio")
      .eq("is_test", false)
      .order("id")
      .range(desde, hasta),
  );

  // 2 · LOS QUE TIENEN SALDO, por tandas. Incluye los de prueba CON saldo y los que ya no se ofrecen:
  //     esconder unidades que estan en su vitrina haria que la pantalla contradijera el conteo fisico, y
  //     es la pantalla que existe PARA contar.
  for (let i = 0; i < idsConSaldo.length; i += IDS_POR_TANDA) {
    const tanda = idsConSaldo.slice(i, i + IDS_POR_TANDA);
    await paginar(`con saldo ${i / IDS_POR_TANDA + 1}`, (desde, hasta) =>
      supabase
        .from("nutraceuticals")
        .select(COLUMNAS_DEL_CATALOGO)
        .in("id", tanda)
        .order("id")
        .range(desde, hasta),
    );
  }
  const cat = [...porId.values()];

  return (cat ?? [])
    .map((c) => ({
      nutraceuticalId: c.id,
      name: c.name,
      indication: c.indication ?? null,
      commercialAvailability: c.commercial_availability,
      stock: stockByNutra.get(c.id) ?? 0,
      esDePrueba: c.is_test === true,
      pvp: c.unit_price == null ? null : Number(c.unit_price),
      lotes: lotesPorNutra.get(c.id) ?? [],
    }))
    .filter((l) => l.stock !== 0 || l.commercialAvailability === "en_consultorio")
    // ═══ LO QUE TIENE, PRIMERO (Santiago, 2026-10-03) ═══
    //
    // Los de saldo CERO siguen en la lista a proposito, y no es lo mismo que en /direccion: alli listar un
    // cero diria que hay producto en una bodega donde no hay ninguno, y aqui es el catalogo de lo que ESTE
    // Integrante puede llegar a tener, con su precio. Desde que la fila lleva el PVP se volvio ademas la
    // forma natural de consultarlo.
    //
    // PERO EL ORDEN IMPORTABA: alfabetico, ADAPTO-STRESS con 14 quedaba arriba por casualidad y los cinco
    // ceros debajo con su precio, de modo que la pantalla se leia como "tengo de todo". Primero lo que tiene
    // en la mano; despues lo que podria pedir.
    .sort((a, b) => (b.stock !== 0 ? 1 : 0) - (a.stock !== 0 ? 1 : 0) || a.name.localeCompare(b.name));
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

/**
 * EL ESTADO DE LA VENTANA DE CONTEO del usuario que mira (0208).
 *
 * Resuelve su perfil profesional igual que `recordOwnCount`, para que la pantalla y el escritor miren
 * EXACTAMENTE lo mismo: si la pantalla calculara la ventana por su cuenta, podria ofrecer el formulario
 * cuando el escritor va a rechazarlo, que es la contradiccion mas molesta posible (una pantalla que invita a
 * hacer algo y un servidor que lo niega).
 *
 * SIN PERFIL PROFESIONAL se devuelve cerrado: quien no custodia inventario no tiene nada que contar.
 */
export async function ventanaDeConteoDelUsuario(userId: string): Promise<EstadoDelConteo> {
  const supabase = await createSupabaseServerClient();
  const profId = await ownProfessionalId(supabase, userId);
  if (!profId) {
    return { abierto: false, porQue: "fuera_de_ventana", proxima: { desde: "-", hasta: "-" } };
  }
  return estadoDeLaVentanaDeConteo(profId);
}
