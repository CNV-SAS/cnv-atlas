import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EL PIPELINE CLINICO CORRE FUERA DE UN REQUEST, ASI QUE NADA QUE LLAME PIDE COOKIES
//
// ═══ EL DEFECTO QUE LO MOTIVA (2026-10-30) ═══
//
// El gate del control de calidad biologico entro al pipeline leyendo con `createSupabaseServerClient`,
// que empieza por `await cookies()`. El pipeline corre tambien FUERA de un request scope (los tests de BD
// lo llaman directo, y el seed golden tambien), asi que `cookies()` lanza: 18 tests de cuatro archivos
// cayeron con *"cookies was called outside a request scope"*, ninguno relacionado con el QC.
//
// Lo esperable habria sido que el gate rompiera el QC. Rompio la CORRECCION de evaluaciones, la
// PROPAGACION, el SELLADO de la trayectoria y la EDICION de encuesta, porque todos pasan por el pipeline.
// Un lector que pide el request contamina a todo el que lo llame, por lejos que este.
//
// ═══ Y YA ESTABA ESCRITO, EN EL ARCHIVO DE AL LADO ═══
//
// `getSealedValidityCaveats`, que el pipeline ya llamaba, lo dice en su comentario desde que se escribio:
// *"usa Drizzle owner (db), NO el cliente RLS: el pipeline corre server-side y a veces fuera de un request
// scope (p. ej. el seed golden/tests), donde cookies() no aplica"*. La regla existia, con su razon, y el
// lector nuevo no la aplico. Un hazard documentado sigue vivo donde nadie lo aplico.
//
// ═══ POR QUE SE BARRE POR SIMBOLO Y NO POR ARCHIVO ═══
//
// La primera version de este candado barrio el grafo de IMPORTS y dio un falso positivo inmediato:
// `bis-conditions-reader.ts` guarda en un mismo archivo la funcion de drizzle que el pipeline llama
// (`getSealedValidityCaveats`) y otras dos que si usan el cliente RLS porque las llama la PANTALLA
// (`getEvaluationPatientSex`, `getActiveBisConditionCatalog`). Ese archivo esta bien, y acusarlo habria
// obligado a partirlo en dos o a poner una excepcion, que es como un candado se vuelve decorativo.
//
// UNA ARISTA DE IMPORT NO ES UNA ARISTA DE LLAMADA. Asi que el barrido sigue los SIMBOLOS: de cada
// declaracion alcanzada mira su cuerpo, y de ahi salta solo a los nombres importados que ese cuerpo
// MENCIONA. Lo que el pipeline no llama, no cuenta.
//
// El codigo de NIVEL DE MODULO es la excepcion y va siempre: se ejecuta por el solo hecho de importar el
// archivo, lo llame alguien o no.
//
// LO QUE NO CUBRE, y conviene decirlo: imports dinamicos (hay un test que comprueba que no hay ninguno),
// y una llamada indirecta a traves de una variable. Es una aproximacion del grafo de llamadas, no el
// grafo. Atrapa la forma por la que esto entro, que es un lector nuevo colgado de un servicio.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// ═══ LAS RAICES SON LAS QUE DE VERDAD CORREN SIN REQUEST, NI UNA MAS ═══
//
// Las dos se llaman DIRECTO desde los tests de BD y desde el seed golden, sin pasar por ningun action.
//
// `reemitir-diagnostico.ts` NO esta aqui a proposito, y vale decir por que: hoy pide el request (por
// `getDiagnosisEmissionVersions`) y eso esta bien, porque Santiago pidio expresamente que la reemision
// corra desde una PANTALLA y no desde un script (*"un acto que escribe registros clinicos necesita actor
// autenticado, policy e IP"*, 2026-10-29). Ponerla de raiz exigiria una propiedad que nadie pidio y
// obligaria a cambiar codigo correcto. La consecuencia, para quien la busque: la reemision no se puede
// mover a un script sin resolver esto primero.
const RAICES = [
  "src/modules/clinical-pipeline/services/run-pipeline.ts",
  "src/modules/corrections/services/correct-evaluation.ts",
];

/** Lo que no puede ejecutarse fuera de un request, con el motivo que se imprime al fallar. */
const PROHIBIDO: { patron: RegExp; porque: string }[] = [
  { patron: /\bcookies\s*\(/, porque: "`cookies()` lanza fuera de un request scope" },
  {
    patron: /\bcreateSupabaseServerClient\b/,
    porque: "`createSupabaseServerClient` empieza por `await cookies()`",
  },
  {
    patron: /\bheaders\s*\(\s*\)/,
    porque: "`headers()` lanza fuera de un request (es el mismo almacen que `cookies()`)",
  },
  {
    patron: /\bgetClientIp\s*\(/,
    porque: "`getClientIp` lee `headers()`; la IP la resuelve el action y viaja como dato",
  },
];

function resolver(desde: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    base = `src/${spec.slice(2)}`;
  } else if (spec.startsWith(".")) {
    const pila: string[] = [];
    for (const p of [...desde.split("/").slice(0, -1), ...spec.split("/")]) {
      if (p === "." || p === "") continue;
      if (p === "..") pila.pop();
      else pila.push(p);
    }
    base = pila.join("/");
  } else {
    return null; // paquete de node_modules: no es nuestro codigo
  }
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
    if ((cand.endsWith(".ts") || cand.endsWith(".tsx")) && existsSync(cand)) return cand;
  }
  return null;
}

