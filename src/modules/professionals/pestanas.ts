// ═══ LAS PESTAÑAS DEL PERFIL (2026-09-25) ═══
//
// MODULO NEUTRO (sin "use client" ni "server-only") a proposito, por la misma razon que `diagnoses/etapas`:
// la lista la consume el shell de cliente Y el servidor, que puede necesitar nombrar una pestaña en un aviso
// ("ese dato se edita en Tributaria"). Si viviera en el componente `"use client"`, un aviso rendido en el
// servidor que la importara caeria en el hazard B de las fronteras RSC.

export const PESTANAS = [
  { id: "datos", titulo: "Mis datos" },
  { id: "tributaria", titulo: "Tributaria" },
  { id: "bancaria", titulo: "Bancaria" },
  { id: "adjuntos", titulo: "Adjuntos" },
] as const;

export type PestanaId = (typeof PESTANAS)[number]["id"];

export const PESTANA_IDS: ReadonlySet<string> = new Set(PESTANAS.map((p) => p.id));

/**
 * Una pestaña desconocida cae a la primera. Se valida contra la LISTA y no contra una cadena de
 * comparaciones: agregar una pestaña y olvidar el parseo daria una a la que la URL nunca llega.
 */
export function parsePestana(raw: string | null): PestanaId {
  return raw && PESTANA_IDS.has(raw) ? (raw as PestanaId) : "datos";
}
