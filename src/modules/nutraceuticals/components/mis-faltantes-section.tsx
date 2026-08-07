import { Badge } from "@/components/ui/badge";

import { getOwnFaltanteCases } from "../services/faltante-service";
import { JustificarFaltanteForm } from "./justificar-faltante-form";

// Casos de faltante del integrante (T3b-3 ST3). Muestra cada caso con el TIEMPO HABIL QUE LE QUEDA para
// justificar (no solo la fecha limite: un caso que vence sin que el sepa que corria es una deuda por
// descuido). Los reportado dentro del plazo traen el formulario de justificacion; los demas, su estado.

const STATUS_LABEL: Record<string, string> = {
  reportado: "Por justificar",
  en_revision: "En revisión de CNV",
  justificado: "Justificado (sin cargo)",
  venta_no_registrada: "Cerrado: venta no registrada",
  injustificado_pendiente: "Pendiente de confirmación de CNV",
  injustificado: "Injustificado (con cargo)",
};
const CATEGORY_LABEL: Record<string, string> = {
  hurto_denuncia: "Hurto o robo (con denuncia)",
  transporte_documentado: "Daño o pérdida en transporte",
  venta_no_registrada: "Venta no registrada",
  devolucion_guia: "Devolución a CNV",
};

function money(v: string): string {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toLocaleString("es-CO")}` : v;
}
function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export async function MisFaltantesSection({ userId }: { userId: string }) {
  const cases = await getOwnFaltanteCases(userId);
  if (!cases || cases.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold tracking-tight">Casos de faltante</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        Cuando un conteo arroja menos de lo que el sistema tiene, se abre un caso. Tienes cinco días hábiles
        para justificarlo con su soporte. Si vence sin justificar, pasa a revisión de CNV.
      </p>
      <div className="flex flex-col gap-3">
        {cases.map((c) => (
          <div key={c.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{c.nutraceuticalName}</span>
                <span className="text-xs text-muted-foreground">
                  Faltan {c.quantity} unidad(es){c.lote ? ` · lote ${c.lote}` : ""} · valor {money(c.sealedTotal)} · reportado {fmtDate(c.reportedAt)}
                </span>
              </div>
              <Badge variant="outline" className="font-normal">
                {STATUS_LABEL[c.status] ?? c.status}
              </Badge>
            </div>

            {c.justifiable ? (
              <>
                <p
                  className={`text-sm font-medium ${c.remainingBusinessDays <= 1 ? "text-clinical-warning" : "text-foreground"}`}
                >
                  {c.remainingBusinessDays === 0
                    ? "Vence hoy: es tu último día hábil para justificar."
                    : `Te ${c.remainingBusinessDays === 1 ? "queda" : "quedan"} ${c.remainingBusinessDays} día(s) hábil(es) para justificar.`}
                </p>
                <JustificarFaltanteForm caseId={c.id} />
              </>
            ) : c.status === "reportado" ? (
              <p className="text-sm text-clinical-warning">
                El plazo venció. El caso pasa a revisión de CNV.
              </p>
            ) : c.justificationCategory ? (
              <p className="text-sm text-muted-foreground">
                Justificado como: {CATEGORY_LABEL[c.justificationCategory] ?? c.justificationCategory}
                {c.justificationReference ? ` (ref. ${c.justificationReference})` : ""}.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
