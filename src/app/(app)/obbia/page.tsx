import { theadTr, th } from "@/components/shared/tabla";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { formatDate } from "@/lib/format/date";

import { leerCohorteDeInvestigacion } from "@/modules/obbia/data/cohorte-reader";
import { getResearchDatasets } from "@/modules/obbia/data/research-reader";
import { canViewObbia } from "@/modules/obbia/policies/can-view-obbia";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "ObBIA - Atlas" };

function fmt(iso: string): string {
  return formatDate(iso);
}

// Una cifra con su rotulo y su nota. La nota NO es decoracion: dice de que es la cifra, para que el numero
// no quede mudo (mismo criterio que la lectura del delta en la comparacion de seguimiento).
function Cifra({ rotulo, valor, nota }: { rotulo: string; valor: number; nota: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-background p-3">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-2xl font-semibold tabular-nums text-foreground">{valor}</span>
      <span className="text-xs text-muted-foreground">{nota}</span>
    </div>
  );
}

// Panel de obbia (B14): datasets de investigacion gobernados, data agregada sin PII. La
// autorizacion va por policy (regla 3); la lectura, por RLS (obbia solo lee research_datasets).
export default async function ObbiaPage() {
  const user = await requireUser();
  if (!canViewObbia(user)) {
    redirect("/no-autorizado");
  }

  const [datasets, cohorte] = await Promise.all([
    getResearchDatasets(),
    leerCohorteDeInvestigacion(),
  ]);

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

      {/* ═══ LA COHORTE, EN CIFRAS ═══

          La vista `evaluaciones_para_investigacion` existia desde la 0224 sin ninguna pantalla, así que
          quien entraba aquí veía "no hay datasets" y concluía que no había datos. Lo que no había era la
          consulta. Y se dice lo que queda FUERA, no solo lo que queda dentro: la autorización de
          investigación es opcional, y un número que solo cuenta lo incluido deja creer que son todos. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">
          Cohorte disponible para investigación
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra
            rotulo="Consultas autorizadas"
            valor={cohorte.conAutorizacion}
            nota={`${cohorte.pacientesAutorizados} pacientes distintos`}
          />
          <Cifra
            rotulo="Con diagnóstico sellado"
            valor={cohorte.conDiagnostico}
            nota="las únicas con indicadores"
          />
          <Cifra
            rotulo="Fuera, sin autorización"
            valor={cohorte.sinAutorizacion}
            nota={`de ${cohorte.vigentes} consultas vigentes`}
          />
          <Cifra
            rotulo="Importadas del HTML"
            valor={cohorte.importadas}
            nota="su procedencia no es la misma"
          />
        </div>
        <p className="max-w-prose text-xs text-muted-foreground">
          Consulta vigente es la de un paciente real, no reemplazada por una corrección y no retirada
          (migración 0224). La autorización de investigación es{" "}
          <strong className="text-foreground">opcional</strong>: quien no la dio sigue siendo paciente de
          CNV y queda fuera de cualquier dataset. Estas cifras no salen de una copia: son la vista.
        </p>
        {cohorte.porVersionDelMotor.length > 1 ? (
          <p className="max-w-prose text-xs font-medium text-clinical-warning">
            La cohorte mezcla {cohorte.porVersionDelMotor.length} versiones del motor (
            {cohorte.porVersionDelMotor.map((v) => `${v.version}: ${v.evaluaciones}`).join(" · ")}). Si
            alguna cambia de versión mayor, sus cifras no son comparables con las demás y el dataset tiene
            que decirlo.
          </p>
        ) : null}
        {cohorte.porMes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Mes de la medición</th>
                  <th className={th}>Consultas autorizadas</th>
                </tr>
              </thead>
              <tbody>
                {cohorte.porMes.map((m) => (
                  <tr key={m.mes} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{m.mes}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{m.evaluaciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <h2 className="text-sm font-semibold text-foreground">Datasets entregados</h2>
      {datasets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Todavía no se ha entregado ningún dataset. Las cifras de arriba son la cohorte disponible; un
          dataset es una entrega concreta, con su alcance y su nivel de anonimización registrados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className={theadTr}>
                <th className={th}>Alcance</th>
                <th className={th}>Anonimización</th>
                <th className={th}>Estado</th>
                <th className={th}>Fecha de creación</th>
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
