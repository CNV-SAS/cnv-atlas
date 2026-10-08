// ═══ COMO SE LLAMA LA DISPONIBILIDAD COMERCIAL, EN UN SOLO SITIO (Santiago, 2026-10-08) ═══
//
// ── EL DEFECTO, Y ME CORRIJO ──────────────────────────────────────────────────────────────────────
//
// El rótulo decía **"En consultorio"**, y Santiago lo señaló dos veces. Yo lo defendí la primera: dije que el
// campo es la disponibilidad comercial del producto (por dónde se consigue), no el inventario del profesional,
// y arreglé solo la leyenda. **Eso no alcanzaba, y él tenía razón.**
//
// *"Literalmente está diciendo X nutracéutico 'en consultorio'. Cuando ninguno lo tiene el profesional en su
// consultorio y toca pedirlos a la bodega CNV."*
//
// **"En consultorio" NOMBRA UN SITIO, y el sitio es justo donde el producto NO está.** En la misma pantalla, dos
// líneas más abajo, el bloque de venta dice "No tienes unidades en tu vitrina. Hay 384 en la bodega de CNV". Dos
// frases del mismo producto, en la misma consulta, diciendo cosas opuestas. Es EXACTAMENTE el defecto que
// acabábamos de arreglar en /direccion, en otra pantalla, y lo defendí en vez de verlo.
//
// ── EL NOMBRE NUEVO DICE EL CANAL, QUE ES LO QUE EL CAMPO SABE ────────────────────────────────────
//
// `en_consulta` (el valor almacenado sigue siendo `en_consultorio`, que es dato y no se toca) significa que el
// producto SE PUEDE ENTREGAR en una consulta: es el canal de venta, no una afirmación sobre dónde hay unidades.
// "Se entrega en consulta" dice eso y no promete un sitio.
//
// ── Y VIVE AQUÍ PORQUE ESTABA ESCRITO CUATRO VECES ───────────────────────────────────────────────
//
// `/nutraceuticos`, `/mi-inventario`, el formulario de edición y la sección de tratamiento tenían cada uno su
// copia del mapa. Cuatro copias es como se llega a que una pantalla se corrija y las otras tres sigan diciendo
// lo viejo, que es la forma en que este proyecto ha perdido más tiempo.

/** Los valores que guarda `nutraceuticals.commercial_availability`. El dato NO cambia: solo su nombre en pantalla. */
export type DisponibilidadComercial = "en_consultorio" | "solo_tienda" | "no_disponible";

/**
 * Cómo se llama cada disponibilidad en pantalla.
 *
 * NINGUNA AFIRMA DÓNDE HAY UNIDADES: eso lo dice el bloque de venta, con las cifras y la ubicación. Un rótulo
 * de catálogo que hable de existencias va a contradecir al inventario el día que la vitrina esté en cero, que
 * es el día normal.
 */
export const DISPONIBILIDAD_LABEL: Record<string, string> = {
  en_consultorio: "Se entrega en consulta",
  solo_tienda: "Solo en la tienda",
  no_disponible: "No disponible",
};

/** El nombre de una disponibilidad, o el valor crudo si llega uno que no conocemos (no se inventa un rótulo). */
export function nombreDeDisponibilidad(valor: string | null | undefined): string {
  if (valor == null) return "";
  return DISPONIBILIDAD_LABEL[valor] ?? valor;
}

/**
 * La leyenda que acompaña al listado, con lo que el rótulo NO dice.
 *
 * Existe como constante y no escrita en la pantalla por lo mismo que el mapa: la frase que explica el rótulo
 * tiene que cambiar con el rótulo, y en sitios distintos no cambian juntas.
 */
export const LEYENDA_DISPONIBILIDAD =
  "Esto es por dónde se consigue el producto, no cuántas unidades tienes. " +
  "Tus unidades se ven al cobrar, en el bloque de venta.";
