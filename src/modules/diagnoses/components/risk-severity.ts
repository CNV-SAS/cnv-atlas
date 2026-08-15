// Mapas de color de la capa clinica (BRAND, theme-aware) para el riesgo integrado y las severidades del
// Diagnostico. Modulo NEUTRO (constantes puras, sin server-only ni cliente): lo comparten la franja de
// veredicto (verdict-strip) y los resultados (evaluation-results), para que no diverjan. La ETIQUETA
// (SEV_LABEL) vive en severity-labels; aqui solo el color.

// Clase de color por severidad 0-3, SEMAFORO como el HTML de Gildardo (_DFI_SEVC): 0 Bajo verde, 1 Leve
// ambar, 2 Moderado naranja, 3 Alto rojo. Sin azul: en un BADGE que dice si algo esta bien o mal, el
// verde-ambar-naranja-rojo se lee sin pensar; el azul obliga a recordar que significa (decision Santiago
// 2026-08-15, revierte la alineacion previa al azul). El azul queda EXCLUSIVO del radar (ahi es escala, no
// clasificacion). Fuente unica: badges de dominio, detalle del estado, riesgo integrado y franja de veredicto.
export const SEV_CLS = [
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-warning-bg text-clinical-warning",
  "bg-clinical-moderate-bg text-clinical-moderate",
  "bg-clinical-critical-bg text-clinical-critical",
];

// Nivel de riesgo integrado del DFI -> indice de la capa clinica (color + etiqueta). Coincide con los NIV
// del HTML: BAJO verde, MEDIO ambar, ALTO naranja, CRITICO rojo.
export const RISK_SEV: Record<string, number> = { BAJO: 0, MEDIO: 1, ALTO: 2, "CRÍTICO": 3 };

// Punto de color por severidad (0-3), mismo semaforo. Color SOLO en el veredicto de riesgo, nunca
// decorativo; la etiqueta sigue siendo el señalizador principal (no depende del color).
export const DOT_CLS = [
  "bg-clinical-optimal",
  "bg-clinical-warning",
  "bg-clinical-moderate",
  "bg-clinical-critical",
];

// Escala de 3 niveles (optimo / alerta / critico) de los CLASIFICADORES POR INDICADOR (colorSev: verde 0,
// ambar 2, rojo 3) y de la antropometria (composicion). El azul (excellent) es EXCLUSIVO del mejor nivel
// del DFI (Bajo), que es una escala de 4; aqui no hay "Bajo", el mejor es OPTIMO = VERDE. Sin esto, cada
// indicador "optimo/verde" quedaria azul (azul repartido): el azul se reserva a lo mas optimo, no a todo
// lo bueno. Indices 0 y 1 comparten el verde (colorSev nunca da 1; la composicion "buena" cae en verde).
export const OPTIMO_CLS = [
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-warning-bg text-clinical-warning",
  "bg-clinical-critical-bg text-clinical-critical",
];
export const OPTIMO_DOT = [
  "bg-clinical-optimal",
  "bg-clinical-optimal",
  "bg-clinical-warning",
  "bg-clinical-critical",
];
