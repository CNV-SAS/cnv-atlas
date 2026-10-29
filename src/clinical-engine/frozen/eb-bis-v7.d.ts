// Declaraciones de tipos para eb-bis-v7.js (CONGELADO, verbatim de Gildardo: su entrega
// EB_BIS_v7_param_7.1.0, 2026-10-26, §4.4 "puede integrarse tal cual al motor"). Describen SOLO la
// superficie que consume el adaptador; el `.js` no se edita ni se convierte a TS (excepcion nombrada a la
// regla 12, ARCHITECTURE.md), igual que `engine.indices.js`.
//
// EL ARCHIVO ES BYTE-IDENTICO al que el entrego, y un candado lo comprueba: `eb-bis-v7.golden.test.ts`
// lo coteja contra la copia de `docs/entregas`. Si alguien lo "arregla", falla y dice cual linea.

/** Las entradas de su §4.1. `ICEC` es opcional y solo alimenta la alerta de discordancia. */
export interface EntradaEbBisV7 {
  sexo: "F" | "M";
  /** Años CUMPLIDOS (entero). Su §4.1: 18 a 100. */
  edad: number;
  /** Ω, del modelo Cole-Cole del equipo. */
  Re: number;
  Ri: number;
  /** nF, del modelo Cole-Cole del equipo. */
  C: number;
  /** kg, de la evaluacion. */
  peso: number;
  /** kg, masa libre de grasa (la `FFM` del equipo). */
  MLG: number;
  /** L, agua corporal total (la `TBW` del equipo). */
  ACT: number;
  /** kg/m². */
  FMI: number;
  /** 0 a 100, de la encuesta. null = no entra, y la alerta no se activa. */
  ICEC?: number | null;
}

/**
 * Lo que devuelve cuando SI calcula. `estado: "ok"`.
 *
 * `version` es la de la FORMULA ("EB-BIS v7") y `versionParametros` la del juego de parametros
 * ("7.1.0"): su §6 pide guardar las dos con cada resultado, porque los parametros pueden cambiar sin que
 * cambie la formula (ya paso: 7.0.0 a 7.1.0 en dos dias).
 */
export interface SalidaEbBisV7Ok {
  estado: "ok";
  version: string;
  versionParametros: string;
  /** Años, un decimal. */
  EB_BIS: number;
  /** Años con signo, un decimal. */
  IAE: number;
  /** Dos decimales. Dato de soporte: su §5 lo deja SOLO para el profesional. */
  zPares: number;
  /** El IAE se limito a ±15. Su §5: solo para el profesional. */
  topado: boolean;
  /** z de pares >= 1 con ICEC >= 80. Su §5: solo para el profesional. */
  alertaDiscordancia: boolean;
  intermedios: {
    IRC: number;
    ReRi: number;
    PSSG: number;
    PSSGp: number;
    z: { IRC: number; ReRi: number; PSSGp: number };
    S: number;
    Sesp: number;
  };
}

/**
 * Lo que devuelve cuando NO calcula, con su motivo literal.
 *
 * SON TRES ESTADOS Y NO UNO, y la diferencia importa: "pendiente" es un dato que falta (se resuelve
 * capturandolo), "revisar" es una medicion que no cuadra (se resuelve mirandola) y "error" es el sexo
 * invalido. Colapsarlos en null perderia justo lo que el profesional necesita para actuar.
 */
export interface SalidaEbBisV7NoCalcula {
  estado: "pendiente" | "revisar" | "error";
  motivo: string;
}

export type SalidaEbBisV7 = SalidaEbBisV7Ok | SalidaEbBisV7NoCalcula;

export function ebBisV7(entrada: EntradaEbBisV7): SalidaEbBisV7;

/** El juego de parametros 7.1.0, tal como lo entrego. Su §4.3: viven en configuracion versionada. */
export const EB_BIS_V7: {
  version: string;
  escalaAniosPorDE: number;
  topeAnios: number;
  F: ParametrosDeSexo;
  M: ParametrosDeSexo;
};

interface ParametrosDeSexo {
  mu: { IRC: number; ReRi: number; PSSGp: number };
  de: { IRC: number; ReRi: number; PSSGp: number };
  w: { IRC: number; ReRi: number; PSSGp: number };
  esperado: { b0: number; edad: number; edad2: number; FMI: number };
  deResidual: number;
}
