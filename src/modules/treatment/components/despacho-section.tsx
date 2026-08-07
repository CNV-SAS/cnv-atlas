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
  if (byId.size === 0) return null;

  const user = await requireUser();
  const ids = [...byId.keys()];
  const [stock, despachos] = await Promise.all([
    getOwnStockByIds(user.id, ids),
    getDespachosForTreatment(protocol.treatmentId),
  ]);
  const products = ids.map((id) => ({ id, name: byId.get(id) ?? "", stock: stock[id] ?? 0 }));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-6">
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
