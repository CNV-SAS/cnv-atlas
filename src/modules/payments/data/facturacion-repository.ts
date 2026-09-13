import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  nutraceuticals,
  patientContacts,
  patientProfiles,
  patients,
  transactionItems,
  transactions,
} from "@/db/schema";
import type { LineaDeVenta, MapaDeAlegra } from "../facturacion";

// Lectura y escritura de lo que la facturacion necesita. Drizzle con el owner (no RLS): esto corre en el
// webhook de Wompi y en la cola de reintento, donde NO hay sesion de usuario. Es la misma razon por la que
// `sealPaidTransaction` vive en el writer y no en un repositorio con cliente anon.

/**
 * QUE LE FALTA A UNA VENTA COBRADA. UNA SOLA DEFINICION, usada por los cuatro sitios que la necesitan.
 *
 * ── POR QUE ES UN FRAGMENTO Y NO CUATRO COPIAS (2026-09-13) ─────────────────────────────────────
 *
 * La condicion vivia escrita a mano en el reclamo, en la cola, en el panel y en el conteo del reporte. Al
 * agregar el pago como segundo hueco se actualizo en UNO y los otros tres siguieron mirando solo el
 * estado de la factura. Resultado en el smoke: seis ventas con el pago fallido que el boton podia reclamar
 * pero el panel no mostraba, y el panel dijo "una pendiente" con siete.
 *
 * Cuatro copias de la misma regla divergen la primera vez que la regla cambia. Una sola no puede.
 *
 * LOS DOS HUECOS: la factura no esta completa, o esta completa y el pago no se registro.
 */
export const LE_FALTA_ALGO = sql`(transactions.alegra_invoice_state is distinct from 'emitida' or transactions.alegra_payment_id is null)`;

/**
 * El mapa del ambiente que se esta usando.
 *
 * QUE AMBIENTE: el que diga `ALEGRA_BASE_URL`. Se resuelve por la URL y no por una variable aparte porque
 * una variable aparte podria decir "produccion" mientras la URL apunta al sandbox, y esa contradiccion no
 * la ve nadie hasta que una factura de prueba sale con numeracion real.
 */
export function ambienteDeAlegra(): string {
  const base = process.env.ALEGRA_BASE_URL ?? "";
  return /sandbox/i.test(base) ? "sandbox" : "produccion";
}

export async function getMapaDeAlegra(): Promise<MapaDeAlegra | null> {
  const env = ambienteDeAlegra();
  const filas = await db.execute<{
    env: string;
    iva_tax_id: string;
    invoice_template_id: string;
    credit_note_template_id: string | null;
    cost_center_propio_id: string;
    cost_center_tercero_id: string;
    bank_account_efectivo_id: string;
    bank_account_pasarela_id: string;
  }>(sql`
    select env, iva_tax_id, invoice_template_id, credit_note_template_id,
           cost_center_propio_id, cost_center_tercero_id,
           bank_account_efectivo_id, bank_account_pasarela_id
      from alegra_config where env = ${env} limit 1`);
  const c = filas[0];
  if (!c) return null;
  return {
    env: c.env,
    ivaTaxId: c.iva_tax_id,
    invoiceTemplateId: c.invoice_template_id,
    creditNoteTemplateId: c.credit_note_template_id,
    costCenterPropioId: c.cost_center_propio_id,
    costCenterTerceroId: c.cost_center_tercero_id,
    bankAccountEfectivoId: c.bank_account_efectivo_id,
    bankAccountPasarelaId: c.bank_account_pasarela_id,
  };
}

/**
 * Las lineas REALES de la venta, con lo que cada producto necesita para facturarse.
 *
 * `transaction_items` ya las tenia desde siempre, con su producto, su cantidad y su precio sellado. El
 * codigo anterior las ignoraba y mandaba un item generico con cantidad 1: el dato existia en Atlas y se
 * descartaba al facturar.
 */
