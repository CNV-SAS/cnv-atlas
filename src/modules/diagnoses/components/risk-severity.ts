// Mapas de color de la capa clinica (BRAND, theme-aware) para el riesgo integrado y las severidades del
// Diagnostico. Modulo NEUTRO (constantes puras, sin server-only ni cliente): lo comparten la franja de
// veredicto (verdict-strip) y los resultados (evaluation-results), para que no diverjan. La ETIQUETA
// (SEV_LABEL) vive en severity-labels; aqui solo el color.

// Clase de color por severidad 0-3, ALINEADA con la escala de 4 colores del radar (ancla azul): 0 Bajo
// azul (excellent, "estas bien"), 1 Leve verde (optimal), 2 Moderado ambar (warning), 3 Alto rojo
// (critical). Antes 0-1 compartian el verde; se separo para que el MISMO "Bajo" no sea azul en el radar y
// verde en el badge de al lado (el profesional los ve juntos). Fuente unica: la comparten los badges de
// dominio, el detalle del estado, el riesgo integrado y la franja de veredicto.
export const SEV_CLS = [
  "bg-clinical-excellent-bg text-clinical-excellent",
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-warning-bg text-clinical-warning",
  "bg-clinical-critical-bg text-clinical-critical",
];

// Nivel de riesgo integrado del DFI -> indice de la capa clinica (color + etiqueta).
export const RISK_SEV: Record<string, number> = { BAJO: 0, MEDIO: 1, ALTO: 2, "CRÍTICO": 3 };

// Punto de color por severidad (0-3), misma escala de 4. Color SOLO en el veredicto de riesgo, nunca
// decorativo; la etiqueta sigue siendo el señalizador principal (no depende del color).
export const DOT_CLS = [
  "bg-clinical-excellent",
  "bg-clinical-optimal",
  "bg-clinical-warning",
  "bg-clinical-critical",
];
