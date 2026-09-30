import { theadTr, th, thNum } from "@/components/shared/tabla";
import { TituloSeccion } from "@/components/shared/titulo-pantalla";
import { NOMBRE_DE_CLASE, NOMBRE_DE_ESTADO, tasaDeReversion } from "@/modules/payments/lo-deshecho";

import type { LoDeshecho } from "../data/lo-deshecho";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// ═══ LO QUE SE DESHIZO (2026-09-30) ═══
//
// LA ADVERTENCIA VA ARRIBA Y VISIBLE, no al pie: estas cifras y las de "qué se prescribe y qué se compra"
// hablan de las mismas ventas y responden preguntas distintas. Allí una compra devuelta sigue contando como
// compra, porque la pregunta es si se siguió la prescripción. Aquí la pregunta es cuánto volvió. Sin decirlo
// donde se lee, alguien va a restar una de la otra y a concluir mal.
export function LoDeshechoSection({ datos }: { datos: LoDeshecho }) {
  const deshechas = datos.porClase.reduce((n, c) => n + c.veces, 0);
  const tasa = tasaDeReversion(deshechas, datos.ventasPagadas);
  const hayLinks =
    datos.links.aMano + datos.links.reemplazadosPorOtroCobro + datos.links.noCompletados + datos.links.sinUsar >
    0;

  return (
    <section className="flex flex-col gap-4">
      <TituloSeccion>Lo que se deshizo</TituloSeccion>

      <div className="flex flex-col gap-2 rounded-lg border border-attention bg-attention-bg p-3">
        <p className="max-w-prose text-sm text-foreground">
          <strong>Esto no se resta de lo de arriba.</strong> En &quot;qué se prescribe y qué se compra&quot;
          una compra devuelta sigue contando como compra, porque allí la pregunta es si se siguió la
          prescripción. Aquí la pregunta es cuánto volvió. Son dos preguntas distintas sobre las mismas
          ventas, y restar una de la otra no da nada útil.
        </p>
        <p className="max-w-prose text-xs text-muted-foreground">
          El dinero sí sale una sola vez: lo devuelto y lo perdido ya están descontados del ingreso bruto.
          {datos.desdeElArranque ? ` Cuenta desde el ${datos.desdeElArranque}, como las demás cifras.` : ""}
        </p>
      </div>

      {deshechas === 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          No se ha deshecho ninguna venta{datos.ventasPagadas > 0 ? ` de las ${datos.ventasPagadas} pagadas` : ""}
          . Cuando haya una devolución o un contracargo, aparece aquí con su motivo.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Tarjeta
              rotulo="Ventas deshechas"
              valor={`${deshechas} de ${datos.ventasPagadas}`}
              nota={
                tasa == null
                  ? "no hay ventas pagadas con qué compararlo"
                  : `${tasa}% de lo pagado · contracargos, anulaciones de la pasarela y devoluciones`
              }
            />
            <Tarjeta
              rotulo="Dinero que volvió"
              valor={cop.format(datos.porClase.reduce((n, c) => n + c.monto, 0))}
              // UN CASO ABIERTO NO HA MOVIDO PLATA TODAVIA, y sumarlo como si lo hubiera hecho diría que CNV
              // ya devolvió algo que aún está en disputa.
              nota="lo debitado de verdad · un caso en disputa todavía no suma"
            />
          </div>

          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Clase</th>
                  <th className={th}>Estado</th>
                  <th className={thNum}>Veces</th>
                  <th className={thNum}>Dinero</th>
                </tr>
              </thead>
              <tbody>
                {datos.porClase.map((c) => (
                  <tr key={`${c.clase}-${c.estado}`} className="border-b border-border/60">
                    <td className="px-3 py-2 text-foreground">{NOMBRE_DE_CLASE[c.clase] ?? c.clase}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {NOMBRE_DE_ESTADO[c.estado] ?? c.estado}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{c.veces}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {c.monto > 0 ? cop.format(c.monto) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {datos.productosDevueltos.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Qué vuelve</span>
          <p className="max-w-prose text-xs text-muted-foreground">
            Unidades devueltas por producto. Un producto que vuelve mucho dice algo, y es información para la
            dirección científica antes que para la comercial.
          </p>
          <ul className="flex flex-col gap-1">
            {datos.productosDevueltos.map((p) => (
              <li key={p.producto} className="text-sm text-muted-foreground">
                <span className="text-foreground">{p.producto}</span>:{" "}
                <span className="tabular-nums">{p.unidades}</span>{" "}
                {p.unidades === 1 ? "unidad" : "unidades"} en {p.veces}{" "}
                {p.veces === 1 ? "devolución" : "devoluciones"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {datos.motivos.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Por qué</span>
          <ul className="flex flex-col gap-1">
            {datos.motivos.map((m) => (
              <li key={`${m.clase}-${m.motivo}`} className="text-sm text-muted-foreground">
                <span className="text-foreground">{NOMBRE_DE_CLASE[m.clase] ?? m.clase}</span>: {m.motivo} ·{" "}
                <span className="tabular-nums">{m.veces}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ═══ LOS LINKS VAN APARTE, Y ESA ES LA DECISIÓN QUE MÁS IMPORTA DE ESTA PANTALLA ═══

          Un link anulado antes de cobrarse NO es una venta deshecha: nadie compró y nadie devolvió nada.
          Meterlo arriba inflaría la tasa de reversión con algo que nunca se hizo. Y dentro de los links, las
          cuatro situaciones tampoco son la misma: cambiar de opinión no es lo mismo que cobrar en efectivo
          (donde la venta sí ocurrió), ni que un pago que murió solo en la pasarela. */}
      {hayLinks ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Links de pago que no llegaron a cobrar</span>
          <p className="max-w-prose text-xs text-muted-foreground">
            Esto <strong className="text-foreground">no son ventas deshechas</strong>: nadie compró, así que
            no cuentan en las cifras de arriba. Van aquí porque dicen otra cosa, cuántos intentos no llegaron
            a cobro y por qué.
          </p>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground">Anulados a mano</span>:{" "}
              <span className="tabular-nums">{datos.links.aMano}</span> · alguien cambió de opinión o se
              equivocó al armarlo
            </li>
            <li>
              <span className="text-foreground">Reemplazados por un cobro en otro medio</span>:{" "}
              <span className="tabular-nums">{datos.links.reemplazadosPorOtroCobro}</span> · la venta sí
              ocurrió, en efectivo o transferencia, y el link sobraba
            </li>
            <li>
              <span className="text-foreground">Pagos que no se completaron</span>:{" "}
              <span className="tabular-nums">{datos.links.noCompletados}</span> · la pasarela los rechazó o el
              paciente no terminó. Nadie los anuló
            </li>
            <li>
              <span className="text-foreground">Abiertos, sin usar</span>:{" "}
              <span className="tabular-nums">{datos.links.sinUsar}</span> · siguen vivos: nadie los pagó ni
              los anuló, y nada los vence solo
            </li>
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
