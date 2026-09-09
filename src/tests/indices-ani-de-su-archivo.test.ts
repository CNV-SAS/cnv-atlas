import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HTML_VIGENTE } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LA FRANJA "ÍNDICES BIOELÉCTRICOS INTEGRADOS · ANI BIS-E" (2026-09-09).
//
// DE DONDE SALE: en su archivo la tabla de composicion de Diagnostico es UNA sola, con franjas de nivel, y
// la ULTIMA franja son los indices compuestos. Su propio comentario la define, y es la frase que resuelve
// la pregunta que trajo este cambio:
//
//     // ── ÍNDICES BIOELÉCTRICOS INTEGRADOS · ANI BIS-E (índices compuestos, no componentes moleculares) ──
//
// LO QUE ESTE CANDADO AFIRMA hoy son dos cosas cerradas:
//   1. AF e IR NO estan en esta tabla. Estan en el Nivel III de Wang, con su referencia, su Δ y su
//      veredicto, exactamente como el los tiene. Estaban en las DOS por nuestra cuenta.
//   2. El NIVEL se nombra en el TITULO DESPLEGABLE ("Nivel II · Molecular - Indicadores ANI-BIS-E"), y
//      dentro de la tabla no hay ninguna franja de seccion.
//
// TRES VUELTAS PARA LLEGAR AQUI, y se escribe entero porque el recorrido es la leccion:
//   · Primero puse una franja propia ("Índices bioeléctricos integrados · ANI BIS-E") argumentando que
//     los indices NO eran del Nivel II. Me apoye en su comentario ("indices compuestos, no componentes
//     moleculares"), que justifica la franja pero no dice que salgan del nivel: le atribui un alcance que
//     la frase no tiene. Su HTML es ademas PLANO (`NvH` es una fila mas del mismo `tbody`), asi que la
//     estructura no distingue las dos lecturas y la cita no zanjaba nada.
//   · Despues, con la correccion de Santiago, puse DOS franjas apiladas dentro de la tabla.
//   · Y lo que Gildardo pedia era mas simple que las dos cosas: que el TITULO diga de que nivel es.
// La moraleja que queda fijada aqui: cuando la pieza es un ROTULO, la respuesta suele ser mover el
// rotulo, no añadir estructura.
//
// Y EL ORDEN YA NO ES UNA PREGUNTA ABIERTA: se adopto el suyo (punto 5e).
//
// QUEDA UNA SOLA ABIERTA, citada y no asertada: el IEHH. Su archivo lo tiene en las FILAS del Nivel II y
// nosotros en esta franja, por pedido suyo. No se retira (en nuestro Nivel II no existe, asi que quitarlo
// lo perderia); falta decidir si se mueve. Se deja escrita y sin asercion: un candado que fija lo que
// suponemos convierte la suposicion en regla.

const RESULTADOS = readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8");
const MAPA = readFileSync("src/modules/diagnoses/data/composition-map.ts", "utf8");

