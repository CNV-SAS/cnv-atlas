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
// LA IDEMPOTENCIA NO ES DE AQUI: la decide el servicio. Pero este modulo le da lo que necesita para
// decidirla, y eso incluye poder BUSCAR lo que quiza ya se creo.
//
// ═══ LAS ESCRITURAS QUE PUEDEN COMPLETARSE SIN QUE LLEGUE LA RESPUESTA (2026-09-14) ═══
//
// Un POST que se corta por tiempo NO es un fallo: es un desenlace DESCONOCIDO. Alegra puede haber creado el
// documento y la respuesta haberse perdido. Paso en el smoke del Bloque 3: la emision tardo mas de 15 s,
// Alegra emitio SETP990214715, Atlas la dio por fallida sin id, y un reintento habria emitido una SEGUNDA
// factura del mismo pago. La proteccion anterior ("si la venta ya tiene id de factura, no se crea otra")
// cubria los reintentos DESPUES de guardar el id y los intentos simultaneos, no este caso.
//
// LA REGLA, UNA SOLA PARA TODAS: antes de volver a crear, se BUSCA en Alegra lo que ese intento pudo haber
// creado, y si existe se ADOPTA. Cada escritura tiene su forma de buscarse:
//
//   · CONTACTO: por el numero de documento (`findAlegraContactByDocument`). Ya era asi: Alegra rechaza el
//     documento repetido.
//   · FACTURA: por la REFERENCIA de la venta de Atlas, que viaja en `observations`
//     (`buscarFacturaPorReferencia`).
//   · PAGO: por el SALDO de la factura, releida (`getAlegraInvoice`). Si ya no debe nada, el pago existe.
//   · NOTA CREDITO (Bloque 3b, todavia sin llamador): la misma forma que la factura. Referencia propia en un
//     campo que se pueda leer, y buscar antes de emitir. No se construye sin eso.

const ALEGRA_DEFAULT_BASE = "https://api.alegra.com/api/v1";
const ALEGRA_TIMEOUT_MS = 15_000;
// LA EMISION TIENE SU PROPIO TIMEOUT, porque pide el sellado ante la DIAN en la misma llamada y Alegra
// responde cuando la DIAN contesta. Medido en el sandbox el 2026-09-14: 12,9 s para una factura de una linea,
// a dos segundos del limite anterior. Subirlo reduce los cortes; lo que evita la factura duplicada cuando
// igual ocurren es buscar antes de emitir. La funcion que factura declara `maxDuration` holgado para esto.
export const ALEGRA_TIMEOUT_EMISION_MS = 60_000;

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
  /** Nombres y apellidos POR SEPARADO. Ver la nota de `createAlegraContact`. */
  nombres: string;
  apellidos: string;
  documento: string;
  tipoDocumento: string; // CC | CE | NIT | PA...
  correo: string | null;
  /** PERSON_ENTITY (natural) | LEGAL_ENTITY (juridica). Alegra lo exige. */
  tipoDePersona: "PERSON_ENTITY" | "LEGAL_ENTITY";
  /** SIMPLIFIED_REGIME (no responsable de IVA) | COMMON_REGIME (responsable). */
  regimen: "SIMPLIFIED_REGIME" | "COMMON_REGIME";
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

/**
 * Crea el contacto. Solo viajan nombre, documento y correo (principio 7 del modelo comercial).
 *
 * ── LOS CUATRO CAMPOS QUE FALTABAN, Y COMO SE SUPO (2026-09-12) ─────────────────────────────────
 *
 * El primer smoke fallo aqui con un 400, y el motivo lo dijo Alegra:
 *
 *     {"message":"El tipo de persona del cliente es obligatorio","code":2031}
 *
 * `kindOfPerson` y `regime` alimentan el documento electronico ante la DIAN, asi que una cuenta con
 * facturacion electronica los exige. Y VAN LOS DOS DE UNA, no solo el que el error nombro: esta API
 * valida de a un campo, asi que mandar solo `kindOfPerson` habria devuelto el siguiente 400 con el
 * siguiente campo, y el smoke habria tardado tres vueltas en vez de una.
 *
 * ── Y EL APELLIDO VIENE PARTIDO DESDE SU FUENTE ─────────────────────────────────────────────────
 *
 * `patient_profiles` guarda `first_name` y `last_name` SEPARADOS, y hasta hoy se concatenaban aqui para
 * meterlos en `firstName`. Partir "Ana Maria Lopez Gomez" de vuelta es imposible de hacer bien (no se
 * sabe donde termina el nombre), asi que el apellido no se adivina: se pide separado a quien ya lo tiene
 * asi. Es la misma regla que con el lote o el consecutivo: no se recalcula lo que la fuente ya sabe.
 */
