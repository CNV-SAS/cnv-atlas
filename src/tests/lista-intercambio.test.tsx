import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { INTER_TABLA_B, alimentosDe } from "@/clinical-engine/intercambio-alimentos";
import { AlimentosDelSubgrupo } from "@/modules/treatment/components/lista-intercambio";

// CANDADO DE LA LISTA DEL PROFESIONAL (porte del v8, 2026-08-23). Lo que se blinda no es el estilo: es el
// RECORTE, que es decision de Gildardo y no nuestra, y que un edit futuro desharia con buena intencion
// ("¿por que ocultamos alimentos?"). La del PROFESIONAL va PLEGADA: el subgrupo Cereales tiene 39
// alimentos y desplegados rompen la tabla. Si se pierde, la pantalla sigue "funcionando" y nadie lo
// notaria en un smoke.
//
// AQUI HABIA UN SEGUNDO BLOQUE, el de la lista del PACIENTE recortada a 8 con "entre otros". Se retiro con
// el componente el 2026-09-03: en el archivo de Gildardo esa lista es `plan-print-only` y nosotros la
// mostrabamos en pantalla por no tener superficie de entrega. Desde el 1-sep el paciente recibe su plan
// dentro del reporte. El recorte a 8 sigue siendo suyo y se re-porta cuando llegue el mapa de regiones,
// dentro del septimo bloque del plan; el commit que lo retira conserva el codigo si hace falta cotejarlo.

const CEREALES = "Cereales"; // el subgrupo mas grande: 39 alimentos

describe("AlimentosDelSubgrupo (referencia del profesional)", () => {
  const markup = renderToStaticMarkup(createElement(AlimentosDelSubgrupo, { sub: CEREALES }));

  it("va PLEGADA: usa details/summary, no una lista abierta", () => {
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
  });

  it("el resumen anuncia CUANTOS alimentos hay, con el conteo real", () => {
    expect(markup).toContain(`ver ${alimentosDe(CEREALES).length} alimentos`);
  });

  it("muestra TODOS los del subgrupo (es referencia; el recorte es de la lista del paciente)", () => {
    for (const a of alimentosDe(CEREALES)) expect(markup).toContain(a.al);
  });

  it("cada alimento va con su gramaje, que es el dato que se consulta", () => {
    const uno = alimentosDe(CEREALES)[0];
    expect(markup).toContain(`${uno.al} (${uno.g} g)`);
  });
});
