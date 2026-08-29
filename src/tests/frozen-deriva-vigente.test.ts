import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

// CANDADO DE DERIVA CONTRA LA ENTREGA VIGENTE, y es el que faltaba a los nueve diff que ya existen.
//
// EL HUECO QUE CIERRA. Cada diff del frozen cotea su trozo contra la entrega desde la que se porto, y esa
// entrega esta CONGELADA a proposito. Eso esta bien mientras Gildardo no toque ese trozo. El problema es
// que si lo toca, el diff sigue verde: compara bien contra un archivo viejo. Nueve tests dando garantia de
// algo que ya no era cierto.
//
// LO ENCONTRO EN LA PRIMERA CORRIDA, y era un defecto vivo en pantalla: `cAF` devolvia "Normal" con el
// color AMBAR (#f59e0b), asi que un paciente con angulo de fase NORMAL se pintaba con color de alerta.
// Gildardo lo corrigio (es el quinto de sus cinco defectos, "cAF ya no devuelve Normal con el color de
// alerta") y nosotros no lo habiamos portado. Ninguno de los nueve diff lo vio, y mi propia verificacion
// a mano tampoco: grepee que `cAF` EXISTIERA, que no es lo mismo que verificar que sea correcto.
//
// COMO COMPARA, y por que asi. Linea de codigo a linea de codigo, IGNORANDO TODO EL ESPACIO, porque entre
// v7 y v8 el reformateo cambio el espaciado sin tocar la ciencia (`0.25*x` paso a `0.25 * x`). Comparar
// byte a byte contra la vigente daria cientos de falsos positivos y el candado se volveria ruido, que es
// como mueren los candados. Lo que SI atrapa es un token distinto: una constante, un corte, un color.
//
// LO QUE NO ES: no reemplaza a los diff byte-a-byte. Aquellos prueban que el porte fue fiel a SU entrega;
// este prueba que esa entrega sigue siendo la de hoy. Son preguntas distintas y hacen falta las dos.

const sinEspacio = (t: string) => t.replace(/\s+/g, "");

// Al portar cambiamos la palabra de declaración (`var` de su HTML pasa a `const` en el módulo), y eso es
// andamiaje, no ciencia: `TIEMPOS_DEF` tiene los mismos seis tiempos con los mismos porcentajes. Se quita
// para comparar el CONTENIDO. Solo la de apertura de línea: un `var` en medio de una expresión sí contaría.
const sinDeclaracion = (l: string) => l.replace(/^(const|let|var)\s+/, "");

/** Lineas de CODIGO de un modulo frozen: sin comentarios y sin el andamiaje que es nuestro, no suyo. */
function lineasDeCodigo(modulo: string): string[] {
  const src = readFileSync(`src/clinical-engine/frozen/${modulo}`, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, ""); // cabeceras nuestras
  return src
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        // Cortas no: `}` o `else {` aparecen en cualquier parte y no distinguen nada.
        l.length > 45 &&
        !l.startsWith("//") &&
        // Andamiaje del port a modulo CommonJS, que en su HTML no existe.
        !l.startsWith("module.exports") &&
        !l.startsWith("const {") &&
        !l.startsWith("require("),
    );
}

