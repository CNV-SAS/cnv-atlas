import "server-only";

// ═══ UN FALLO DE CONEXION SE REINTENTA UNA VEZ (segundo smoke, 2026-10-12) ═══
//
// EL INCIDENTE: en /mi-inventario salio "Failed to connect to database: timeout", una vez; Santiago recargo
// y paso. Es el pooler de Supabase en modo transaccion, no una consulta lenta: el cliente ya tiene
// `max: 6`, `idle_timeout: 20` y `connect_timeout: 10` desde el incidente del 2026-09-15.
//
// ── LA CONDICION QUE HACE SEGURO EL REINTENTO, y es toda la idea ──
//
// Un fallo al CONECTAR significa que la consulta NO LLEGO A CORRER. No hay nada que pueda ocurrir dos
// veces, asi que reintentar no es una apuesta: es pedir otra vez algo que nunca se pidio.
//
// POR QUE NO SE REINTENTA CUALQUIER FALLO DE RED, aunque se parezca: una conexion que se cae EN MEDIO de
// una transaccion deja un desenlace DESCONOCIDO (puede haber confirmado antes de que se cortara el cable),
// y reintentar ahi podria cobrar dos veces o emitir dos documentos. Es la misma leccion del timeout en un
// POST que crea algo externo. La clase 08 de Postgres cubre las dos situaciones, asi que no basta mirarla:
// este reintento se aplica solo donde quien llama sabe que es una LECTURA.
//
// POR QUE NO VA DENTRO DEL CLIENTE DE LA BASE: ahi no se puede distinguir una lectura de una escritura, y un
// reintento global convertiria el caso seguro y el peligroso en el mismo. La decision es de quien llama, y
// por eso la funcion se llama `leerConReintento`: el nombre dice la condicion.

/** Los codigos con los que postgres.js reporta un fallo ANTES de mandar la consulta. */
const CODIGOS_DE_CONEXION = new Set([
  "CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "ETIMEDOUT",
  // SQLSTATE clase 08: el servidor (o el pooler) rechazo el establecimiento de la conexion.
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
]);

/** Drizzle ENVUELVE el error de Postgres: el codigo vive en la causa, no en el error de arriba. */
function codigoDe(e: unknown): string | null {
  const vistos = new Set<unknown>();
  let actual: unknown = e;
  while (actual && typeof actual === "object" && !vistos.has(actual)) {
    vistos.add(actual);
    const code = (actual as { code?: unknown }).code;
    if (typeof code === "string") return code;
    actual = (actual as { cause?: unknown }).cause;
  }
  return null;
}

export function esFalloDeConexion(e: unknown): boolean {
  const code = codigoDe(e);
  return code != null && CODIGOS_DE_CONEXION.has(code);
}

/**
 * Corre una LECTURA y, si falla al conectar, la vuelve a intentar UNA vez.
 *
 * UNA SOLA VEZ, no tres: el fallo que se vio es momentaneo (el pooler ocupado un instante), y encadenar
 * reintentos contra una base caida solo alarga la espera del profesional antes de darle la mala noticia.
 * Con `connect_timeout: 10` ya son hasta diez segundos por intento.
 *
 * SOLO PARA LECTURAS. Si lo que se pasa escribe algo, este reintento no aplica: ver la cabecera.
 */
export async function leerConReintento<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!esFalloDeConexion(e)) throw e;
    return fn();
  }
}