export async function getLineasDeVenta(txId: string): Promise<LineaDeVenta[]> {
  const filas = await db
    .select({
      nutraceuticalId: transactionItems.nutraceuticalId,
      nombre: nutraceuticals.name,
      cantidad: transactionItems.quantity,
      precioUnitario: transactionItems.unitPrice,
      alegraItemId: nutraceuticals.alegraItemId,
      alegraEnv: nutraceuticals.alegraEnv,
      ownership: nutraceuticals.ownership,
    })
    .from(transactionItems)
    .innerJoin(nutraceuticals, eq(nutraceuticals.id, transactionItems.nutraceuticalId))
    .where(eq(transactionItems.transactionId, txId));

  return filas.map((f) => ({
    nutraceuticalId: f.nutraceuticalId,
    nombre: f.nombre,
    cantidad: Number(f.cantidad),
    precioUnitario: Number(f.precioUnitario),
    alegraItemId: f.alegraItemId,
    alegraEnv: f.alegraEnv,
    ownership: f.ownership,
  }));
}

export type DatosDelContacto = {
  patientId: string;
  documento: string;
  tipoDocumento: string;
  /** SEPARADOS, como los guarda `patient_profiles`. Alegra los quiere asi y partirlos aqui seria adivinar. */
  nombres: string | null;
  apellidos: string | null;
  correo: string | null;
  /** Si es paciente de PRUEBA. Gatea la facturacion en las dos direcciones; ver `pacienteYAmbienteCuadran`. */
  esDePrueba: boolean;
  alegraContactId: string | null;
  alegraEnv: string | null;
};

/**
 * Lo que hace falta para resolver el contacto, y NADA MAS: nombre, documento y correo (principio 7 del
 * modelo comercial, a la contabilidad solo van datos de identificacion). Ni fecha de nacimiento, ni sexo,
 * ni ciudad, aunque esten en la misma tabla y saliera gratis traerlos.
 */
export async function getDatosDelContacto(patientId: string): Promise<DatosDelContacto | null> {
  const [p] = await db
    .select({
      patientId: patients.id,
      documento: patients.documentNumber,
      tipoDocumento: patients.documentType,
      esDePrueba: patients.isTest,
      nombres: patientProfiles.firstName,
      apellidos: patientProfiles.lastName,
      correo: patientContacts.email,
      alegraContactId: patients.alegraContactId,
      alegraEnv: patients.alegraEnv,
    })
    .from(patients)
    // LEFT y no INNER: un paciente sin perfil o sin correo no puede quedarse sin factura. La factura la
    // exige la ley; el correo es una comodidad.
    .leftJoin(patientProfiles, eq(patientProfiles.patientId, patients.id))
    .leftJoin(patientContacts, eq(patientContacts.patientId, patients.id))
    .where(eq(patients.id, patientId))
    .limit(1);
  return p ?? null;
}

/** La venta, con lo que la facturacion necesita saber de ella. La usa la cola de reintento. */
export async function getVentaParaFacturar(
  txId: string,
): Promise<{ id: string; amount: string; patientId: string | null; canal: "wompi" | "efectivo" } | null> {
  const [t] = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      patientId: transactions.patientId,
      canal: transactions.paymentMethod,
    })
    .from(transactions)
    .where(eq(transactions.id, txId))
    .limit(1);
  if (!t) return null;
  return { ...t, canal: t.canal === "efectivo" ? "efectivo" : "wompi" };
}

/**
 * Guarda el contacto de Alegra en el paciente, CON SU AMBIENTE.
 *
 * Guardado por `alegra_contact_id IS NULL` del mismo ambiente: si dos ventas simultaneas del mismo
 * paciente crean el contacto a la vez, la segunda no pisa a la primera. Y al cambiar de ambiente el id
 * viejo no sirve, asi que el ambiente se guarda con el id y no aparte.
 */
export async function setContactoDeAlegra(
  patientId: string,
  contactId: string,
  env: string,
): Promise<void> {
  await db
    .update(patients)
    .set({ alegraContactId: contactId, alegraEnv: env })
    .where(and(eq(patients.id, patientId), isNull(patients.alegraContactId)));
}

/** Lo que se sabe de la factura tras intentarla. */
export type ResultadoDeFacturacion = {
  estado: "borrador" | "emitida" | "emitida_sin_sellar" | "fallida";
  invoiceId?: string | null;
  numero?: string | null;
  cufe?: string | null;
  legalStatus?: string | null;
  paymentId?: string | null;
  error?: string | null;
};

