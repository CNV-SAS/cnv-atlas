import "server-only";

import * as Sentry from "@sentry/nextjs";

import { HttpError } from "@/core/http/http-error";

import {
  createAlegraContact,
  createAlegraInvoice,
  createAlegraPayment,
  findAlegraContactByDocument,
  getAlegraInvoice,
} from "@/lib/alegra/client";
import {
  armarFactura,
  cuentaDelPago,
  desgloseDeLaVenta,
  motivoSiPacienteYAmbienteNoCuadran,
} from "../facturacion";
import * as fr from "../data/facturacion-repository";

// ═══ EMITIR LA FACTURA DE VERDAD, Y REGISTRAR SU PAGO ═══
//
// Sustituye a `tryCreateAlegraInvoice`, que mandaba a Alegra el MISMO cliente para todo paciente, UN item
// generico con cantidad 1 y el total como precio, y la dejaba en BORRADOR (nunca `status:'open'`). No era
// una factura mal hecha: no era una factura, porque sin consecutivo no hay documento fiscal.
//
// ── EL ORDEN DE LOS PASOS, que no es casual ─────────────────────────────────────────────────────
//
//   1. Se ARMA y se VALIDA todo antes de la primera llamada. Lo que se rechaza aqui son cosas que Alegra
//      ACEPTARIA, produciendo un documento valido y equivocado; despues de emitir, corregirlo es una nota
//      credito y otra factura.
//   2. Contacto (buscar o crear). Va antes de la factura porque la factura lo necesita, y buscar primero
//      es obligatorio: Alegra RECHAZA un documento repetido, asi que el paciente que vuelve rompe el
//      flujo si se intenta crear a ciegas.
//   3. Factura, emitida.
//   4. Pago. VA DESPUES y en su propio try: si el pago falla, la factura YA existe y volver a emitirla
//      duplicaria el documento. Una factura emitida sin pago registrado es un problema contable que se ve
//      y se arregla; dos facturas del mismo hecho, no.
//
// ── QUE PASA SI ALGO FALLA ──────────────────────────────────────────────────────────────────────
//
// Nada revienta el webhook: el pago del paciente YA se sello y responder != 200 haria que Wompi reenviara
// un evento que no cambia nada. El desenlace se ESCRIBE en la transaccion (estado, intento, motivo), que
// es lo que la pone en la cola. Antes solo iba a Sentry y nadie volvia a mirarla.

const MAX_INTENTOS = 5;

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * El motivo que se guarda en la transaccion, CON LO QUE DIJO EL PROVEEDOR.
 *
 * ── POR QUE EXISTE (2026-09-12, primer smoke del Bloque 2a) ─────────────────────────────────────
 *
 * La primera venta real fallo y `alegra_last_error` decia, entero:
 *
 *     HTTP 400 en POST https://sandbox.alegra.com:26967/api/v1/contacts
 *
 * Eso dice DONDE fallo y no dice POR QUE, que es justo lo que hacia falta. Y el porque estaba a mano:
 * `fetchJson` construye un `HttpError` que YA LLEVA el cuerpo de la respuesta en `.body`, con el mensaje
 * de validacion de Alegra dentro. Lo perdiamos al persistir, porque se guardaba solo `.message`.
 *
 * Es la forma mas cara de fallar: el sistema externo explica el error, nosotros lo recibimos, y lo
 * tiramos antes de escribirlo. El siguiente intento habria dado exactamente la misma linea inutil.
 */
