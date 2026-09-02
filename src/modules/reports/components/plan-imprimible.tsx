import type { PlanPaciente } from "../data/reports-view-types";

import { HcImprimir } from "./hc-imprimir";

// EL PLAN DEL PACIENTE, EN PAPEL. La hoja que se lleva de la consulta, ahora mismo, sin esperar a que le
// llegue el correo. Es la mitad que el pedido legal deja del lado del profesional: poder entregarlo.
//
// DE DONDE SALE, Y POR QUE NO ES UNA SEGUNDA CONSTRUCCION: lee `PlanPaciente`, el MISMO objeto que arma
// `getPlanPaciente` y que viaja al PDF del correo. Es otra PRESENTACION del mismo dato, no otra fuente:
// si el papel y el PDF dijeran cosas distintas, el defecto estaria en el lector y lo verian los dos. Lo
// que no se hace es recomponer el plan aqui a partir del protocolo, que si seria la segunda construccion
// que llevamos una semana evitando.
//
// EL ORDEN ES EL DEL PDF, y a proposito: el paciente puede tener las dos cosas delante (la hoja de la
// consulta y el correo de despues), y dos ordenes distintos del mismo plan se leen como dos planes.
//
// Y NO LLEVA EL DIAGNOSTICO: el PDF del correo lo abre con el, porque ahi va el reporte completo. Esta
// hoja es solo el plan, que es lo que el paciente necesita en la cocina.

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 break-inside-avoid">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

export function PlanImprimible({
  plan,
  paciente,
  fecha,
}: {
  plan: PlanPaciente;
  paciente: string;
  fecha: string;
}) {
  const hayMeta = plan.objetivoTexto || plan.kcalObjetivo != null || plan.pesoMeta != null;

  return (
    <div className="imprimible flex flex-col gap-5 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Plan del paciente</h2>
          <p className="text-xs text-muted-foreground">
            {paciente} · {fecha}
          </p>
        </div>
        <HcImprimir />
      </div>

      {/* AVISO QUE NO SALE EN PAPEL: es para el profesional, no para el paciente. */}
      <p className="no-print max-w-prose rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        Esto es lo que el paciente recibe, con el mismo contenido y el mismo orden que el PDF del reporte.
        Al imprimir sale solo esta hoja, sin los bloques de trabajo de arriba.
      </p>

      {hayMeta ? (
        <Bloque titulo="Tu meta">
          {plan.objetivoTexto ? <p className="text-sm">{plan.objetivoTexto}</p> : null}
          {plan.pesoMeta != null ? (
            <p className="text-sm">Peso que acordaste con tu profesional: {plan.pesoMeta} kg.</p>
          ) : null}
          {plan.kcalObjetivo != null ? (
            <p className="text-sm">Tu plan es de {plan.kcalObjetivo} calorías al día.</p>
          ) : null}
        </Bloque>
      ) : null}

      {plan.tipoDieta || plan.prescripcion.length > 0 || plan.atributos.length > 0 ? (
        <Bloque titulo="Tu plan de alimentación">
          {plan.tipoDieta ? <p className="text-sm">{plan.tipoDieta}</p> : null}
          {plan.atributos.length > 0 ? <p className="text-sm">{plan.atributos.join(" · ")}</p> : null}
          {plan.prescripcion.map((f) => (
            <p key={f.nombre} className="text-sm">
              {f.nombre}: {f.valor}
            </p>
          ))}
          {plan.notasDelModelo.map((n) => (
            <p key={n} className="text-sm text-muted-foreground">
              {n}
            </p>
          ))}
        </Bloque>
      ) : null}

      {/* LO QUE NO PUEDE COMER, ANTES DEL MENU. Mismo orden que el PDF, y por la misma razon: un menú
          leído antes que sus restricciones es un menú que el paciente ya empezó a seguir mal. */}
      {plan.restricciones.length > 0 ? (
        <Bloque titulo="Lo que debes evitar">
          <ul className="flex flex-col gap-1">
            {plan.restricciones.map((r) => (
              <li key={r} className="text-sm">
                {r}
              </li>
            ))}
          </ul>
        </Bloque>
      ) : null}

      {plan.distribucion.length > 0 ? (
        <Bloque titulo="Cómo repartir tus porciones en el día">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="pb-1 pr-3 font-medium">Grupo</th>
                  {plan.tiemposActivos.map((t) => (
                    <th key={t} className="pb-1 pr-3 font-medium">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.distribucion.map((fila) => (
                  <tr key={fila.alimento} className="border-t border-border">
                    <td className="py-1 pr-3">{fila.alimento}</td>
                    {plan.tiemposActivos.map((t) => (
                      <td key={t} className="py-1 pr-3 tabular-nums">
                        {fila.porTiempo.find((p) => p.tiempo === t)?.porciones ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloque>
      ) : null}

      {plan.menu.length > 0 ? (
        <Bloque titulo="Un ejemplo de menú para tu semana">
          {plan.menu.map((d) => (
            <div key={d.dia} className="flex flex-col gap-0.5 break-inside-avoid">
              <p className="text-xs font-medium text-foreground">{d.dia}</p>
              {d.comidas.map((c) => (
                <p key={c.tiempo} className="text-xs">
                  <span className="font-medium">{c.tiempo}:</span> {c.texto}
                </p>
              ))}
            </div>
          ))}
        </Bloque>
      ) : null}

      {plan.recomendaciones.length > 0 ? (
        <Bloque titulo="Recomendaciones para tu caso">
          {plan.recomendaciones.map((r) => (
            <div key={r.titulo} className="flex flex-col gap-0.5 break-inside-avoid">
              <p className="text-xs font-medium text-foreground">{r.titulo}</p>
              {r.lineas.map((l) => (
                <p key={l} className="text-xs">
                  {l}
                </p>
              ))}
            </div>
          ))}
        </Bloque>
      ) : null}
    </div>
  );
}