/**
 * Registra el desenlace del intento, gane o pierda.
 *
 * NO TOCA `alegra_attempts`. Esta nota decia que "siempre lo sube", y dejo de ser cierto el 2026-09-12
 * cuando el contador se movio a `reclamarParaFacturar`: intentar ES reclamar, y un intento que muere sin
 * llegar a escribir desenlace tiene que contar igual. Se corrige aqui porque un texto que describe mal lo
 * que hace una funcion lleva a llamarla dos veces "para asegurarse".
 */
export async function registrarIntentoDeFactura(
  txId: string,
  r: ResultadoDeFacturacion,
): Promise<void> {
  await db.execute(sql`
    update transactions set
      alegra_invoice_state = ${r.estado},
      alegra_invoice_id     = coalesce(${r.invoiceId ?? null}, alegra_invoice_id),
      alegra_invoice_number = coalesce(${r.numero ?? null}, alegra_invoice_number),
      -- EL CUFE SE ESCRIBE, que hasta hoy no. Se leia de la respuesta, se pasaba a esta funcion y se
      -- perdia aqui porque no habia columna: se recibia y se tiraba.
      alegra_cufe           = coalesce(${r.cufe ?? null}, alegra_cufe),
      alegra_legal_status   = coalesce(${r.legalStatus ?? null}, alegra_legal_status),
      alegra_payment_id     = coalesce(${r.paymentId ?? null}, alegra_payment_id),
      alegra_emitted_at     = case when ${r.estado} = 'emitida' and alegra_emitted_at is null
                                   then now() else alegra_emitted_at end,
      -- EL CONTADOR NO SE TOCA AQUI: lo sube reclamarParaFacturar, que es quien decide intentar. Si se
      -- subiera en los dos sitios, un intento contaria doble; y si solo se subiera aqui, un intento que
      -- muere sin llegar a registrar desenlace no contaria nunca y el tope no lo frenaria.
      alegra_last_error     = ${r.error ?? null},
      updated_at            = now()
    where id = ${txId}`);
}


/**
 * RECLAMA una venta para facturarla. Devuelve false si otro ya la tiene o si ya esta emitida.
 *
 * ── POR QUE HACE FALTA UN RECLAMO Y NO BASTA UN `if` ────────────────────────────────────────────
 *
 * El boton de reintentar se puede pulsar dos veces, y dos webhooks del mismo pago pueden llegar a la vez.
 * Con un `if (estado === 'emitida') return`, las dos llamadas leen el estado ANTES de que ninguna lo
 * cambie, las dos pasan, y salen DOS FACTURAS del mismo hecho. Deshacer eso es una nota credito y un hueco
 * en el consecutivo.
 *
 * El reclamo es un UPDATE CONDICIONAL: gana quien lo ejecuta primero, y Postgres serializa. Lo que llega
 * despues no encuentra fila y se va.
 *
 * ── Y ES UN ARRIENDO, NO UN CANDADO PERMANENTE ─────────────────────────────────────────────────
 *
 * Si el proceso muere a mitad (un timeout de la funcion serverless, un despliegue), un candado permanente
 * dejaria esa venta sin facturar PARA SIEMPRE y sin que nadie pueda reintentarla. Con el arriendo de dos
 * minutos, se libera sola. Dos minutos es mas que el timeout de las llamadas a Alegra (15s cada una) y
 * menos que la paciencia de quien pulsa el boton.
 *
 * AQUI SE CUENTA EL INTENTO, y en un solo sitio: intentar ES reclamar. Antes se contaba al registrar el
 * desenlace, asi que un intento que moria sin desenlace no se contaba y el tope no lo frenaba nunca.
 */
export async function reclamarParaFacturar(txId: string): Promise<boolean> {
  const filas = await db.execute<{ id: string }>(sql`
    update transactions
       set alegra_attempts = alegra_attempts + 1,
           alegra_last_attempt_at = now(),
           updated_at = now()
     where id = ${txId}
       and status = 'paid'
       -- LOS DOS HUECOS: sin documento, o con documento y SIN PAGO. Antes solo el primero, y las ventas
       -- facturadas con el pago fallido no se podian reclamar: el boton no las tocaba nunca.
       and ${LE_FALTA_ALGO}
       and (alegra_last_attempt_at is null or alegra_last_attempt_at < now() - interval '2 minutes')
    returning id`);
  return filas.length > 0;
}

