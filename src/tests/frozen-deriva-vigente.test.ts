import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ENTREGAS, htmlDeEntrega, HTML_VIGENTE } from "./fixtures/html-vigente";

// CANDADO DE DERIVA CONTRA LA ENTREGA VIGENTE, y es el que faltaba a los nueve diff que ya existen.
//
// EL HUECO QUE CIERRA. Cada diff del frozen cotea su trozo contra la entrega desde la que se porto, y esa
// entrega esta CONGELADA a proposito. Eso esta bien mientras Gildardo no toque ese trozo. El problema es
// que si lo toca, el diff sigue verde: compara bien contra un archivo viejo. Nueve tests dando garantia de
// algo que ya no era cierto.
//
// LO ENCONTRO EN LA PRIMERA CORRIDA, y era un defecto vivo en pantalla: `cAF` devolvia "Normal" con el
// color AMBAR (#f59e0b), asi que un paciente con angulo de fase NORMAL se pintaba con color de alerta. La
// etiqueta decia una cosa y el color la contraria, sobre el mismo numero.
//
// Y AL ESCRIBIR EL CONTROL NEGATIVO SALIO QUE LA DERIVA ERA PEOR DE LO QUE YO CONTABA. Dije que el lo
// habia corregido en su archivo del 29; no: ya estaba corregido en el del 28, y en el del 19 y anteriores
// seguia en ambar. O sea que nuestro frozen venia de una entrega VARIAS versiones atras, no una. Ninguno
// de los nueve diff podia verlo, porque todos miraban entregas viejas. Vale la pena dejarlo escrito: el
// relato "se nos escapo la ultima entrega" era mas benigno que el hecho.
//
// Y mi verificacion a mano tampoco lo vio: grepee que `cAF` EXISTIERA, que no es lo mismo que verificar
// que sea correcto. Es la leccion que ya teniamos escrita, cometida sobre la leccion misma.
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

