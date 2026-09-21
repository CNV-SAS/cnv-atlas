// LOS OCHO DOMINIOS DE LA ENCUESTA, con el titulo de su read-out (ATLAS de Gildardo, separador "·").
//
// VIVIAN EN LA PANTALLA de Diagnostico › Encuesta (`survey-diagnosis-section`). Se mudan aqui el 2026-09-21
// porque ahora hay TRES lectores: esa pantalla, el resumen de IA y el SOAP, que agrupan por dominio las
// respuestas en rojo. Tres copias del mismo titulo son tres sitios donde uno puede quedarse viejo.
//
// PURO (regla dura 12): lo importan el motor (alertas de la consulta) y la app.

export const DOMINIOS_ENCUESTA = [
  "D1 · Patrón Usual de Consumo Alimentario",
  "D2 · Imagen Corporal y Conducta Alimentaria",
  "D3 · Hábitos de Vida",
  "D4 · Patrón Horario Alimentario",
  "D5 · Determinantes y Epigenética",
  "D6 · Salud Digestiva",
  "D7 · Hidratación",
  "D8 · Contexto Social y Alimentario",
] as const;

/** El titulo del dominio de un `field_key` ("d6_45" -> "D6 · Salud Digestiva"), o el codigo si no calza. */
export function dominioDeCampo(fieldKey: string): string {
  const m = /^d([1-8])_/.exec(fieldKey);
  return m ? DOMINIOS_ENCUESTA[Number(m[1]) - 1] : fieldKey.slice(0, 2).toUpperCase();
}
