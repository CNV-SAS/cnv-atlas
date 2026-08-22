// Firma de los campos que EDITA el ProtocolForm. Pura y AUTOCONTENIDA (sin imports server-only): la usan
// el panel client (para el `key`) y el writer server (para el candado de concurrencia). Un solo lugar =
// cliente y servidor computan lo mismo, sin deriva.
//
// El defecto que arranco esto NO es solo de la lista de nutraceuticos: TODO el estado editable del panel
// (kcal, proteina, restricciones, prescripcion, guias) es useState inicializado UNA sola vez desde el prop,
// asi que si el servidor cambia un campo tras el montaje, el panel se queda pegado sin forma de notarlo (los
// nutraceuticos se delataron porque la seccion de entrega muestra el dato real; kcal/proteina no).
//
// Dos usos:
//  - `key={protocolSignature(p)}` en ProtocolForm: un cambio real del servidor mueve la firma y remonta el
//    form (re-deriva del prop); una revalidacion que no tocó estos campos (entrega/menu/nota) la deja igual
//    y no remonta, preservando una edicion en curso.
//  - candado de concurrencia en saveProtocol: el cliente manda la firma POR SECCION de lo que cargó; el
//    servidor recomputa la actual bajo lock y, si difiere, rechaza la escritura (no pisa el cambio ajeno) y
//    dice QUE seccion cambió. Sin esto, saveProtocol REEMPLAZA en bloque: un guardado con estado viejo
//    borraria la prescripcion entera sin dejar rastro.

// Entrada minima estructural: TreatmentProtocol la satisface (superset), y el writer arma este subset desde
// las filas de BD. Los conjuntos se firman ORDENADOS: cliente y servidor deben coincidir sin importar el
// orden en que la BD devuelva las filas (un SELECT sin ORDER BY no garantiza orden).
export type SignableProtocol = {
  treatmentId: string;
  kcalObjetivo: number | null;
  proteinaGramos: number | null;
  restricciones: string[];
  guidelines: { text: string }[];
};

// La prescripcion de nutraceuticos se PARTIO a su propia accion/candado (checkpoint 2.3, misma razon que
// los ajustes: dos formularios sobre una accion que reemplaza en bloque se pisan). Ya no es seccion del
// protocolo; su firma vive abajo (nutraceuticalsSignature).
export type SectionKey = "objetivos" | "restricciones" | "guidelines";

export type SectionSignatures = Record<SectionKey, string>;

// Etiqueta en lenguaje de producto de cada seccion, para el mensaje de rechazo (el profesional decide con
// criterio: sabe QUE cambió, no solo que "algo cambió").
const SECTION_LABEL: Record<SectionKey, string> = {
  objetivos: "los objetivos (calorías/proteína)",
  restricciones: "las restricciones",
  guidelines: "las guías dietarias",
};

export function protocolSectionSignatures(p: SignableProtocol): SectionSignatures {
  return {
    objetivos: `${p.kcalObjetivo ?? ""}:${p.proteinaGramos ?? ""}`,
    restricciones: [...p.restricciones].sort().join("|"),
    guidelines: [...p.guidelines.map((g) => g.text)].sort().join("|"),
  };
}

// Firma combinada para el `key` del form. Incluye treatmentId (un tratamiento distinto, p. ej. tras una
// correccion, siempre remonta).
export function protocolSignature(p: SignableProtocol): string {
  const s = protocolSectionSignatures(p);
  return [p.treatmentId, s.objetivos, s.restricciones, s.guidelines].join("§");
}

// Secciones que difieren entre una base (lo que el cliente cargó) y la actual (lo que hay en BD ahora).
export function changedSections(base: SectionSignatures, current: SectionSignatures): SectionKey[] {
  return (Object.keys(current) as SectionKey[]).filter((k) => base[k] !== current[k]);
}

// Frase legible con las secciones que cambiaron ("los objetivos (calorías/proteína), las restricciones").
export function describeChangedSections(keys: SectionKey[]): string {
  return keys.map((k) => SECTION_LABEL[k]).join(", ");
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