// UNA ASIGNACION SE COMPARA AUNQUE SEA CORTA, y esta linea es el arreglo de un hueco real.
//
// El filtro de abajo descartaba toda linea de 45 caracteres o menos, para no ahogarse en `}` y `else {`,
// que aparecen en cualquier parte y no distinguen nada. Pero una DECLARACION CON VALOR tambien puede ser
// corta, y ahi si vive la ciencia. El caso que lo destapo:
//
//   const LE8_MAPEO_CORREGIDO = false;   <- 34 caracteres
//
// El 2 de septiembre Gildardo lo puso en `true` en su archivo. Ese interruptor cambia la edad
// bioelectrica de TODOS los pacientes entre 1 y 8 anos, y lo dice su propio comentario. Los DOS candados
// que tenian que verlo pasaron verdes: el diff byte-a-byte porque mira la entrega de la que se porto, y
// ESTE porque la linea mide 34 caracteres. La cobertura era menor de lo que su nombre promete, que es
// exactamente la forma de defecto que este archivo dice cerrar.
//
// Medido ANTES de aplicarlo: suma 121 lineas vigiladas y produce 2 rojos, uno real (el interruptor) y uno
// que ya estaba tolerado por sus cuerpos pero no por su linea de apertura (RUTA_COND).
const ES_ASIGNACION = /^(const|let|var)\s+[A-Za-z_$][\w$]*\s*=/;

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
        // Cortas no: `}` o `else {` aparecen en cualquier parte y no distinguen nada. PERO una
        // asignacion si, por corta que sea: ahi es donde vive un interruptor (ver arriba).
        (l.length > 45 || ES_ASIGNACION.test(l)) &&
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
      patron: /^const LE8_MAPEO_CORREGIDO = false;$/,
      razon:
        "DIVERGENCIA DELIBERADA Y FECHADA, no un porte olvidado. El 2-sep su archivo encendio el " +
        "interruptor SIN recalibrar la media y la desviacion del ICEC, que es lo que su propio " +
        "comentario exige hacer 'en el MISMO acto, nunca por separado'. Encenderlo solo baja la edad " +
        "bioelectrica de TODOS los pacientes entre 1 y 8 anos (cifra suya). Preguntado en la ronda del " +
        "2026-09-03 (P-92). NO se tolera a ciegas: 'le8-interruptor-pendiente.test.ts' fija los cuatro " +
        "hechos y se pone ROJO en cuanto el recalibre o vuelva atras, que es cuando hay que portar.",
    },
    {
      patron: /^return \{ domains, riesgo:/,
      razon: "el return final: en su v8 el objeto se arma distinto, mismos campos",
    },
    {
      patron: /_smmwLow/,
      razon: "lleva comentario NUESTRO pegado en la misma linea (el barrido del umbral 24 -> 22)",
    },
  ],
  // ── LOS CUATRO MODULOS QUE SU ENTREGA DEL 3-SEP VACIA DE PROTEINA Y DE GASTO BASAL ──────────────
  //
  // No son cuatro toleradas sueltas: son UNA decision, partida en los modulos donde cae. Se agrupan aqui
  // arriba para que se lean juntas, porque por separado cada una parece un detalle.
  "engine.core.js": [
    {
      patron: /p\.push\("d[eé]ficit cal[oó]rico moderado con prote[ií]na|p\.push\("aumentar aporte proteico/,
      razon: "DIVERGENCIA DELIBERADA, entrega del 2026-09-03. Su entrega RETIRA de cuatro modulos congelados " +
        "toda la prescripcion de proteina y el gasto basal, que es lo que el mismo nos mando portar dos " +
        "dias antes (su §9.6: 'la proteina la prescribe el motor' y 'Harris-Benedict'). Aplicado y en " +
        "produccion: 56 de 60 tratamientos pasaron de 0,8 al valor del motor, y el GEB cambio para " +
        "TODOS. NO se porta la retirada hasta que confirme que es deliberada y diga que hacer con lo " +
        "ya prescrito. Preguntado en la ronda del 2026-09-04 (P-99). Es la misma forma que el " +
        "interruptor del LE8: su documento y su archivo no dicen lo mismo, dos veces en la misma entrega.",
    },
  ],
  "atlas-protocolo.js": [
    {
      patron: /tieneIRC \? \{ nombre:'Prote[ií]na'/,
      razon: "DIVERGENCIA DELIBERADA, entrega del 2026-09-03. Su entrega RETIRA de cuatro modulos congelados " +
        "toda la prescripcion de proteina y el gasto basal, que es lo que el mismo nos mando portar dos " +
        "dias antes (su §9.6: 'la proteina la prescribe el motor' y 'Harris-Benedict'). Aplicado y en " +
        "produccion: 56 de 60 tratamientos pasaron de 0,8 al valor del motor, y el GEB cambio para " +
        "TODOS. NO se porta la retirada hasta que confirme que es deliberada y diga que hacer con lo " +
        "ya prescrito. Preguntado en la ronda del 2026-09-04 (P-99). Es la misma forma que el " +
        "interruptor del LE8: su documento y su archivo no dicen lo mismo, dos veces en la misma entrega.",
    },
  ],
  "atlas-geb.js": [
    {
      // El modulo ENTERO: su entrega retira `ATLAS_GEB` y `ATLAS_GEB_HB` de raiz.
      // El modulo ENTERO: su entrega lo retira de raiz, asi que se toleran todas sus lineas.
      patron: /ATLAS_GEB|Number\(peso\)|medido|var hb =|66\.473|655\.0955|origen:/,
      razon: "DIVERGENCIA DELIBERADA, entrega del 2026-09-03. Su entrega RETIRA de cuatro modulos congelados " +
        "toda la prescripcion de proteina y el gasto basal, que es lo que el mismo nos mando portar dos " +
        "dias antes (su §9.6: 'la proteina la prescribe el motor' y 'Harris-Benedict'). Aplicado y en " +
        "produccion: 56 de 60 tratamientos pasaron de 0,8 al valor del motor, y el GEB cambio para " +
        "TODOS. NO se porta la retirada hasta que confirme que es deliberada y diga que hacer con lo " +
        "ya prescrito. Preguntado en la ronda del 2026-09-04 (P-99). Es la misma forma que el " +
        "interruptor del LE8: su documento y su archivo no dicen lo mismo, dos veces en la misma entrega.",
    },
  ],
  "atlas-tratamiento-nutri.js": [
    {
      patron:
        /protKg|desnutricion|Hiperprote|hasERC|kcalObjetivo|tipoEnergia|ATLAS_GEB_HB|var fatPct|10\*pesoMeta|actividad\.fuerza=/,
      razon: "DIVERGENCIA DELIBERADA, entrega del 2026-09-03. Su entrega RETIRA de cuatro modulos congelados " +
        "toda la prescripcion de proteina y el gasto basal, que es lo que el mismo nos mando portar dos " +
        "dias antes (su §9.6: 'la proteina la prescribe el motor' y 'Harris-Benedict'). Aplicado y en " +
        "produccion: 56 de 60 tratamientos pasaron de 0,8 al valor del motor, y el GEB cambio para " +
        "TODOS. NO se porta la retirada hasta que confirme que es deliberada y diga que hacer con lo " +
        "ya prescrito. Preguntado en la ronda del 2026-09-04 (P-99). Es la misma forma que el " +
        "interruptor del LE8: su documento y su archivo no dicen lo mismo, dos veces en la misma entrega.",
    },
  ],
  "engine.indices.js": [
    {
      patron: /^const RUTA_COND = \{$/,
      razon:
        "la LINEA DE APERTURA del mismo mapa cuyos cuerpos ya estan tolerados abajo: en su v8 las " +
        "condiciones viven dentro de RUTAS[].condicion y este mapa es andamiaje NUESTRO, no ciencia. " +
        "Aparece al empezar a vigilar las asignaciones cortas (2026-09-02); es la excepcion de siempre.",
    },
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
  "atlas-geb.js",
  "atlas-tratamiento-nutri.js",
  "derivar-composicion.js",
  "atlas-alertas.js",
  "atlas-asesoria-macro.js",
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
        // La asignacion entra aunque sea corta, por lo mismo que arriba: el umbral de longitud dejaba
        // fuera los interruptores. Este era el SEGUNDO filtro con el mismo hueco, en el mismo archivo;
        // aparecio al barrer los demas candados. Medido: +36 lineas vigiladas, 0 rojos.
        .filter(
          (l) =>
            (l.length > 45 || ES_ASIGNACION.test(l)) && !l.startsWith("//") && !ANDAMIAJE.test(l),
        )
        .filter((l) => !vigente.includes(sinEspacio(sinDeclaracion(l))));
      expect(
        faltan,
        `${f}: estas líneas ya no están en su archivo vigente. Re-extrae el bloque:\n  ` +
          faltan.map((l) => l.slice(0, 120)).join("\n  "),
      ).toEqual([]);
    });
  }
});

