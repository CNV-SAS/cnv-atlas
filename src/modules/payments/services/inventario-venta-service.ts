import "server-only";

import * as Sentry from "@sentry/nextjs";

import * as inv from "../data/inventario-de-venta";
import { motivoLegible } from "./facturacion-service";

// ═══ EL DESCUENTO DE INVENTARIO DE UNA VENTA PAGADA ═══
//
// Se llama DESPUES de sellar el pago, en el webhook de Wompi y en la venta en efectivo, y NUNCA LANZA. Es la
// misma forma que la factura: el pago ya esta sellado y es lo que no se puede perder; lo que falle aqui se
// escribe en la venta (`stock_state`, `stock_last_error`) y queda en la cola.
//
// DOS DESENLACES QUE NO SON EL FELIZ, Y NO SON LO MISMO:
//   · `sin_saldo`: se desconto lo que habia y faltaron unidades. No es un error del sistema, es una
//     DISCREPANCIA entre Atlas y la vitrina, y se avisa (decision 4 de Santiago: se sella igual y avisa).
//   · `fallido`: el descuento no pudo correr. Se reintenta.

export async function descontarInventarioDeVenta(transactionId: string): Promise<void> {
  try {
    const r = await inv.descontarVenta(transactionId);
    if (r.estado === "sin_saldo" && r.movio) {
      Sentry.captureMessage("Venta pagada sin saldo suficiente", {
        level: "warning",
        tags: { area: "inventario-venta", transactionId },
        extra: { faltantes: r.faltantes },
      });
    }
  } catch (e) {
    await inv.registrarFalloDeDescuento(transactionId, motivoLegible(e)).catch(() => {
      // Si ni siquiera se puede escribir el fallo, queda Sentry. No se traga el error original.
    });
    Sentry.captureException(e, { tags: { area: "inventario-venta", transactionId } });
  }
}

/** Barre la cola: ventas pagadas a las que les falta descontar el inventario. */
export async function reintentarDescuentosPendientes(): Promise<{ intentados: number }> {
  const pendientes = await inv.listarDescuentosPendientes();
  for (const id of pendientes) await descontarInventarioDeVenta(id);
  return { intentados: pendientes.length };
}
