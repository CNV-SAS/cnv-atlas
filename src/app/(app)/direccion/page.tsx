import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { getDireccionDashboard } from "@/modules/direccion/data/dashboard-reader";
import { InsightsDeLaCompraSection } from "@/modules/direccion/components/insights-de-la-compra-section";
import { LoDeshechoSection } from "@/modules/direccion/components/lo-deshecho-section";
import { insightsDeLaCompra } from "@/modules/direccion/data/insights-de-la-compra";
import { loDeshecho } from "@/modules/direccion/data/lo-deshecho";
import { canViewDireccion } from "@/modules/direccion/policies/can-view-direccion";
import { requireUser } from "@/modules/auth/session";

export const metadata = { title: "Dirección - Atlas" };

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Tablero consolidado de direccion (B14): agregados financieros e inventario. La
// autorizacion va por policy (regla 3); los datos, por RLS. Sin PII.
export default async function DireccionPage() {
  const user = await requireUser();
  if (!canViewDireccion(user)) {
    redirect("/no-autorizado");
  }

  const [d, insights, deshecho] = await Promise.all([
    getDireccionDashboard(),
    insightsDeLaCompra(),
    loDeshecho(),
  ]);

  // EL ALCANCE SE DICE EN CADA TARJETA DE DINERO, no en una nota al pie: el dia del arranque estas cifras
  // caen de golpe (sale todo lo de las pruebas) y una caida sin explicacion al lado se lee como un defecto.
  const notaDeArranque = d.desdeElArranque ? `desde el ${d.desdeElArranque}` : null;

  const cards: { label: string; value: string; hint?: string }[] = [
    // LAS CIFRAS DICEN QUE DEJAN FUERA (smoke del 2026-09-29): sin decirlo, el número parece moverse solo,
    // y un número que se mueve solo es indistinguible de un defecto.
    {
      label: "Ingreso bruto facturado",
      value: cop.format(d.grossPaid),
      // ── Y CUÁNTAS SE DESHICIERON, PARA QUE LA CUENTA SE PUEDA REHACER (Santiago, 2026-10-07) ──
      //
      // Decía "7 pagos" al lado de $428.400, que son exactamente CUATRO ventas de 107.100. Las dos cifras
      // estaban bien (7 pagadas menos el dinero de 3 devueltas), pero juntas se leían como un descuadre, y
      // Santiago paró el smoke a preguntar si cuadraban. Ahora la propia línea cierra la resta.
      hint: `${d.paidCount} pago${d.paidCount === 1 ? "" : "s"}${
        d.devueltasCount > 0
          ? `, ${d.devueltasCount} devuelto${d.devueltasCount === 1 ? "" : "s"} (su dinero no suma aquí)`
          : ""
      } · sin lo devuelto ni lo que está en revisión${notaDeArranque ? ` · ${notaDeArranque}` : ""}`,
    },
    { label: "Ingreso CNV", value: cop.format(d.cnvRevenue), hint: notaDeArranque ?? undefined },
    {
      label: "Comisiones a profesionales",
      value: cop.format(d.professionalCommissions),
      // SE DICE QUE ESTO NO ES LO QUE SE DEBE, porque la liquidación sí paga lo anterior al arranque y las
      // dos cifras van a discrepar a propósito. Sin esta línea, la diferencia parece un error de una de las
      // dos pantallas.
      hint: d.desdeElArranque
        ? `desde el ${d.desdeElArranque} · lo anterior se sigue liquidando, no se pierde`
        : undefined,
    },
    {
      // EL RÓTULO DICE QUÉ CUENTA (Santiago, 2026-10-02). Decía "Inventario" y sumaba las vitrinas más la
      // bodega central más la cuarentena, así que crecía cada vez que un Integrante recibía una remesa. El
      // alcance se escribe en el nombre de la cifra, no en letra chica: es lo que ya aprendimos con "Tu mes".
      label: "En las vitrinas",
      value: `${d.inventoryUnits} unidades`,
      // EL INVENTARIO NO LLEVA CORTE Y HAY QUE DECIRLO: un saldo no es un flujo. Las unidades que hay están
      // hoy en la bodega, las haya puesto ahí quien las haya puesto. Recortarlo por fecha daría un número
      // que no es el de ninguna bodega.
      hint: `${d.inventoryProducts} producto${d.inventoryProducts === 1 ? "" : "s"} en ${d.inventoryLocations} vitrina${d.inventoryLocations === 1 ? "" : "s"} · sin los productos de prueba ni las vitrinas de demostración${d.desdeElArranque ? " · es el saldo de hoy, no lleva corte de fecha" : ""}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* Cae "vista consolidada de finanzas e inventario" (son las tarjetas de abajo) y queda que son
            AGREGADOS SIN DATOS PERSONALES, que es una garantia de gobernanza y no se ve en las cifras. */}
        <TituloPantalla titulo="Dirección" descripcion="Agregados, sin datos personales." />
        {/* EL DÍA DEL ARRANQUE ESTAS CIFRAS CAEN DE GOLPE, y esa vez es correcto. Se dice arriba y no en
            letra chica porque una caída sin explicación se lee como un defecto, y ya nos pasó esta semana
            con el "0 de 18". La línea también dice qué NO cambia, que es lo que evita la pregunta
            siguiente: nadie perdió una comisión ni desapareció una venta. */}
        {d.desdeElArranque ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            Las cifras de dinero cuentan desde el{" "}
            <strong className="text-foreground">{d.desdeElArranque}</strong>, el día del arranque: lo anterior
            es de las pruebas y dejó de sumar aquí. No se borró nada, y lo que se le debe a alguien se sigue
            liquidando entero.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* LA TARJETA COMPARTIDA (2026-09-03): estas cifras estaban hechas a mano, con su propia escala
            y su propio borde. Es la misma pieza que /pacientes, y tenerla dos veces es como se llega a
            dos dialectos para lo mismo. El `hint` pasa a `detalle`, que es donde va el ALCANCE de la
            cifra. */}
        {cards.map((c) => (
          <TarjetaMetrica key={c.label} rotulo={c.label} valor={c.value} detalle={c.hint} />
        ))}
      </div>

      {/* ═══ CUÁLES SON ESOS PRODUCTOS Y ESAS UBICACIONES (Santiago, 2026-09-30) ═══

          La tarjeta decía "6 productos en 9 ubicaciones" y la pregunta inmediata era cuáles. Un agregado que
          no se puede abrir obliga a creérselo, y creérselo es justo lo que no queremos de una cifra. El
          desglose sale de las MISMAS filas que el total, así que no pueden discrepar. */}
      {d.inventoryByProduct.length > 0 ? (
        <details className="rounded-xl border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm text-foreground">
            Qué hay en el inventario, y dónde
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              {/* ── EL ALCANCE VA EN EL RÓTULO (Santiago, smoke del 2026-10-07) ──

                  Decía solo "Por producto", debajo de una tarjeta que dice "En las vitrinas", y se leyó como el
                  inventario COMPLETO. De ahí salieron dos conclusiones equivocadas en una sola sesión: que el
                  "disponibles: 386 en la bodega" de la pantalla de venta era falso, y que una venta desde la
                  bodega no había movido inventario. Las dos vienen de una palabra que faltaba. */}
              <span className="text-xs text-muted-foreground">Por producto, en las vitrinas</span>
              {d.inventoryByProduct.map((p) => (
                <span key={p.nombre} className="text-sm text-foreground">
                  {p.nombre} <span className="tabular-nums text-muted-foreground">{p.unidades}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Por vitrina</span>
              {d.inventoryByLocation.map((l) => (
                <span key={l.nombre} className="text-sm text-foreground">
                  {l.nombre} <span className="tabular-nums text-muted-foreground">{l.unidades}</span>
                </span>
              ))}
            </div>
          </div>

          {/* ═══ LO QUE NO ESTÁ EN NINGUNA VITRINA (Santiago, 2026-10-02) ═══

              Va DENTRO del desglose y FUERA de la cifra, y las dos cosas a propósito. Fuera, porque sumarlo
              hacía que el total creciera cada vez que un Integrante recibía una remesa: la recepción le suma
              a él y nada resta de la bodega, así que las mismas unidades se contaban dos veces. Y dentro del
              desglose, porque el producto existe y esconderlo sería el error contrario.

              SE DICE QUE ES INFORMATIVO, con su razón. Una cifra que no se puede usar y no avisa de ello es
              peor que no tenerla. */}
          {d.inventoryFueraDeVitrinas.length > 0 ? (
            <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                Fuera de las vitrinas (no suma en la cifra de arriba)
              </span>
              {d.inventoryFueraDeVitrinas.map((l) => (
                <span key={l.nombre} className="text-sm text-foreground">
                  {l.nombre} <span className="tabular-nums text-muted-foreground">{l.unidades}</span>
                </span>
              ))}
              {/* Y SUS PRODUCTOS, para poder cotejar el "disponibles: N en la bodega de CNV" de la pantalla de
                  venta. Sin el desglose había que creerse la cifra, y creérsela fue justo lo que falló. */}
              {d.inventoryFueraPorProducto.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Por producto, fuera de las vitrinas</span>
                  {d.inventoryFueraPorProducto.map((p) => (
                    <span key={p.nombre} className="text-sm text-foreground">
                      {p.nombre} <span className="tabular-nums text-muted-foreground">{p.unidades}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              {/* ── LA NOTA DISTINGUÍA MAL, Y ESO CONFUNDIÓ (Santiago, 2026-10-07) ──

                  Decía "el saldo de la bodega central no baja", a secas. Eso es verdad de una REMESA y FALSO de
                  una VENTA desde la bodega, que sí descuenta (el saldo es un caché del trigger de movimientos,
                  migración 0040). Leída como regla general, llevó a concluir que una venta despachada no había
                  movido nada. Una nota que explica un caso y se lee como todos es peor que ninguna. */}
              <p className="mt-2 max-w-prose text-xs text-muted-foreground">
                Es informativo y no suma arriba, porque contaría dos veces: una <strong>remesa</strong> le suma
                al Integrante cuando la confirma y no le resta a la bodega (se corrige con el módulo de bodega).
                Una <strong>venta desde la bodega</strong> sí le resta aquí, al pagarse.
              </p>
            </div>
          ) : null}
          <p className="mt-3 max-w-prose text-xs text-muted-foreground">
            Solo lo que tiene saldo distinto de cero: una fila en cero existe porque alguna vez hubo unidades
            ahí, y listarla diría que hay producto en una bodega donde no hay ninguno. Sin los productos de
            prueba, igual que la tarjeta, y suma exactamente lo mismo que ella.
          </p>
          {/* UN SALDO NEGATIVO NO SE ESCONDE: significa que se descontaron unidades que la vitrina no tenía,
              y es algo que hay que arreglar en los datos. Esconderlo lo volvería indetectable, y además
              descuadraría el desglose con su propia tarjeta (ya pasó: 7.197 contra 7.187). */}
          {d.inventoryByProduct.some((p) => p.unidades < 0) ||
          d.inventoryByLocation.some((l) => l.unidades < 0) ? (
            <p className="max-w-prose text-xs text-attention">
              Alguna línea sale en negativo. Eso no es un error de la cifra: significa que se descontaron
              unidades que esa bodega no tenía registradas, y hay que cuadrarlo en los datos.
            </p>
          ) : null}
        </details>
      ) : null}

      {/* VA DEBAJO DE LAS CIFRAS DE DINERO, no arriba: el dinero es lo que Dirección viene a ver todos los
          días, y esto es análisis. Poner el análisis primero le quitaría el sitio a lo operativo. */}
      <InsightsDeLaCompraSection datos={insights} />

      {/* DEBAJO DE LOS INSIGHTS Y NO ANTES: es la contracara de esa sección, y solo se entiende habiendo
          leído la otra. Su advertencia ("esto no se resta de lo de arriba") nombra justo lo que queda
          encima. */}
      <LoDeshechoSection datos={deshecho} />
    </div>
  );
}
