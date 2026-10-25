import { theadTr, th } from "@/components/shared/tabla";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { formatDate } from "@/lib/format/date";

import { leerCohorteDeInvestigacion } from "@/modules/obbia/data/cohorte-reader";
import { getResearchDatasets } from "@/modules/obbia/data/research-reader";
import { canViewObbia } from "@/modules/obbia/policies/can-view-obbia";
import {
  CIFRAS_DEL_PANEL,
  EXPORT_FILA_A_FILA_DE_LA_VISTA,
  nivelDeAnonimizacion,
  type NivelDeAnonimizacion,
  sigueSiendoDatoPersonal,
} from "@/modules/obbia/services/nivel-de-anonimizacion";
import { requireUser } from "@/modules/auth/session";

// ═══ EL NIVEL SE DICE EN ESPAÑOL, Y EL CRUDO AL LADO ═══
//
// El crudo (`pseudonymized`) es el valor que la base guarda y el que hay que poder citar al hablar con
// alguien que lea la tabla; el rótulo es para quien mira la pantalla. Decir solo uno de los dos deja a
// alguien sin la palabra que necesita.
const ROTULO_DEL_NIVEL: Record<NivelDeAnonimizacion, string> = {
  aggregate: "Agregado",
  pseudonymized: "Seudonimizado",
  anonymized: "Anonimizado",
};

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
  const nivelDelExport = nivelDeAnonimizacion(EXPORT_FILA_A_FILA_DE_LA_VISTA);
  const nivelDeLaPantalla = nivelDeAnonimizacion(CIFRAS_DEL_PANEL);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* ═══ EL ENCABEZADO SE DERIVA, Y ANTES SE CONTRADECIA CON SU PROPIA PANTALLA ═══

            Decía "Solo data agregada o anonimizada; nunca datos personales del paciente" mientras el
            bloque de abajo decía que un dataset fila a fila de esta cohorte sería SEUDONIMIZADO y que eso
            sigue siendo dato personal (Gildardo, 2026-10-25). Las dos frases hablan de lo mismo y una de
            las dos sobra: la de abajo está calculada, la de arriba estaba escrita a mano.

            Y la diferencia importa, porque no son la misma pregunta: lo que ESTA PANTALLA muestra sí es
            agregado (ni una fila cruza), y lo que un DATASET llevaría no lo es. El encabezado nuevo dice
            las dos cosas, y las dos salen de `nivelDeAnonimizacion`: si mañana la vista deja de llevar
            `patient_id`, esta frase cambia sola. */}
        <TituloPantalla
          titulo="Investigación"
          descripcion={
            `Esta pantalla es ${ROTULO_DEL_NIVEL[nivelDeLaPantalla.nivel].toLowerCase()}: ni una fila de paciente la cruza. ` +
            `Un dataset fila a fila de esta cohorte sería ${ROTULO_DEL_NIVEL[nivelDelExport.nivel].toLowerCase()}` +
            (sigueSiendoDatoPersonal(nivelDelExport.nivel)
              ? ", y eso sigue siendo dato personal."
              : ", y eso ya no es dato personal.")
          }
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
          {/* EL TOTAL VA EN LA NOTA, y sin él el 8 parecía un defecto del import. Son dos hechos
              distintos: cuántas se importaron, y cuántas de esas se pueden usar. */}
          <Cifra
            rotulo="Importadas del HTML"
            valor={cohorte.importadas}
            nota={`de ${cohorte.importadasVigentes} importadas en total`}
          />
        </div>

        {/* ═══ POR QUÉ QUEDAN FUERA LAS QUE QUEDAN FUERA (Gildardo, 2026-10-25) ═══

            "197 de 513 es el 38 %, pero dijiste que 53 de 402 pacientes no autorizaron (13 %)". Las dos
            cifras son ciertas y miden cosas distintas: un paciente sin autorización que tuvo tres
            consultas pone TRES en el conteo de consultas. Por eso cada razón trae las dos columnas, y por
            eso la mayor parte de los excluidos no "dijo que no": nunca firmó en Atlas, porque el
            consentimiento del HTML no tenía casilla de investigación. */}
        {cohorte.sinAutorizacionPorRazon.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Por qué queda fuera</th>
                  <th className={th}>Consultas</th>
                  <th className={th}>Pacientes</th>
                </tr>
              </thead>
              <tbody>
                {cohorte.sinAutorizacionPorRazon.map((r) => (
                  <tr key={r.razon} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-foreground">{r.razon}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.consultas}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.pacientes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="max-w-prose text-xs text-muted-foreground">
          Consulta vigente es la de un paciente real, no reemplazada por una corrección y no retirada
          (migración 0224). La autorización de investigación es{" "}
          <strong className="text-foreground">opcional</strong>: quien no la dio sigue siendo paciente de
          CNV y queda fuera de cualquier dataset. Estas cifras no salen de una copia: son la vista.
        </p>
        {/* ═══ EL AVISO DE VERSIONES DECIA ALGO FALSO (Gildardo, 2026-10-25) ═══

            Avisaba "la cohorte mezcla 2 versiones del motor" sobre `1.0.0` y `anibise-1.4.0`, y son la
            MISMA ciencia: el 2026-09-09 el motor se renombró de `anibise-1.4.0` a `1.0.0` sin mover una
            sola cifra, y los diagnósticos ya emitidos conservan la grafía vieja a propósito, porque el
            sello dice con qué se calculó. La banda de trayectoria ya las leía igual; esta pantalla no.

            Un aviso que dice "no son comparables" sobre cifras que sí lo son hace desconfiar de la cohorte
            entera, y es peor que no avisar. Ahora la alarma solo salta si hay dos familias MAYORES
            distintas, que es lo único que de verdad hace incomparables dos cifras, y en el caso normal se
            dice en voz baja cuántas grafías hay, que es un dato de calidad y no una alarma. */}
        {cohorte.mezclaFamilias ? (
          <p className="max-w-prose text-xs font-medium text-clinical-warning">
            La cohorte mezcla {cohorte.porFamiliaDelMotor.length} familias mayores del motor (
            {cohorte.porFamiliaDelMotor.map((f) => `${f.mayor}.x: ${f.evaluaciones}`).join(" · ")}). Las
            cifras de una familia no son comparables con las de otra y el dataset tiene que decirlo.
          </p>
        ) : cohorte.porVersionDelMotor.length > 1 ? (
          <p className="max-w-prose text-xs text-muted-foreground">
            Toda la cohorte con diagnóstico está en una sola familia del motor
            {cohorte.porFamiliaDelMotor[0] ? ` (${cohorte.porFamiliaDelMotor[0].mayor}.x)` : ""}, así que
            sus cifras son comparables entre sí. Lo sellado trae{" "}
            {cohorte.porVersionDelMotor.length} grafías distintas (
            {cohorte.porVersionDelMotor.map((v) => `${v.version}: ${v.evaluaciones}`).join(" · ")}) porque
            el nombre de la versión cambió el 9 de septiembre y un diagnóstico emitido antes conserva el
            nombre con el que se calculó.
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

      {/* ═══ QUE NIVEL SALDRIA SI HOY SE GENERARA UN DATASET DE ESTA COHORTE ═══

          Lo CALCULA la misma función que rotularía el dataset (`nivelDeAnonimizacion`), no un texto
          escrito a mano: si mañana la vista deja de llevar `patient_id`, esta frase cambia sola. Y la
          respuesta de hoy es la que hay que saber antes de prometer un dataset: la vista lleva
          `patient_id` a propósito (es lo que permite el análisis longitudinal), así que un export fila a
          fila es SEUDONIMIZADO, no anónimo. */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold text-foreground">
          Un dataset fila a fila de esta cohorte saldría{" "}
          {ROTULO_DEL_NIVEL[nivelDelExport.nivel].toLowerCase()} ({nivelDelExport.nivel})
        </p>
        <p className="mt-1 max-w-prose text-muted-foreground">{nivelDelExport.porQue}</p>
        <p className="mt-1 max-w-prose text-xs text-muted-foreground">
          El nivel no se escribe: se deriva de lo que el archivo lleva. Para producir uno anonimizado hay
          que quitar la llave del paciente, generalizar los cuasi-identificadores y verificar el
          k-anonimato, y esa verificación todavía no está construida.
        </p>
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
                  <td className="px-3 py-2 text-muted-foreground">
                    {ROTULO_DEL_NIVEL[d.anonymizationLevel as NivelDeAnonimizacion] ??
                      d.anonymizationLevel}
                  </td>
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
