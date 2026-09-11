import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// ═══ RESOLVER LA UBICACION Y EL LOTE DE UN MOVIMIENTO (Bloque 1, migracion 0121) ═══
//
// Desde que el saldo se lleva por (ubicacion, producto, lote), todo movimiento necesita las dos cosas. Los
// servicios que ya existian solo conocian al profesional y un `lote` de TEXTO LIBRE, asi que este modulo
// es el puente: convierte lo que esos servicios tienen en lo que la tabla ahora exige.
//
// VIVE APARTE Y NO DENTRO DE `inventory-service` porque lo necesitan tres servicios (inventario, remesa y
// el despacho del tratamiento) y porque su regla mas delicada, la eleccion de lote al entregar, merece
// leerse sola.

/** La ubicacion de un profesional. Cada uno tiene exactamente una (indice unico parcial, migracion 0120). */
export async function ubicacionDelProfesional(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("professional_id", professionalId)
    .maybeSingle();
  return data?.id ?? null;
}

/** La bodega central de CNV. Hay una sola, garantizada por indice unico parcial. */
export async function ubicacionCentral(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("kind", "central")
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * RESUELVE EL LOTE DE UNA RECEPCION a partir del codigo que escribio el Integrante.
 *
 * ANTES ese codigo era texto libre en el movimiento y no gobernaba nada. Ahora tiene que ser una FILA, y
 * eso obliga a decidir que hacer cuando el codigo no existe todavia.
 *
 * SE CREA, y no se rechaza. El Integrante esta reconociendo mercancia que TIENE EN LA MANO: negarle el
 * registro porque CNV no habia dado de alta el lote convertiria un dato cierto (llegaron 15 unidades del
 * lote 19826) en un dato ausente, y el saldo se alejaria de la vitrina, que es lo unico que el inventario
 * tiene que reflejar.
 *
 * LO QUE SI FALTA cuando se crea asi es el VENCIMIENTO, que el formulario no pide. Se deja nulo... salvo
 * que no se puede: la columna es NOT NULL, porque un lote sin vencimiento no sirve para lo que existen los
 * lotes (avisar a 60 dias y rastrear un retiro). Asi que se crea con un vencimiento PROVISIONAL y se marca
 * en `notes` para que se pueda listar lo que falta completar. Un lote provisional visible es mejor que un
 * movimiento sin lote o que una recepcion rechazada.
 */
export async function resolverLoteDeRecepcion(
  supabase: SupabaseClient,
  nutraceuticalId: string,
  codigo: string | null,
): Promise<{ lotId: string | null; message?: string }> {
  const code = (codigo ?? "").trim();
  if (!code) {
    return { lotId: null, message: "Indica el lote del producto que estás recibiendo." };
  }

  const { data: existente } = await supabase
    .from("lots")
    .select("id")
    .eq("nutraceutical_id", nutraceuticalId)
    .eq("code", code)
    .maybeSingle();
  if (existente) return { lotId: existente.id };

  // PROVISIONAL Y MARCADO. La fecha se completa cuando CNV registre la remesa o revise el lote; lo que no
  // puede pasar es que quede en silencio, asi que la nota es lo que lo hace listable.
  const dentroDeUnAno = new Date();
  dentroDeUnAno.setFullYear(dentroDeUnAno.getFullYear() + 1);
  const { data: creado, error } = await supabase
    .from("lots")
    .insert({
      nutraceutical_id: nutraceuticalId,
      code,
      expires_on: dentroDeUnAno.toISOString().slice(0, 10),
      notes: "PROVISIONAL: vencimiento sin confirmar, declarado en una recepción del Integrante",
    })
    .select("id")
    .single();
  if (error || !creado) return { lotId: null, message: "No se pudo registrar el lote." };
  return { lotId: creado.id };
}

/**
 * ═══ DE QUE LOTE SE ENTREGA: EL QUE VENCE ANTES (FEFO) ═══
 *
 * Con el saldo por lote, entregar obliga a elegir uno. Y la eleccion NO se le pregunta al profesional, por
 * dos razones:
 *
 *   · LA RESPUESTA CORRECTA SIEMPRE ES LA MISMA en un producto perecedero: sale primero lo que vence
 *     primero. Preguntar algo cuya respuesta no depende del criterio clinico es gastarle atencion al
 *     profesional y abrir la puerta a que el producto viejo se quede en la vitrina hasta vencerse.
 *   · Y LA TRAZABILIDAD NO DEPENDE DE QUE EL ACIERTE: el lote queda registrado igual, que es lo que hace
 *     falta para un retiro dirigido.
 *
 * DEVUELVE null SI NO ALCANZA en ningun lote. Entregar mas de lo que hay en un lote partiria la entrega
 * entre dos, y eso es otra decision (y otra fila); hoy se avisa en vez de repartir en silencio.
 */
export async function loteParaEntregar(
  supabase: SupabaseClient,
  locationId: string,
  nutraceuticalId: string,
  cantidad: number,
): Promise<{ lotId: string | null; disponible: number }> {
  const { data } = await supabase
    .from("nutraceutical_inventory")
    .select("lot_id, stock_quantity, lots!inner(expires_on)")
    .eq("location_id", locationId)
    .eq("nutraceutical_id", nutraceuticalId)
    .gt("stock_quantity", 0);

  const filas = (data ?? []) as unknown as {
    lot_id: string;
    stock_quantity: number;
    lots: { expires_on: string };
  }[];
  const disponible = filas.reduce((a, f) => a + f.stock_quantity, 0);
  // El que vence antes primero; a igualdad de fecha, el que mas tenga (deja menos saldos sueltos).
  const ordenadas = [...filas].sort(
    (a, b) => a.lots.expires_on.localeCompare(b.lots.expires_on) || b.stock_quantity - a.stock_quantity,
  );
  const elegido = ordenadas.find((f) => f.stock_quantity >= cantidad);
  return { lotId: elegido?.lot_id ?? null, disponible };
}
