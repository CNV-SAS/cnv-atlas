import "server-only";

// fetch con timeout explicito (regla dura 10: ninguna llamada externa sin
// timeout). Devuelve el JSON parseado o lanza HttpError con contexto. Pensado para
// los proveedores externos (Wompi, Alegra) desde el servidor.

export type FetchJsonOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

// Error de transporte/HTTP: el proveedor respondio != 2xx o no se pudo contactar.
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { method = "GET", headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const hasBody = body !== undefined;
  const res = await fetch(url, {
    method,
    headers: hasBody ? { "content-type": "application/json", ...headers } : headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    // El timeout es la unica defensa contra un proveedor que cuelga la conexion.
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text; // respuesta no-JSON (ej. pagina de error del proveedor)
    }
  }

  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status} en ${method} ${url}`, res.status, parsed);
  }
  return parsed as T;
}
