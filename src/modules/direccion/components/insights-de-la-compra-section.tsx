import { theadTr, th, thNum } from "@/components/shared/tabla";
import { TituloSeccion } from "@/components/shared/titulo-pantalla";

import type { InsightsDeLaCompra } from "../data/insights-de-la-compra";

// ═══ QUE SE PRESCRIBE Y QUE SE COMPRA (2026-09-29) ═══
//
// LA ADVERTENCIA VA ARRIBA Y NO EN LETRA CHICA, y es la decisión de diseño de esta pantalla: estas cifras
// responden "¿el modelo VENDE?" y NO "¿el modelo FUNCIONA?". Comprar no es tomar, y nadie registra todavía lo
// que el paciente consumió. Presentar esto como evidencia clínica sería el peor uso posible de estos números,
// y el sitio donde eso se evita es aquí, antes de que se lean.
//
// Y LA VENTANA SE DICE TAMBIÉN: antes del 29 de septiembre una venta de /pagos nacía sin consulta, así que no
// hay con qué cruzarla. Una cifra sin su ventana invita a leerla como "todo el histórico".
export function InsightsDeLaCompraSection({ datos }: { datos: InsightsDeLaCompra }) {
  const totalVentas = datos.ventasConConsulta + datos.ventasSinConsulta;
  const totalLineas = datos.lineasDentroDelPlan + datos.lineasFueraDelPlan;
  const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : null);

  if (totalVentas === 0) {
    return (
      <section className="flex flex-col gap-3">
        <TituloSeccion>Qué se prescribe y qué se compra</TituloSeccion>
        <p className="max-w-prose text-sm text-muted-foreground">
          Todavía no hay ninguna venta pagada. Con los primeros cobros estas cifras empiezan a significar algo.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <TituloSeccion>Qué se prescribe y qué se compra</TituloSeccion>

      <div className="flex flex-col gap-2 rounded-lg border border-attention bg-attention-bg p-3">
        <p className="max-w-prose text-sm text-foreground">
          <strong>Esto mide si el modelo vende, no si funciona.</strong> Comprar no es tomar: nadie registra
          todavía qué consumió el paciente, así que ninguna de estas cifras dice si le sirvió. Para eso hace
          falta el registro de consumo en el seguimiento.
        </p>
        {datos.ventasSinConsultaAnteriores > 0 ? (
          <p className="text-xs text-muted-foreground">
            Y {datos.ventasSinConsultaAnteriores} de las compras sin consulta son anteriores al {datos.desde}:
            esas <strong className="text-foreground">no podían decirlo</strong>, porque el sistema no lo
            preguntaba. No son compras fuera de plan, son compras de antes.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tarjeta
          rotulo="Compras con su consulta"
          valor={`${datos.ventasConConsulta} de ${totalVentas}`}
          nota={pct(datos.ventasConConsulta, totalVentas) != null ? `${pct(datos.ventasConConsulta, totalVentas)}%` : null}
        />
        <Tarjeta
          rotulo="Líneas dentro de lo prescrito"
          valor={`${datos.lineasDentroDelPlan} de ${totalLineas}`}
          nota={
            datos.lineasFueraDelPlan > 0
              ? `${datos.lineasFueraDelPlan} fuera del plan de esa consulta`
              : "ninguna fuera del plan"
          }
        />
        <Tarjeta
          rotulo="Tarda en comprar"
          valor={datos.diasHastaLaCompra.mediana == null ? "-" : `${datos.diasHastaLaCompra.mediana} días`}
          // LA MEDIANA, y el máximo aparte: con pocas filas un caso de ocho meses mueve el promedio y hace
          // creer que nadie compra cuando la mayoría compró el mismo día.
          nota={
            datos.diasHastaLaCompra.maximo == null
              ? null
              : `mediana · el más tardío, ${datos.diasHastaLaCompra.maximo} días`
          }
        />
      </div>

      {datos.porProducto.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Por producto</span>
          <p className="max-w-prose text-xs text-muted-foreground">
            Prescrito en cuántas consultas, comprado en cuántas de esas, y cuántas veces se compró{" "}
            <strong className="text-foreground">sin estar en el plan</strong> de la consulta a la que se ató la
            venta. Lo último no es un error: puede venir del seguimiento o el paciente pedirlo.
          </p>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Producto</th>
                  <th className={thNum}>Prescrito en</th>
                  <th className={thNum}>Comprado en</th>
                  <th className={thNum}>Fuera del plan</th>
                </tr>
              </thead>
              <tbody>
                {datos.porProducto.map((p) => (
                  <tr key={p.producto} className="border-b border-border/60">
                    <td className="px-3 py-2 text-foreground">{p.producto}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{p.prescritoEn}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {p.compradoEn}
                      {p.prescritoEn > 0 ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({Math.round((p.compradoEn / p.prescritoEn) * 100)}%)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {p.compradoFueraDelPlan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* EL EJE DEL MODELO, SEPARADO DEL DE LA PRESCRIPCIÓN. No es un reproche al profesional: apartarse del
          modelo es su criterio clínico, y el modelo propone. Lo que la cifra dice es DÓNDE se aparta, que es
          información para la dirección científica, no una nota de desempeño. */}
      {datos.recomendadoSinPrescribir.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            Lo que el modelo recomendó y no se prescribió
          </span>
          <p className="max-w-prose text-xs text-muted-foreground">
            El modelo propone y el profesional dispone, así que esto no es un error: es dónde el criterio
            clínico se aparta del modelo. Información para la dirección científica.
          </p>
          <ul className="flex flex-col gap-1">
            {datos.recomendadoSinPrescribir.map((r) => (
              <li key={r.producto} className="text-sm text-muted-foreground">
                <span className="text-foreground">{r.producto}</span>: {r.veces}{" "}
                {r.veces === 1 ? "consulta" : "consultas"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {datos.motivosDeVentaSuelta.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Por qué hubo compras sin consulta</span>
          <ul className="flex flex-col gap-1">
            {datos.motivosDeVentaSuelta.map((m) => (
              <li key={m.motivo} className="text-sm text-muted-foreground">
                {m.motivo} · <span className="tabular-nums">{m.veces}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Tarjeta({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-base font-semibold tabular-nums text-foreground">{valor}</span>
      {nota ? <span className="text-xs text-muted-foreground">{nota}</span> : null}
    </div>
  );
}
