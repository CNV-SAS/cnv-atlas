import "server-only";

import { fetchJson } from "@/core/http/fetch-json";
import { missingEnvMessage } from "@/lib/env/missing-env";

// Cliente de Alegra (facturacion). Auth: Basic base64(email:api_key).
//
// QUE HACE Y QUE NO. Este modulo SOLO habla HTTP: arma el cuerpo, llama y devuelve lo que vino. No decide
// contra que cuenta se registra un pago, ni que centro de costo lleva un producto, ni si una linea puede
// ir sin impuesto. Eso son reglas de negocio y viven en el servicio (regla 2). Aqui no hay ni un solo
// identificador quemado: todos llegan por parametro desde `alegra_config`.
//
// LA IDEMPOTENCIA NO ES DE AQUI. No facturar dos veces la misma transaccion lo garantiza el servicio
// mirando `transactions.alegra_invoice_state` antes de llamar.

const ALEGRA_DEFAULT_BASE = "https://api.alegra.com/api/v1";
const ALEGRA_TIMEOUT_MS = 15_000;

// Base URL desde el entorno: sandbox y produccion tienen hosts distintos, no se hardcodea.
function baseUrl(): string {
  const base = process.env.ALEGRA_BASE_URL ?? ALEGRA_DEFAULT_BASE;
  return base.replace(/\/+$/, "");
}

function authHeader(): string {
  const email = process.env.ALEGRA_EMAIL;
  const apiKey = process.env.ALEGRA_API_KEY;
  const missing = missingEnvMessage({ ALEGRA_EMAIL: email, ALEGRA_API_KEY: apiKey });
  if (missing) throw new Error(missing);
  return `Basic ${Buffer.from(`${email}:${apiKey}`).toString("base64")}`;
}

const cabeceras = () => ({ authorization: authHeader(), accept: "application/json" });

// ── CONTACTOS ────────────────────────────────────────────────────────────────────────────────────

export type AlegraContactInput = {
  nombre: string;
  documento: string;
  tipoDocumento: string; // CC | CE | NIT | PA...
  correo: string | null;
};

/**
 * Busca un contacto por su NUMERO DE DOCUMENTO. Devuelve null si no existe.
 *
 * Es la mitad "buscar" del patron buscar-o-crear, y existe porque Alegra RECHAZA un contacto con un
 * documento que ya esta registrado. Sin este paso, el segundo paciente que vuelve a comprar rompe la
 * facturacion; y con un `catch` que ignore el rechazo, se factura al contacto equivocado.
 */
export async function findAlegraContactByDocument(documento: string): Promise<{ id: string } | null> {
  const url = `${baseUrl()}/contacts?identification=${encodeURIComponent(documento)}&limit=30`;
  const res = await fetchJson<unknown>(url, { headers: cabeceras(), timeoutMs: ALEGRA_TIMEOUT_MS });
  const lista = Array.isArray(res) ? res : [];
  // El filtro de Alegra es por coincidencia, no exacto, asi que se compara el documento aqui: un
  // contacto "parecido" seria facturarle a otra persona.
  const exacto = lista.find(
    (c) => String((c as { identification?: unknown }).identification ?? "") === documento,
  );
  return exacto ? { id: String((exacto as { id: unknown }).id) } : null;
}

/** Crea el contacto. Solo viajan nombre, documento y correo (principio 7 del modelo comercial). */
export async function createAlegraContact(input: AlegraContactInput): Promise<{ id: string }> {
  const res = await fetchJson<{ id: number | string }>(`${baseUrl()}/contacts`, {
    method: "POST",
    headers: cabeceras(),
    body: {
      nameObject: { firstName: input.nombre },
      identificationObject: { type: input.tipoDocumento, number: input.documento },
      ...(input.correo ? { email: input.correo } : {}),
      type: ["client"],
    },
    timeoutMs: ALEGRA_TIMEOUT_MS,
  });
  return { id: String(res.id) };
}

// ── FACTURA ──────────────────────────────────────────────────────────────────────────────────────

export type AlegraInvoiceLine = {
  id: number; // item del catalogo de Alegra
  price: number; // BASE sin IVA, en pesos enteros
  quantity: number;
  /**
   * Impuestos por id. NO ES OPCIONAL, y el tipo lo dice para que no se pueda omitir por descuido: sin
   * `tax` explicito Alegra factura con IVA en 0 AUNQUE EL ITEM LO TENGA CONFIGURADO, la DIAN valida el
   * documento, y el IVA no cobrado lo asume CNV de su margen. Hay una factura asi en el sandbox.
   */
  tax: { id: number }[];
};

export type AlegraInvoiceInput = {
  clientId: number;
  items: AlegraInvoiceLine[];
  date: string; // yyyy-MM-dd
  dueDate: string;
  numberTemplateId: number; // quien asigna el consecutivo. Atlas nunca lo calcula.
  costCenterId?: number;
  /** `true` emite (consecutivo y CUFE). `false` la deja en borrador, que NO es un documento fiscal. */
  emitir: boolean;
};

export type AlegraStamp = {
  cufe: string | null;
  legalStatus: string | null;
};

export type AlegraInvoiceResult = {
  id: string;
  /** El CONSECUTIVO, que es lo que reconoce la DIAN y lo que ve el paciente. Distinto del id interno. */
  numero: string | null;
  estado: string | null; // draft | open | closed...
  stamp: AlegraStamp | null;
  total: number | null;
  tax: number | null;
};

type InvoiceResponse = {
  id: number | string;
  status?: string;
  total?: number;
  tax?: number;
  numberTemplate?: { fullNumber?: string; number?: string };
  stamp?: { cufe?: string; legalStatus?: string };
};