describe("el candado no es vacío: comparado con la entrega ANTERIOR, se pone rojo", () => {
  // CONTROL NEGATIVO, y aquí es imprescindible. Todo lo de arriba son aserciones de la forma "no falta
  // nada", y esa forma pasa verde tambien cuando no hay NADA que comparar: si el filtro de líneas dejara
  // la lista vacía, si `vigente` se leyera mal, o si alguien ampliara las tolerancias hasta cubrirlo todo,
  // el archivo entero seguiría verde diciendo "sin deriva". Un candado que solo sabe decir que sí es un
  // candado apagado.
  //
  // La prueba de que está vivo: corriendo la MISMA comparación contra la entrega ANTERIOR tiene que
  // encontrar diferencias, porque entre las dos él cambió cosas que ya portamos (el `cAF`, el piso
  // calórico, los cortes del IRC). Si esto deja de encontrarlas, la maquinaria dejó de mirar.

  it("hay al menos dos entregas, o no hay nada contra qué contrastar", () => {
    expect(ENTREGAS.length).toBeGreaterThanOrEqual(2);
  });

  it("el frozen SÍ difiere de la entrega anterior: la comparación está viva", () => {
    // BUSCA HACIA ATRAS HASTA ENCONTRAR UNA QUE DIFIERA, en vez de mirar solo la inmediatamente anterior.
    //
    // POR QUE SE CAMBIO (2026-09-03): este control se puso rojo diciendo la verdad. Nuestro frozen se
    // porto DE la entrega del 2-sep, asi que contra ella coincide entero; con la del 3 como vigente, la
    // "anterior" paso a ser justo aquella de la que venimos y el control no podia distinguir nada.
    //
    // Y ESE ROJO NO SIGNIFICABA QUE LA MAQUINARIA ESTUVIERA MUERTA, que es lo que el control existe para
    // detectar: significaba que le toco comparar contra su propia fuente. Un control que se pone rojo por
    // una coincidencia legitima acaba relajandose, y ahi se pierde. Lo que de verdad hay que probar es que
    // la comparacion SABE encontrar diferencias, y para eso sirve cualquier entrega que difiera.
    const anteriores = ENTREGAS.slice(0, -1).reverse();
    let usada = "";
    let faltan: string[] = [];
    for (const carpeta of anteriores) {
      const previa = sinEspacio(
        readFileSync(htmlDeEntrega(carpeta), "utf8"),
      );
      faltan = MODULOS.flatMap((m) =>
        lineasDeCodigo(m)
          .filter((l) => !previa.includes(sinEspacio(sinDeclaracion(l))))
          .filter((l) => !(TOLERADAS[m] ?? []).some((t) => t.patron.test(l))),
      );
      if (faltan.length) {
        usada = carpeta;
        break;
      }
    }
    expect(
      faltan.length,
      `el frozen coincide con TODAS las entregas anteriores (${anteriores.join(", ")}), no solo con la ` +
        `vigente. O él no cambió nada en ninguna, o esta comparación dejó de mirar lo que dice mirar.`,
    ).toBeGreaterThan(0);
    // Y se deja constancia de contra cual encontro diferencias: sin esto, el verde no dice si tuvo que
    // retroceder cinco entregas para hallar una, que ya seria una señal por si misma.
    expect(usada, "deberia haber encontrado una entrega que difiera").not.toBe("");
  });

  it("y entre lo que difiere está el GASTO BASAL, que es de donde cuelga toda la cadena", () => {
    // Ancla CONCRETA, no un conteo: un conteo se satisface con cualquier ruido. El piso pasó de colgar del
    // déficit a colgar de la rama de la fórmula entre esas dos entregas, y eso cambia las kcal que se le
    // prescriben a una paciente real. Si esta diferencia deja de verse, la maquinaria dejó de mirar.
    //
    // ES EL PISO Y NO EL `cAF`, y la corrección de mi propio relato importa: el `cAF` no cambió entre el 28
    // y el 29. Él lo había corregido YA en la entrega del 28, y nuestro frozen seguía trayendo el ámbar
    // porque venía portado de una entrega del 19 o anterior. O sea que la deriva no era de una entrega,
    // era de varias, y ninguno de los nueve diff podía verla porque todos miraban entregas viejas.
    const anterior = readFileSync(
      `docs/entregas/Gildardo responses/${ENTREGAS[ENTREGAS.length - 2]}/ATLAS_v8.html`,
      "utf8",
    );
    const nutri = readFileSync("src/clinical-engine/frozen/atlas-tratamiento-nutri.js", "utf8");
    // EL ANCLA CAMBIO, NO LA ASERCION (2026-09-01). Era el PISO CALORICO, y dejo de servir en cuanto llego
    // la entrega del 1-sep: "la anterior" paso a ser la del 29, que YA traia el piso corregido. El test se
    // puso rojo, que es exactamente lo que tenia que hacer una lista de entregas que crece.
    //
    // EL ANCLA SE MUEVE CON CADA ENTREGA, y eso es lo que la mantiene viva: apunta a la diferencia
    // CONCRETA entre la vigente y la anterior, no a una que ya quedo atras. La del 1-sep era el peso meta;
    // la del 2-sep, el gasto basal; y la del 3-sep es LA RETIRADA DE LA PROTEINA, que es de otro orden:
    // no cambia una formula, quita el bloque entero que prescribe.
    //
    // SE ANCLA AL SENTIDO CONTRARIO QUE LAS ANTERIORES, y por eso hay que leerlo con cuidado: aqui lo que
    // la entrega VIGENTE tiene es una AUSENCIA. La anterior prescribe (protKg con sus ramas) y la de hoy
    // no. Nuestro frozen conserva la version que prescribe, y eso es DELIBERADO mientras el confirme que
    // la retirada es intencional (ver las cuatro toleradas de arriba y la ronda del 2026-09-04, P-99).
    const vigenteTxt = readFileSync(HTML_VIGENTE, "utf8");
    expect(sinEspacio(nutri), "nuestro motor conserva la prescripcion de proteina").toContain(
      sinEspacio("protKg = desnutricion ? 1.5 : 1.25"),
    );
    expect(sinEspacio(anterior), "la entrega ANTERIOR tambien la tenia").toContain(
      sinEspacio("protKg = desnutricion ? 1.5 : 1.25"),
    );
    expect(sinEspacio(vigenteTxt), "y la VIGENTE la retiro: esa es la diferencia de hoy").not.toContain(
      sinEspacio("protKg = desnutricion ? 1.5 : 1.25"),
    );
  });
});
