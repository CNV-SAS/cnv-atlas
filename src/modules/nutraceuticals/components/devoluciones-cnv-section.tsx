import { TituloSeccion } from "@/components/shared/titulo-pantalla";

import { devolucionesAbiertas } from "../services/devolucion-a-cnv-service";
import { CerrarDevolucionForm } from "./cerrar-devolucion-form";

// ═══ LO QUE LOS INTEGRANTES DEVOLVIERON Y CNV NO HA RECIBIDO (0187) ═══
//
// LA ANTIGUEDAD SE MUESTRA porque es el dato que convierte esta lista en un control: una devolucion declarada
// hace tres semanas y sin recibir no es papeleo pendiente, es mercancia de CNV que nadie sabe donde esta.
export async function DevolucionesCnvSection() {
  const abiertas = await devolucionesAbiertas();
  if (abiertas.length === 0) return null;

  const hoy = new Date();
  const dias = (ymd: string) =>
    Math.max(0, Math.round((hoy.getTime() - new Date(`${ymd}T12:00:00`).getTime()) / 86_400_000));

  return (
    <section className="flex flex-col gap-3">
      <TituloSeccion>Devoluciones de Integrantes por recibir</TituloSeccion>
      <p className="max-w-prose text-sm text-muted-foreground">
        Producto que un Integrante declaró que despachó de vuelta.{" "}
        <strong className="text-foreground">Su saldo todavía no bajó</strong>: baja cuando confirmes lo que de
        verdad llegó. Cuenta antes de confirmar; si no llegó todo, registra lo que llegó y la diferencia
        seguirá en su saldo (aparecerá en su conteo, con plazo para justificar).
      </p>
      {abiertas.map((d) => {
        const edad = dias(d.declaradaEl);
        return (
          <div key={d.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  {d.producto} · lote {d.codigo} · declaró {d.declaradas}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.quien ?? "Integrante"} · {d.declaradaEl} ({edad === 0 ? "hoy" : `hace ${edad} ${edad === 1 ? "día" : "días"}`}) · {d.motivo}
                </span>
              </div>
              {edad >= 15 ? (
                <span className="text-xs text-attention">
                  Lleva {edad} días sin recibirse: es mercancía de CNV en tránsito
                </span>
              ) : null}
            </div>
            <CerrarDevolucionForm returnId={d.id} declaradas={d.declaradas} />
          </div>
        );
      })}
    </section>
  );
}
