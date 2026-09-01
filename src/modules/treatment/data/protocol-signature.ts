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

import type { IntercambioSaved, MenuSemanalSaved, TiemposSaved, TreatmentProtocol } from "./treatment-view-types";

// LA KEY DE REACT NO ES LA FIRMA: es "que seccion es" + la firma (defecto real, 2026-08-23).
// La firma es "treatmentId + contenido", asi que DOS SECCIONES SIN DATO GUARDADO producen la MISMA
// (`T§` para objetivo/guias/restricciones/nutraceuticos vacios; `T§none` para intercambio/tiempos sin
// guardar), y eso pasa SIEMPRE en un paciente nuevo. Con dos hermanos con la misma key React avisa y
// puede duplicar u omitir: en una actualizacion la reconciliacion puede casar el hermano equivocado y
// remontar el que no era, perdiendo lo que el profesional esta escribiendo. Justo lo que la firma
// venia a evitar. El prefijo se aplica SOLO en el `key`; la firma que viaja al servidor como
// baseSignature (el candado de concurrencia) queda intacta, o cliente y servidor dejarian de coincidir.
// Candado: section-keys-unique.test.ts.
export function sectionKey(section: string, signature: string): string {
  return `${section}:${signature}`;
}

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

// Objetivo del tratamiento nutricional (columna treatments.objetivo_texto, texto libre). Un solo string.
export function objetivoSignature(p: { treatmentId: string; objetivo: string | null }): string {
  return `${p.treatmentId}§${p.objetivo ?? ""}`;
}

// Lista de intercambio (columna treatments.intercambio_porciones, jsonb). POR ALIMENTO. ORDEN-INDEPENDIENTE:
// serializa las porciones por CLAVE (alimento) ORDENADA (Object.keys().sort()), no por el orden del objeto (que
// jsonb no garantiza al volver de la BD). Incluye objetivoBase: un cambio del objetivo con el que se guardo
// tambien mueve la firma.
export function intercambioSignature(p: { treatmentId: string; intercambio: IntercambioSaved | null }): string {
  // Defensivo: el writer relee el jsonb CRUDO de la BD, que puede traer una forma VIEJA/ajena (por-grupo:
  // {grupos}, sin `porciones`). Sin este guard, Object.keys(undefined) tumbaba el guardado con 500 (2026-08-22).
  // Una forma que no es la actual == "none", IGUAL que el reader la normaliza a null: asi el baseSignature del
  // cliente (§none) coincide y el guardado sobrescribe la fila vieja en vez de reventar.
  const inter = p.intercambio;
  if (!inter || !inter.porciones || typeof inter.porciones !== "object") return `${p.treatmentId}§none`;
  const { porciones, objetivoBase } = inter;
  const entries = Object.keys(porciones)
    .sort()
    .map((sub) => `${sub}:${porciones[sub]}`)
    .join("|");
  return `${p.treatmentId}§${objetivoBase}§${entries}`;
}

// Distribucion por tiempos (columna treatments.tiempos, jsonb). ORDEN-INDEPENDIENTE en las tres partes
// (activos, celdas, base): serializa por clave ordenada. Un cambio en cualquiera (toggle, override, o el
// contexto base) mueve la firma.
function sortBoolMap(m: Record<string, boolean>): string {
  return Object.keys(m)
    .sort()
    .map((k) => `${k}:${m[k] ? 1 : 0}`)
    .join(",");
}
// Tiempos ACTIVOS (columna propia desde 2026-08-23): su propia firma, porque su guardado es propio. Que
// sea independiente de la de la distribucion es justo el punto: guardar las casillas no debe rechazarse
// porque otro toco la tabla, ni al reves.
export function tiemposActivosSignature(p: { treatmentId: string; activos: Record<string, boolean> | null }): string {
  const a = p.activos;
  if (!a || typeof a !== "object" || Array.isArray(a)) return `${p.treatmentId}§none`;
  return `${p.treatmentId}§${sortBoolMap(a)}`;
}

