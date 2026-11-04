import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

import { type EngineInput, runEngine } from "@/clinical-engine";
import {
  MARCA_AZUL,
  MARCA_FRANJA,
  MARCA_HONDA,
  MARCA_TINTA,
  styles,
} from "@/modules/reports/pdf/estilos-del-pdf";
import { ANCHO as ANCHO_DEL_RADAR } from "@/modules/reports/pdf/radar-del-paciente";
import { renderReportPdf } from "@/modules/reports/services/render-report";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LA MAQUETACION DEL INFORME DEL PACIENTE  ·  los cuatro ajustes de forma del 2026-10-30
//
//   a) *"Mas espacio entre 'Informe ANI-BIS-E del paciente' y 'Connected Nutrition Ventures': hoy estan
//      pegadas."*
//   b) *"Despues del bloque 'Como estas'... un salto de pagina: el radar y la explicacion de los 5
//      dominios van en su propia hoja."*
//   c) *"El radar, centrado en la hoja."*
//   e) *"Decorarlo un poco, con el brand de Atlas: el azul electrico y formas de fondo simples... nada que
//      tape el texto ni que gaste tinta."*
//
// ═══ SE MIDE SOBRE EL PDF RENDERIZADO, NO SOBRE EL JSX ═══
//
// Y es la unica forma de que diga algo. Un \`toContain("break")\` sobre el componente comprueba que alguien
// escribio una palabra, no que el documento tenga una pagina mas; un \`toContain("alignItems")\` no dice si
// el dibujo quedo centrado. Asi que esto renderiza el PDF de verdad, descomprime sus streams y lee la
// geometria: donde empieza cada pagina, que rectangulos se pintan y con que color, y con cuanto
// desplazamiento entra el radar.
//
// LAS CIFRAS SE DERIVAN, NO SE ESCRIBEN: el centrado se calcula del ancho de pagina menos los margenes de
// \`styles.page\` y del ANCHO del radar. Un 56 suelto aqui envejeceria el dia que el dibujo cambie de
// tamano, y el candado fallaria por una razon que no es la suya.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Carta en puntos PDF. Es la medida del papel, no una preferencia nuestra. */
const ANCHO_CARTA = 612;

function snapshotConDfiCompleto() {
  const input: EngineInput = {
    sexo: "M",
    edad: 54,
    bisRow: biody as Record<string, unknown>,
    survey: {},
    expectedFieldKeys: ["d2_19"],
    fuerzaPrensil: null,
    model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  };
  const snap = runEngine(input);
  // SE FUERZA EL DFI A COMPLETO, y esto es legitimo porque lo que se mide aqui es MAQUETACION: la hoja de
  // la figura solo existe con el DFI completo, y armar una encuesta completa de verdad pide la BD sembrada
  // (eso ya lo cubren los tests del proyecto |db|). Lo que se afirma no es ningun hecho clinico.
  const dfi = snap.dfi as unknown as {
    complete: boolean;
    domains: { id: string; nombre: string; sev: number | null; lectura: string }[];
  };
  dfi.complete = true;
  dfi.domains = [
    { id: "d1", nombre: "Celular-Eléctrico", sev: 1, lectura: "Lectura de prueba." },
    { id: "d2", nombre: "Metabólico-Estructural", sev: 2, lectura: "Lectura de prueba." },
    { id: "d3", nombre: "Envejecimiento", sev: 0, lectura: "Lectura de prueba." },
    { id: "d4", nombre: "Conductual-Perceptual", sev: 1, lectura: "Lectura de prueba." },
    { id: "d5", nombre: "Epigenético-Contextual", sev: 3, lectura: "Lectura de prueba." },
  ];
  return snap;
}

type Pagina = {
  /** Los streams de contenido, ya descomprimidos. */
  codigo: string;
  /** Las traslaciones `x y cm`, en el orden en que el documento las aplica. */
  traslaciones: { x: number; y: number }[];
};

/** El hex de un color PDF (`r g b scn`) desde su hexadecimal CSS, para comparar sin redondeos. */
function comoPdf(hex: string): string {
  const n = (i: number) => String(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255);
  return `${n(0)} ${n(1)} ${n(2)} scn`;
}

