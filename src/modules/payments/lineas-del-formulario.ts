// Lectura de las lineas de una venta desde el FormData. Modulo NEUTRO y puro.
//
// ── POR QUE NO VIVE EN `actions.ts`, y lo enseño el build ───────────────────────────────────────
//
// Ahi estaba, y exportarla rompio la compilacion de produccion: en un modulo `"use server"` TODO export
// tiene que ser una funcion async, porque Next las convierte en endpoints. Una funcion sincrona exportada
// no es un error de tipos ni de lint, y los 2838 tests pasaron: solo la vio `pnpm build`.
//
// Es la familia de fallos que `CLAUDE.md` ya documenta (fronteras RSC, hazards de formulario): verde en
// local, roto en produccion. Y el arreglo correcto no era dejar de exportarla para poder probarla: es que
// leer un formulario NO ES UNA ACCION DE SERVIDOR. Aqui es puro, testeable y no cruza ninguna frontera.
//
// ── LO QUE HACE Y LO QUE NO ─────────────────────────────────────────────────────────────────────
//
// Las lineas viajan como JSON en un campo oculto (el mismo patron que el conteo de inventario). Si viene
// roto o vacio se devuelve lista VACIA y la rechaza el esquema de Zod con su mensaje: no se cae a un valor
// por defecto, porque el defecto seria cobrar algo que nadie eligio.

export type LineaDelFormulario = { nutraceuticalId: string; quantity: number };

export function leerLineas(formData: FormData): LineaDelFormulario[] {
  try {
    const crudo = JSON.parse(String(formData.get("lineas") ?? "[]")) as unknown;
    if (!Array.isArray(crudo)) return [];
    return crudo.map((l) => {
      const o = (l ?? {}) as { nutraceuticalId?: unknown; quantity?: unknown };
      return {
        nutraceuticalId: String(o.nutraceuticalId ?? ""),
        // Una cantidad que no es numero llega como NaN A PROPOSITO: convertirla a 1 seria decidir una
        // cantidad que el profesional no escribio. Se deja pasar rota para que la rechace quien tiene el
        // mensaje de error.
        quantity: Number(String(o.quantity ?? "")),
      };
    });
  } catch {
    return [];
  }
}
