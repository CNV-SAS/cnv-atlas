import "server-only";

import * as Sentry from "@sentry/nextjs";

import { ambienteDeLaLlave, listarTransacciones } from "@/lib/wompi/client";

import { cotejar, type Discrepancia } from "../conciliacion";
import * as repo from "../data/conciliacion-repository";
import { markWebhookProcessed, recordWebhookEvent } from "../data/payments-writer";
import { aplicarPagoAprobado } from "./payments-service";
import { abrirPorAnulacionDeWompi } from "./reversas-service";

// ═══ EL COTEJO CON WOMPI (Bloque 3b, sesion 3) ═══
//
// EL HUECO: Wompi reintenta su webhook 3 veces en 24 horas y despues no lo intenta mas. Si Atlas no pudo
// responder durante esa ventana, esa venta queda cobrada y sin sellar: sin factura, sin comision, sin inventario
// descontado y sin que nadie se entere. Paso el 2026-09-15 con la base saturada, con plata de prueba; en
// produccion es plata cobrada que Atlas no ve.
//
// COMO SE RECUPERA, SIN ABRIR UNA SEGUNDA PUERTA: se sella por la MISMA ruta del webhook (`aplicarPagoAprobado`)
// y se anota el MISMO evento (`<wompiId>:APPROVED`), asi que si el webhook llega tarde no vuelve a aplicar nada.
// El cotejo no sabe sellar: solo sabe a quien preguntarle.
//
// Y LO QUE NO HACE: no revierte nada. Si Wompi dice VOIDED sobre una venta que Atlas tiene pagada, lo deja
// anotado y avisa; revertir es la sesion 1.

const PROVEEDOR = "wompi";
const DIAS_POR_DEFECTO = 3;

export type ResultadoDelCotejo = {
  ambiente: "test" | "produccion";
  revisadas: number;
  recuperadas: string[];
  yaEstaban: number;
  discrepancias: Discrepancia[];
  /** Las ventas para las que el cotejo abrio un caso de contracargo o anulacion. */
  reversasAbiertas: string[];
  falloPor: string | null;
};

