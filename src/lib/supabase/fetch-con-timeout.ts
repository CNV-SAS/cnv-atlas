// ═══ EL FETCH DE SUPABASE, CON TIMEOUT (regla dura 10) ═══
//
// Modulo NEUTRO (ni `server-only` ni `"use client"`): lo usan el cliente de servidor, el de navegador, el de
// service role y el proxy de sesion (Edge).
//
// POR QUE EXISTE (2026-09-14): los cuatro clientes de Supabase se creaban sin `global.fetch`, asi que cada
// consulta, cada llamada de autenticacion y cada subida de archivo esperaba lo que quisiera el servidor. Lo
// descubrio el link de pago del paciente: la API de Supabase respondio 502 de forma intermitente, y si en vez
// de fallar hubiera tardado, la pantalla del paciente habria quedado colgada sin limite. La regla dura 10 dice
// que ninguna llamada externa va sin timeout, y estas lo eran.
//
// DOS PLAZOS Y NO UNO: una consulta o una llamada de sesion no tiene por que tardar mas de unos segundos, y
// una subida de un PDF (reporte, RUT) si puede. Un solo plazo corto cortaria las subidas; uno solo largo
// dejaria esperando al paciente.

/** Consultas (PostgREST), autenticacion y todo lo que no sea Storage. El mismo plazo que `fetchJson`. */
export const SUPABASE_TIMEOUT_MS = 10_000;
/** Subidas y descargas de archivos. */
export const SUPABASE_STORAGE_TIMEOUT_MS = 60_000;

/**
 * Arma un `fetch` que aborta al vencer su plazo. Los plazos se inyectan para poder probarlo con plazos cortos:
 * `AbortSignal.timeout` usa temporizadores internos que los relojes simulados de los tests no controlan.
 *
 * Si la llamada ya trae su propia senal (supabase-js la pasa cuando se usa `.abortSignal()`), se respetan las
 * dos: aborta la que llegue primero.
 */
export function crearFetchConTimeout(plazos: { consultasMs: number; storageMs: number }) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const plazo = AbortSignal.timeout(url.includes("/storage/v1/") ? plazos.storageMs : plazos.consultasMs);
    const propia = init?.signal ?? null;
    let signal: AbortSignal = plazo;
    if (propia) {
      // `AbortSignal.any` existe en Node 20+, Edge y los navegadores actuales. Donde no, se conserva la senal del
      // llamador: perder el plazo es preferible a ignorar una cancelacion pedida.
      signal = typeof AbortSignal.any === "function" ? AbortSignal.any([propia, plazo]) : propia;
    }
    return fetch(input, { ...init, signal });
  };
}

/** El que usan los cuatro clientes. */
export const fetchConTimeout = crearFetchConTimeout({
  consultasMs: SUPABASE_TIMEOUT_MS,
  storageMs: SUPABASE_STORAGE_TIMEOUT_MS,
});
