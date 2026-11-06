import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { Document, Page, renderToBuffer, Text as TextDelPaquete } from "@react-pdf/renderer";

import { type EngineInput, runEngine } from "@/clinical-engine";
import { Text as TextDeLaCasa } from "@/modules/reports/pdf/text-seguro";
import { paraPdf, simbolosSinEquivalencia } from "@/modules/reports/pdf/texto-para-pdf";
import { renderReportPdf } from "@/modules/reports/services/render-report";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: NINGUN SIMBOLO LLEGA ROTO AL PDF  ·  2026-11-03
//
// ═══ EL DEFECTO (Santiago, leyendo el informe de un paciente real) ═══
//
// *"Los SIMBOLOS ROTOS: «e25g», «e7h» y «’» en lugar de ≥ y →. La fuente del PDF no los tiene. Arreglalo
// en los dos documentos y deja un candado que busque esos caracteres en el PDF generado."*
//
// `@react-pdf` compone con las fuentes estandar del PDF (Helvetica), cuya codificacion es WinAnsi. `≥`,
// `→`, `φ`, `−`, `Δ` y los emojis no estan ahi, y el renderizador NO FALLA: emite el byte que puede y
// sale otra letra. Por eso `≥25g` se imprimio como `e25g`.
//
// ═══ ESTE CANDADO MIDE EL PDF, NO EL CODIGO, Y ESA ES LA DIFERENCIA ═══
//
// Una asercion sobre las fuentes diria que el arreglo esta escrito. Lo que hay que saber es si SALE, y
// para eso hay que abrir los bytes: se descomprimen los streams de contenido y se leen los runs de texto
// que el documento pinta. Es el mismo camino que midio la maquetacion del informe.
//
// ═══ Y LAS OTRAS DOS MITADES, QUE SON LAS QUE EVITAN QUE VUELVA ═══
//
//   · EL BARRIDO DEL TEXTO CLINICO: si manana un texto trae un simbolo que el mapa no contempla, se
//     quitaria en silencio (que es mejor que imprimir basura, pero sigue perdiendo informacion). Este
//     caso falla ANTES, para que ese simbolo obligue a una decision.
//   · LA PUERTA UNICA: ningun archivo de `pdf/` puede importar `Text` de `@react-pdf/renderer`. Sin eso,
//     el proximo documento volveria a importarlo del paquete y nadie se enteraria hasta que un paciente
//     reciba su informe.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * La frase de control: lleva TODOS los simbolos del defecto, y se compone de verdad en un PDF.
 *
 * \u2550\u2550\u2550 POR QUE SE MIDE ASI Y NO BUSCANDO `\u2265` EN EL PDF \u2550\u2550\u2550
 *
 * La primera version de este candado buscaba el caracter crudo en los bytes del documento, y ERA VACUA:
 * los streams se leen en latin1, asi que un `\u2265` (U+2265) no puede aparecer ahi NUNCA, traducido o no. El
 * defecto no deja el simbolo: deja OTRA LETRA (por eso Santiago leyo "e25g" y no un cuadrito).
 *
 * Asi que se mide al reves y de las dos formas: la misma frase se compone con el `Text` de la casa y con
 * el del paquete, y se comparan. Con el nuestro tiene que LEERSE; con el del paquete tiene que salir
 * distinta. Si algun dia @react-pdf aprende estos glifos, el caso de control falla y nos enteramos.
 */
const FRASE_DE_CONTROL = "\u226525g \u22647h \u2192 \u2190 PCR\u2191 alb\u00FAmina\u2193 \u03C6=1,618 \u22125 \u0394 \u22481 \u2208 \u221E \u207A \uD83D\uDD34 \u26A0";

function textoDelPdf(pdf: Buffer): string {
  const latin = pdf.toString("latin1");
  const trozos: string[] = [];
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
      continue; // las fuentes y las imagenes tambien son streams
    }
    if (!codigo.includes("BT")) continue;
    // LOS RUNS DE TEXTO van en hexadecimal dentro de los `TJ`. Se decodifican todos, no el primero: lo
    // que se busca puede estar en cualquier linea de cualquier hoja.
    for (const tj of codigo.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const h of tj[1].matchAll(/<([0-9a-fA-F]+)>/g)) {
        trozos.push(Buffer.from(h[1], "hex").toString("latin1"));
      }
    }
  }
  return trozos.join("");
}

