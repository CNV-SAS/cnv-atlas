// El error que lanza `fetchJson` cuando un proveedor responde != 2xx.
//
// VIVE APARTE, sin `server-only`, a proposito: es un dato (estado + cuerpo), no una capacidad de
// servidor, y quien decide QUE HACER con un 429 o un 500 tiene que poder mirarlo sin arrastrar el
// marcador. Es el mismo patron de modulo NEUTRO que ARCHITECTURE.md pide para lo que cruza una frontera.
// `fetch-json.ts` lo reexporta, asi que quien ya lo importaba de alli sigue igual.
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