type Archivo = {
  /** nombre importado -> archivo del repo donde vive. Solo imports de VALOR: los `type` los borra tsc. */
  importes: Map<string, string>;
  /** nombre declarado -> su cuerpo, para las declaraciones que NO corren al importar. */
  diferidas: Map<string, string>;
  /** Todo lo que se ejecuta por el solo hecho de importar el archivo. */
  nivelDeModulo: string;
};

const cache = new Map<string, Archivo>();

function leer(ruta: string): Archivo {
  const yaEsta = cache.get(ruta);
  if (yaEsta) return yaEsta;
  const codigo = sinComentarios(readFileSync(ruta, "utf8"));

  const importes = new Map<string, string>();
  for (const m of codigo.matchAll(
    /^\s*import\s+(?!type\s)([^;]*?)\s+from\s+["']([^"']+)["']/gm,
  )) {
    const destino = resolver(ruta, m[2]);
    if (!destino) continue;
    for (const crudo of m[1].replace(/[{}]/g, ",").split(",")) {
      const nombre = crudo.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (nombre && /^[A-Za-z_$][\w$]*$/.test(nombre)) importes.set(nombre, destino);
    }
  }

  // LAS LINEAS DE IMPORT SE BORRAN ANTES DE BARRER, y esto el candado lo aprendio fallando: un `import
  // { createSupabaseServerClient }` acusaba al archivo de llamarlo. Importar un nombre no lo ejecuta; de
  // hecho es lo contrario de ejecutarlo. Se sustituyen por espacios para no mover la numeracion.
  const sinImports = codigo.replace(/^[ \t]*import\s+[^;]*?["'][^"']+["'];?/gm, (m) =>
    m.replace(/[^\n]/g, " "),
  );

  // Se parte el archivo en declaraciones de nivel superior. Una declaracion empieza en la columna 0; lo
  // que sigue hasta la siguiente es su cuerpo.
  const INICIO =
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/;
  const lineas = sinImports.split("\n");
  const cortes: { nombre: string; linea: number; diferida: boolean }[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = INICIO.exec(lineas[i]);
    if (!m) continue;
    // DIFERIDA = crear el valor no lo ejecuta: una `function`, o un `const` cuyo valor es una funcion. Un
    // `const X = new Map(...)` SI corre al importar, asi que cuenta como nivel de modulo.
    const diferida =
      /\b(?:async\s+)?function\s/.test(lineas[i]) ||
      /=\s*(?:async\s*)?(?:\(|[A-Za-z_$][\w$]*\s*=>)/.test(lineas[i]);
    cortes.push({ nombre: m[1], linea: i, diferida });
  }

  const diferidas = new Map<string, string>();
  const sueltas: string[] = [];
  for (let c = 0; c < cortes.length; c++) {
    const hasta = c + 1 < cortes.length ? cortes[c + 1].linea : lineas.length;
    const cuerpo = lineas.slice(cortes[c].linea, hasta).join("\n");
    if (cortes[c].diferida) diferidas.set(cortes[c].nombre, cuerpo);
    else sueltas.push(cuerpo);
  }
  const antesDeLaPrimera = lineas.slice(0, cortes[0]?.linea ?? lineas.length).join("\n");

  const archivo: Archivo = {
    importes,
    diferidas,
    nivelDeModulo: [antesDeLaPrimera, ...sueltas].join("\n"),
  };
  cache.set(ruta, archivo);
  return archivo;
}

type Hallazgo = { donde: string; porque: string; camino: string[] };

/** Recorre el grafo de llamadas aproximado desde una raiz y devuelve lo prohibido que alcanza. */
function barrer(raiz: string): { hallazgos: Hallazgo[]; alcanzados: Set<string> } {
  const hallazgos: Hallazgo[] = [];
  const alcanzados = new Set<string>();
  const vistos = new Set<string>();
  // La raiz entra COMPLETA: todo el archivo del servicio es codigo del pipeline.
  const cola: { archivo: string; simbolo: string | null; camino: string[] }[] = [
    { archivo: raiz, simbolo: null, camino: [raiz] },
  ];

  while (cola.length > 0) {
    const { archivo, simbolo, camino } = cola.shift()!;
    const clave = `${archivo}#${simbolo ?? "*"}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    alcanzados.add(archivo);

    const f = leer(archivo);
    // El nivel de modulo se mira la PRIMERA vez que se alcanza el archivo, porque corre al importarlo.
    const trozos: { etiqueta: string; codigo: string }[] = [];
    if (!vistos.has(`${archivo}#<modulo>`)) {
      vistos.add(`${archivo}#<modulo>`);
      trozos.push({ etiqueta: "(nivel de modulo)", codigo: f.nivelDeModulo });
    }
    if (simbolo === null) {
      for (const [nombre, cuerpo] of f.diferidas) trozos.push({ etiqueta: nombre, codigo: cuerpo });
    } else {
      const cuerpo = f.diferidas.get(simbolo);
      if (cuerpo) trozos.push({ etiqueta: simbolo, codigo: cuerpo });
    }

    for (const trozo of trozos) {
      for (const { patron, porque } of PROHIBIDO) {
        if (patron.test(trozo.codigo)) {
          hallazgos.push({ donde: `${archivo} · ${trozo.etiqueta}`, porque, camino });
        }
      }
      // Y se salta solo a los nombres importados que ESTE cuerpo menciona.
      for (const [nombre, destino] of f.importes) {
        if (!new RegExp(`\\b${nombre}\\b`).test(trozo.codigo)) continue;
        cola.push({
          archivo: destino,
          simbolo: nombre,
          camino: [...camino, `${destino} · ${nombre}`],
        });
        // Un barril (`index.ts`) reexporta sin declarar: si el nombre no vive ahi, se sigue por sus
        // reexportaciones. Sin esto, `@/clinical-engine` cortaria el grafo entero.
        const d = leer(destino);
        if (!d.diferidas.has(nombre)) {
          for (const reexportado of new Set(d.importes.values())) {
            cola.push({ archivo: reexportado, simbolo: nombre, camino: [...camino, reexportado] });
          }
        }
      }
    }
  }
  return { hallazgos, alcanzados };
}

