// Tipos para el harness Via C (JS sin tipos; el .mjs es verbatim, ver frozen-fenotipo-diff.test.ts).
// Solo para tsc.
export function classifyVerbatim(
  bis: Record<string, unknown>,
  enc: Record<string, unknown>,
  sexoM: boolean,
): {
  nivelFMI: string;
  nivelFFMI: string;
  MCA_ok: boolean;
  keyMCCB: string;
  fenotipo: { id: string; nombre: string; riesgo: string; color: string };
  sarcopenia: boolean;
  asmiLow: boolean;
  obesidadSarcopenica: boolean;
};
