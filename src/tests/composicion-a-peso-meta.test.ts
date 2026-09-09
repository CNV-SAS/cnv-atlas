import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LA META DE PESO EN LA TABLA DE WANG (2026-09-10, SEGUNDA version).
//
// LA PRIMERA VERSION PROTEGIA LO EQUIVOCADO. Daba por hecho que la meta era una SIMULACION sobre valores
// sellados y blindaba que se viera aparte: columna propia, hairline, cursiva, sin color. Nada de eso
// estaba en su archivo. Lo que su archivo hace (entrega vigente del 4 de septiembre, linea 7721) es poner
// la meta EN LA CELDA DE REFERENCIA de la fila de Peso y la distancia en la de Δ, con las mismas cuatro
// columnas que el resto de la tabla.
//
// Y LA FILA DE PESO NO TIENE OTRA REFERENCIA, ni en su archivo ni en nuestro mapa
// (`["Peso", "peso", null, "kg"]`, sin refKey): la meta no desplaza nada sellado, ocupa una celda que
// estaba vacia. Es la referencia que faltaba, no una simulacion encima de un valor emitido.
//
// LO QUE ESTE CANDADO PROTEGE, que es lo que de verdad importa:
//   1. Que NO se escriba: aqui solo se pinta.
//   2. Que NO viaje al DOCUMENTO (Historia Clinica ni PDF).
//   3. Que NO vuelva a aparecer como columna, ni en Diagnostico, donde la fila de Peso ni existe.
const SECCION = readFileSync("src/modules/diagnoses/components/composition-section.tsx", "utf8");

describe("la meta se pinta, no se escribe", () => {
  it("no hay writer, ni action, ni fetch detrás de ella", () => {
    const limpio = sinComentarios(SECCION);
    for (const prohibido of ["useActionState", "action=", "fetch(", "insert", "update"]) {
      expect(limpio, `la sección de composición ganó un ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("el peso sale del mismo mapa que la tabla, no de una segunda fuente", () => {
    // Dos fuentes del mismo dato es como se produce una tabla que se contradice consigo misma.
    expect(sinComentarios(SECCION)).toContain('.find((r) => r.key === "peso")');
  });
});

describe("es la REFERENCIA de la fila, no una columna nueva", () => {
  it("la tabla sigue teniendo las mismas columnas", () => {
    // El defecto que esto cierra es literal: la primera version hacia `(showDiagnosis ? 5 : 4) + (conMeta
    // ? 1 : 0)`. Si el conteo vuelve a depender de la meta, es que volvio la columna.
    const limpio = sinComentarios(SECCION);
    expect(limpio).toContain("const colCount = showDiagnosis ? 5 : 4;");
    expect(limpio, "volvió el encabezado de la columna retirada").not.toContain("A peso meta");
  });

  it("y solo manda en la fila de Peso, en la tabla de Antropometría", () => {
    // `!showDiagnosis` = la tabla de Antropometria (Diagnostico no tiene fila de Peso).
    // `!soloAlterados` = fuera de la Historia Clinica, que es el documento.
    expect(sinComentarios(SECCION)).toContain(
      'r.key === "peso" && metaVigente != null && !showDiagnosis && !soloAlterados',
    );
  });

  it("y solo si hay meta Y hay peso medido", () => {
    // Una referencia a medias deja la Δ inventandose un numero contra null.
    expect(sinComentarios(SECCION)).toContain(
      "pesoMetaKg != null && pesoMetaKg > 0 && pesoMedido != null",
    );
  });
});

// EL ALCANCE SE BARRE, NO SE FIJA. Una version anterior contaba `pesoMetaKg={` DENTRO de `page.tsx` y
// afirmaba "exactamente uno"; al añadir un segundo sitio de llamada en OTRO archivo, el candado siguio
// verde sin haberlo mirado. Contar dentro de un archivo no dice nada de los demas.
function tsxDelRepo(dir: string, salida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) tsxDelRepo(ruta, salida);
    else if (entrada.endsWith(".tsx")) salida.push(ruta.split(sep).join("/"));
  }
  return salida;
}

/** Cada `<CompositionSection ... />` del repo, con sus props. */
function sitiosDeLlamada() {
  const sitios: { archivo: string; etiqueta: string }[] = [];
  for (const archivo of tsxDelRepo("src")) {
    const src = readFileSync(archivo, "utf8");
    let i = src.indexOf("<CompositionSection");
    while (i !== -1) {
      const cierre = src.indexOf("/>", i);
      sitios.push({ archivo, etiqueta: src.slice(i, cierre === -1 ? i + 800 : cierre) });
      i = src.indexOf("<CompositionSection", i + 1);
    }
  }
  return sitios;
}

const conMeta = () => sitiosDeLlamada().filter((s) => s.etiqueta.includes("pesoMetaKg="));

describe("y NO llega al documento", () => {
  it("el control: la tabla se renderiza en más de un sitio", () => {
    expect(sitiosDeLlamada().length).toBeGreaterThan(1);
  });

  it("la pasa SOLO Antropometría", () => {
    // Antropometria es donde su archivo la tiene y donde la meta se fija. Diagnostico no tiene fila de
    // Peso, y la Historia Clinica es el documento.
    expect(
      conMeta().map((s) => s.archivo),
      "un sitio nuevo pasa la meta, o Antropometría dejó de pasarla",
    ).toEqual(["src/modules/evaluations/components/entrada-evaluacion.tsx"]);
  });

  it("y nunca dentro del bloque de la Historia Clínica", () => {
    // Se mira la ETIQUETA y no el contexto de arriba: en la HC real `soloAlterados` va DESPUES del nombre
    // del componente, asi que una version anterior de esta asercion nunca llegaba a evaluarse.
    for (const sitio of conMeta()) {
      expect(sitio.etiqueta, `la meta cayó en el bloque de la HC (${sitio.archivo})`).not.toContain(
        "soloAlterados",
      );
    }
  });

  it("y el PDF no la conoce", () => {
    const PDF = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
    const HC = readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8");
    for (const [nombre, src] of [["reporte", PDF], ["HC", HC]] as const) {
      expect(src, `el PDF de ${nombre} menciona la meta`).not.toContain("A peso meta");
      expect(src).not.toContain("pesoMetaKg");
    }
  });
});

describe("el signo es el de su archivo, no el intuitivo", () => {
  it("valor menos referencia: por encima de la meta da POSITIVO", () => {
    // Su `difCell` (linea 7392 de la entrega vigente) hace `d = v - r`, la MISMA convencion que las demas
    // deltas de la tabla. Un paciente de 80,4 con meta 75 da +5,4, no -5,4. Es contraintuitivo leido como
    // "lo que hay que bajar", y aun asi es lo correcto: dos signos distintos en la misma tabla es peor.
    //
    // Aqui no hay formula propia: la fila de Peso entra por el MISMO calculo de Δ que el resto, cambiando
    // solo contra que se compara. Eso es lo que se afirma.
    const limpio = sinComentarios(SECCION);
    expect(limpio).toContain("const cut = filaDePesoConMeta ? metaVigente : w ? w.cut : effectiveRef;");
    expect(limpio).toContain("deltaNum = r.value != null && cut != null ? r.value - cut : null;");
    expect(limpio, "el signo invertido sería la otra convención").not.toContain("cut - r.value");
  });
});
