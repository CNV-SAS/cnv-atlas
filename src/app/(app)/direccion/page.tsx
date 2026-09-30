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
      hint: `${d.paidCount} pagos · sin lo devuelto ni lo que está en revisión${notaDeArranque ? ` · ${notaDeArranque}` : ""}`,
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
      label: "Inventario",
      value: `${d.inventoryUnits} unidades`,
      // EL INVENTARIO NO LLEVA CORTE Y HAY QUE DECIRLO: un saldo no es un flujo. Las unidades que hay están
      // hoy en la bodega, las haya puesto ahí quien las haya puesto. Recortarlo por fecha daría un número
      // que no es el de ninguna bodega.
      hint: `${d.inventoryProducts} producto${d.inventoryProducts === 1 ? "" : "s"} en ${d.inventoryLocations} ubicaci${d.inventoryLocations === 1 ? "ón" : "ones"} · sin los productos de prueba${d.desdeElArranque ? " · es el saldo de hoy, no lleva corte de fecha" : ""}`,
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
              <span className="text-xs text-muted-foreground">Por producto</span>
              {d.inventoryByProduct.map((p) => (
                <span key={p.nombre} className="text-sm text-foreground">
                  {p.nombre} <span className="tabular-nums text-muted-foreground">{p.unidades}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Por ubicación</span>
              {d.inventoryByLocation.map((l) => (
                <span key={l.nombre} className="text-sm text-foreground">
                  {l.nombre} <span className="tabular-nums text-muted-foreground">{l.unidades}</span>
                </span>
              ))}
            </div>
          </div>
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
