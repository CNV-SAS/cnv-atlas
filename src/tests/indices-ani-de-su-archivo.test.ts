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
//   2. La franja se rotula como el la rotula, y NO "Nivel II · Molecular": su Nivel II es una franja
//      anterior con otras filas, y su comentario dice literalmente que estos indices no son componentes
//      moleculares.
//
// DOS PREGUNTAS ABIERTAS, CITADAS Y NO ASERTADAS (reporte del 2026-09-09, sin respuesta de Santiago):
//   · IEHH. El lo tiene en el NIVEL II; nosotros solo aqui. No se retira: en nuestro Nivel II no existe,
//     asi que quitarlo lo perderia. Falta decidir si se MUEVE.
//   · EL ORDEN. El suyo cierra con EB-BIS -> IAE -> ISCM-BIS; el nuestro pone ISCM e IEHH antes.
// Se dejan escritas aqui y no como asercion: un candado que fija lo que suponemos convierte la suposicion
// en regla, y estas dos las tiene que contestar el.

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
  it("índices bioeléctricos integrados, NO Nivel II", () => {
    // Rotularla "Nivel II · Molecular" (que fue lo que se pidió) diría dos cosas falsas: que estos índices
    // son moleculares, y que el Nivel II aparece dos veces con contenidos distintos. Su comentario lo
    // zanja: "índices compuestos, no componentes moleculares".
    expect(RESULTADOS).toContain("Índices bioeléctricos integrados · ANI BIS-E");
    // SIN COMENTARIOS: el comentario que explica por que NO se rotula "Nivel II · Molecular" contiene esa
    // cadena, asi que la asercion se cazaba a si misma y se ponia roja por la prosa.
    const limpio = sinComentarios(RESULTADOS);
    const bloque = limpio.slice(limpio.indexOf("Indicadores ANI-BIS-E"));
    expect(bloque.slice(0, 1500), "la franja se rotuló como un nivel de Wang").not.toContain(
      "Nivel II",
    );
  });

  it("y su Nivel II sigue siendo el molecular, con sus propias filas", () => {
    // El control de que la franja nueva no desplazo ni duplico un nivel que ya existia.
    const limpio = sinComentarios(MAPA);
    expect(limpio).toContain('title: "Nivel II · Molecular"');
    expect(limpio).toContain('["ACT - Agua corporal total", "TBW", "TBW_ref", "L"]');
  });
});
