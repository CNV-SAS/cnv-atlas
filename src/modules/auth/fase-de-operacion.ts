// ═══ EN QUE FASE ESTA ATLAS (2026-09-25) ═══
//
// Lector de entorno PURO (sin secretos ni BD, por eso no lleva `server-only` y es testeable).
//
// ── POR QUE HACE FALTA, Y NO ES UN FLAG MAS ──
//
// El aviso de arriba de la pantalla colgaba de `ATLAS_MFA_RELAXED`, o sea del segundo factor. Eso fue correcto
// mientras las dos cosas coincidieran (estamos en pruebas Y el segundo factor esta relajado), y deja de serlo
// ahora: Santiago arranca operacion real **sin separar ambientes** y **sin activar el segundo factor todavia**.
// Con el aviso atado a ese flag, Atlas seguiria diciendo "Entorno de pruebas. Nada de lo que registres aqui es
// real" a profesionales que estan atendiendo pacientes de verdad.
//
// ESE ES EL PEOR ERROR POSIBLE DE LOS DOS: un aviso que invita a escribir basura sobre datos reales. Por eso se
// separan: la relajacion del segundo factor sigue siendo una propiedad de la AUTENTICACION, y la fase es una
// propiedad de la OPERACION. Son dos hechos distintos y hoy ya no coinciden.
//
// ── EL DEFECTO SEGURO ES NO DECIR NADA ──
//
// Sin la variable no se muestra ningun aviso. Y la razon es asimetrica a proposito: el error de callar es que
// un profesional no sepa que puede haber fallos (molesto, y se le dice por otro canal); el error de decir
// "pruebas" en produccion es que registre datos falsos sobre pacientes reales, y eso no se deshace. Cuando dos
// defectos no cuestan lo mismo, el defecto por omision tiene que ser el barato.

export type FaseDeOperacion = "pruebas" | "lanzamiento" | null;

/**
 * La fase, tomada de `ATLAS_FASE`. Un valor desconocido se trata como ausente: es un dedo mal puesto en la
 * configuracion, y ante la duda vale la misma regla de arriba (callar antes que afirmar algo falso).
 *
 * CAMBIARLA ES CONFIGURACION, NO CODIGO: se edita en Vercel y no hay que tocar un archivo ni revisar un PR.
 */
export function faseDeOperacion(): FaseDeOperacion {
  const valor = (process.env.ATLAS_FASE ?? "").trim().toLowerCase();
  if (valor === "pruebas") return "pruebas";
  if (valor === "lanzamiento") return "lanzamiento";
  return null;
}