/** Lo que ya se sabe de la factura de una venta, para no crear una segunda. */
export async function getFacturaDeVenta(
  txId: string,
): Promise<{ invoiceId: string | null; estado: string | null } | null> {
  const [t] = await db
    .select({ invoiceId: transactions.alegraInvoiceId, estado: transactions.alegraInvoiceState })
    .from(transactions)
    .where(eq(transactions.id, txId))
    .limit(1);
  return t ?? null;
}

/** Las ventas sin documento fiscal, CON SU MOTIVO. Es lo que pinta el panel de reintento. */
export async function listarVentasSinDocumento(limite = 50): Promise<
  {
    id: string;
    amount: string;
    estado: string | null;
    numero: string | null;
    intentos: number;
    motivo: string | null;
    fecha: string;
    /** Si la factura esta completa pero el pago no. Es el hueco que el panel no mostraba. */
    pagoPendiente: boolean;
  }[]
> {
  const filas = await db.execute<{
    id: string;
    amount: string;
    alegra_invoice_state: string | null;
    alegra_invoice_number: string | null;
    alegra_attempts: number;
    alegra_last_error: string | null;
    created_at: string;
    alegra_payment_id: string | null;
  }>(sql`
    select id, amount, alegra_invoice_state, alegra_invoice_number,
           alegra_attempts, alegra_last_error, created_at, alegra_payment_id
      from transactions
     where status = 'paid'
       and ${LE_FALTA_ALGO}
     order by created_at desc
     limit ${limite}`);
  return filas.map((f) => ({
    id: f.id,
    amount: String(f.amount),
    estado: f.alegra_invoice_state,
    numero: f.alegra_invoice_number,
    intentos: Number(f.alegra_attempts),
    motivo: f.alegra_last_error,
    fecha: String(f.created_at),
    pagoPendiente: f.alegra_invoice_state === "emitida" && !f.alegra_payment_id,
  }));
}

/** Marca que la venta esta pagada y a la espera de factura. Es lo que la pone en la cola. */
export async function marcarFacturaPendiente(txId: string): Promise<void> {
  await db.execute(sql`
    update transactions set alegra_invoice_state = 'pendiente', updated_at = now()
     where id = ${txId} and alegra_invoice_state is null`);
}

/**
 * LA COLA. Es una consulta, no una tabla: una tabla aparte seria una segunda fuente del mismo hecho,
 * capaz de desincronizarse de la transaccion que dice representar.
 *
 * `maxIntentos` corta los errores permanentes. Lo que pasa el tope no desaparece: sigue en `fallida` con
 * su motivo, y es lo que tiene que salir en el reporte de ventas sin documento fiscal.
 */
export async function listarFacturasPendientes(
  maxIntentos = 5,
  limite = 50,
): Promise<{ id: string; intentos: number }[]> {
  const filas = await db.execute<{ id: string; alegra_attempts: number }>(sql`
    select id, alegra_attempts from transactions
     where status = 'paid'
       -- TODO LO QUE NO ESTA TERMINADO, no una lista de estados: incluye emitida_sin_sellar (numerada y
       -- sin CUFE), que antes quedaba fuera del barrido justo por parecer terminada. Y un estado nuevo
       -- entra solo, sin que haya que acordarse de esta linea.
       and ${LE_FALTA_ALGO}
       and alegra_attempts < ${maxIntentos}
     order by created_at asc
     limit ${limite}`);
  return filas.map((f) => ({ id: f.id, intentos: Number(f.alegra_attempts) }));
}

/**
 * VENTAS SIN DOCUMENTO FISCAL. Es el reporte que contabilidad exige en CERO al cierre de cada dia
 * (decision D2), y la contrapartida de haber aceptado que el inventario se descuente al sellar la venta
 * y no al emitir la factura.
 *
 * Incluye las que agotaron reintentos, que la cola ya no toca y que por eso son justo las que hay que ver.
 */
export async function contarVentasSinDocumento(): Promise<{ total: number; agotadas: number }> {
  const [r] = await db.execute<{ total: number; agotadas: number }>(sql`
    select count(*)::int as total,
           count(*) filter (where alegra_attempts >= 5)::int as agotadas
      from transactions
     where status = 'paid'
       and ${LE_FALTA_ALGO}`);
  return { total: Number(r?.total ?? 0), agotadas: Number(r?.agotadas ?? 0) };
}
