import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ LA GRÁFICA DEL INFORME (2026-09-20) ═══
//
// QUÉ SE BLINDA, y es lo mismo que en el resto del documento del paciente: que no entre el lenguaje del
// modelo. Una gráfica es una puerta nueva para eso, porque un eje rotulado "PABU" o "EB-BIS" pasaría
// desapercibido entre líneas de colores.
//
// Y DOS REGLAS DE LECTURA que un descuido rompe sin que nadie lo note: que no se dibuje una trayectoria
// con un solo punto (una línea plana inventada), y que se diga que el eje no arranca en cero (si no, un
// kilo de diferencia se ve como un salto enorme y el paciente lee lo que no pasó).

const GRAFICA = readFileSync("src/modules/reports/pdf/grafica-trayectoria.tsx", "utf8");
const LECTOR = readFileSync("src/modules/reports/data/serie-del-paciente.ts", "utf8");
const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");

describe("la gráfica no lleva nada del modelo", () => {
  it("las series son medidas del cuerpo, no índices", () => {
    expect(LECTOR).toContain("BIODY_COLUMNS.peso.header");
    expect(LECTOR).toContain("BIODY_COLUMNS.FM.header");
    expect(LECTOR).toContain("BIODY_COLUMNS.FFM.header");
  });

  it("y ningún índice prohibido aparece en la gráfica ni en su lector", () => {
    // SIN COMENTARIOS: los dos archivos NOMBRAN los índices para explicar por qué NO están. Un detector
    // sobre el texto crudo cazaría su propia documentación, que ya nos pasó dos veces.
    const codigo = (t: string) =>
      t.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join(" ");
    for (const idx of ["PABU", "ICA-BIS", "icaBis", "EB-BIS", "ebBis", "IFC", "IRC", "IEHH", "ISCM"]) {
      expect(codigo(GRAFICA), idx + " no puede salir en la gráfica del paciente").not.toContain(idx);
      expect(codigo(LECTOR), idx + " no puede alimentar la gráfica del paciente").not.toContain(idx);
    }
  });
});

describe("las dos reglas de lectura", () => {
  it("con menos de dos puntos no se dibuja nada", () => {
    // Una trayectoria de un punto no es una trayectoria, y una línea plana inventada es peor que nada.
    expect(GRAFICA).toContain("if (puntos.length < 2) return null;");
    expect(DOC).toContain("serie.length >= 2");
  });

  it("y se dice que el eje no arranca en cero", () => {
    // Sin decirlo, la gráfica exagera el cambio sin querer: un kilo se ve como un salto.
    expect(GRAFICA).toContain("no empieza en cero");
  });

  it("cada línea lleva su rótulo y su último valor: no hay leyenda que descifrar", () => {
    expect(GRAFICA).toContain("s.rotulo");
    expect(GRAFICA).toContain("uno(ultimo.v)");
  });
});

describe("el lector de la serie", () => {
  it("funde las mediciones del mismo día: una consulta es un punto", () => {
    expect(LECTOR).toContain("porFecha");
  });

  it("y acota cuántas consultas se muestran", () => {
    // Más puntos en una hoja carta no se leen.
    expect(LECTOR).toContain("MAX_PUNTOS");
    expect(LECTOR).toContain("slice(-MAX_PUNTOS)");
  });
});
