import "server-only";

import * as Sentry from "@sentry/nextjs";

import { HttpError } from "@/core/http/http-error";

import {
  buscarFacturaPorReferencia,
  createAlegraContact,
  createAlegraInvoice,
  createAlegraPayment,
  findAlegraContactByDocument,
  getAlegraInvoice,
  type AlegraInvoiceResult,
} from "@/lib/alegra/client";
import {
  armarFactura,
  cuentaDelPago,
  desgloseDeLaVenta,
  fechaEnColombia,
  motivoSiPacienteYAmbienteNoCuadran,
  pudoHaberseCreado,
  rangoDeBusqueda,
  referenciaDeVenta,
} from "../facturacion";
import * as fr from "../data/facturacion-repository";
import { motivoSiLaVentaNoEsDeEsteAmbiente } from "../ambiente";
import { codigoAlegraDelPago } from "../medio-de-pago";

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

// La fecha de la factura es la de HOY EN COLOMBIA. Era UTC, y una venta despues de las 7 de la noche salia
// con la fecha del dia siguiente.
function hoy(): string {
  return fechaEnColombia();
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

  // SEGUNDA LINEA DEL GUARD. La primera va en `emitirFacturaDeVenta`, antes del reclamo, para no gastar
  // intentos. Esta se queda porque `resolverContacto` tambien la llama `completarFactura`, y es la ultima
  // puerta antes de la primera llamada que lleva PII: una vez creado el contacto, el dato ya salio.
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
 * Registra el pago de una factura si todavia tiene saldo. Devuelve el id del pago o el motivo del fallo.
 *
 * EL SALDO LO DICE ALEGRA, no Atlas. Si el pago se registro y el desenlace no llego a escribirse (el proceso
 * murio entre las dos llamadas), Atlas creeria que falta y lo registraria DOS VECES. La unica fuente que no
 * puede equivocarse sobre si una factura esta pagada es la factura.
 */
export const PAGADA_SIN_ID = "pagada-en-alegra";

async function registrarPagoSiFalta(
  clientId: number,
  factura: { id: string; balance: number | null },
  cobrado: number,
  cuenta: number,
  fecha: string,
): Promise<{ paymentId: string | null; error: string | null }> {
  // YA ESTA PAGADA segun Alegra, pero Atlas no tiene el id (la respuesta de la factura no trae sus pagos).
  // Se marca con un valor que dice exactamente eso en vez de dejarlo nulo: nulo significa "falta el
  // pago", y la cola lo reintentaria hasta agotar los intentos contra una factura que ya estaba bien.
  if (factura.balance !== null && factura.balance <= 0) return { paymentId: PAGADA_SIN_ID, error: null };
  try {
    const pago = await createAlegraPayment({
      clientId,
      invoiceId: factura.id,
      // BRUTO. La comision de la pasarela es gasto de CNV: restarla haria que la factura dijera que el
      // paciente pago menos de lo que pago.
      amount: cobrado,
      date: fecha,
      bankAccountId: cuenta,
    });
    return { paymentId: pago.id, error: null };
  } catch (e) {
    // EL ERROR DEL PAGO SE ESCRIBE, y hasta el 2026-09-12 solo iba a Sentry. Con eso se diagnostico el
    // campo `bankAccount` en vez de `account`, que tumbo los seis pagos del smoke.
    Sentry.captureException(e, { tags: { area: "alegra-pago", invoiceId: factura.id } });
    return { paymentId: null, error: `Factura OK, PAGO NO REGISTRADO: ${motivoLegible(e)}` };
  }
}

/**
 * Completa una factura QUE YA EXISTE: relee su estado, guarda el CUFE si ya llego y registra el pago si
 * falta.
 *
 * ── POR QUE ESTO NO PUEDE SER "volver a emitir" ─────────────────────────────────────────────────
 *
 * Es el camino del reintento sobre una venta que quedo `emitida_sin_sellar` o con el pago fallido. Si
 * llamara otra vez a `createAlegraInvoice`, saldria una SEGUNDA factura del mismo hecho, con su propio
 * consecutivo. Deshacer eso es una nota credito y un hueco en la numeracion.
 *
 * La regla, entonces: si la venta YA tiene id de factura, NUNCA se crea otra. Se relee y se completa.
 */
async function completarFactura(
  venta: VentaSellada,
  invoiceId: string,
  mapa: Parameters<typeof cuentaDelPago>[1],
): Promise<void> {
  const factura = await getAlegraInvoice(invoiceId);
  const cufe = factura.stamp?.cufe ?? null;
  const cobrado = Math.round(Number(venta.amount));
  const cuenta = cuentaDelPago(venta.canal, mapa);

  let pago: { paymentId: string | null; error: string | null } = { paymentId: null, error: null };
  if (cuenta) {
    const clientId = await resolverContacto(venta.patientId!, mapa.env);
    pago = await registrarPagoSiFalta(clientId, factura, cobrado, cuenta, hoy());
  }

  await fr.registrarIntentoDeFactura(venta.id, {
    estado: factura.estado === "draft" ? "borrador" : cufe ? "emitida" : "emitida_sin_sellar",
    invoiceId: factura.id,
    alegraEnv: mapa.env,
    numero: factura.numero,
    cufe,
    legalStatus: factura.stamp?.legalStatus ?? null,
    paymentId: pago.paymentId,
    error:
      pago.error ??
      (cufe ? null : "Numerada sin sellar ante la DIAN (sin CUFE). La cola vuelve a leerla."),
  });
}

/**
 * ADOPTA una factura que ya existe en Alegra para esta venta: guarda su id y la completa (CUFE y pago).
 *
 * Es el desenlace de encontrarla por su referencia. Se escribe PRIMERO el id, que es lo irreversible: si el
 * proceso muriera durante el pago, el reintento ya la tiene y no la busca ni la crea otra vez.
 */
async function adoptarFactura(
  venta: VentaSellada,
  existente: AlegraInvoiceResult,
  mapa: Parameters<typeof cuentaDelPago>[1],
): Promise<void> {
  await fr.registrarIntentoDeFactura(venta.id, {
    estado: existente.estado === "draft" ? "borrador" : existente.stamp?.cufe ? "emitida" : "emitida_sin_sellar",
    invoiceId: existente.id,
    alegraEnv: mapa.env,
    numero: existente.numero,
    cufe: existente.stamp?.cufe ?? null,
    legalStatus: existente.stamp?.legalStatus ?? null,
    error: `Factura ${existente.numero ?? existente.id} encontrada en Alegra por su referencia y adoptada: no se emitió otra.`,
  });
  await completarFactura(venta, existente.id, mapa);
}

/**
 * Emite la factura de una venta ya pagada y registra su pago.
 *
 * ── LA IDEMPOTENCIA ES REAL DESDE EL 2026-09-12, Y ANTES ERA SOLO UNA FRASE ─────────────────────
 *
 * Esta nota decia "idempotente por el estado: si ya esta emitida, no hace nada", Y NO HABIA NINGUNA
 * COMPROBACION en el codigo. Era un texto que afirmaba una garantia sin derivarla, escrito por mi al
 * crear la funcion. Se cierra con dos piezas, porque una sola no basta:
 *
 *   1. UN RECLAMO (`reclamarParaFacturar`): un UPDATE condicional con arriendo. Dos pulsaciones del boton
 *      o dos webhooks a la vez no pueden pasar los dos; Postgres serializa y el segundo no encuentra fila.
 *      Un `if` no habria servido: las dos llamadas leen el estado antes de que ninguna lo cambie.
 *   2. Y NO CREAR SEGUNDA FACTURA: si la venta ya tiene id de factura, se RELEE y se completa. Crear otra
 *      daria un segundo consecutivo del mismo hecho, y deshacerlo es una nota credito y un hueco en la
 *      numeracion.
 *
 * ── Y AUN ASI ERA INCOMPLETA: FALTABA UNA TERCERA PIEZA (2026-09-14) ──────────────────────────────
 *
 * Las dos de arriba cubrian los intentos simultaneos y los reintentos DESPUES de guardar el id. No cubrian el
 * caso que ocurrio en el smoke del Bloque 3: Alegra EMITIO la factura, la respuesta no llego a tiempo, la venta
 * quedo fallida SIN id, y un reintento habria emitido una segunda. Decir "idempotencia real" era quedarse corto:
 * cubria los casos que se pensaron, no el que paso.
 *
 *   3. BUSCAR ANTES DE EMITIR: la factura lleva la referencia de la venta, y antes de emitir (y otra vez si la
 *      emision se corta sin respuesta) se busca en Alegra. Si existe, se ADOPTA.
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

    // ── LAS DOS DECISIONES VAN ANTES DEL RECLAMO, y el orden es el que cumple lo pedido ──────────
    //
    // El reclamo SUBE el contador de intentos. Si las decisiones fueran despues, cada pulsacion del boton
    // le gastaria un intento a una venta cuyo resultado no puede cambiar, y a los cinco el panel diria
    // "agotados", que se lee como que algo se rindio. Evaluadas antes, se re-evaluan en cada reintento SIN
    // COSTE: si el paciente se marca de prueba o cambia el ambiente, la venta sale sola de `rechazada`.
    //
    // 1. EL AMBIENTE, que va primero porque es la que protege a produccion: un pago de prueba nunca se
    //    factura en produccion, y una factura de un ambiente nunca se relee en el otro.
    const ambiente = await fr.getAmbienteDeVenta(venta.id);
    const motivoAmbiente = ambiente
      ? motivoSiLaVentaNoEsDeEsteAmbiente(ambiente, mapa.env)
      : "La venta no existe.";
    if (motivoAmbiente) {
      await fr.registrarIntentoDeFactura(venta.id, { estado: "rechazada", error: motivoAmbiente });
      return;
    }

    // 2. EL PACIENTE: uno real no viaja al sandbox, y uno de prueba no se factura en produccion.
    const datos = await fr.getDatosDelContacto(venta.patientId);
    const motivoPaciente = datos
      ? motivoSiPacienteYAmbienteNoCuadran(datos.esDePrueba, mapa.env)
      : "El paciente de la venta no existe.";
    if (motivoPaciente) {
      await fr.registrarIntentoDeFactura(venta.id, { estado: "rechazada", error: motivoPaciente });
      return;
    }

    // Y AHORA SI EL RECLAMO: lo que protege es el derecho a INTENTAR, y a esta altura ya se sabe que se
    // puede. Dos pulsaciones o dos webhooks a la vez no pasan los dos.
    if (!(await fr.reclamarParaFacturar(venta.id))) return;

    // SI YA HAY FACTURA, no se crea otra: se completa. Es el camino del reintento.
    const yaHecha = await fr.getFacturaDeVenta(venta.id);
    if (yaHecha?.invoiceId) {
      await completarFactura(venta, yaHecha.invoiceId, mapa);
      return;
    }

    const lineas = await fr.getLineasDeVenta(venta.id, mapa.env);
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

    // EL MEDIO DE PAGO viaja solo si su codigo de Alegra esta VERIFICADO. Si no, la factura sale "no
    // definido" como hasta hoy: el campo es informativo, y un codigo que Alegra no reconozca podria
    // rechazar la factura entera.
    const instrumento = await fr.getInstrumentoDeVenta(venta.id);
    const paymentMethod = codigoAlegraDelPago({ canal: venta.canal, ...instrumento });

    // ── 3. BUSCAR ANTES DE EMITIR ─────────────────────────────────────────────────────────────────
    //
    // Un intento anterior pudo haberla emitido sin que llegara la respuesta. Si esta, se adopta.
    const referencia = referenciaDeVenta(venta.id);
    const rango = rangoDeBusqueda(fecha);
    const previa = await buscarFacturaPorReferencia({ clientId, referencia, ...rango });
    if (previa) {
      await adoptarFactura(venta, previa, mapa);
      return;
    }

    let factura: AlegraInvoiceResult;
    try {
      factura = await createAlegraInvoice({
        clientId,
        referencia,
        items: armado.lineas,
        date: fecha,
        dueDate: fecha,
        numberTemplateId: Number(mapa.invoiceTemplateId),
        ...(armado.costCenterId ? { costCenterId: armado.costCenterId } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        emitir: true,
      });
    } catch (e) {
      // UN 4xx ES UN RECHAZO: Alegra no creo nada, y el error es el de siempre.
      if (!pudoHaberseCreado(e)) throw e;
      // CUALQUIER OTRO (corte por tiempo, red, 5xx) ES DESCONOCIDO. Se busca una vez ahora; si ya aparece, se
      // adopta. Si todavia no (Alegra puede tardar en dejarla visible), la venta queda fallida con un motivo
      // que dice exactamente eso, y el reintento vuelve a buscar antes de emitir.
      const tras = await buscarFacturaPorReferencia({ clientId, referencia, ...rango }).catch(() => null);
      if (tras) {
        await adoptarFactura(venta, tras, mapa);
        return;
      }
      throw new Error(
        `No se supo si Alegra emitió la factura (${motivoLegible(e)}). No se emite otra: el reintento la busca por su referencia antes de emitir.`,
      );
    }

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

    // TRES ESTADOS, no dos, y la factura 7 enseño por que: salio `open` con su consecutivo y con `stamp`
    // NULO. Numerada y sin sellar ante la DIAN. Guardarla como `emitida` decia "listo" sobre algo a
    // medias, y un estado que dice listo es peor que uno que dice fallida, porque nadie vuelve a mirarlo.
    const cufe = sellada.stamp?.cufe ?? null;
    const estado =
      sellada.estado === "draft" ? "borrador" : cufe ? "emitida" : "emitida_sin_sellar";
    await fr.registrarIntentoDeFactura(venta.id, {
      estado,
      invoiceId: sellada.id,
      alegraEnv: mapa.env,
      numero: sellada.numero,
      cufe,
      legalStatus: sellada.stamp?.legalStatus ?? null,
      // El motivo no es un fallo: es lo que falta. Sin esto, una factura sin CUFE se ve igual que una
      // completa en la unica columna que alguien mira.
      error: cufe ? null : "Numerada sin sellar ante la DIAN (sin CUFE). La cola vuelve a leerla.",
    });

    // EL PAGO VA DESPUES DE ESE REGISTRO, y el orden es el que importa: la factura ya existe en Alegra, y
    // si el proceso muere durante el pago, el id TIENE que estar guardado o el reintento crearia una
    // segunda factura. Se escribe primero lo irreversible.
    const cuenta = cuentaDelPago(venta.canal, mapa);
    if (cuenta) {
      const pago = await registrarPagoSiFalta(clientId, sellada, cobrado, cuenta, fecha);
      // Se escribe SIEMPRE, no solo al fallar: el id del pago es lo que saca la venta de la cola. Sin
      // escribirlo en el exito, una venta bien pagada seguiria figurando como "le falta el pago".
      await fr.registrarIntentoDeFactura(venta.id, {
        estado,
        paymentId: pago.paymentId,
        error:
          pago.error ??
          (cufe ? null : "Numerada sin sellar ante la DIAN (sin CUFE). La cola vuelve a leerla."),
      });
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
