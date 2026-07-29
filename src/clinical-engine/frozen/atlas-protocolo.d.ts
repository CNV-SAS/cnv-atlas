// Tipos para frozen/atlas-protocolo.js (JS congelado verbatim; DIFF A lo protege). Solo para tsc.
export function motorProtocolo(
  bis: Record<string, unknown>,
  enc: Record<string, unknown>,
  motor: Record<string, unknown>,
): {
  pesoCalculo: number;
  pesoCalculoLabel: string;
  PI: number;
  estrategia: { tipo: string; deficit: number; label: string; color: string; ref: string };
  protMin: number;
  protMax: number;
  protRef: string;
  restricciones: { nombre: string; valor: string; ref: string }[];
  examenes: { nombre: string; razon: string; protocolo: string; prioridad: string }[];
  suplementacion: { nombre: string; dosis: string; razon: string; vitacellebis: string }[];
  resumenClinico: string;
  alertaSindRealim: boolean;
  tieneIRC: boolean;
  tieneCancer: boolean;
  tieneDM: boolean;
  tieneHTA: boolean;
  tieneObesidadSarcopenica: boolean;
};
