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
  nombre: string | null;
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
      nombre: sql<string | null>`nullif(trim(concat_ws(' ', ${patientProfiles.firstName}, ${patientProfiles.lastName})), '')`,
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
  estado: "borrador" | "emitida" | "fallida";
  invoiceId?: string | null;
  numero?: string | null;
  cufe?: string | null;
  error?: string | null;
};

/**
 * Registra el desenlace del intento, gane o pierda.
 *
 * SIEMPRE SUBE `alegra_attempts`, tambien cuando sale bien: el contador no es "cuantas veces fallo", es
 * cuantas veces se intento, y sin eso un error permanente (un item que no existe) se reintentaria para
 * siempre sin que nadie note el bucle.
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
      alegra_emitted_at     = case when ${r.estado} = 'emitida' and alegra_emitted_at is null
                                   then now() else alegra_emitted_at end,
      alegra_attempts       = alegra_attempts + 1,
      alegra_last_attempt_at = now(),
      alegra_last_error     = ${r.error ?? null},
      updated_at            = now()
    where id = ${txId}`);
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
       and alegra_invoice_state in ('pendiente', 'fallida')
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
       and (alegra_invoice_state is null or alegra_invoice_state <> 'emitida')`);
  return { total: Number(r?.total ?? 0), agotadas: Number(r?.agotadas ?? 0) };
}
