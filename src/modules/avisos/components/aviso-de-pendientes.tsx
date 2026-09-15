import Link from "next/link";

import type { CurrentUser } from "@/modules/auth/roles";

import * as repo from "../data/avisos-repository";
import { canAtenderPendientesVentas } from "../policies/can-atender-pendientes";
import { pendientesVisibles } from "../resumen";

// ═══ LA FRANJA DE PENDIENTES, EN CUALQUIER PANTALLA (Bloque A) ═══
//
// Para quien tiene la marca de pendientes de ventas: si hay algo que pide accion, lo ve arriba entre por donde
// entre, no solo en /pagos. Complementa el correo, no lo reemplaza. Cuenta con la MISMA clasificacion del correo:
// lo que esta en gestion no suma, salvo que haya vencido.
//
// Y SI NADIE TIENE LA MARCA, la ve el administrador: un control sin destinatario es el mismo problema que un panel
// que nadie mira.
export async function AvisoDePendientes({ user }: { user: CurrentUser }) {
  if (!canAtenderPendientesVentas(user)) return null;
  const [tengoMarca, alguienRecibe] = await Promise.all([
    repo.tieneMarca(user.id, "pendientes_ventas"),
    repo.hayQuienRecibaPendientes(),
  ]);
  const esAdmin = user.roles.includes("admin");
  if (!tengoMarca && !(esAdmin && !alguienRecibe)) return null;

  const { total, vencidos } = pendientesVisibles(await repo.listarPendientesDeAccion(), new Date());
  if (!alguienRecibe && esAdmin) {
    return (
      <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
        Nadie recibe los avisos de ventas.{" "}
        <Link href="/admin" className="font-medium underline underline-offset-4">
          Pon la marca a alguien
        </Link>
        {total > 0 ? ` · hay ${total} pendiente${total === 1 ? "" : "s"}` : ""}
      </div>
    );
  }
  if (total === 0) return null;
  return (
    <div
      className={`border-b px-4 py-2 text-sm ${vencidos > 0 ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-attention/30 bg-attention-bg text-attention"}`}
    >
      {total} pendiente{total === 1 ? "" : "s"} de ventas necesita{total === 1 ? "" : "n"} acción
      {vencidos > 0 ? ` (${vencidos} vencido${vencidos === 1 ? "" : "s"})` : ""}.{" "}
      <Link href="/pagos" className="font-medium underline underline-offset-4">
        Ver en Pagos
      </Link>
    </div>
  );
}
