import "server-only";

import { reportServerError } from "./report-error";

// ═══ UNA PANTALLA NO SE CUELGA POR UNA CONSULTA (2026-09-16) ═══
//
// EL CASO: /pagos dejo de cargar para administracion y Vercel la corto con "504 FUNCTION_INVOCATION_TIMEOUT".
// Eso no deja ni error ni rastro: la funcion no fallo, se quedo esperando. Y la pantalla arma OCHO consultas, asi
// que ni siquiera se sabia cual. Un cuelgue sin nombre se diagnostica a ciegas.
//
// LO QUE HACE: le pone un limite propio a cada carga y le da un NOMBRE. Si una tarda mas de la cuenta, o falla, se
// reporta con ese nombre (Sentry, con el area) y la pantalla sigue con lo demas, marcando el pedazo que falto.
// Vale la pena en las pantallas de TRABAJO INTERNO, donde ver nueve paneles de diez es mucho mejor que no ver
// ninguno. NO vale para lo clinico ni para lo que decide un cobro: ahi un dato a medias enganaria, y es preferible
// que falle a la vista.
//
// El limite por defecto es 8 segundos: una consulta de estas tarda milisegundos, asi que pasar de ahi ya es senal
// de que la conexion no esta, no de que el dato sea pesado.
const LIMITE_MS = 8_000;

export async function conLimite<T>(
  nombre: string,
  cargar: () => Promise<T>,
  siNoLlega: T,
  limiteMs: number = LIMITE_MS,
): Promise<{ dato: T; fallo: boolean }> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    const dato = await Promise.race([
      cargar(),
      new Promise<never>((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(new Error(`${nombre} no respondio en ${limiteMs} ms`)), limiteMs);
      }),
    ]);
    return { dato, fallo: false };
  } catch (e) {
    reportServerError(`carga.${nombre}`, e);
    return { dato: siNoLlega, fallo: true };
  } finally {
    // Sin esto, el temporizador mantiene viva la funcion hasta que vence, aunque la consulta ya haya respondido.
    if (temporizador) clearTimeout(temporizador);
  }
}
