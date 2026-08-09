// Tipos del frozen derivar-composicion.js (ciencia congelada; ver ese archivo). derivarFaltantes MUTA el
// objeto de composicion en sitio (rellena solo los campos ausentes) y devuelve el origen de cada derivado.

export type ComposicionDerivable = Record<string, number | null | undefined>;
export type OrigenDerivado = Record<string, { origen: string; formula: string; version: string }>;

export function derivarFaltantes(d: ComposicionDerivable): OrigenDerivado;
export function controlCalidadImport(d: ComposicionDerivable): string[];
export const ESPECTRO_FORMULAS_V: string;
