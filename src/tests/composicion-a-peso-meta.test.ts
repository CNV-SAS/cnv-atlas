import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LA COLUMNA "A PESO META" · ES UNA SIMULACION (2026-09-10).
//
// QUE ES: lo que el peso seria a la meta acordada, y cuanto falta. SU ARCHIVO LA TIENE (v8 del 13 de
// agosto, linea 7482) en esta misma fila, con `difCell(pesoActual, pesoMeta, true)`.
//
// LO QUE ESTE CANDADO PROTEGE es lo unico que la hace segura: **se calcula al leer y no se escribe en
// ninguna parte**. Las columnas Referencia y Δ salen del snapshot SELLADO; esta no puede colarse ahi ni
// en el documento, porque entonces el profesional leeria como emitido algo que no lo es.
const SECCION = readFileSync(
  "src/modules/diagnoses/components/composition-section.tsx",
  "utf8",
);

describe("la columna se calcula al leer y no se escribe", () => {
  it("no hay writer, ni action, ni columna nueva detrás de ella", () => {
    const limpio = sinComentarios(SECCION);
    for (const prohibido of ["useActionState", "action=", "fetch(", "insert", "update"]) {
      expect(limpio, `la sección de composición ganó un ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("sale del peso MEDIDO del mismo mapa, no de una segunda fuente", () => {
    // Dos fuentes del mismo dato es como se produce una tabla que se contradice consigo misma.
    const limpio = sinComentarios(SECCION);
    expect(limpio).toContain('.find((r) => r.key === "peso")');
  });
});

// EL ALCANCE SE BARRE, NO SE FIJA (2026-09-10, segunda version). La primera contaba `pesoMetaKg={`
// DENTRO de `page.tsx` y afirmaba "exactamente uno". Al añadir la columna en Antropometria, el segundo
// sitio de llamada quedo FUERA de lo que el candado miraba y paso verde sin haberlo visto: contar dentro
// de un archivo no dice nada de los demas archivos.
//
// Ahora se barren TODOS los `<CompositionSection ...>` del repositorio y se listan por sitio. La lista de
// permitidos esta escrita aqui con su razon, asi que un cuarto sitio (o mover uno) se pone rojo aunque
// nadie se acuerde de esta regla.
function tsxDelRepo(dir: string, salida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) tsxDelRepo(ruta, salida);
    else if (entrada.endsWith(".tsx")) salida.push(ruta.split(sep).join("/"));
  }
  return salida;
}

/** Cada `<CompositionSection ... />` del repo, con sus props: archivo y cuerpo de la etiqueta. */
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

const conColumna = () => sitiosDeLlamada().filter((s) => s.etiqueta.includes("pesoMetaKg="));

describe("solo la miran los DOS sitios donde se decide y se lee", () => {
  it("el control: la tabla se renderiza en más de un sitio", () => {
    // Sin esto, un barrido que no encontrara nada haria pasar en verde todo lo de abajo.
    expect(sitiosDeLlamada().length).toBeGreaterThan(1);
  });

  it("la pasan Antropometría y Diagnóstico, y nadie más", () => {
    // ANTROPOMETRIA: es donde la meta se FIJA, y es la razon literal que dio Gildardo (no recordar de que
    // peso se parte). DIAGNOSTICO: es donde se LEE el resultado. En los dos es el mismo componente, asi
    // que son las mismas garantias.
    const permitidos = [
      "src/modules/evaluations/components/entrada-evaluacion.tsx",
      "src/app/(app)/evaluaciones/[id]/page.tsx",
    ];
    expect(
      conColumna().map((s) => s.archivo).sort(),
      "un sitio nuevo pasa la simulación, o uno de los dos dejó de pasarla",
    ).toEqual(permitidos.sort());
  });

  it("y NUNCA en el bloque de la Historia Clínica", () => {
    // La HC es el DOCUMENTO: una simulacion ahi se presentaria como parte de lo emitido. El bloque se
    // reconoce por `soloAlterados`, que es la vista resumida que SOLO la HC usa.
    //
    // Se mira la ETIQUETA, no el contexto de arriba (2026-09-10): la primera version leia los 1400
    // caracteres previos, y en la HC real `soloAlterados` va DESPUES del nombre del componente, asi que la
    // asercion nunca llegaba a evaluarse. Verde por el sitio equivocado, que es lo mismo que no tenerla.
    for (const sitio of conColumna()) {
      expect(
        sitio.etiqueta,
        `la simulación cayó en el bloque de la Historia Clínica (${sitio.archivo})`,
      ).not.toContain("soloAlterados");
    }
  });

  it("y el PDF no la conoce", () => {
    const PDF = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
    const HC = readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8");
    for (const [nombre, src] of [["reporte", PDF], ["HC", HC]] as const) {
      expect(src, `el PDF de ${nombre} menciona la simulación`).not.toContain("A peso meta");
      expect(src).not.toContain("pesoMetaKg");
    }
  });
});

describe("el signo es el de su archivo, no el intuitivo", () => {
  it("valor menos referencia: por encima de la meta da POSITIVO", () => {
    // Verificado en su `difCell` (v8, línea 7153): `d = valor - ref`, la MISMA convención que las demás
    // deltas de esta tabla. Un paciente de 80,4 con meta 75 da +5,4, no -5,4. Es contraintuitivo leído
    // como "lo que hay que bajar", y aun así es lo correcto: dos signos distintos en la misma tabla es
    // peor que uno que el rótulo explica.
    const limpio = sinComentarios(SECCION);
    expect(limpio).toContain("const d = Math.round((actual - meta) * 10) / 10;");
    expect(limpio, "el signo invertido sería la otra convención").not.toContain("(meta - actual)");
  });

  it("y el encabezado dice qué significa el signo", () => {
    // Sin eso, un "+5,4" se lee como "le sobran" o "le faltan" según quién mire.
    expect(SECCION).toContain("(+ = por encima)");
  });
});

describe("se distingue de las columnas selladas", () => {
  it("hairline y cursiva, no solo el rótulo", () => {
    // Si se ve igual que las selladas, se lee igual. El rótulo solo no basta.
    // Se ancla en el ENCABEZADO renderizado, no en la primera aparicion del texto: la primera esta en un
    // comentario del propio archivo y el candado estaria mirando prosa.
    const i = SECCION.indexOf('A peso meta{" "}');
    expect(i, "no se encontro el encabezado renderizado").toBeGreaterThan(-1);
    const encabezado = SECCION.slice(Math.max(0, i - 400), i);
    expect(encabezado).toContain("border-l border-border");
    expect(encabezado).toContain("italic");
  });

  it("y NO lleva color clínico: el color es de lo emitido", () => {
    // Su archivo SÍ la colorea (invierte el semáforo en esa fila). No se porta: nuestro `--clinical-*`
    // sale de sus clasificadores y está reservado para lo que el motor emitió. Pintar una simulación con
    // el color de un veredicto es exactamente confundirlas.
    const i = SECCION.indexOf("{conMeta ? (");
    const celda = SECCION.slice(SECCION.indexOf("{conMeta ? (", i + 10));
    expect(celda.slice(0, 900), "la celda de simulación ganó color clínico").not.toContain(
      "clinical-",
    );
  });

  it("y solo aparece si hay meta Y hay peso", () => {
    // Una columna vacía invita a preguntarse qué falta.
    const limpio = sinComentarios(SECCION);
    expect(limpio).toContain("pesoMetaKg != null && pesoMetaKg > 0 && pesoActual != null");
  });
});
