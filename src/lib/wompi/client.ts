import "server-only";

import { z } from "zod";

import { appError, err, ok, type Result } from "@/core/errors";

// ═══ CONSULTAR TRANSACCIONES EN WOMPI (Bloque 3b, sesion 3) ═══
//
// PARA QUE: Wompi reintenta su webhook 3 veces en 24 horas y despues no lo intenta mas. Si Atlas no pudo
// responder durante esa ventana (paso el 2026-09-15, con la base saturada), esa venta queda cobrada, sin sellar,
// sin factura y sin aviso, y NADA la recupera. Preguntarle a Wompi es la unica forma de enterarse.
//
// ESTE LISTADO NO ESTA DOCUMENTADO: la documentacion publica de Wompi describe el de dispersiones, que es otro
// producto. Lo que sabemos salio de un sondeo de solo lectura contra el sandbox (`scripts/sondeo-wompi-consulta`,
// 2026-09-16), y por eso queda escrito aqui:
//
//   · GET /v1/transactions exige CUATRO parametros: from_date, until_date, page y page_size (tope 200).
//     La fecha vale con hora ISO o como AAAA-MM-DD; se manda con hora, que es mas preciso.
//   · Devuelve `{ data: [...], meta: { page, page_size, total_results } }`, ordenado de la mas NUEVA a la mas
//     vieja, y el numero de pagina se respeta (la pagina 2 no repite la 1).
//   · `?reference=` SI filtra de verdad (devolvio 1 de 20). Aun asi se vuelve a comparar aqui: un filtro que
//     algun dia deje de filtrar no puede hacer que Atlas selle la venta equivocada.
//   · La consulta va con la llave PRIVADA. Con la publica, Wompi responde 404.
//
// AMBIENTE: la llave privada decide a que Wompi se pregunta, y `ambienteDeLaLlave` lo expone para que el cotejo
// no mezcle ambientes (regla del Bloque 2a: una venta de `test` no se sella con datos de produccion).

const TIMEOUT_MS = 15_000;
const TOPE_POR_PAGINA = 200;

/** Lo que el cotejo necesita de una transaccion. Se ignora el resto de campos que Wompi manda. */
const transaccionSchema = z.object({
  id: z.string(),
  reference: z.string().nullable().optional(),
  status: z.string(),
  amount_in_cents: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  payment_method_type: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  finalized_at: z.string().nullable().optional(),
  status_message: z.string().nullable().optional(),
  payment_method: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type TransaccionDeWompi = z.infer<typeof transaccionSchema>;

const respuestaSchema = z.object({
  data: z.array(transaccionSchema),
  meta: z.object({ page: z.number().optional(), page_size: z.number().optional(), total_results: z.number().optional() }).partial().optional(),
});

function llave(): string | null {
  const k = process.env.WOMPI_PRIVATE_KEY;
  return typeof k === "string" && k.startsWith("prv_") ? k : null;
}

/** "test" o "produccion", segun la llave privada configurada. La publica y la privada tienen que ir a la par. */
export function ambienteDeLaLlave(): "test" | "produccion" | null {
  const k = llave();
  if (!k) return null;
  return k.startsWith("prv_prod_") ? "produccion" : "test";
}

function baseUrl(): string {
  return ambienteDeLaLlave() === "produccion" ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";
}

async function pedir(ruta: string): Promise<Result<z.infer<typeof respuestaSchema>>> {
  const k = llave();
  if (!k) return err(appError("internal", "Falta WOMPI_PRIVATE_KEY (la publica no sirve para consultar)."));
  try {
    const res = await fetch(`${baseUrl()}${ruta}`, {
      headers: { Authorization: `Bearer ${k}` },
      // ARCHITECTURE regla 10: ninguna llamada externa sin timeout.
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      const cuerpo = (await res.text()).slice(0, 300);
      return err(appError("internal", `Wompi respondio ${res.status}: ${cuerpo}`));
    }
    const parsed = respuestaSchema.safeParse(await res.json());
    if (!parsed.success) return err(appError("internal", "La respuesta de Wompi no tiene la forma esperada."));
    return ok(parsed.data);
  } catch (e) {
    // Un timeout aqui es benigno: consultar no cambia nada, y el cotejo vuelve a correr.
    return err(appError("internal", e instanceof Error ? e.message : "No se pudo consultar a Wompi."));
  }
}

const enIso = (f: Date) => f.toISOString();

/**
 * Las transacciones de un rango, recorriendo las paginas que haga falta. `tope` acota el trabajo: con el volumen
 * de CNV un dia entero cabe en una pagina, y si alguna vez no cupiera, es mejor avisar que barrer sin limite.
 */
export async function listarTransacciones(desde: Date, hasta: Date, tope = 1_000): Promise<Result<TransaccionDeWompi[]>> {
  const todas: TransaccionDeWompi[] = [];
  for (let pagina = 1; todas.length < tope; pagina++) {
    const r = await pedir(
      `/transactions?from_date=${encodeURIComponent(enIso(desde))}&until_date=${encodeURIComponent(enIso(hasta))}&page=${pagina}&page_size=${TOPE_POR_PAGINA}`,
    );
    if (!r.ok) return r;
    todas.push(...r.value.data);
    if (r.value.data.length < TOPE_POR_PAGINA) break;
  }
  return ok(todas);
}

/**
 * UNA venta concreta, por la referencia con la que Atlas la creo (su id). El filtro de Wompi funciona, pero la
 * referencia se vuelve a comparar aqui: sellar la venta equivocada seria peor que no encontrarla.
 */
export async function buscarPorReferencia(referencia: string, desde: Date, hasta: Date): Promise<Result<TransaccionDeWompi | null>> {
  const r = await pedir(
    `/transactions?from_date=${encodeURIComponent(enIso(desde))}&until_date=${encodeURIComponent(enIso(hasta))}&page=1&page_size=${TOPE_POR_PAGINA}&reference=${encodeURIComponent(referencia)}`,
  );
  if (!r.ok) return r;
  const suyas = r.value.data.filter((t) => t.reference === referencia);
  // La mas reciente: un mismo link puede tener varios intentos (uno rechazado y otro aprobado).
  const ordenadas = [...suyas].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  return ok(ordenadas[0] ?? null);
}