// EXCEPCIONES, una por una y con su razon. Sin razon escrita, una excepcion es un candado apagado.
const TOLERADAS: Record<string, { patron: RegExp; razon: string }[]> = {
  "engine.dfi.js": [
    {
      patron: /^return \{ domains, riesgo:/,
      razon: "el return final: en su v8 el objeto se arma distinto, mismos campos",
    },
    {
      patron: /_smmwLow/,
      razon: "lleva comentario NUESTRO pegado en la misma linea (el barrido del umbral 24 -> 22)",
    },
  ],
  "engine.indices.js": [
    {
      patron: /_zBis|iscm|iehh|ifcZ|mcaZ|eisgZ|fmiZ|ffwZ|reRinfZ|cZ2|41\.438|computeEB|computeIAE|parseFloat/,
      razon:
        "portado del v7, donde era una FUNCION; en el v8 el mismo calculo va inline dentro del render. " +
        "Las constantes se verifican una por una abajo, que es lo que importa: la ciencia, no la forma.",
    },
    {
      patron: /^(R\d:|return Object\.keys\(RUTA_COND\))/,
      razon:
        "el ENVOLTORIO de las condiciones de ruta difiere: nuestro porte las extrajo a un mapa " +
        "RUTA_COND y en su v8 viven dentro de RUTAS[].condicion. Los CUERPOS se verifican abajo, uno " +
        "por uno, que es donde está la ciencia.",
    },
  ],
  "atlas-tratamiento.js": [
    {
      patron: /salvaguarda=tcaFlag/,
      razon:
        "OBSOLETA desde el 2026-08-29 y se deja como registro: CA-2 se retiro porque el absorbio la " +
        "correccion en su archivo, y el original se re-porto con SU texto. Ya no hay divergencia aqui.",
    },
  ],
};

const MODULOS = [
  "engine.patron.js",
  "engine.dfi.js",
  "engine.core.js",
  "engine.indices.js",
  "atlas-protocolo.js",
  "atlas-tratamiento.js",
  "atlas-tratamiento-nutri.js",
  "derivar-composicion.js",
  "atlas-alertas.js",
];

describe("el frozen no derivó de la entrega vigente de Gildardo", () => {
  const vigente = sinEspacio(readFileSync(HTML_VIGENTE, "utf8"));

  it("la lista de módulos cubre TODOS los del frozen que se portan de su archivo", () => {
    // Sin esto, un modulo nuevo entra sin vigilancia y el candado da una cobertura que no tiene. Es la
    // misma forma del defecto que cierra: una garantia que se cree completa.
    const enDisco = readdirSync("src/clinical-engine/frozen")
      .filter((f) => f.endsWith(".js"))
      // Generados (se producen del original + manifiesto) y el manifiesto mismo: no son porte suyo.
      .filter((f) => !/\.authorized\.js$|\.derived\.js$|^authorized-modifications\.js$/.test(f));
    expect([...enDisco].sort()).toEqual([...MODULOS].sort());
  });

  for (const modulo of MODULOS) {
    it(`${modulo} sigue coincidiendo con su archivo de hoy`, () => {
      const toleradas = TOLERADAS[modulo] ?? [];
      const faltan = lineasDeCodigo(modulo)
        .filter((l) => !vigente.includes(sinEspacio(sinDeclaracion(l))))
        .filter((l) => !toleradas.some((t) => t.patron.test(l)));
      expect(
        faltan,
        `${modulo}: estas líneas ya no están en ${HTML_VIGENTE}. O él las cambió y falta portarlas, ` +
          `o las cambiamos nosotros sin registrarlo en authorized-modifications.js:\n  ` +
          faltan.map((l) => l.slice(0, 120)).join("\n  "),
      ).toEqual([]);
    });
  }
});

describe("las constantes de los índices secundarios, una por una", () => {
  // `engine.indices.js` queda tolerado arriba porque su v8 inlinea el calculo y la comparacion linea a
  // linea no aplica. Pero las CONSTANTES si se pueden cotejar, y son lo unico que hace ciencia: si el
  // moviera una media o una desviacion, aqui truena aunque el bloque entero este escrito de otra forma.
  const vigente = sinEspacio(readFileSync(HTML_VIGENTE, "utf8"));
  const nuestro = readFileSync("src/clinical-engine/frozen/engine.indices.js", "utf8");

  const CONSTANTES = [
    ["ISCM · IFC", "4.1430, 3.0534"],
    ["ISCM · MCA_dif", "0.3261, 1.3467"],
    ["ISCM · ECW/ICW", "-0.0682, 0.9665"],
    ["ISCM · FMI", "7.8875, 3.0139"],
    ["ISCM · FFW", "35.5520, 8.4521"],
    ["IEHH · Re/Rinf", "1.55,   0.15"],
    ["IEHH · C", "1.8294, 0.7719"],
    ["EB-BIS · IFC", "4.0146,  2.2669"],
    ["EB-BIS · PABU", "1.8303,  0.7741"],
    ["EB-BIS · ICEC", "58.578,  13.332"],
  ] as const;

  for (const [nombre, par] of CONSTANTES) {
    it(`${nombre}: ${par.replace(/\s+/g, " ")} está en los dos`, () => {
      expect(nuestro.includes(par), "cambió en NUESTRO frozen").toBe(true);
      expect(vigente.includes(sinEspacio(par)), "ya no está en SU archivo vigente").toBe(true);
    });
  }
});

describe("las condiciones de las seis rutas, cuerpo por cuerpo", () => {
  // Toleradas arriba SOLO por el envoltorio: nuestro porte las sacó a un mapa `RUTA_COND` y en su v8
  // viven dentro de `RUTAS[].condicion`. La condición en sí es la ciencia, y esa sí tiene que coincidir
  // con la de hoy: una ruta que se activa con otro corte cambia el tratamiento del paciente.
  const vigente = sinEspacio(readFileSync(HTML_VIGENTE, "utf8"));
  const nuestro = readFileSync("src/clinical-engine/frozen/engine.indices.js", "utf8").replace(/\r\n/g, "\n");
  // Bloque COMPLETO de cada condición, de `Rn:` hasta la siguiente: R3 y R5 son multilínea y R6 toma dos
  // parámetros. Un regex de una sola línea solo cazaba tres de las seis, y las otras habrían pasado sin
  // mirarse: la peor forma de verde, la parcial y silenciosa.
  const condiciones = [...nuestro.matchAll(/^ {2}(R\d): ([\s\S]*?)(?=\n {2}R\d: |\n\};)/gm)].map(
    (m) =>
      [
        m[1],
        m[2]
          // Los comentarios de rótulo de la SIGUIENTE ruta caen dentro del bloque: son nuestros y en su
          // archivo no existen, así que arrastrarlos haría fallar las seis por una razón falsa.
          .split("\n")
          .filter((l) => !l.trim().startsWith("//"))
          .join("\n")
          .replace(/,\s*$/, "")
          .trim(),
      ] as const,
  );

  it("son las seis, ni una menos", () => {
    // Sin esto, si el regex dejara de casar la lista quedaria vacia y los `it` de abajo no correrian:
    // cero aserciones tambien pasa verde.
    expect(condiciones.map(([id]) => id)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6"]);
  });

  for (const [id, cuerpo] of condiciones) {
    it(`${id}: su condición es la misma en el archivo vigente`, () => {
      expect(
        vigente.includes(sinEspacio(cuerpo)),
        `la condición de ${id} ya no está en su archivo: o la cambió él, o la cambiamos nosotros`,
      ).toBe(true);
    });
  }
});

describe("las copias de su código en fixtures tampoco derivaron", () => {
  // SEPTIMA INSTANCIA DE LA MISMA FORMA, y la encontró el candado de anclajes al preguntarse por qué
  // `dfi-narrative.golden.test.ts` no anclaba a ninguna entrega: no ancla, tiene una COPIA. Hay siete
  // extractos verbatim de su código en `fixtures/reference/`, cada uno sacado de una entrega concreta, y
  // nada verificaba que siguieran siendo los de hoy. Una copia envejece igual que una ruta literal, y
  // encima calla mejor: no menciona ninguna entrega, así que ni siquiera se ve que esté anclada a algo.
  //
  // Son los golden diferenciales: si la copia envejece, el golden compara nuestro porte contra una
  // ciencia que él ya cambió, y pasa verde.
  const vigente = sinEspacio(readFileSync(HTML_VIGENTE, "utf8"));
  const DIR = "src/tests/fixtures/reference";

  // Andamiaje NUESTRO, que en su HTML no existe porque allá todo vive en un solo archivo.
  const ANDAMIAJE = /^(import |export |function computeValidacionRef|return INTER_NUTS\.map)/;

  for (const f of readdirSync(DIR).filter((f) => f.endsWith(".js"))) {
    it(`${f} sigue siendo el de su archivo de hoy`, () => {
      const src = readFileSync(`${DIR}/${f}`, "utf8")
        .replace(/\r\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const faltan = src
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 45 && !l.startsWith("//") && !ANDAMIAJE.test(l))
        .filter((l) => !vigente.includes(sinEspacio(sinDeclaracion(l))));
      expect(
        faltan,
        `${f}: estas líneas ya no están en su archivo vigente. Re-extrae el bloque:\n  ` +
          faltan.map((l) => l.slice(0, 120)).join("\n  "),
      ).toEqual([]);
    });
  }
});