export function motivoLegible(e: unknown): string {
  if (e instanceof HttpError) {
    // El cuerpo puede ser objeto (lo normal) o texto (una pagina de error del proveedor).
    const detalle = typeof e.body === "string" ? e.body : JSON.stringify(e.body ?? {});
    return `${e.message} -> ${detalle}`;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Lo que se necesita de la venta ya sellada. */
export type VentaSellada = {
  id: string;
  amount: string;
  patientId: string | null;
  canal: "wompi" | "efectivo";
};

/**
 * Resuelve el contacto del paciente en Alegra: el suyo si ya lo tiene, el que exista con su documento, o
 * uno nuevo.
 *
 * SOLO VIAJAN NOMBRE, DOCUMENTO Y CORREO (principio 7 del modelo: a la contabilidad solo van datos de
 * identificacion). Ni diagnostico, ni evaluacion, ni nada clinico.
 */
async function resolverContacto(patientId: string, env: string): Promise<number> {
  const datos = await fr.getDatosDelContacto(patientId);
  if (!datos) throw new Error("El paciente de la venta no existe.");

  // EL GUARD VA AQUI, antes de la primera llamada que lleva PII: una vez creado el contacto, el dato ya
  // salio y borrarlo despues no lo devuelve.
  const motivo = motivoSiPacienteYAmbienteNoCuadran(datos.esDePrueba, env);
  if (motivo) throw new Error(motivo);

  // El id guardado solo sirve si es de ESTE ambiente. Uno de sandbox no existe en produccion, y usarlo
  // facturaria contra un contacto inexistente o, peor, contra otro que por casualidad tenga ese id.
  if (datos.alegraContactId && datos.alegraEnv === env) return Number(datos.alegraContactId);

  const existente = await findAlegraContactByDocument(datos.documento);
  if (existente) {
    await fr.setContactoDeAlegra(patientId, existente.id, env);
    return Number(existente.id);
  }

  const creado = await createAlegraContact({
    // Sin nombre no se deja de facturar: la factura la exige la ley y el documento identifica al
    // adquirente igual. Se usa un rotulo con el documento, que es verdadero y visible.
    nombres: datos.nombres ?? "Paciente",
    apellidos: datos.apellidos ?? datos.documento,
    documento: datos.documento,
    tipoDocumento: datos.tipoDocumento,
    correo: datos.correo,
    // EL TIPO DE PERSONA SALE DEL TIPO DE DOCUMENTO, no de un valor fijo. Un NIT es una persona
    // JURIDICA; una cedula, una natural. Hoy todos los pacientes son personas naturales, pero poner
    // "PERSON_ENTITY" a secas seria cierto por casualidad, y dejaria de serlo el dia que CNV le facture a
    // una empresa sin que nada avise.
    tipoDePersona: datos.tipoDocumento === "NIT" ? "LEGAL_ENTITY" : "PERSON_ENTITY",
    // Y EL REGIMEN: un paciente es consumidor final, no responsable de IVA. Si algun dia se factura a un
    // responsable, sale de su perfil tributario, no de aqui.
    regimen: "SIMPLIFIED_REGIME",
  });
  await fr.setContactoDeAlegra(patientId, creado.id, env);
  return Number(creado.id);
}

/**
 * Emite la factura de una venta ya pagada y registra su pago.
 *
 * Idempotente por el estado: si ya esta `emitida`, no hace nada. Es lo que impide que un reintento de la
 * cola, o un webhook reenviado, emitan el documento dos veces.
 */
export async function emitirFacturaDeVenta(venta: VentaSellada): Promise<void> {
  try {
    const mapa = await fr.getMapaDeAlegra();
    if (!mapa) {
      await fr.registrarIntentoDeFactura(venta.id, {
        estado: "fallida",
        error: `No hay configuración de Alegra para el ambiente ${fr.ambienteDeAlegra()}.`,
      });
      return;
    }

    if (!venta.patientId) {
      await fr.registrarIntentoDeFactura(venta.id, {
        estado: "fallida",
        error: "La venta no tiene paciente, y la factura tiene que identificar al adquirente.",
      });
      return;
    }

    const lineas = await fr.getLineasDeVenta(venta.id);
    const armado = armarFactura(lineas, mapa);
    if (!armado.ok) {
      // NO SE LLAMA A ALEGRA. Es el punto del bloque: lo que se rechaza aqui saldria validado y mal.
      await fr.registrarIntentoDeFactura(venta.id, { estado: "fallida", error: armado.motivo });
      return;
    }

    // COTEJO DE IMPORTES antes de emitir: lo que se le cobro al paciente contra lo que va a decir la
    // factura. Si no coinciden, el pago registrado no cuadraria con el documento, y esa diferencia hay que
    // verla ahora y no en el cierre del mes.
    const desglose = desgloseDeLaVenta(lineas);
    const cobrado = Math.round(Number(venta.amount));
    if (desglose.total !== cobrado) {
      await fr.registrarIntentoDeFactura(venta.id, {
        estado: "fallida",
        error: `Lo cobrado (${cobrado}) no coincide con las líneas de la venta (${desglose.total}). No se emite hasta saber por qué.`,
      });
      return;
    }

    const clientId = await resolverContacto(venta.patientId, mapa.env);
    const fecha = hoy();

    const factura = await createAlegraInvoice({
      clientId,
      items: armado.lineas,
      date: fecha,
      dueDate: fecha,
      numberTemplateId: Number(mapa.invoiceTemplateId),
      ...(armado.costCenterId ? { costCenterId: armado.costCenterId } : {}),
      emitir: true,
    });

    // EL SELLADO ANTE LA DIAN ES ASINCRONO: la respuesta puede volver sin CUFE. Se relee una vez, que es
    // lo que permite tener el CUFE sin construir un webhook. Si sigue sin venir, la factura esta emitida
    // igual (ya tiene consecutivo) y el CUFE lo completa el barrido de la cola.
    let sellada = factura;
    if (!factura.stamp?.cufe && factura.id) {
      try {
        sellada = await getAlegraInvoice(factura.id);
      } catch {
        // Releer es una mejora, no un requisito: si falla, se guarda lo que ya se sabe.
      }
    }

    await fr.registrarIntentoDeFactura(venta.id, {
      estado: sellada.estado === "draft" ? "borrador" : "emitida",
      invoiceId: sellada.id,
      numero: sellada.numero,
      cufe: sellada.stamp?.cufe ?? null,
      error: null,
    });

    // EL PAGO, en su propio try. Si falla, la factura YA existe: reintentar la emision duplicaria el
    // documento, y eso es peor que una factura sin pago registrado, que se ve en el reporte y se arregla.
    const cuenta = cuentaDelPago(venta.canal, mapa);
    if (cuenta && sellada.id) {
      try {
        await createAlegraPayment({
          clientId,
          invoiceId: sellada.id,
          // BRUTO. La comision de la pasarela es gasto de CNV: restarla haria que la factura dijera que
          // el paciente pago menos de lo que pago.
          amount: cobrado,
          date: fecha,
          bankAccountId: cuenta,
        });
      } catch (e) {
        Sentry.captureException(e, {
          tags: { area: "alegra-pago", transactionId: venta.id, invoiceId: sellada.id },
        });
      }
    }
  } catch (e) {
    const motivo = motivoLegible(e);
    await fr
      .registrarIntentoDeFactura(venta.id, { estado: "fallida", error: motivo.slice(0, 500) })
      .catch(() => {
        // Si ni siquiera se puede registrar el fallo, queda Sentry. No se traga el error original.
      });
    Sentry.captureException(e, { tags: { area: "alegra-factura", transactionId: venta.id } });
  }
}

/**
 * Barre la cola: las ventas pagadas sin factura emitida que aun no agotaron reintentos.
 *
 * La cola es una CONSULTA sobre `transactions`, no una tabla. Lo que agota el tope no desaparece: se
 * queda en `fallida` con su motivo, y sale en el reporte de ventas sin documento fiscal, que es donde
 * tiene que verse.
 */
export async function reintentarFacturasPendientes(): Promise<{ intentadas: number }> {
  const pendientes = await fr.listarFacturasPendientes(MAX_INTENTOS);
  for (const p of pendientes) {
    const venta = await fr.getVentaParaFacturar(p.id);
    if (venta) await emitirFacturaDeVenta(venta);
  }
  return { intentadas: pendientes.length };
}
