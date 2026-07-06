// Declaraciones de tipos para engine.dfi.js (CONGELADO, verbatim del prototipo de
// Gildardo). Describen SOLO la superficie publica que consume el adaptador; el `.js` no
// se edita ni se convierte a TS (excepcion nombrada a la regla 12, ARCHITECTURE.md).

export interface DFIDomain {
  id: string;
  nombre: string;
  icon?: string;
  sev: number;
  clasif: string;
  lectura: string;
  items: string[];
  veto?: boolean;
}

export interface DFIResult {
  domains: DFIDomain[];
  riesgo: { l: string; c: string; d: string; score: number };
  veto: boolean;
  rutas: string[];
}

export interface LE8Result {
  scores: Array<{ dom: string; v: number }>;
  total: number;
}

export function calcLE8(enc: Record<string, unknown>): LE8Result;
export function computeDFI(args: Record<string, unknown>): DFIResult | null;
export function computeDFIFromData(
  enc: Record<string, unknown>,
  bis: Record<string, unknown>,
): DFIResult | null;
