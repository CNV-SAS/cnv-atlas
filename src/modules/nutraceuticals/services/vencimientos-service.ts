import "server-only";

import * as Sentry from "@sentry/nextjs";

import { sendAvisoEmail } from "@/lib/email/resend";
import { destinatarios } from "@/modules/avisos/data/avisos-repository";

import * as repo from "../data/vencimientos-repository";
import { diaEnColombia, lotesQueAlertar, textoDelPlazo } from "../vencimientos";

// ═══ LA TAREA DIARIA DE VENCIMIENTOS (2026-09-28) ═══
//
// Genera el REGISTRO de la alerta de cada lote que entro en la ventana, y lo entrega: al Integrante que lo
// tiene en su vitrina, y a CNV en un resumen (incluida la bodega central, que no tiene a quien avisar).
//
// ── EL HAZARD QUE GOBIERNA ESTE ARCHIVO, y es la razon de que borre filas ──
//
// La fila de la alerta es lo que determina QUIEN ASUME un vencido. Si la fila se crea y el correo no sale, el
// registro afirma que se aviso a alguien que nunca se entero, y con ese registro se le podria cobrar. Asi que
// una alerta nueva cuyo correo falla SE BORRA: es de este mismo minuto, nadie la vio, y borrarla deja el
// estado honesto (no se aviso) y hace que el dia siguiente se reintente. Es lo contrario de lo habitual con
// los registros de este sistema, y la asimetria es a proposito: los movimientos de inventario son inmutables
// porque describen algo que PASO; esta fila describe un aviso que ENTREGAMOS, y si no se entrego, no paso.
//
// Nunca lanza hacia quien la llama: la dispara una tarea programada, y un fallo se registra en Sentry.

export type ResultadoDeVencimientos = {
  /** Alertas registradas ahora (no se cuentan las que ya existian de dias anteriores). */
  nuevas: number;
  /** Integrantes a los que salio correo. */
  integrantesAvisados: number;
  /** Si salio el resumen a CNV. */
  resumenACnv: boolean;
  /** Lo que no se pudo entregar, con su motivo, para que quede en la respuesta de la tarea. */
  problemas: string[];
};

function enlaceAMiInventario(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/mi-inventario`;
}

function enlaceANutraceuticos(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/nutraceuticos`;
}

type LoteAvisado = {
  producto: string;
  codigo: string;
  vence: string;
  unidades: number;
  plazo: string;
  vencido: boolean;
};

/** Una linea de lote, igual en el correo del Integrante y en el de CNV. */
function linea(l: LoteAvisado): string {
  return `  · ${l.producto} · lote ${l.codigo} · ${l.unidades} ${l.unidades === 1 ? "unidad" : "unidades"} · vence ${l.vence} (${l.plazo})`;
}