function paginasDe(pdf: Buffer): Pagina[] {
  const latin = pdf.toString("latin1");
  const paginas: Pagina[] = [];
  const re = /stream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) !== null) {
    let ini = m.index + "stream".length;
    while (latin[ini] === "\r" || latin[ini] === "\n") ini++;
    const fin = latin.indexOf("endstream", ini);
    if (fin < 0) continue;
    let codigo: string;
    try {
      codigo = inflateSync(pdf.subarray(ini, fin)).toString("latin1");
    } catch {
      continue; // no todos los streams son de contenido (las fuentes, por ejemplo)
    }
    if (!codigo.includes("BT")) continue; // sin texto no es una pagina del documento
    paginas.push({
      codigo,
      traslaciones: [...codigo.matchAll(/1 0 0 1 ([0-9.]+) ([0-9.]+) cm/g)].map((t) => ({
        x: Number(t[1]),
        y: Number(t[2]),
      })),
    });
  }
  return paginas;
}

/** El primer texto de una pagina, decodificado de los runs hexadecimales del primer `TJ`. */
function primerTexto(pagina: Pagina): string {
  const tj = /\[([^\]]*)\]\s*TJ/.exec(pagina.codigo);
  if (!tj) return "";
  return [...tj[1].matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((h) => Buffer.from(h[1], "hex").toString("latin1"))
    .join("");
}

const PDF = await renderReportPdf(snapshotConDfiCompleto(), {
  patientName: "Paciente Demo",
  documentLabel: "CC 12345",
  evaluationDate: "12/04/2026",
  consultationDate: "12/04/2026",
  profesional: { nombre: "Profesional Demo", profesion: "Nutricionista" },
  reportId: "11111111-1111-1111-1111-111111111111",
});
const PAGINAS = paginasDe(PDF);

