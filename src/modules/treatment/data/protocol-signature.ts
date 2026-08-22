// Firmas de las secciones EDITABLES del panel de tratamiento. Puras y AUTOCONTENIDAS (sin imports
// server-only): las usan el panel client (para el `key` de remonte) y el writer server (para el candado de
// concurrencia). Un solo lugar = cliente y servidor computan lo mismo, sin deriva.
//
// El defecto que arranco esto: TODO el estado editable del panel es useState inicializado UNA sola vez desde
// el prop, asi que si el servidor cambia un campo tras el montaje, el panel se queda pegado (estado pegado).
// La firma keyea la seccion: un cambio del servidor la remonta. Y como cada guardado REEMPLAZA su set en
// bloque, la firma es la base del candado: el cliente manda la que cargó, el servidor la recomputa bajo lock
// y rechaza si difiere (no pisa un cambio ajeno). Checkpoint 2.4/2.5: cada seccion editable (cadena/ajustes,
// nutraceuticos, restricciones, guias) tiene su PROPIA accion y su PROPIA firma; la maquinaria de "firma por
// secciones del protocolo" (protocolSectionSignatures/saveProtocol) se retiro, era de un solo proposito.

// Firma de una lista de texto (treatmentId + el set ORDENADO): base del candado + key de remonte. Ordenado
// para no depender del orden de filas (un SELECT sin ORDER BY no lo garantiza).
function stringListSignature(treatmentId: string, items: string[]): string {
  return `${treatmentId}§${[...items].sort().join("|")}`;
}

// Restricciones alimentarias (columna treatments.restricciones, text[]).
export function restriccionesSignature(p: { treatmentId: string; restricciones: string[] }): string {
  return stringListSignature(p.treatmentId, p.restricciones);
}

// Guias dietarias (tabla treatment_diet_guidelines).
export function guidelinesSignature(p: { treatmentId: string; guidelines: string[] }): string {
  return stringListSignature(p.treatmentId, p.guidelines);
}

// --- Firma de los AJUSTES a la cadena calorica (columnas adj_*, pieza 2) ---
// Misma familia y misma razon que la firma del protocolo, sobre un camino de guardado DISTINTO
// (saveAdjustments, que ESCRIBE LAS SEIS COLUMNAS DE GOLPE). Dos usos, identicos a los de arriba:
//  - `key={adjustmentSignature(p)}` en la seccion de la cadena: un cambio del servidor a cualquiera de los
//    seis ajustes remonta la seccion y re-deriva el estado del prop, para que no quede pegada (el bug del
//    estado pegado que hoy tiene latente PesoMetaSection: useState-once sin firma de remonte).
//  - candado de concurrencia en saveAdjustments: el cliente manda la firma que cargó; el servidor la
//    recomputa bajo lock y, si difiere, rechaza en vez de pisar. Sin esto, como el .set toca las seis
//    columnas, un guardado con estado viejo borraria el ajuste que otro profesional acaba de fijar.
// Firma UNICA (no por seccion): los seis ajustes son una sola unidad clinica (la cadena), no secciones
// independientes; basta con detectar que "algo de la cadena cambió".
export type SignableAdjustments = {
  treatmentId: string;
  adjGeb: number | null;
  adjPal: number | null;
  adjKcalObj: number | null;
  adjProtGkg: number | null;
  adjFatPct: number | null;
  adjPesoMeta: number | null;
};

// Los numeros se serializan via `${}` (String): cliente y servidor DEBEN normalizar antes con Number (el
// reader y el writer lo hacen), asi "1.5" y "1.500" colapsan al mismo "1.5" y la firma no diverge por scale.
export function adjustmentSignature(a: SignableAdjustments): string {
  return [
    a.treatmentId,
    a.adjGeb ?? "",
    a.adjPal ?? "",
    a.adjKcalObj ?? "",
    a.adjProtGkg ?? "",
    a.adjFatPct ?? "",
    a.adjPesoMeta ?? "",
  ].join("§");
}

// --- Firma de la PRESCRIPCION de nutraceuticos (checkpoint 2.3) ---
// Se partio del guardado del protocolo a su propia accion (saveNutraceuticals), que REEMPLAZA EL SET de
// treatment_nutraceuticals. Misma familia que la firma de ajustes: `key` de remonte de la seccion +
// base del candado de concurrencia. El conjunto se firma ORDENADO (un SELECT sin ORDER BY no garantiza
// orden); cliente (desde el prop) y servidor (bajo lock) deben coincidir sin importar el orden de filas.
export type SignableNutraceuticals = {
  treatmentId: string;
  nutraceuticals: { nutraceuticalId: string; dosage: string | null; durationDays: number | null }[];
};

export function nutraceuticalsSignature(p: SignableNutraceuticals): string {
  const set = p.nutraceuticals
    .map((n) => `${n.nutraceuticalId}:${n.dosage ?? ""}:${n.durationDays ?? ""}`)
    .sort()
    .join("|");
  return `${p.treatmentId}§${set}`;
}
