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
  nutraceuticals: { nutraceuticalId: string; dosage: string | null; durationDays: number | null }[];
  guidelines: { text: string }[];
};

export type SectionKey = "objetivos" | "restricciones" | "nutraceuticals" | "guidelines";

export type SectionSignatures = Record<SectionKey, string>;

// Etiqueta en lenguaje de producto de cada seccion, para el mensaje de rechazo (el profesional decide con
// criterio: sabe QUE cambió, no solo que "algo cambió").
const SECTION_LABEL: Record<SectionKey, string> = {
  objetivos: "los objetivos (calorías/proteína)",
  restricciones: "las restricciones",
  nutraceuticals: "la prescripción de nutracéuticos",
  guidelines: "las guías dietarias",
};

export function protocolSectionSignatures(p: SignableProtocol): SectionSignatures {
  return {
    objetivos: `${p.kcalObjetivo ?? ""}:${p.proteinaGramos ?? ""}`,
    restricciones: [...p.restricciones].sort().join("|"),
    nutraceuticals: p.nutraceuticals
      .map((n) => `${n.nutraceuticalId}:${n.dosage ?? ""}:${n.durationDays ?? ""}`)
      .sort()
      .join("|"),
    guidelines: [...p.guidelines.map((g) => g.text)].sort().join("|"),
  };
}

// Firma combinada para el `key` del form. Incluye treatmentId (un tratamiento distinto, p. ej. tras una
// correccion, siempre remonta).
export function protocolSignature(p: SignableProtocol): string {
  const s = protocolSectionSignatures(p);
  return [p.treatmentId, s.objetivos, s.restricciones, s.nutraceuticals, s.guidelines].join("§");
}

// Secciones que difieren entre una base (lo que el cliente cargó) y la actual (lo que hay en BD ahora).
export function changedSections(base: SectionSignatures, current: SectionSignatures): SectionKey[] {
  return (Object.keys(current) as SectionKey[]).filter((k) => base[k] !== current[k]);
}

// Frase legible con las secciones que cambiaron ("los objetivos (calorías/proteína), las restricciones").
export function describeChangedSections(keys: SectionKey[]): string {
  return keys.map((k) => SECTION_LABEL[k]).join(", ");
}
