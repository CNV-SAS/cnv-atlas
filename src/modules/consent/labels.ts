import type { ConsentType } from "./validations";

// Rotulos CORTOS de las autorizaciones, para las superficies del profesional (la ficha del paciente).
// NO reemplazan los del documento: los de `consent-copy.ts` son los de cara al PACIENTE y van completos
// porque ahi es donde autoriza. Estos son para leer un estado de un vistazo, no para autorizar nada.
export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  servicio: "Finalidades del servicio",
  datos_sensibles: "Datos sensibles de salud",
  investigacion: "Investigación científica",
  comunicaciones_continuidad: "Continuidad asistencial",
  comunicaciones_comerciales: "Publicidad",
};

// Las dos vias que promete el documento que el paciente firma (CONSENT_ATLAS.md seccion 10). No son
// nuestras: si esta lista cambia, cambia porque cambio el texto firmado.
export const CANALES_REVOCACION = [
  { valor: "profesional", label: "Ante el profesional, en consulta" },
  { valor: "proteccion_datos", label: "Por el canal de protección de datos" },
] as const;