function leerFactura(res: InvoiceResponse): AlegraInvoiceResult {
  return {
    id: String(res.id),
    numero: res.numberTemplate?.fullNumber ?? res.numberTemplate?.number ?? null,
    estado: res.status ?? null,
    stamp: res.stamp ? { cufe: res.stamp.cufe ?? null, legalStatus: res.stamp.legalStatus ?? null } : null,
    total: typeof res.total === "number" ? res.total : null,
    tax: typeof res.tax === "number" ? res.tax : null,
  };
}

export async function createAlegraInvoice(input: AlegraInvoiceInput): Promise<AlegraInvoiceResult> {
  const res = await fetchJson<InvoiceResponse>(`${baseUrl()}/invoices`, {
    method: "POST",
    headers: cabeceras(),
    body: {
      client: { id: input.clientId },
      items: input.items,
      date: input.date,
      dueDate: input.dueDate,
      numberTemplate: { id: input.numberTemplateId },
      ...(input.costCenterId ? { costCenter: { id: input.costCenterId } } : {}),
      // Alegra Colombia exige la forma de pago. La venta a paciente esta pagada al facturarse.
      paymentForm: "CASH",
      // `open` emite: asigna consecutivo y dispara el sellado ante la DIAN. Sin esto queda en borrador,
      // que es lo que hacia Atlas hasta hoy y por lo que nunca hubo una factura de verdad.
      ...(input.emitir ? { status: "open" } : {}),
    },
    timeoutMs: ALEGRA_TIMEOUT_MS,
  });
  return leerFactura(res);
}

/**
 * Relee una factura.
 *
 * EL SELLADO ANTE LA DIAN ES ASINCRONO: la respuesta de emision puede volver sin `stamp`, y el CUFE
 * aparece unos segundos despues. Releer es lo que permite completarlo SIN construir un webhook, que fue
 * la decision del 2026-09-12: la informacion ya viene en la respuesta, solo que a veces mas tarde.
 */
export async function getAlegraInvoice(id: string): Promise<AlegraInvoiceResult> {
  const res = await fetchJson<InvoiceResponse>(`${baseUrl()}/invoices/${encodeURIComponent(id)}`, {
    headers: cabeceras(),
    timeoutMs: ALEGRA_TIMEOUT_MS,
  });
  return leerFactura(res);
}

// ── PAGO ─────────────────────────────────────────────────────────────────────────────────────────

export type AlegraPaymentInput = {
  clientId: number;
  invoiceId: string;
  /** BRUTO, el mismo total de la factura. La comision de la pasarela es gasto de CNV y no se resta. */
  amount: number;
  date: string;
  /** Cuenta PUENTE segun el canal. Nunca el banco: cuando Atlas registra, la plata no ha llegado. */
  bankAccountId: number;
};

/**
 * Registra el pago de una factura.
 *
 * POR QUE ES PARTE DEL MISMO ACTO Y NO UN PASO APARTE: la venta a paciente YA esta pagada cuando se
 * factura (Wompi cobro antes). Si solo se emitiera, la contabilidad acumularia cuentas por cobrar de
 * pacientes que ya pagaron y el banco no cuadraria nunca. La unica que si queda por cobrar es la
 * quincenal al Integrante bajo modalidad Distribucion, que no pasa por aqui.
 */
export async function createAlegraPayment(input: AlegraPaymentInput): Promise<{ id: string }> {
  const res = await fetchJson<{ id: number | string }>(`${baseUrl()}/payments`, {
    method: "POST",
    headers: cabeceras(),
    body: {
      date: input.date,
      account: { id: input.bankAccountId },
      client: { id: input.clientId },
      type: "in",
      paymentMethod: "cash",
      invoices: [{ id: input.invoiceId, amount: input.amount }],
    },
    timeoutMs: ALEGRA_TIMEOUT_MS,
  });
  return { id: String(res.id) };
}

// ── NOTA CREDITO ─────────────────────────────────────────────────────────────────────────────────

export type AlegraCreditNoteInput = {
  clientId: number;
  /** La factura que se corrige. NO es opcional: ver abajo. */
  invoiceId: string;
  items: AlegraInvoiceLine[];
  date: string;
  numberTemplateId: number;
  motivo: string;
};

/**
 * Emite una nota credito SOBRE UNA FACTURA.
 *
 * LA REFERENCIA A LA FACTURA ORIGINAL NO ES OPCIONAL, y el tipo lo impone. Es regla de contabilidad y
 * ademas un detector: en este flujo una nota credito sin referencia no seria "una nota suelta", seria la
 * senal de que algo se rompio. Un parametro opcional invitaria justo a ese caso.
 *
 * Y USA LA NUMERACION ELECTRONICA. La factura que emitimos lo es; una nota credito no electronica contra
 * ella no es lo que la DIAN espera, y no falla: emite el documento que no corresponde.
 */
export async function createAlegraCreditNote(
  input: AlegraCreditNoteInput,
): Promise<AlegraInvoiceResult> {
  const res = await fetchJson<InvoiceResponse>(`${baseUrl()}/credit-notes`, {
    method: "POST",
    headers: cabeceras(),
    body: {
      date: input.date,
      client: { id: input.clientId },
      invoices: [{ id: input.invoiceId }],
      items: input.items,
      numberTemplate: { id: input.numberTemplateId },
      observations: input.motivo,
    },
    timeoutMs: ALEGRA_TIMEOUT_MS,
  });
  return leerFactura(res);
}
