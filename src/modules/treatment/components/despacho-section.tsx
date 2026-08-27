import { bloqueCls } from "@/components/shared/bloque";
import { requireUser } from "@/modules/auth/session";
import {
  getDespachosForTreatment,
  getOwnStockByIds,
} from "@/modules/nutraceuticals/services/inventory-service";

import type { TreatmentProtocol } from "../data/treatment-reader";
import { DespachoForm } from "./despacho-form";

// T3b-2: entrega (despacho) de nutraceuticos al paciente. Solo lo ve el nutricionista, tras confirmar el
// diagnostico, y solo para los productos PRESCRITOS que son en_consultorio (los solo_tienda los compra el
// paciente en la tienda; no se entregan aqui). Cada entrega descuenta el inventario en consignacion del
// profesional (movimiento despacho, -N, ligado a este tratamiento).
//
// Separacion clinico/comercial: el vinculo entrega->paciente es dato clinico (vive en el movimiento y lo ve
// el profesional del paciente). El saldo del inventario es comercial y no expone al paciente; se consulta en
// Mi inventario. La futura vista de CNV veria el saldo sin este vinculo.

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export async function DespachoSection({
  evaluationId,
  protocol,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
}) {
  // La entrega es un acto posterior a la prescripcion, que exige diagnostico confirmado (regla de las
  // escrituras de tratamiento). Antes de eso no hay nada que entregar.
  if (!protocol.diagnosisConfirmed) return null;

  // Entregables = prescritos que son en_consultorio, sin duplicados por producto.
  const availById = new Map(protocol.catalog.map((c) => [c.id, c.commercialAvailability]));
  const byId = new Map<string, string>();
  for (const n of protocol.nutraceuticals) {
    if (availById.get(n.nutraceuticalId) === "en_consultorio") byId.set(n.nutraceuticalId, n.name);
  }

  // CUANDO NO HAY NADA QUE ENTREGAR, SE DICE POR QUE. Antes esto era `return null` y el bloque entero
  // desaparecia, asi que el profesional no podia distinguir tres situaciones distintas: que no habia
  // prescrito nada, que lo prescrito no se entrega aqui, o que habia prescrito y no habia guardado. Y
  // la frase que lo explicaba ("los productos de solo tienda no aparecen aqui") vivia DENTRO del bloque
  // que no se mostraba, asi que no la leia nunca.
  //
  // Es la misma leccion de ausencia contra fila vacia: un bloque que no esta no informa de nada.
  if (byId.size === 0) {
    const noEntregables = protocol.nutraceuticals.filter(
      (n) => availById.get(n.nutraceuticalId) !== "en_consultorio",
    );
    const soloTienda = noEntregables.filter((n) => availById.get(n.nutraceuticalId) === "solo_tienda");
    const noDisponibles = noEntregables.filter(
      (n) => availById.get(n.nutraceuticalId) !== "solo_tienda",
    );
    return (
      <section className={bloqueCls("derivado")}>
        <h3 className="text-sm font-semibold text-foreground">Entrega de nutracéuticos</h3>
        {noEntregables.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay nada que entregar: todavía no has prescrito ningún nutracéutico.
          </p>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>Lo que prescribiste no se entrega en consultorio:</p>
            <ul className="ml-4 list-disc">
              {soloTienda.map((n) => (
                <li key={n.nutraceuticalId}>
                  <span className="text-foreground">{n.name}</span> · se compra en la tienda
                </li>
              ))}
              {noDisponibles.map((n) => (
                <li key={n.nutraceuticalId}>
                  <span className="text-foreground">{n.name}</span> · aún no está disponible
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  const user = await requireUser();
  const ids = [...byId.keys()];
  const [stock, despachos] = await Promise.all([
    getOwnStockByIds(user.id, ids),
    getDespachosForTreatment(protocol.treatmentId),
  ]);
  const products = ids.map((id) => ({ id, name: byId.get(id) ?? "", stock: stock[id] ?? 0 }));

  return (
    <section className={bloqueCls("derivado")}>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">Entrega de nutracéuticos</h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          Registra lo que le entregas al paciente de los productos prescritos que tienes en consultorio. Cada
          entrega descuenta tu inventario en consignacion. Los productos de solo tienda no aparecen aqui: el
          paciente los compra en la tienda.
        </p>
      </div>

      <DespachoForm evaluationId={evaluationId} treatmentId={protocol.treatmentId} products={products} />

      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tu saldo</h4>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {products.map((p) => (
            <li key={p.id} className="text-foreground">
              {p.name}: <span className={`font-bold ${p.stock < 0 ? "text-clinical-warning" : ""}`}>{p.stock}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Entregas a este paciente
        </h4>
        {despachos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin entregas registradas todavia.</p>
        ) : (
          <ul className="ml-4 list-disc text-sm text-foreground">
            {despachos.map((m) => (
              <li key={m.id}>
                <span className="text-muted-foreground">{fmtDate(m.createdAt)}</span> {m.nutraceuticalName}:{" "}
                <span className="font-medium">{Math.abs(m.delta)} unidad(es)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
