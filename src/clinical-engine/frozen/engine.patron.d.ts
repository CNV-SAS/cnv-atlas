// Declaraciones de tipos para engine.patron.js (CONGELADO, verbatim del prototipo vigente
// de Gildardo). Describen SOLO la superficie publica que consume el reader/render; el `.js`
// no se edita ni se convierte a TS (excepcion nombrada a la regla 12, ARCHITECTURE.md).

// Nivel de calidad del patron (etiqueta + color + icono), tal cual lo emite el prototipo.
export type PatronNivel = { l: string; col: string; ico: string };

// enc: indices numericos de frecuencia por campo (d1_1_i..d1_15_i, d1f_*_i). Un campo ausente
// se lee como -1 (no respondido). No entran nombres ni PII: solo ordinales 0-4.
export type PatronEnc = Record<string, number | null | undefined>;

export type PatronResult = {
  score: number; // 0-100
  nivel: PatronNivel;
  protAltos: number;
  protModerado: number;
  riesgoAltos: number;
  riesgoNunca: number;
  prot: number[]; // 7 grupos protectores (n 1-7)
  neutro: number[]; // 4 grupos energeticos (n 8,9,10,15)
  riesgo: number[]; // 4 grupos de riesgo (n 11-14)
  respondidos: number;
  activos: number;
  salExtra: number;
  desayuna: number;
  cenaHora: number;
};

export function calcPatron(enc: PatronEnc): PatronResult;
