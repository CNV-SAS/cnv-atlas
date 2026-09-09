// LAS ETAPAS DE UNA EVALUACION · MODULO NEUTRO (2026-09-09).
//
// POR QUE EXISTE, y no es reorganizacion por gusto: hay textos de pantalla que dicen DONDE vive un paso
// ("ese paso vive en la pestaña X"). Escritos a mano, sobreviven a que su premisa deje de ser cierta.
// Paso literalmente: al partir "Evaluacion" en Encuesta + Antrop. & BIS, el aviso de la pestaña
// Diagnostico siguio mandando a "la pestaña Evaluación", que ya no existe. Nadie lo vio hasta el smoke.
//
// LA REGLA QUE SALE: un texto que nombra una pestaña se DERIVA del mapa de pestañas. Asi, el dia que una
// se renombre o se parta, los avisos se renombran con ella y no hay nada que acordarse de barrer.
//
// POR QUE NEUTRO (sin `"use client"` ni `server-only`): lo importan las dos orillas. La barra de pestañas
// es un componente cliente y los avisos que nombran una pestaña se rinden desde el servidor. Un valor
// compartido por las dos vive en un modulo neutro; si viviera en el componente cliente, la pagina estaria
// importando un valor de un modulo `"use client"` e invocandolo, que es el hazard B de CLAUDE.md.

export type TabId = "encuesta" | "antro" | "diagnostico" | "tratamiento" | "seguimiento" | "reporte";

// EL ORDEN SALE DE SU ARCHIVO (`MODS_CLINICA`, entrega vigente del 4 de septiembre), y el candado
// `etapas-en-su-orden.test.ts` lo DERIVA de ahi y lo compara. Nuestras ETIQUETAS no son sus etiquetas:
// "Tratamiento" se queda (Gildardo lo reviso y dijo que asi lo dejaramos), y ademas esa pestaña contiene
// las rutas Y el panel del profesional, asi que describe mejor lo que hay dentro que "Rutas de atencion".
// Lo que se fija es el ORDEN y CUANTAS son, que es lo que el pidio.
export const ETAPAS: { id: TabId; label: string }[] = [
  { id: "encuesta", label: "Encuesta" },
  { id: "antro", label: "Antrop. & BIS" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "tratamiento", label: "Tratamiento" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "reporte", label: "Reporte / HC" },
];

export const ETAPA_IDS = new Set<string>(ETAPAS.map((t) => t.id));

/**
 * El rotulo de una etapa, tal como aparece en la barra.
 *
 * USARLO EN CUALQUIER TEXTO QUE NOMBRE UNA PESTAÑA, en vez de escribir el nombre. Es lo unico que impide
 * que un aviso siga mandando a una pestaña que se renombro o que ya no existe.
 */
export function etiquetaDeEtapa(id: TabId): string {
  const etapa = ETAPAS.find((t) => t.id === id);
  // No puede pasar (el tipo lo impide), pero devolver el id es mejor que romper una pantalla por un
  // rotulo: el profesional leeria "antro" en vez de quedarse sin aviso.
  return etapa?.label ?? id;
}