/** Los codigos de SU franja de indices, en su orden. */
function indicesDeSuArchivo(): string[] {
  const src = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
  const i = src.indexOf("NvH('ÍNDICES BIOELÉCTRICOS INTEGRADOS");
  if (i < 0) throw new Error(`no aparece la franja de índices en ${HTML_VIGENTE}`);
  // Hasta el cierre de la tabla: las filas son `R('CODIGO — ...` o `R('CODIGO (...`.
  const bloque = src.slice(i, i + 2000);
  return [...bloque.matchAll(/R\('([A-ZÁ-Ú-]+(?:-BIS)?)\s*[—(]/g)].map((m) => m[1]);
}

/** Nuestros codigos, leidos del arreglo que pinta la tabla. */
function nuestrosIndices(): string[] {
  const limpio = sinComentarios(RESULTADOS);
  const bloque = limpio.slice(
    limpio.indexOf("const INDICATORS"),
    limpio.indexOf("];", limpio.indexOf("const INDICATORS")),
  );
  return [...bloque.matchAll(/code: "([A-Z-]+)"/g)].map((m) => m[1]);
}

describe("AF e IR viven en el Nivel III, no en la tabla de índices", () => {
  it("el control: su franja se lee y trae varios índices", () => {
    // Sin esto, una extraccion rota devolveria una lista vacia y las dos aserciones de abajo pasarian
    // verdes comparando nada contra nada.
    expect(indicesDeSuArchivo().length, `no se leyó su franja en ${HTML_VIGENTE}`).toBeGreaterThan(5);
  });

  it("su franja tampoco los lleva: no es una decisión nuestra", () => {
    const suyos = indicesDeSuArchivo();
    expect(suyos, "su archivo empezó a llevar AF en los índices").not.toContain("AF");
    expect(suyos, "su archivo empezó a llevar IR en los índices").not.toContain("IR");
  });

  it("y nuestra tabla tampoco", () => {
    const nuestros = nuestrosIndices();
    expect(nuestros.length, "no se leyó nuestra lista de índices").toBeGreaterThan(5);
    expect(nuestros, "AF volvió a la tabla de índices: ya está en el Nivel III").not.toContain("AF");
    expect(nuestros, "IR volvió a la tabla de índices: ya está en el Nivel III").not.toContain("IR");
  });

  it("porque siguen estando en el Nivel III de Wang, y con su rayo", () => {
    // La otra mitad, y es la que hace que retirarlos no pierda nada. Un candado que solo comprueba la
    // ausencia certifica que se quitaron, no que sigan estando donde deben.
    const limpio = sinComentarios(MAPA);
    expect(limpio).toContain('["AF - Ángulo de fase", "AF", null, "°", bio]');
    expect(limpio).toContain('["IR - Radio de impedancia", "IR", null, "", bio]');
  });
});

describe("la franja se rotula como en su archivo", () => {
  it("el nivel va en el título desplegable", () => {
    expect(sinComentarios(RESULTADOS)).toContain(
      'title="Nivel II · Molecular - Indicadores ANI-BIS-E"',
    );
  });

  it("y NO hay franjas de sección dentro de la tabla", () => {
    // Las dos versiones anteriores metian un `th colSpan` de banda encima del encabezado de columnas. Es
    // una segunda cabecera compitiendo con la que ya hay, y ademas no era lo que se pedia.
    const limpio = sinComentarios(RESULTADOS);
    const bloque = limpio.slice(limpio.indexOf("Nivel II · Molecular - Indicadores"));
    expect(bloque.slice(0, 2000), "volvió la franja retirada").not.toContain(
      "Índices bioeléctricos integrados",
    );
    expect(bloque.slice(0, 2000), "volvió una franja de sección dentro de la tabla").not.toContain(
      "colSpan={5}",
    );
  });

  it("y el orden de los índices es el de su archivo", () => {
    // Se DERIVA de su franja, no se escribe aqui. El IEHH es nuestro (pedido suyo) y no esta en la suya:
    // se descuenta para comparar, en vez de excluirlo con una lista escrita a mano que envejeceria.
    const suyos = indicesDeSuArchivo().map((c) => (c === "EB-BIS" ? "EB" : c === "ISCM-BIS" ? "ISCM" : c));
    const nuestros = nuestrosIndices().filter((c) => c !== "IEHH");
    expect(nuestros, "el orden de los índices dejó de ser el de su archivo").toEqual(suyos);
  });

  it("y los rótulos EB-BIS e ISCM-BIS son de DISPLAY, no la clave del motor", () => {
    // Si el renombre hubiera tocado `code`, `sevByCode` y `clasesPorCodigo` dejarian de encontrar la fila
    // y saldria sin veredicto y sin punto, sin que nada fallara. Por eso el rotulo va aparte.
    const limpio = sinComentarios(RESULTADOS);
    expect(limpio).toContain('{ code: "EB", label: "EB-BIS", key: "eb" }');
    expect(limpio).toContain('{ code: "ISCM", label: "ISCM-BIS", key: "iscm" }');
  });

  it("y su Nivel II sigue siendo el molecular, con sus propias filas", () => {
    // El control de que la franja nueva no desplazo ni duplico un nivel que ya existia.
    const limpio = sinComentarios(MAPA);
    expect(limpio).toContain('title: "Nivel II · Molecular"');
    expect(limpio).toContain('["ACT - Agua corporal total", "TBW", "TBW_ref", "L"]');
  });
});
