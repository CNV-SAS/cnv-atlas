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

/**
 * Corre las cargas de a POCAS A LA VEZ, no todas de golpe.
 *
 * ═══ POR QUE EXISTE (2026-09-24) ═══
 *
 * El pool de la base tiene SEIS conexiones (`src/db/index.ts`). Una pantalla que dispara siete consultas en
 * paralelo deja a una esperando turno, y el limite de `conLimite` corre MIENTRAS ESPERA: la consulta que no
 * alcanzo cupo se reporta como "no respondio en 8000 ms" sin haber llegado a correr. Medida sola tardaba
 * 0,2 ms. Es lo que paso dos veces en /pagos, primero con `dias-con-ventas-sin-cerrar` y despues con
 * `devueltas`, y la segunda vez arrastro ademas a `pendientes-de-accion`, que fallo por conexion.
 *
 * Por eso el limite no se sube: subirlo esconderia la espera en vez de quitarla. Lo que se arregla es que
 * ninguna carga tenga que esperar cupo, y el temporizador de cada una empieza CUANDO DE VERDAD ARRANCA,
 * porque recibe una funcion y no una promesa ya lanzada.
 *
 * Tres a la vez deja margen: quedan conexiones libres para lo que la misma peticion necesite (la sesion, los
 * permisos) y para las otras peticiones que esten entrando al mismo tiempo.
 */
export async function enTandas<T extends readonly (() => Promise<unknown>)[]>(
  cargas: [...T],
  simultaneas = 3,
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  // Tipado como TUPLA y no como arreglo: cada carga devuelve lo suyo, y la pantalla lee `paneles[3]` con su
  // tipo. Con `T[]` TypeScript intenta unificar los siete en uno solo y se queja de algo que no es un error.
  const resultados: unknown[] = new Array(cargas.length);
  let siguiente = 0;
  async function trabajador() {
    for (;;) {
      const i = siguiente++;
      if (i >= cargas.length) return;
      resultados[i] = await cargas[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(simultaneas, cargas.length) }, trabajador));
  return resultados as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