export async function cotejarConWompi(opciones?: {
  dias?: number;
  origen?: "tarea" | "manual";
  actorId?: string | null;
}): Promise<ResultadoDelCotejo> {
  const dias = opciones?.dias ?? DIAS_POR_DEFECTO;
  const origen = opciones?.origen ?? "tarea";
  const actorId = opciones?.actorId ?? null;
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - dias * 86_400_000);

  const ambiente = ambienteDeLaLlave();
  if (!ambiente) {
    const falloPor = "Falta WOMPI_PRIVATE_KEY: sin ella no se puede preguntar a Wompi.";
    Sentry.captureMessage(falloPor, { level: "error", tags: { area: "cotejo-wompi" } });
    return { ambiente: "test", revisadas: 0, recuperadas: [], yaEstaban: 0, discrepancias: [], reversasAbiertas: [], falloPor };
  }

  const vacio = { ambiente, revisadas: 0, recuperadas: [] as string[], yaEstaban: 0, discrepancias: [] as Discrepancia[], reversasAbiertas: [] as string[] };
  const ventas = await repo.ventasParaCotejar(desde, ambiente);
  if (ventas.length === 0) {
    await repo.registrarCorrida({ desde, hasta, ambiente, origen, actorId, revisadas: 0, recuperadas: [], discrepancias: [], falloPor: null });
    return { ...vacio, falloPor: null };
  }

  const traidas = await listarTransacciones(desde, hasta);
  if (!traidas.ok) {
    // NO es un fallo silencioso: si el cotejo no puede preguntar, el hueco sigue abierto y alguien tiene que
    // saberlo. La corrida queda escrita con su motivo.
    Sentry.captureMessage(`El cotejo con Wompi no pudo consultar: ${traidas.error.message}`, {
      level: "error",
      tags: { area: "cotejo-wompi" },
    });
    await repo.registrarCorrida({
      desde,
      hasta,
      ambiente,
      origen,
      actorId,
      revisadas: ventas.length,
      recuperadas: [],
      discrepancias: [],
      falloPor: traidas.error.message.slice(0, 300),
    });
    return { ...vacio, revisadas: ventas.length, falloPor: traidas.error.message };
  }

  const { recuperar, discrepancias } = cotejar(ventas, traidas.value);
  const recuperadas: string[] = [];
  let yaEstaban = 0;

  for (const r of recuperar) {
    // LA MISMA LLAVE QUE EL WEBHOOK: si el webhook llega despues (o llego y nadie lo vio), no se aplica dos veces.
    const evento = await recordWebhookEvent(PROVEEDOR, `${r.wompiId}:APPROVED`, {
      origen: "cotejo",
      transactionId: r.ventaId,
      wompiTransactionId: r.wompiId,
    });
    if (!evento.isNew && evento.alreadyProcessed) {
      yaEstaban++;
      continue;
    }
    try {
      const sellada = await aplicarPagoAprobado({
        txId: r.ventaId,
        wompiTxId: r.wompiId,
        metodo: r.metodo,
        tipoDeTarjeta: r.tipoDeTarjeta,
        ambienteDelEvento: ambiente === "produccion" ? "prod" : "test",
        alSellar: () => markWebhookProcessed(PROVEEDOR, `${r.wompiId}:APPROVED`),
      });
      if (sellada) {
        recuperadas.push(r.ventaId);
        // CADA RECUPERACION ES UN DEFECTO, no una rutina: significa que un webhook se perdio. Si empiezan a
        // aparecer seguido, el problema esta en Atlas o en la red, y hay que mirarlo.
        Sentry.captureMessage("El cotejo recuperó un pago que Wompi aprobó y cuyo webhook no llegó", {
          level: "warning",
          tags: { area: "cotejo-wompi", transactionId: r.ventaId },
        });
      } else {
        yaEstaban++;
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { area: "cotejo-wompi", transactionId: r.ventaId } });
      discrepancias.push({ ventaId: r.ventaId, wompiId: r.wompiId, motivo: "Falló al sellarla; ver Sentry." });
    }
  }

  const reversasAbiertas: string[] = [];
  // Las que ya tenian su caso abierto: se siguen mostrando en pantalla, pero NO se vuelven a alertar. El cotejo
  // corre cada dia y las ve otra vez hasta que alguien las resuelva; alertar cada vez hace crecer el error hasta
  // que deja de significar algo (Santiago, 2026-09-18).
  const yaAvisadas = new Set<string>();
  for (const d of discrepancias) {
    // SI WOMPI DA POR ANULADA UNA VENTA QUE AQUI ESTA PAGADA, se abre la reversa (Bloque 3b, sesion 1). Esta es
    // la via que sirve cuando el aviso de Wompi NO llego, que es SIEMPRE para las anulaciones: el smoke del
    // 2026-09-17 confirmo que Wompi no manda ningun evento al anular. El listado si las trae, y por eso esto
    // existe.
    if (d.motivo.includes("Wompi dice")) {
      const estado = d.motivo.split("Wompi dice ")[1]?.replace(".", "") ?? "VOIDED";
      try {
        const desenlace = await abrirPorAnulacionDeWompi(d.ventaId, estado, d.wompiId);
        if (desenlace === "abierta") {
          reversasAbiertas.push(d.ventaId);
          d.motivo = `${d.motivo} Se abrió el caso para resolverlo.`;
        } else if (desenlace === "ya_estaba") {
          yaAvisadas.add(d.ventaId);
          d.motivo = `${d.motivo} Su caso ya está abierto en el panel.`;
        }
      } catch (e) {
        // NO SE QUEDA SOLO EN SENTRY (smoke del 2026-09-17): el cotejo dijo "1 no cuadra" y nadie supo que el
        // caso no se habia abierto. El motivo viaja a la pantalla y al rastro de la corrida.
        Sentry.captureException(e, { tags: { area: "cotejo-wompi", transactionId: d.ventaId } });
        d.motivo = `${d.motivo} NO se pudo abrir el caso: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
      }
    }
    if (!yaAvisadas.has(d.ventaId)) {
      Sentry.captureMessage(`Cotejo con Wompi: ${d.motivo}`, {
        level: "error",
        tags: { area: "cotejo-wompi", transactionId: d.ventaId },
      });
    }
  }

  await repo.registrarCorrida({ desde, hasta, ambiente, origen, actorId, revisadas: ventas.length, recuperadas, discrepancias, falloPor: null });
  return { ambiente, revisadas: ventas.length, recuperadas, yaEstaban, discrepancias, reversasAbiertas, falloPor: null };
}