export function tiemposSignature(p: { treatmentId: string; tiempos: TiemposSaved | null }): string {
  // Misma defensa que intercambioSignature: el writer relee el jsonb crudo, que puede venir malformado/ajeno.
  // Sin las partes esperadas se trata como "none" (el reader lo normaliza a null igual), sin reventar. Una
  // fila ANTERIOR al corte de 2026-08-23 traia ademas `activos`; la data-migration la saco, y si quedara
  // alguna, la clave sobrante NO cambia la firma porque solo se serializa lo que se lista abajo.
  const t = p.tiempos;
  if (!t || !t.celdas || typeof t.celdas !== "object" || !t.base || typeof t.base !== "object" || !t.base.porciones || typeof t.base.porciones !== "object" || !t.base.activos || typeof t.base.activos !== "object") {
    return `${p.treatmentId}§none`;
  }
  const { celdas, base } = t;
  const serCeldas = Object.keys(celdas)
    .sort()
    .map(
      (g) =>
        `${g}={${Object.keys(celdas[g])
          .sort()
          .map((m) => `${m}:${celdas[g][m]}`)
          .join(",")}}`,
    )
    .join("|");
  const serPorc = Object.keys(base.porciones)
    .sort()
    .map((k) => `${k}:${base.porciones[k]}`)
    .join(",");
  return `${p.treatmentId}§${serCeldas}§${serPorc}§${sortBoolMap(base.activos)}`;
}

// Menu semanal (columna treatments.menu_semanal, jsonb). ORDEN-INDEPENDIENTE: serializa las celdas por
// clave ordenada. Incluye diaInicio: cambiar la semana base tambien mueve la firma, porque cambia el plan.
export function menuSemanalSignature(p: { treatmentId: string; menu: MenuSemanalSaved | null }): string {
  // Misma defensa que las otras dos formas jsonb: el writer relee el crudo, que puede venir de una forma
  // vieja o ajena. Lo que no es la forma actual == "none", igual que el reader lo normaliza a null.
  const m = p.menu;
  if (!m || typeof m.diaInicio !== "number" || !m.celdas || typeof m.celdas !== "object") {
    return `${p.treatmentId}§none`;
  }
  const ser = Object.keys(m.celdas)
    .sort()
    .map((k) => `${k}=${m.celdas[k]}`)
    .join("|");
  return `${p.treatmentId}§${m.diaInicio}§${ser}`;
}

// --- Firma de los AJUSTES a la cadena calorica (columnas adj_*, pieza 2) ---
// Misma familia y misma razon que la firma del protocolo, sobre un camino de guardado DISTINTO
// (saveAdjustments, que ESCRIBE LAS SEIS COLUMNAS DE GOLPE). Dos usos, identicos a los de arriba:
//  - `key={adjustmentSignature(p)}` en la seccion de la cadena: un cambio del servidor a cualquiera de los
//    seis ajustes remonta la seccion y re-deriva el estado del prop, para que no quede pegada (el bug del
//    estado pegado). El comentario anterior citaba una "PesoMetaSection" con el hazard latente: ese
//    componente ya no existe, el peso meta se edita DENTRO de la seccion de la cadena y por lo tanto
//    queda cubierto por esta misma firma. Se corrige el texto, no el codigo (afirmaba un estado falso).
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
  // El peso meta ya NO vive en `treatments` sino en `evaluation_bis_intake` (migracion 0095), pero SIGUE
  // en la firma, y es deliberado: el formulario lo escribe, asi que el candado tiene que cubrirlo o dos
  // profesionales podrian pisarse el peso meta sin que nadie lo note. El writer lo lee bajo el mismo lock.
  // El nombre cambia; la POSICION en la firma no, para que las firmas ya emitidas sigan coincidiendo.
  pesoMetaFijado: number | null;
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
    a.pesoMetaFijado ?? "",
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

// Firma de la prescripcion GUARDADA de un protocolo: base del candado + `key` de remonte. VIVE AQUI (modulo
// NEUTRO), no en el componente client, porque la LLAMAN LOS DOS LADOS: page.tsx (servidor) como `key` de la
// seccion, y NutraceuticalsSection (cliente) como baseSignature. Una funcion en un modulo "use client"
// llamada desde el servidor tumba la pagina (RSC boundary): el fix del 500 del 2026-08-21.
export function prescriptionSignature(protocol: TreatmentProtocol): string {
  return nutraceuticalsSignature({
    treatmentId: protocol.treatmentId,
    nutraceuticals: protocol.nutraceuticals.map((n) => ({
      nutraceuticalId: n.nutraceuticalId,
      dosage: n.dosage,
      durationDays: n.durationDays,
    })),
  });
}
