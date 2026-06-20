import "server-only";

import { fetchJson } from "@/core/http/fetch-json";

// Cliente de Alegra (facturacion). Auth: Basic base64(email:api_key). Endpoint y
// formato del body verificados contra la doc oficial vigente (api.alegra.com/api/v1).
// La idempotencia (no facturar dos veces la misma transaccion) la garantiza el
// servicio chequeando transactions.alegra_invoice_id antes de llamar aqui.

const ALEGRA_BASE = "https://api.alegra.com/api/v1";
const ALEGRA_TIMEOUT_MS = 15_000;

export type AlegraInvoiceItem = {
  id: number; // id del item en el catalogo de Alegra
  price: number;
  quantity: number;
};

export type AlegraInvoiceInput = {
  clientId: number; // id del cliente en Alegra
  items: AlegraInvoiceItem[];
  date: string; // yyyy-MM-dd
  dueDate: string; // yyyy-MM-dd
};

export type AlegraInvoiceResult = { id: string };

function authHeader(): string {
  const email = process.env.ALEGRA_EMAIL;
  const apiKey = process.env.ALEGRA_API_KEY;
  if (!email || !apiKey) throw new Error("Faltan ALEGRA_EMAIL o ALEGRA_API_KEY");
  const token = Buffer.from(`${email}:${apiKey}`).toString("base64");
  return `Basic ${token}`;
}

// Crea una factura de venta. Lanza HttpError si Alegra responde != 2xx; el llamador
// decide que hacer (reintentar acotado, marcar pendiente). Nunca dentro de una
// transaccion de BD: es una llamada externa.
export async function createAlegraInvoice(
  input: AlegraInvoiceInput,
): Promise<AlegraInvoiceResult> {
  const body = {
    client: { id: input.clientId },
    items: input.items,
    date: input.date,
    dueDate: input.dueDate,
  };
  const res = await fetchJson<{ id: number | string }>(`${ALEGRA_BASE}/invoices`, {
    method: "POST",
    headers: { authorization: authHeader(), accept: "application/json" },
    body,
    timeoutMs: ALEGRA_TIMEOUT_MS,
  });
  return { id: String(res.id) };
}