describe("el pipeline clinico corre sin request scope", () => {
  for (const raiz of RAICES) {
    it(`nada de lo que llama ${raiz} pide el request`, () => {
      const { hallazgos, alcanzados } = barrer(raiz);
      // EL BARRIDO NO PUEDE SALIR VACIO: si el grafo se queda corto, el resolver dejo de resolver y el
      // candado pasaria sin mirar nada, que es el peor resultado posible para un candado.
      expect(alcanzados.size).toBeGreaterThan(15);

      const textos = hallazgos.map(
        (h) => `${h.donde}: ${h.porque}\n    camino: ${h.camino.join("\n          -> ")}`,
      );
      expect(textos, textos.join("\n  ")).toEqual([]);
    });
  }

  it("ningun archivo que el pipeline alcanza carga modulos con un import dinamico", () => {
    // Si manana aparece uno, este candado deja de ver esa rama. Que falle es el aviso; pasar en silencio
    // seria creer que se barrio algo que no se barrio.
    const dinamicos = new Set<string>();
    for (const raiz of RAICES) {
      for (const archivo of barrer(raiz).alcanzados) {
        const codigo = sinComentarios(readFileSync(archivo, "utf8"));
        if (/\bawait\s+import\s*\(|[^.\w]import\s*\(\s*["'@.]/.test(codigo)) dinamicos.add(archivo);
      }
    }
    expect([...dinamicos]).toEqual([]);
  });

  it("el barrido DE VERDAD encuentra lo prohibido cuando esta (control del candado)", () => {
    // Sin esto, los tres de arriba podrian estar verdes porque el barrido no mira nada. Se barre desde una
    // pantalla que SI usa el cliente RLS y tiene que salir acusada.
    const { hallazgos } = barrer("src/modules/bis/data/edad-del-equipo-reader.ts");
    expect(hallazgos.length).toBeGreaterThan(0);
  });

  it("el lector del control de calidad biologico lee por drizzle, que sirve a sus dos llamadores", () => {
    const codigo = sinComentarios(
      readFileSync("src/modules/bis/data/qc-biologico-reader.ts", "utf8"),
    );
    expect(codigo).toMatch(/from "@\/db"/);
    expect(codigo).not.toMatch(/createSupabaseServerClient/);
  });

  it("el gate del pipeline usa EL MISMO lector que pinta el panel, no una segunda comprobacion", () => {
    // La razon es el hazard 4: dos fuentes distintas dejan la pantalla y el servidor diciendo cosas
    // opuestas sobre la misma medicion. Si alguien duplica la comprobacion para esquivar el grafo, esto
    // lo atrapa.
    const pipeline = sinComentarios(
      readFileSync("src/modules/clinical-pipeline/services/run-pipeline.ts", "utf8"),
    );
    expect(pipeline).toMatch(/qcBiologicoDeLaConsulta\(input\.evaluationId\)/);
    expect(pipeline).not.toMatch(/identidadesVioladas/);
  });
});