describe("el informe del paciente, medido sobre el PDF que sale", () => {
  it("CONTROL: la lectura del PDF encuentra paginas de verdad", () => {
    // Sin esto, todo lo de abajo pasaria verde el dia que @react-pdf cambie de compresion o de operadores:
    // una lista vacia de paginas satisface cualquier aserción que itere sobre ella.
    expect(PAGINAS.length, "no se descomprimio ninguna pagina del PDF").toBeGreaterThanOrEqual(2);
    expect(primerTexto(PAGINAS[0])).toContain("Informe ANI-BIS-E");
  });

  it("(a) el titulo y la firma ya no estan pegados", () => {
    // Eran 2 puntos de separación con un título de 18: la firma colgaba del título. Se mide el ESTILO y no
    // la geometría a propósito: la distancia renderizada depende del alto de línea de la fuente, y un
    // número exacto aquí fallaría el día que cambie la tipografía, por una razón que no es esta.
    expect(styles.title.marginBottom).toBeGreaterThanOrEqual(6);
    // Y la firma es la de marca: en el azul, no en el gris de un subtítulo cualquiera.
    expect(styles.subtitle.color).toBe(MARCA_AZUL);
  });

  it("(b) la figura y las cinco areas abren su PROPIA hoja", () => {
    // LA MEDICION QUE IMPORTA: el primer texto de la segunda pagina ES el título de esa hoja. Si el salto
    // no estuviera, la página empezaría por donde quedó cortado el bloque anterior.
    expect(primerTexto(PAGINAS[1])).toContain("Tu evaluación bioeléctrica integral, área por área");
  });

  it("(c) el radar entra CENTRADO, con la cifra derivada y no escrita", () => {
    const anchoDeContenido = ANCHO_CARTA - 2 * (styles.page.padding as number);
    const centrado = (anchoDeContenido - ANCHO_DEL_RADAR) / 2;
    expect(centrado, "el radar ya no cabe en la hoja: revisa ANCHO").toBeGreaterThan(0);
    const desplazamientos = PAGINAS[1].traslaciones.map((t) => t.x);
    expect(
      desplazamientos,
      `el radar no entra desplazado ${centrado} puntos: quedo pegado al margen`,
    ).toContain(centrado);
  });

  it("(e) la decoracion de marca esta en TODAS las paginas, y es la banda de su azul", () => {
    for (const [i, pagina] of PAGINAS.entries()) {
      expect(
        pagina.codigo,
        `la pagina ${i + 1} no lleva la banda de marca a sangre`,
      ).toContain(`0 0 ${ANCHO_CARTA} ${styles.bandaDeMarca.height} re`);
      expect(pagina.codigo, `la pagina ${i + 1} no pinta la banda en el azul de marca`).toContain(
        comoPdf(MARCA_AZUL),
      );
    }
  });

  it("y NO TAPA TEXTO: la forma suave sale de la hoja por la esquina", () => {
    // Su condición: *"nada que tape el texto ni que gaste tinta"*. Las dos se comprueban en la geometría y
    // no en la intención: el círculo tiene que estar FUERA del área de texto, y la banda tiene que caber
    // en el margen superior.
    const margen = styles.page.padding as number;
    expect(styles.bandaDeMarca.height as number).toBeLessThan(margen);
    // ESTA ES LA ASERCION QUE ATRAPO EL DEFECTO. La primera forma era un circulo de 230 con top -96: su
    // borde inferior caia en 134 y su borde izquierdo en 478, o sea DENTRO de la columna de texto, que
    // llega hasta 572. Al 7 % no tapaba nada legible, pero su condición era "nada que tape el texto", y se
    // puede cumplir de verdad: el borde inferior de la forma no pasa del margen superior de la página.
    const bajoDeLaForma = (styles.formaDeMarca.top as number) + (styles.formaDeMarca.height as number);
    expect(bajoDeLaForma, "la forma de marca baja hasta la columna de texto").toBeLessThanOrEqual(
      margen,
    );
    // Y es suave de verdad, no un bloque de color: por debajo del 10 % no mancha una fotocopia.
    expect(styles.formaDeMarca.opacity as number).toBeLessThanOrEqual(0.1);
  });

  it("y la hoja del plan lleva la MISMA marca, porque llegan en el mismo correo", () => {
    // Aquí se comprueba la COMPOSICION y no la geometría, y la diferencia está razonada: la geometría ya
    // quedó medida arriba sobre el PDF real, y es la misma hoja de estilo y el mismo componente. Lo único
    // que puede fallar distinto en el plan es que nadie lo haya compuesto.
    const PLAN_PDF = readFileSync("src/modules/reports/pdf/plan-document.tsx", "utf8");
    expect(PLAN_PDF, "la hoja del plan salio sin la marca de Atlas").toContain("<MarcaDeFondo />");
    // Y LO PRIMERO DE LA PAGINA, que es lo que la deja DETRAS del contenido: @react-pdf pinta en orden, y
    // puesta despues el circulo taparia texto, que es justo lo que el encargo prohibe.
    const pagina = PLAN_PDF.indexOf("<Page");
    expect(PLAN_PDF.indexOf("<MarcaDeFondo />")).toBeGreaterThan(pagina);
    expect(PLAN_PDF.indexOf("<MarcaDeFondo />")).toBeLessThan(PLAN_PDF.indexOf("styles.title"));
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS AJUSTES DEL 2026-11-03, MEDIDOS SOBRE EL MISMO PDF
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("la franja y los rótulos del radar, medidos sobre el PDF", () => {
  it("la franja va en el azul de marca oscurecido, y la forma de fondo sigue en el claro", () => {
    // ═══ DOS INTENTOS, Y LOS DOS SUYOS (2026-11-03) ═══
    //
    // Por la mañana: *"la franja es un azul electrico algo chillón, prefiero cambiarlo a un azul oscuro
    // (puede ser el de las letras de Atlas #15161a)"*. Se puso, y al verlo impreso: *"se ve muy extraño...
    // volver al azul eléctrico pero un poquito más oscuro, que no quede tan chillón y que tampoco quede
    // gris como este color, ya que ahora se mezcla con el gris del fondo del PDF"*.
    //
    // LAS DOS OBSERVACIONES SON CORRECTAS, y lo que falló fue el diagnóstico: el problema no era la
    // claridad, era el TONO. El tinta de Atlas es un gris azulado casi negro y sobre el gris del visor
    // deja de leerse como marca: parece un borde de la hoja.
    //
    // Y NO ES UN HEXADECIMAL INVENTADO: es el punto medio entre los DOS anclas de marca que el módulo ya
    // declaraba. Se afirma así, derivándolo, y no con el hex escrito aquí: un número suelto en un test no
    // dice de dónde salió, que es la misma regla que gobierna los umbrales clínicos.
    expect(styles.bandaDeMarca.backgroundColor).toBe(MARCA_FRANJA);
    expect(MARCA_FRANJA, "la franja dejó de derivarse de los dos azules de marca").not.toBe(MARCA_AZUL);
    expect(MARCA_FRANJA).not.toBe(MARCA_HONDA);
    expect(MARCA_FRANJA, "volvió al gris, que es lo que se mezclaba con el fondo del visor").not.toBe(
      MARCA_TINTA,
    );
    // Y LA FORMA DE FONDO SE QUEDA EN EL AZUL CLARO, que es la otra mitad de su frase ("dejamos la
    // nubecita como está"): si alguien la cambia "para que combine", este caso lo dice.
    expect(styles.formaDeMarca.backgroundColor, "la forma de fondo también cambió de color").toBe(
      MARCA_AZUL,
    );
    // Y QUE SALGA DE VERDAD en los bytes del documento, no solo en la hoja de estilo.
    expect(
      PAGINAS.some((p) => p.codigo.includes(comoPdf(MARCA_FRANJA))),
      "la franja no salió con ese color en ninguna hoja",
    ).toBe(true);
  });

  it("el rótulo del radar se parte SIN arrastrar el guion, y el nombre completo sigue en la hoja", () => {
    // ═══ SANTIAGO LO REPORTO DOS DIAS SEGUIDOS ═══
    //
    // *"CelularElectrico"*, pegado. La primera vez se midió sobre los bytes y el guion ESTABA: salía
    // "Celular-" / "Eléctrico", que es correcto. Lo que pasa es que los lectores de PDF DES-HIFENAN al
    // copiar, así que al pegarlo sale pegado. El dibujo estaba bien y la lectura no, **y eso ya es un
    // defecto**: no se le puede pedir a un profesional que sepa que su visor miente.
    //
    // ═══ Y EL CANDADO ANTERIOR PASABA POR LA RAZON EQUIVOCADA ═══
    //
    // Exigía "-Eléctrico" en los bytes, y eso lo cumple la LISTA DE DETALLE de debajo del radar, que pinta
    // el nombre entero. O sea que medía otra cosa y habría seguido verde con el radar roto. Por eso aquí
    // se mira el RADAR, acotando por su `fontSize`, y no el documento entero.
    //
    // LO QUE SE AFIRMA: el eje se parte en dos palabras sin guion colgando, y el nombre COMPLETO sigue
    // estando en la hoja (en el detalle), que es lo que hace que no se pierda nada.
    const RADAR = sinComentarios(
      readFileSync("src/modules/reports/pdf/radar-del-paciente.tsx", "utf8"),
    );
    expect(RADAR, "el rótulo volvió a arrastrar el guion al final de la primera línea").toContain(
      "[nombre.slice(0, i), nombre.slice(i + 1)]",
    );

    const runs: string[] = [];
    for (const p of PAGINAS) {
      for (const tj of p.codigo.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
        for (const h of tj[1].matchAll(/<([0-9a-fA-F]+)>/g)) {
          runs.push(Buffer.from(h[1], "hex").toString("latin1"));
        }
      }
    }
    const unido = runs.join("");
    expect(unido, "el radar no dibujó el nombre del dominio").toContain("Celular");
    expect(
      unido,
      "el nombre completo con su guion desapareció del documento: estaba en el detalle por dominio",
    ).toContain("Celular-Eléctrico");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA FECHA DE LA CONSULTA ES EL DIA DE LA ATENCION  ·  2026-11-03
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("la fecha de la consulta no puede ser anterior a la medición", () => {
  it("manda la fecha de la MEDICIÓN, con `created_at` de respaldo", () => {
    // EL DEFECTO, en un informe real (Santiago): *"Fecha de la medición 3/11/2026 · Fecha de la consulta
    // 30/10/2026"*. Leído por el paciente es absurdo: lo midieron en una consulta que, según el papel, ya
    // había terminado cuatro días antes.
    //
    // Y NO ERA UN DATO MALO: `evaluations.created_at` es cuando el profesional ABRIÓ la ficha, y abrirla
    // antes de la cita es normal (se manda el enlace de la encuesta, el paciente la responde en casa).
    // Lo que no es cierto es llamar a eso "la fecha de la consulta".
    //
    // ES LA MISMA REGLA QUE YA RIGE EN LA BASE: `evaluaciones_vigentes` agrupa por
    // `coalesce(dia, created_at)`. Una consulta no podía contarse en octubre para la cohorte y en
    // noviembre para el paciente.
    const REPO = sinComentarios(
      readFileSync("src/modules/reports/data/reports-repository.ts", "utf8"),
    );
    expect(REPO, "la fecha de la consulta volvió a ser la de apertura de la ficha").toContain(
      "return fechaDeMedicion(ev) ??",
    );
    // Y EL RESPALDO SE QUEDA: una consulta sin toma todavía tiene que decir una fecha.
    expect(REPO).toContain("created_at ?? null");
  });

  it("y las dos fechas siguen siendo DOS en el documento", () => {
    // Unificarlas sería la otra forma de "arreglarlo", y sería peor: el paciente no tendría cómo saber
    // cuál está viendo. La medición y la consulta pueden ser días distintos con toda legitimidad (una
    // consulta retroactiva sobre un archivo de hace un mes).
    const DOC = sinComentarios(readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8"));
    expect(DOC).toContain("Fecha de la medición");
    expect(DOC).toContain("Fecha de la consulta");
  });
});