export async function avisarDeVencimientos(ahora: Date = new Date()): Promise<ResultadoDeVencimientos> {
  const problemas: string[] = [];
  let nuevas = 0;
  let integrantesAvisados = 0;

  const hoy = diaEnColombia(ahora);
  const dias = await repo.diasDeAlerta();
  const custodias = await repo.custodiasConLotes();

  // Lo nuevo de la bodega central y lo que ya estaba vencido en cualquier parte, para el resumen de CNV.
  const paraCnv: { donde: string; lotes: LoteAvisado[] }[] = [];

  for (const c of custodias) {
    const enVentana = lotesQueAlertar(c.lotes, hoy, dias);
    if (enVentana.length === 0) continue;

    // SIN CORREO NO SE REGISTRA LA ALERTA. Una fila que dice "se aviso" sobre una vitrina a la que no se le
    // puede escribir es la misma mentira que un correo que no sale, y esa fila desplazaria el vencido.
    const email = c.professionalEmail;
    if (c.professionalId != null && !email) {
      const aviso = `La vitrina "${c.locationName}" tiene ${enVentana.length} lote(s) por vencer y su profesional no tiene correo: no se pudo avisar ni registrar la alerta.`;
      problemas.push(aviso);
      Sentry.captureMessage(aviso, { level: "error", tags: { area: "vencimientos-sin-correo" } });
      continue;
    }

    const nuevosDeEstaUbicacion: { alertaId: string; lote: LoteAvisado }[] = [];
    for (const l of enVentana) {
      const a = await repo.registrarAlerta({
        lotId: l.lotId,
        locationId: c.locationId,
        nutraceuticalId: l.nutraceuticalId,
        professionalId: c.professionalId,
        expiresOn: l.vence,
        unitsAtAlert: l.unidades,
        daysAhead: dias,
      });
      if (a.esNueva) {
        nuevas++;
        nuevosDeEstaUbicacion.push({
          alertaId: a.id,
          lote: {
            producto: l.producto,
            codigo: l.codigo,
            vence: l.vence,
            unidades: l.unidades,
            plazo: textoDelPlazo(l),
            vencido: l.estado === "vencido",
          },
        });
      }
    }

    // LA BODEGA CENTRAL no tiene a quien avisarle: va entera en el resumen de CNV, tambien lo que ya se
    // avisó antes, porque ahi nadie recibe un correo propio que se lo recuerde.
    if (c.professionalId == null) {
      paraCnv.push({
        donde: c.locationName,
        lotes: enVentana.map((l) => ({
          producto: l.producto,
          codigo: l.codigo,
          vence: l.vence,
          unidades: l.unidades,
          plazo: textoDelPlazo(l),
          vencido: l.estado === "vencido",
        })),
      });
      continue;
    }

    if (nuevosDeEstaUbicacion.length === 0 || !email) continue;

    const nombre = c.professionalName ?? "";
    const hayVencido = nuevosDeEstaUbicacion.some((n) => n.lote.vencido);
    const cuerpo = [
      `Hola, ${nombre}.`,
      "",
      hayVencido
        ? "Tienes producto de CNV vencido o por vencer en tu vitrina:"
        : "Tienes producto de CNV que se acerca a su fecha de vencimiento:",
      "",
      ...nuevosDeEstaUbicacion.map((n) => linea(n.lote)),
      "",
      // LA CONSECUENCIA SE DICE, y es la razon de que este correo exista. Sin esta frase el aviso es un dato
      // curioso; con ella es lo que le permite evitar un cargo.
      "Véndelos primero. El producto no vendido que se vence lo asume CNV, salvo que hayas recibido este aviso y no hayas actuado: en ese caso se te cobra al precio de facturación, igual que un faltante.",
      "",
      "Si no vas a poder venderlos, escríbele a CNV para devolverlos antes de que venzan.",
      "",
      `Los ves en Atlas, en Mi inventario: ${enlaceAMiInventario()}`,
    ].join("\n");

    const asunto = hayVencido
      ? "Atlas · Tienes producto vencido o a punto de vencer"
      : "Atlas · Producto de CNV cerca de su vencimiento";
    // La clave lleva los ids de las alertas nuevas: un reintento del mismo aviso no duplica, y un aviso con
    // lotes distintos si sale (la leccion de la clave de envio del Bloque A).
    const clave = `vencimientos:${nuevosDeEstaUbicacion.map((n) => n.alertaId).sort().join(",")}`;
    const r = await sendAvisoEmail([email], asunto, cuerpo, clave);
    if (r.ok) {
      integrantesAvisados++;
      paraCnv.push({ donde: `${nombre} (${c.locationName})`, lotes: nuevosDeEstaUbicacion.map((n) => n.lote) });
    } else {
      // SE BORRAN LAS FILAS NUEVAS (ver la cabecera): el aviso no se entrego, asi que el registro no puede
      // decir que si. Las de dias anteriores no se tocan.
      for (const n of nuevosDeEstaUbicacion) await repo.borrarAlertaNoEntregada(n.alertaId);
      nuevas -= nuevosDeEstaUbicacion.length;
      const aviso = `No salió el aviso de vencimiento a ${nombre}: ${r.error.message}. Se borraron ${nuevosDeEstaUbicacion.length} alerta(s) recién creadas para no afirmar que se avisó.`;
      problemas.push(aviso);
      Sentry.captureMessage(aviso, { level: "error", tags: { area: "vencimientos" } });
    }
  }

  let resumenACnv = false;
  if (paraCnv.length > 0) {
    // SE REUSA LA MARCA DE "pendientes_ventas" y no se crea una nueva, a proposito: una marca nueva no la
    // tiene nadie el dia que se despliega, y un control sin destinatario es lo mismo que no tenerlo (ya pasó
    // con los avisos de ventas). Si mas adelante conviene separarlo, es una marca y una fila.
    const para = await destinatarios("pendientes_ventas");
    if (para.length === 0) {
      problemas.push("Nadie tiene la marca para recibir el resumen de vencimientos.");
      Sentry.captureMessage("Hay vencimientos y NADIE tiene la marca para recibirlos", {
        level: "error",
        tags: { area: "vencimientos-sin-destinatario" },
      });
    } else {
      const cuerpo = [
        "Lotes vencidos o por vencer, con producto de CNV todavía en existencia.",
        "",
        ...paraCnv.flatMap((g) => [`── ${g.donde} ──`, ...g.lotes.map(linea), ""]),
        "Lo que está en vitrina de un Integrante ya le llegó a él con la consecuencia dicha. Lo de la bodega central no le llega a nadie más: es de CNV.",
        "",
        `Quién asume cada vencido se ve en Atlas, en Nutracéuticos: ${enlaceANutraceuticos()}`,
      ].join("\n");
      const total = paraCnv.reduce((n, g) => n + g.lotes.length, 0);
      const r = await sendAvisoEmail(
        para,
        `Atlas · ${total} lote${total === 1 ? "" : "s"} vencido${total === 1 ? "" : "s"} o por vencer`,
        cuerpo,
        `vencimientos-cnv:${hoy}`,
      );
      if (r.ok) resumenACnv = true;
      else {
        problemas.push(`No salió el resumen de vencimientos a CNV: ${r.error.message}`);
        Sentry.captureMessage(`No salió el resumen de vencimientos a CNV: ${r.error.message}`, {
          level: "error",
          tags: { area: "vencimientos" },
        });
      }
    }
  }

  return { nuevas, integrantesAvisados, resumenACnv, problemas };
}
