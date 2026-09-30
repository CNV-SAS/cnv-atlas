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
  // ── EL DENOMINADOR SON LAS QUE PODIAN DECIRLO, no todas (Santiago, 2026-09-30) ──
  //
  // Salia "0 de 18" con las 18 anteriores al vinculo dentro, mientras el numerador solo podia salir de las
  // posteriores: numerador y denominador median ventanas distintas. Y el propio texto de abajo decia que
  // esas 18 no podian decirlo, asi que la pantalla se contradecia a si misma.
  const comparables = datos.ventasConConsulta + datos.ventasSinConsultaComparables;
  const totalVentas = datos.ventasConConsulta + datos.ventasSinConsulta;
  const totalLineas = datos.lineasDentroDelPlan + datos.lineasFueraDelPlan;
  const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : null);

  // ═══ VACÍA POR EL ARRANQUE NO ES LO MISMO QUE VACÍA PORQUE NO HAY NADA ═══
  //
  // El día que se fije la fecha, esta pantalla se vacía de golpe y ESA VEZ ES CORRECTO. Pero después de dos
  // días mirando un "0 de 18" que sí era un defecto, un cero sin explicación se va a leer como otro defecto.
  // Así que el vacío dice con todas las letras por qué está vacío y cuántas compras dejaron de contar: un
  // cero que se explica a sí mismo es lo único que distingue "está bien" de "se rompió".
  if (totalVentas === 0) {
    return (
      <section className="flex flex-col gap-3">
        <TituloSeccion>Qué se prescribe y qué se compra</TituloSeccion>
        {datos.desdeElArranque ? (
          <div className="flex flex-col gap-2 rounded-lg border border-attention bg-attention-bg p-3">
            <p className="max-w-prose text-sm text-foreground">
              <strong>Esto no es un error: está contando desde el {datos.desdeElArranque}</strong>, que es el
              día del arranque, y todavía no hay ninguna compra de esa fecha en adelante.
            </p>
            {datos.ventasAnterioresAlArranque > 0 ? (
              <p className="max-w-prose text-xs text-muted-foreground">
                Quedaron fuera {datos.ventasAnterioresAlArranque} compras anteriores, que son las de las
                pruebas. No se borraron: siguen en el historial y en las liquidaciones. Con el primer cobro
                real estas cifras vuelven a llenarse.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="max-w-prose text-sm text-muted-foreground">
            Todavía no hay ninguna venta pagada. Con los primeros cobros estas cifras empiezan a significar
            algo.
          </p>
        )}
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
        {datos.desdeElArranque ? (
          <p className="text-xs text-muted-foreground">
            Cuenta desde el <strong className="text-foreground">{datos.desdeElArranque}</strong>, que es el
            día del arranque
            {datos.ventasAnterioresAlArranque > 0
              ? `, así que ${datos.ventasAnterioresAlArranque} compras anteriores dejaron de contar aquí`
              : ""}
            : las consultas y las compras de antes son de las pruebas, y mezclarlas haría que estas cifras
            midieran otra cosa. No se borraron, siguen en el historial. El corte alcanza a los tres ejes a la
            vez (lo que el modelo propuso, lo prescrito y lo comprado), porque recortar solo uno los pondría a
            medir ventanas distintas.
          </p>
        ) : null}
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
          valor={comparables > 0 ? `${datos.ventasConConsulta} de ${comparables}` : "-"}
          nota={
            comparables > 0
              ? `${pct(datos.ventasConConsulta, comparables)}% · solo cuentan las que podían decirlo`
              : "todavía ninguna compra pudo decir su consulta"
          }
        />
        <Tarjeta
          rotulo="De lo comprado con consulta, dentro del plan"
          valor={totalLineas > 0 ? `${datos.lineasDentroDelPlan} de ${totalLineas}` : "-"}
          nota={
            totalLineas === 0
              ? "ninguna compra trae su consulta todavía"
              : datos.lineasFueraDelPlan > 0
                ? `${datos.lineasFueraDelPlan} fuera del plan de esa consulta`
                : "ninguna fuera del plan"
          }
        />
        <Tarjeta
          rotulo="Tarda en comprar"
          valor={datos.diasHastaLaCompra.mediana == null ? "-" : `${datos.diasHastaLaCompra.mediana} días`}
          // LA MEDIANA, y el máximo aparte: con pocas filas un caso de ocho meses mueve el promedio y hace
          // creer que nadie compra cuando la mayoría compró el mismo día.
          // UN GUION SIN EXPLICACION SE LEE COMO UN FALLO: se dice por qué no hay cifra.
          nota={
            datos.diasHastaLaCompra.maximo == null
              ? "no hay compras atadas a una consulta todavía"
              : `mediana · el más tardío, ${datos.diasHastaLaCompra.maximo} días`
          }
        />
      </div>

      {/* ═══ UNA SOLA TABLA CON EL EMBUDO ENTERO (Santiago, 2026-09-30) ═══

          Eran DOS bloques y se leían como contradictorios: arriba "MULTI-CELL BASE, prescrito en 24" y abajo
          "MULTI-CELL BASE, 60 consultas". Son consultas distintas y hechos distintos, pero nadie tiene por qué
          deducirlo: puestos aparte parecen dos cifras del mismo hecho. En una fila se ve el recorrido entero,
          y la relación entre las columnas se DICE en vez de dejarla suponer.

          Y el eje del modelo sigue sin ser un reproche al profesional: el modelo propone y él dispone. Lo que
          la cifra dice es DÓNDE se aparta, que es información para la dirección científica. */}
      {datos.porProducto.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Producto por producto, de punta a punta</span>
          <p className="max-w-prose text-xs text-muted-foreground">
            Cada cifra cuenta <strong className="text-foreground">consultas</strong> (una consulta es un
            tratamiento), salvo la última, que cuenta líneas de compra.{" "}
            <strong className="text-foreground">
              Lo que el modelo recomienda y lo que el profesional prescribe no son la misma lista:
            </strong>{" "}
            puede prescribir algo que el modelo no propuso, que es su criterio clínico y cuenta igual, y hay
            consultas con prescripción que no tienen informe. Por eso &quot;prescrito en&quot; no sale de
            &quot;el modelo lo propuso en&quot;: se cruzan, no se contienen.{" "}
            {/* SE DICE QUE UNA DEVOLUCIÓN NO RESTA AQUÍ, y por qué: la pregunta es si la prescripción se
                siguió; que después la devolviera es otro hecho. Descontarla escondería los dos. El dinero de
                lo devuelto sí sale del bruto, arriba. */}
            <strong className="text-foreground">Una compra devuelta sigue contando como compra:</strong> la
            pregunta es si siguió la prescripción, y la devolución es otro hecho (su dinero sí sale del bruto).
          </p>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Producto</th>
                  <th className={thNum}>El modelo lo propuso en</th>
                  <th className={thNum}>De esas, sin prescribir</th>
                  <th className={thNum}>Prescrito en</th>
                  <th className={thNum}>Comprado en</th>
                  <th className={thNum}>Comprado fuera del plan</th>
                </tr>
              </thead>
              <tbody>
                {datos.porProducto.map((p) => (
                  <tr key={p.producto} className="border-b border-border/60">
                    <td className="px-3 py-2 text-foreground">{p.producto}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{p.recomendadoEn}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {p.recomendadoSinPrescribir}
                    </td>
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
          <p className="max-w-prose text-xs text-muted-foreground">
            Cómo se lee una fila: el modelo lo propuso en tantas consultas, en tantas de esas nadie lo
            prescribió, se prescribió en tantas (propuestas o no), en tantas de esas se compró, y tantas veces
            se compró sin estar en el plan de la consulta a la que se ató la venta. Lo último no es un error:
            puede venir del seguimiento o el paciente pedirlo.
          </p>
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
