// Mapas de color de la capa clinica (BRAND, theme-aware) para el riesgo integrado y las severidades del
// Diagnostico. Modulo NEUTRO (constantes puras, sin server-only ni cliente): lo comparten la franja de
// veredicto (verdict-strip) y los resultados (evaluation-results), para que no diverjan. La ETIQUETA
// (SEV_LABEL) vive en severity-labels; aqui solo el color.

// Clase de color por severidad 0-3. Hoy sev 0-1 comparten el verde (agrupamiento del modelo de riesgo:
// 2 alerta, 3 critico). (El RADAR usa su propia escala de 4 colores con ancla azul; ver dfi-radar.)
export const SEV_CLS = [
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-warning-bg text-clinical-warning",
  "bg-clinical-critical-bg text-clinical-critical",
];

// Nivel de riesgo integrado del DFI -> indice de la capa clinica (color + etiqueta).
export const RISK_SEV: Record<string, number> = { BAJO: 0, MEDIO: 1, ALTO: 2, "CRÍTICO": 3 };

// Punto de color por severidad (0-3). Color SOLO en el veredicto de riesgo, nunca decorativo; la
// etiqueta sigue siendo el señalizador principal (no depende del color).
export const DOT_CLS = [
  "bg-clinical-optimal",
  "bg-clinical-optimal",
  "bg-clinical-warning",
  "bg-clinical-critical",
];