export async function createAlegraContact(input: AlegraContactInput): Promise<{ id: string }> {
  const res = await fetchJson<{ id: number | string }>(`${baseUrl()}/contacts`, {
    method: "POST",
    headers: cabeceras(),
    body: {
      nameObject: { firstName: input.nombres, lastName: input.apellidos },
      identificationObject: { type: input.tipoDocumento, number: input.documento },
      kindOfPerson: input.tipoDePersona,
      regime: input.regimen,
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
  /**
   * LA REFERENCIA DE LA VENTA DE ATLAS, obligatoria. Viaja en `observations`, que Alegra NO imprime:
   * verificado en el PDF de una factura emitida del sandbox (SETP990214717), donde `anotation` si aparece
   * junto al CUFE y `observations` no. Es lo que permite encontrar la factura si la respuesta se pierde.
   */
  referencia: string;
  items: AlegraInvoiceLine[];
  date: string; // yyyy-MM-dd
  dueDate: string;
  numberTemplateId: number; // quien asigna el consecutivo. Atlas nunca lo calcula.
  costCenterId?: number;
  /**
   * El CODIGO de medio de pago de Alegra ("INSTRUMENT_NOT_DEFINED" y similares), NO el rotulo de su
   * pantalla. Opcional: si no viene, la factura sale "no definido", que es informativo y no tiene efecto
   * fiscal. Solo se manda un codigo VERIFICADO (ver `modules/payments/medio-de-pago`).
   */
  paymentMethod?: string;
  /**
   * `true` emite: Alegra asigna el CONSECUTIVO y se pide el SELLADO ante la DIAN. `false` la deja en
   * borrador, que no es un documento fiscal.
   *
   * SON DOS COSAS Y SE APRENDIO CON LA FACTURA 7: salio `status: open` con su consecutivo y con `stamp`
   * NULO, o sea numerada y sin sellar. En la pantalla de Alegra eso se ve como un boton "Emitir"
   * pendiente. El consecutivo lo da `status: open`; el CUFE hay que pedirlo.
   */
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
  /** Lo que falta por cobrar. Es la FUENTE para saber si el pago ya se registro, y es la de Alegra: si el
   *  pago fallo y no dejo rastro en Atlas, el saldo lo dice igual. */
  balance: number | null;
};

type InvoiceResponse = {
  id: number | string;
  status?: string;
  total?: number;
  tax?: number;
  balance?: number;
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
    balance: typeof res.balance === "number" ? res.balance : null,
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
      // Interna: no la ve el paciente (ver `referencia`).
      observations: input.referencia,
      ...(input.costCenterId ? { costCenter: { id: input.costCenterId } } : {}),
      // Alegra Colombia exige la forma de pago. La venta a paciente esta pagada al facturarse.
      paymentForm: "CASH",
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      // `open` da el CONSECUTIVO. Sin esto queda en borrador, que es lo que hacia Atlas hasta hoy y por
      // lo que nunca hubo una factura de verdad.
      ...(input.emitir ? { status: "open" } : {}),
      // Y ESTO PIDE EL SELLADO ante la DIAN, que es lo que produce el CUFE. La factura 7 demostro que no
      // viene con `open`: hay que pedirlo aparte, en el mismo POST.
      ...(input.emitir ? { stamp: { generateStamp: true } } : {}),
    },
    timeoutMs: ALEGRA_TIMEOUT_EMISION_MS,
  });
  return leerFactura(res);
}

/**
 * BUSCA la factura de una venta por su REFERENCIA, entre las facturas del cliente en un rango de fechas.
 *
 * Devuelve null si no hay ninguna. LANZA si hay mas de una: dos facturas vivas con la referencia de la misma
 * venta es un duplicado que ya ocurrio, y adoptar una al azar esconderia la otra. Eso lo mira una persona.
 *
 * Las anuladas (`void`) no cuentan: una factura anulada no es la factura de la venta.
 */
export async function buscarFacturaPorReferencia(input: {
  clientId: number;
  referencia: string;
  /** yyyy-MM-dd, inclusivos. */
  desde: string;
  hasta: string;
}): Promise<AlegraInvoiceResult | null> {
  const encontradas: (InvoiceResponse & { observations?: string | null })[] = [];
  for (let start = 0; ; start += 30) {
    const url =
      `${baseUrl()}/invoices?client_id=${encodeURIComponent(String(input.clientId))}` +
      `&date_afterOrNow=${input.desde}&date_beforeOrNow=${input.hasta}&limit=30&start=${start}`;
    const pagina = await fetchJson<unknown>(url, { headers: cabeceras(), timeoutMs: ALEGRA_TIMEOUT_MS });
    const filas = (Array.isArray(pagina) ? pagina : []) as (InvoiceResponse & { observations?: string | null })[];
    encontradas.push(...filas);
    if (filas.length < 30) break;
  }
  const suyas = encontradas.filter(
    (f) => f.status !== "void" && typeof f.observations === "string" && f.observations.includes(input.referencia),
  );
  if (suyas.length > 1) {
    throw new Error(
      `Hay ${suyas.length} facturas en Alegra con la referencia "${input.referencia}" (${suyas.map((f) => f.numberTemplate?.fullNumber ?? f.id).join(", ")}). No se adopta ninguna: se revisa a mano.`,
    );
  }
  return suyas[0] ? leerFactura(suyas[0]) : null;
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
      // `bankAccount`, NO `account`. Con `account` Alegra respondia 400 en TODOS los pagos:
      //   {"message":"La cuenta de banco asociada al pago es obligatoria","code":4002}
      // Se supo porque el motivo ya se escribia en la transaccion. Seis pagos fallaron igual en el smoke,
      // cada uno con la factura bien emitida y el paciente figurando "por cobrar" habiendo pagado.
      bankAccount: { id: input.bankAccountId },
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
