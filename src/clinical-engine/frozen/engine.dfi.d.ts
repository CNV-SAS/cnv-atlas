// Declaraciones de tipos para engine.dfi.js (CONGELADO, verbatim del prototipo de
// Gildardo). Describen SOLO la superficie publica que consume el adaptador; el `.js` no
// se edita ni se convierte a TS (excepcion nombrada a la regla 12, ARCHITECTURE.md).

export interface DFIDomain {
  id: string;
  nombre: string;
  icon?: string;
  /** 0..3, o null si el dominio NO SE MIDIO (CA-6, Gildardo 2026-08-30 §4): sin dato no puntua. */
  sev: number | null;
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
  /** ids de los dominios sin dato. El riesgo integrado se renormalizo sobre los demas. */
  sinDato: string[];
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
