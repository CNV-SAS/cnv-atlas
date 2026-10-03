import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ UN DESCUADRE FISICO NO LO BORRA UNA MARCA DE PRUEBA (Santiago, smoke del 2026-10-03) ═══
//
// LA REGLA, que ya estaba decidida y escrita en la bandeja: cuando el PRODUCTO es real, la unidad salio de
// verdad de una vitrina de verdad, y la vitrina esta descuadrada aunque el paciente o el profesional sean de
// prueba. Las cifras de DINERO pueden excluir esa venta; el movimiento de inventario no.
//
// EL DEFECTO: esa regla vivia en la bandeja de "ventas por revisar" y NO en el lector de pendientes, donde un
// filtro general (`and not tx.cuenta_como_de_prueba`, puesto al final "para que no se olvide en ninguna rama")
// PISABA la regla propia de la rama de `sin_saldo`.
//
// LO QUE PRODUJO, y es peor que esconder de mas: la bandeja MOSTRABA la LUVIA descuadrada y el panel de
// "Pendientes sin salida" NO, porque sale del otro lector. La fila se veia en un panel y no se podia descartar
// en el otro: el unico remedio que existe para ella quedaba fuera de su alcance.
//
// ES LA MISMA FORMA DE SIEMPRE: la misma pregunta contestada en dos sitios con criterios distintos. Lo que
// este candado vigila es que los dos paneles que hablan del MISMO hecho fisico lo decidan igual.

const BANDEJA = sinComentarios(readFileSync("src/modules/payments/data/ventas-por-revisar.ts", "utf8"));
const PENDIENTES = sinComentarios(readFileSync("src/modules/avisos/data/avisos-repository.ts", "utf8"));

describe("la bandeja y el panel de descartar deciden igual sobre un sin_saldo", () => {
  it("la bandeja mira el PRODUCTO, no la marca de la venta", () => {
    // Si algun dia filtrara por `cuenta_como_de_prueba`, esconderia un descuadre fisico real.
    expect(BANDEJA, "la bandeja empezo a esconder por la marca de la venta").not.toMatch(
      /and\s+not\s+t\.cuenta_como_de_prueba/,
    );
    expect(BANDEJA, "la bandeja dejo de mirar si el producto es de prueba").toContain("n.is_test");
  });

  it("y el lector de pendientes NO saca un sin_saldo por la marca de la venta", () => {
    // El filtro general sigue para las otras ramas (hablan de dinero y de documentos); `sin_saldo` habla de
    // unidades fisicas, y por eso queda exceptuada. Sin esta excepcion, la fila no se puede descartar.
    expect(
      PENDIENTES,
      "volvio el filtro general sin la excepcion de sin_saldo: la fila se ve en la bandeja y no se puede descartar",
    ).toMatch(/not tx\.cuenta_como_de_prueba or p\.tipo = 'sin_saldo'/);
  });

  it("y la rama de sin_saldo conserva su propia regla, que es la del producto", () => {
    // El control: si alguien quitara la condicion de la rama creyendo que la excepcion de arriba la sustituye,
    // entraria al correo cualquier venta de un producto de prueba.
    const i = PENDIENTES.indexOf("'sin_saldo', t.id");
    expect(i, "cambio la rama de sin_saldo: revisa este candado").toBeGreaterThan(0);
    const rama = PENDIENTES.slice(i, i + 2000);
    expect(rama, "la rama de sin_saldo dejo de exigir que el producto sea real").toContain("is_test, false) = false");
  });
});

describe("y la bandeja DICE por que muestra una venta de prueba", () => {
  const COMPONENTE = sinComentarios(readFileSync("src/modules/payments/components/ventas-por-revisar.tsx", "utf8"));

  it("trae la marca y la explica, en vez de dejar la contradiccion muda", () => {
    // La lista principal de /pagos la esconde y esta la muestra. Las dos reglas son correctas; lo que no
    // puede quedar es que el profesional vea el mismo hecho en un panel y no en el otro sin saber por que.
    expect(BANDEJA).toContain("deUnaVentaDePrueba");
    expect(COMPONENTE).toContain("deUnaVentaDePrueba");
    expect(COMPONENTE).toContain("el producto es real");
  });
});