/**
 * Un snapshot con las rutas activas, que es donde viven los textos con los simbolos: "≥25g por comida",
 * "Sueño reparador ≥7h", "sulforafano → Nrf2". Mismo input que la medicion de la maquetacion.
 */
function snapshotConRutas() {
  const input: EngineInput = {
    sexo: "M",
    edad: 54,
    bisRow: biody as Record<string, unknown>,
    survey: {},
    expectedFieldKeys: ["d2_19"],
    fuerzaPrensil: null,
    model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  };
  return runEngine(input);
}

const PDF = await renderReportPdf(snapshotConRutas(), {
  patientName: "Paciente Demo",
  documentLabel: "CC 12345",
  evaluationDate: "12/04/2026",
  consultationDate: "12/04/2026",
  profesional: { nombre: "Profesional Demo", profesion: "Nutricionista" },
  reportId: "11111111-1111-1111-1111-111111111111",
});
const TEXTO = textoDelPdf(PDF);

/** Compone UNA frase en un PDF minimo con el `Text` que se le pase, y devuelve lo que el documento pinta. */
async function textoDeUnaFrase(
  frase: string,
  Componente: typeof TextDeLaCasa | typeof TextDelPaquete,
): Promise<string> {
  const bytes = await renderToBuffer(
    <Document>
      <Page size="LETTER" style={{ padding: 40, fontSize: 10 }}>
        <Componente>{frase}</Componente>
      </Page>
    </Document>,
  );
  return textoDelPdf(bytes);
}

