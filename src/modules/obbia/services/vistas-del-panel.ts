// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES VISTAS DEL PANEL  ·  2026-11-04
//
// ═══ DE DONDE SALE (cotejo contra su CNVResearch, 2026-11-03) ═══
//
// Su modulo abre en tres pestanas, **Resumen · Datos · Exportar**, con las dos ultimas bajo candado.
// /obbia era una sola pagina que se recorria entera. Santiago, con las dos capturas delante: *"sigue sin
// parecerse a la pantalla que habia hecho Gildardo"*.
//
// Y LA DIFERENCIA NO ES ESTETICA: su panel dice QUE SE PUEDE HACER antes de ensenar nada. Las tres
// pestanas son tres permisos. En /obbia el permiso estaba escrito (el encabezado y el bloque del nivel),
// pero disuelto en el recorrido: habia que leer hasta el final para saber que el fila a fila no se puede.
//
// ═══ POR QUE LA PESTANA CERRADA EXISTE, EN VEZ DE NO ESTAR ═══
//
// *Datos* no se puede abrir hoy (seria seudonimizado y falta el k-anonimato fila a fila). Lo que vale es
// que ESTE y diga POR QUE: una ausencia no explica nada, una puerta cerrada con su razon si. Es la misma
// regla que esta casa ya aplica a un freno: *"un freno sin salida no es un guard"*, y su version para una
// pieza que todavia no existe es decir que no existe y por que.
//
// ═══ SIN UNA LINEA DE JAVASCRIPT DE CLIENTE ═══
//
// La vista viaja en la URL (`?vista=`), asi que son enlaces normales y el panel sigue siendo un Server
// Component. Se pierde el cambio instantaneo de su modulo y se gana que la pantalla se pueda compartir por
// enlace apuntando a una pestana concreta, que en investigacion vale mas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Las tres vistas, en el orden en que se leen. */
export const VISTAS_DEL_PANEL = ["resumen", "datos", "exportar"] as const;

export type VistaDelPanel = (typeof VISTAS_DEL_PANEL)[number];

export const ROTULO_DE_LA_VISTA: Record<VistaDelPanel, string> = {
  resumen: "Resumen",
  datos: "Datos",
  exportar: "Exportar",
};

/**
 * La vista pedida en la URL, o el resumen.
 *
 * CONSERVADOR A PROPOSITO: cualquier cosa que no sea una de las tres cae en el resumen, que es la unica
 * que no promete nada. Un valor raro en la URL no puede abrir una pestana con mas alcance que la que el
 * usuario pidio.
 */
export function vistaPedida(valor: string | string[] | undefined): VistaDelPanel {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return (VISTAS_DEL_PANEL as readonly string[]).includes(v ?? "")
    ? (v as VistaDelPanel)
    : "resumen";
}
