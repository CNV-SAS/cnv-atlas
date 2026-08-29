import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { formatDate } from "@/lib/format/date";

import { getResearchDatasets } from "@/modules/obbia/data/research-reader";
import { canViewObbia } from "@/modules/obbia/policies/can-view-obbia";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "ObBIA - Atlas" };

function fmt(iso: string): string {
  return formatDate(iso);
}

// Panel de obbia (B14): datasets de investigacion gobernados, data agregada sin PII. La
// autorizacion va por policy (regla 3); la lectura, por RLS (obbia solo lee research_datasets).
export default async function ObbiaPage() {
  const user = await requireUser();
  if (!canViewObbia(user)) {
    redirect("/no-autorizado");
  }

  const datasets = await getResearchDatasets();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* Cae "datasets de investigacion gobernados" (la tabla los lista) y queda la GARANTIA: nunca
            datos personales del paciente. */}
        <TituloPantalla
          titulo="Investigación"
          descripcion="Solo data agregada o anonimizada; nunca datos personales del paciente."
        />
      </div>

      {datasets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay datasets de investigacion todavia. La generacion de datasets agregados es una
          capa posterior al MVP; por ahora los exports se gobiernan de forma manual.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border bg-muted text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Alcance</th>
                <th className="px-3 py-2 font-semibold">Anonimización</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">Fecha de creación</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{d.scope}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.anonymizationLevel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.status}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmt(d.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