describe("ningún símbolo llega roto al PDF del paciente", () => {
  it("CONTROL: la lectura encuentra texto de verdad en el PDF", () => {
    // Sin esto, un fallo al descomprimir dejaria el texto vacio y TODO lo de abajo pasaria en verde
    // afirmando que no hay simbolos rotos. Es el mismo guard que la medicion de la maquetacion.
    expect(TEXTO.length, "no se pudo leer el texto del PDF: lo de abajo no probaría nada").toBeGreaterThan(
      500,
    );
    // EL TITULO CAMBIO EL 2026-11-06 (Santiago): "Informe de evaluacion bioelectrica", con el modelo en
    // el subtitulo. Lo que este control necesita es un ancla que exista; se usa el titulo de hoy.
    expect(TEXTO).toContain("Informe de evaluación bioeléctrica");
  });

  it("la frase de control sale LEGIBLE del PDF, compuesta con el `Text` de la casa", async () => {
    const texto = await textoDeUnaFrase(FRASE_DE_CONTROL, TextDeLaCasa);
    // Se exige lo que cada símbolo pasó a decir, no que el símbolo no esté: quitarlo también haría pasar
    // un "no está", y perder el `≥` de "≥25 g" es una prescripción distinta.
    expect(texto).toContain(">=25g");
    expect(texto).toContain("<=7h");
    expect(texto).toContain("->");
    expect(texto).toContain("PCR (alto)");
    expect(texto).toContain("albúmina (bajo)");
    expect(texto).toContain("phi=1,618");
    expect(texto).toContain("-5");
    expect(texto).toContain("Delta");
  });

  it("CONTROL AL REVÉS: con el `Text` del paquete la misma frase sale rota", async () => {
    // Sin este caso, todo lo de arriba podría pasar en verde el día que el defecto no exista y el
    // envoltorio no haga nada. Esto demuestra que el defecto ES REAL en esta versión de @react-pdf: la
    // misma frase, compuesta sin traducir, no contiene lo que debería leerse.
    const roto = await textoDeUnaFrase(FRASE_DE_CONTROL, TextDelPaquete);
    expect(roto, "el PDF crudo no compuso nada: el control no probaría nada").not.toBe("");
    expect(
      roto.includes(">=25g"),
      "el paquete ya dibuja estos glifos: este candado y su traducción sobran, revísalo",
    ).toBe(false);
    // Y la forma exacta del síntoma que reportó Santiago: donde debía ir `≥25g` sale otra letra pegada.
    expect(roto, "el síntoma cambió de forma: vuelve a mirar qué imprime").toContain("25g");
  });

  it("y los comparadores NO se perdieron: se tradujeron", () => {
    // ESTA ES LA MITAD QUE IMPORTA. Quitar el `≥` haria pasar el caso de arriba y dejaria "25 g" donde
    // decia "≥25 g", que es una PRESCRIPCION DISTINTA, legible y falsa. Así que se exige que la
    // traducción esté, no solo que el símbolo no esté.
    expect(paraPdf("Distribución proteica: ≥25g por comida")).toBe(
      "Distribución proteica: >=25g por comida",
    );
    expect(paraPdf("Sueño reparador ≥7h")).toBe("Sueño reparador >=7h");
    expect(paraPdf("sulforafano → Nrf2 → protección")).toBe("sulforafano -> Nrf2 -> protección");
    expect(paraPdf("−5 a +5 años")).toBe("-5 a +5 años");
    expect(paraPdf("φ = 1,618")).toBe("phi = 1,618");
    // Los sufijos de biomarcador quedan legibles en cualquier posición, que es por lo que van en paréntesis.
    expect(paraPdf("PCR↑, albúmina↓")).toBe("PCR (alto), albúmina (bajo)");
    // Y lo que SÍ dibuja la fuente no se toca: tildes, eñes, el punto medio y las comillas tipográficas.
    expect(paraPdf("Año · «cómo estás» – ok")).toBe("Año · «cómo estás» – ok");
  });

  it("el mapa cubre TODO el texto clínico del repositorio", () => {
    // Si no, un símbolo nuevo se quitaría en silencio. Se barre donde vive el texto que puede llegar a un
    // documento: el motor (sus cadenas de contenido) y el módulo de reportes.
    const sueltos = new Map<string, string[]>();
    for (const ruta of fuentes("src/clinical-engine").concat(fuentes("src/modules/reports"))) {
      // SOLO LAS CADENAS, y los comentarios se quitan PRIMERO con el helper de la casa: las cabeceras de
      // este repositorio usan `═` y `─`, y su prosa cita textos entre comillas que cruzan varias líneas.
      // Sin quitarlos, el barrido se pone rojo por la documentación y no por un texto que se imprima.
      const texto = sinComentarios(readFileSync(ruta, "utf8"));
      for (const cadena of texto.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`\\]*)`/g)) {
        const valor = cadena[1] ?? cadena[2] ?? cadena[3] ?? "";
        for (const c of simbolosSinEquivalencia(valor)) {
          const donde = sueltos.get(c) ?? [];
          if (donde.length < 2) donde.push(ruta.split("\\").join("/"));
          sueltos.set(c, donde);
        }
      }
    }
    const resumen = [...sueltos.entries()].map(
      ([c, donde]) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")} ${JSON.stringify(c)} en ${donde.join(", ")}`,
    );
    expect(
      resumen,
      "estos símbolos no están en EQUIVALENCIAS_PDF: decide qué dicen en vez de dejar que se quiten solos",
    ).toEqual([]);
  });

  it("y ningún documento importa el `Text` del paquete por su cuenta", () => {
    // LA PUERTA UNICA. Es lo que hace que las 169 llamadas a `<Text>` estén cubiertas sin tocarlas: si un
    // archivo lo importa del paquete, sus textos vuelven a salir sin traducir. `SvgText` sí viene del
    // paquete (dentro de un `<Svg>` el texto es otra primitiva), y por eso se busca el nombre exacto.
    const culpables = fuentes("src/modules/reports/pdf")
      .filter((r) => !r.includes("text-seguro"))
      .filter((r) => {
        const src = readFileSync(r, "utf8");
        const imports = src.match(/import \{([^}]*)\} from "@react-pdf\/renderer"/g) ?? [];
        return imports.some((i) => /[{,]\s*Text\s*[,}]/.test(i));
      });
    expect(culpables.map((r) => r.split("\\").join("/")), "importan Text del paquete").toEqual([]);
  });
});

/** Los .ts/.tsx de un directorio, recursivo. */
function fuentes(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) fuentes(ruta, acc);
    else if (/\.(ts|tsx|js)$/.test(nombre)) acc.push(ruta);
  }
  return acc;
}
