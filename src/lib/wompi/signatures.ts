import { createHash } from "node:crypto";

// Firmas de Wompi, verificadas contra la doc oficial vigente (docs.wompi.co, 2026):
// - Integridad del checkout: SHA256(reference + amountInCents + currency + integritySecret).
// - Eventos (webhook): SHA256(concat de los valores de signature.properties, en
//   orden, + timestamp + eventsSecret), comparado con signature.checksum.
// Funciones puras (solo node:crypto) para poder probarlas con vectores conocidos.

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// Firma de integridad para el Web Checkout por redirect. amountInCents es entero.
export function computeIntegritySignature(params: {
  reference: string;
  amountInCents: number;
  currency: string;
  integritySecret: string;
}): string {
  const { reference, amountInCents, currency, integritySecret } = params;
  return sha256Hex(`${reference}${amountInCents}${currency}${integritySecret}`);
}

// Resuelve un path con puntos (ej. "transaction.amount_in_cents") contra el objeto
// data del evento. Devuelve string vacio si falta el campo (la firma no cuadrara).
function getByPath(obj: unknown, path: string): string {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return "";
    }
  }
  return current == null ? "" : String(current);
}

export type WompiEvent = {
  timestamp: number;
  signature: { checksum: string; properties: string[] };
  data: unknown;
};

// Recalcula el checksum del evento y lo compara (case-insensitive) con el que
// envia Wompi. Los properties son paths relativos a data (ej. "transaction.id").
export function verifyEventSignature(event: WompiEvent, eventsSecret: string): boolean {
  if (!event?.signature?.checksum || !Array.isArray(event.signature.properties)) {
    return false;
  }
  const concatenated =
    event.signature.properties.map((p) => getByPath(event.data, p)).join("") +
    String(event.timestamp) +
    eventsSecret;
  return sha256Hex(concatenated).toLowerCase() === event.signature.checksum.toLowerCase();
}
