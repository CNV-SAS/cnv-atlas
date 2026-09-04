import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { describe, expect, it } from "vitest";

import DATOS from "@/clinical-engine/registry-data.generated.json";

import { ENTREGAS, HTML_VIGENTE } from "./fixtures/html-vigente";

// CANDADO DE LOS 81 ESTADOS EFR contra la entrega VIGENTE de Gildardo.
//
// POR QUE HACIA FALTA. Los 81 estados de `registry-data.generated.json` se generan corriendo el motor
// CONGELADO (`buildEfrStates` -> `core.getDX`), y el motor congelado se porta de una entrega concreta.
// O sea que el generador no puede detectar que su archivo cambio: regenerar produce exactamente lo mismo
// mientras el frozen no se vuelva a portar. Sin este candado, el dia que el reescriba un mecanismo o
// llene un hueco, Atlas seguiria mostrando el texto viejo y NADA se pondria rojo. Es la misma familia
// del candado anclado a una entrega superada, con el agravante de que aqui el texto es lo que el
// profesional LEE como diagnostico.
//
// LO QUE COMPARA: los cinco campos de los 81 estados, contra su `getDX` extraido de la entrega vigente
// y ejecutado, no contra una transcripcion. Si algo difiere hay que re-portar el frozen y regenerar.

/** Su `DX` + `efrCompose` + `getDX`, extraidos por NOMBRE (nunca por rango de lineas) y ejecutados. */
function motorSuyo(archivo: string): {
  DX: Record<string, Record<string, string>>;
  getDX: (i: number, r: number, f: number, m: number) => Record<string, string>;
  efrCompose: (
    i: string,
    r: string,
    f: string,
    m: string,
  ) => Record<string, string>;
} {
  const lineas = readFileSync(archivo, "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const ini = lineas.findIndex((l) => /^const DX = \{/.test(l));
  const desdeGetDx = lineas.findIndex(
    (l, k) => k > ini && /^const getDX = /.test(l),
  );
  if (ini < 0 || desdeGetDx < 0)
    throw new Error(`no encuentro DX/getDX en ${archivo}`);
  // El final se localiza cerrando las llaves de `getDX`, que es estructura y no posicion.
  let fin = desdeGetDx;
  let prof = 0;
  do {
    prof +=
      (lineas[fin].match(/[{[(]/g) ?? []).length -
      (lineas[fin].match(/[}\])]/g) ?? []).length;
    fin++;
  } while (prof > 0 && fin < lineas.length);

  const ctx: Record<string, unknown> = {};
  createContext(ctx);
  // `kl` traduce banda (1/2/3) a letra (B/N/A). Vive fuera del rango extraido, asi que se reproduce; es
  // la UNICA linea que no sale de su archivo, y es un mapeo de tres valores, no contenido clinico.
  runInContext(
    "var kl = b => (b===1?'B':b===2?'N':'A');\n" +
      lineas
        .slice(ini, fin)
        .join("\n")
        .replace(/^const /gm, "var "),
    ctx,
  );
  return ctx as never;
}

const BANDA: Record<string, number> = { B: 1, N: 2, A: 3 };
/** Nuestro campo <- su campo. */
const CAMPOS: [keyof (typeof DATOS)["efrStates"][number], string][] = [
  ["diagnosisName", "dx"],
  ["mechanism", "mec"],
  ["biomarkers", "bio"],
  ["risks", "rsk"],
  ["suggestedNutraceuticals", "n"],
];

const estados = DATOS.efrStates;

describe("los 81 estados EFR coinciden con su entrega vigente, campo por campo", () => {
  it("son 81, uno por cada combinacion de las cuatro bandas", () => {
    expect(estados).toHaveLength(81);
    expect(new Set(estados.map((s) => s.key)).size).toBe(81);
    expect(new Set(estados.map((s) => s.stateNumber)).size).toBe(81);
  });

  it("y los 405 campos son los suyos, sin una sola diferencia", () => {
    const suyo = motorSuyo(HTML_VIGENTE);
    const difs: string[] = [];
    for (const s of estados) {
      const [i, r, f, m] = s.key.split("_").map((b) => BANDA[b]);
      const dxSuyo = suyo.getDX(i, r, f, m);
      for (const [nuestro, deEl] of CAMPOS) {
        const a = String(dxSuyo[deEl] ?? "").trim();
        const b = String(s[nuestro] ?? "").trim();
        if (a !== b)
          difs.push(
            `#${s.stateNumber} ${s.key}.${String(nuestro)}: suyo=${a} | nuestro=${b}`,
          );
      }
    }
    expect(
      difs,
      "su archivo cambio: hay que re-portar el frozen (engine.core) y correr `pnpm gen:registry`",
    ).toEqual([]);
  });

  it("CONTROL: la comparacion sabe encontrar diferencias, no pasa verde por no mirar nada", () => {
    // Sin esto, el caso de arriba pasaria igual si la extraccion devolviera un objeto vacio y todo
    // comparara "" contra "". Una asercion negativa necesita un control que demuestre que compara.
    const suyo = motorSuyo(HTML_VIGENTE);
    const uno = suyo.getDX(1, 3, 1, 3);
    expect(
      Object.keys(uno).length,
      "la extraccion no devolvio nada",
    ).toBeGreaterThan(3);
    expect(
      uno.dx,
      "el diagnostico salio vacio: la extraccion no corrio",
    ).toBeTruthy();
    // Y que un valor cambiado se detecte de verdad.
    const alterado = { ...estados[0], mechanism: "TEXTO QUE EL NO ESCRIBIO" };
    const [i, r, f, m] = alterado.key.split("_").map((b) => BANDA[b]);
    expect(String(suyo.getDX(i, r, f, m).mec ?? "")).not.toBe(
      alterado.mechanism,
    );
  });
});

describe("ya no queda ningun estado con raya (P-102 respondida el 2026-09-04)", () => {
  // ESTE BLOQUE SE DIO LA VUELTA ENTERO, y conviene leer el giro antes que la asercion.
  //
  // Hasta el 3 de septiembre afirmaba lo contrario: que VEINTIUN estados mostraban "—" en mecanismo, en
  // biomarcadores o en los dos, y que la raya estaba EN SU ARCHIVO byte por byte. Se fijo asi para que
  // nadie lo "arreglara" desde Atlas: rellenar los textos habria sido escribirle el diagnostico, y ocultar
  // el campo vacio habria sido un arreglo de FORMA tapando un hueco de CONTENIDO suyo.
  //
  // LO QUE SE LE PREGUNTO (P-102) no fue "escriba veintiun textos". Fue que su PROPIO `efrCompose` ya
  // producia esos textos, y que lo que impedia que llegaran era la forma de la caida de `getDX`, que solo
  // componia cuando faltaba la CLAVE ENTERA:
  //
  //     const base = DX[key] ? { ...DX[key] } : efrCompose(...)
  //
  // y las 21 claves existian, con "—" dentro. Su otro visor del mismo archivo caia CAMPO POR CAMPO, asi
  // que el mismo paciente veia texto en una pantalla suya y una raya en la otra. La pregunta era cual de
  // sus dos caidas manda.
  //
  // RESPONDIO ADOPTANDO LA CAIDA CAMPO POR CAMPO (su punto 5 del 4-sep), y ademas trata la raya como
  // AUSENCIA de texto y no como texto, que es la parte que resuelve los 21 de una vez. Su comentario en
  // el archivo lo dice: "la raya '—' es ausencia de texto, no texto. Unifica el comportamiento con el
  // visor de los 81 estados". `n` (los nutraceuticos) se quedo fuera a proposito.
  const conRaya = estados.filter((s) =>
    [s.mechanism, s.biomarkers].some((v) => String(v).trim() === "—"),
  );

  it("ninguno de los 81, en ninguno de los cinco campos", () => {
    // LA ASERCION ES MAS ANCHA QUE EL DEFECTO QUE SE CERRO, a proposito. El arreglo toca cuatro campos
    // (dx, mec, bio, rsk) y aqui se exige que NINGUNO de los cinco quede en raya ni vacio. Asi cubre
    // tambien `n`, que su arreglo deliberadamente no toca: si algun dia una clave nueva entra con la
    // raya en nutraceuticos, sale por aqui y no por un paciente.
    expect(conRaya).toEqual([]);
    for (const s of estados) {
      for (const c of [
        "diagnosisName",
        "mechanism",
        "biomarkers",
        "risks",
        "suggestedNutraceuticals",
      ] as const) {
        const v = String(s[c] ?? "").trim();
        expect(v, `#${s.stateNumber} ${s.key}.${c}`).not.toBe("");
        expect(v, `#${s.stateNumber} ${s.key}.${c}`).not.toBe("—");
      }
    }
  });

  it("y el texto que llego es el que su efrCompose ya producia, no uno nuevo", () => {
    // ESTE CASO ES EL QUE HACE LA VERIFICACION DE VERDAD, y por eso no basta con el de arriba.
    //
    // "Ningun campo esta vacio" tambien pasaria verde si alguien hubiera rellenado los 21 a mano con
    // cualquier cosa. Lo que se afirma aqui es la PROCEDENCIA: para los 21 estados que antes tenian raya,
    // el texto que hoy se ve es exactamente el que SU `efrCompose` compone, caracter por caracter.
    const suyo = motorSuyo(HTML_VIGENTE);
    // Los 21 de la entrega anterior, listados por su clave para que el caso siga siendo el mismo aunque
    // el numero cambie. Son los que tenian "—" en mecanismo, biomarcadores o los dos.
    const antes = estados.filter((s) => {
      const [i, r, f, m] = s.key.split("_");
      const comp = suyo.efrCompose(i, r, f, m);
      const [bi, br, bf, bm] = s.key.split("_").map((b) => BANDA[b]);
      const d = suyo.getDX(bi, br, bf, bm);
      return d.mec === comp.mec || d.bio === comp.bio;
    });
    expect(
      antes.length,
      "ningun estado cae al compose: el arreglo no esta activo",
    ).toBeGreaterThan(0);
    for (const s of antes) {
      const [i, r, f, m] = s.key.split("_");
      const comp = suyo.efrCompose(i, r, f, m);
      const [bi, br, bf, bm] = s.key.split("_").map((b) => BANDA[b]);
      const d = suyo.getDX(bi, br, bf, bm);
      if (d.mec === comp.mec)
        expect(s.mechanism, `#${s.stateNumber} mec`).toBe(comp.mec);
      if (d.bio === comp.bio)
        expect(s.biomarkers, `#${s.stateNumber} bio`).toBe(comp.bio);
    }
  });
});

describe("y el candado sigue mirando la entrega de HOY", () => {
  it("HTML_VIGENTE apunta a la ULTIMA entrega, no a una carpeta escrita a mano", () => {
    // El defecto que cierra `html-vigente.ts` es que un comparador quede apuntando al pasado: verde por
    // construccion. Esto lo reafirma desde aqui, porque este candado es de los que mas lo sufririan.
    //
    // Y se afirma contra ENTREGAS, no contra una ruta literal: escribir la carpeta aqui seria repetir el
    // mismo defecto dentro del test que lo vigila. (El candado de anclajes lo atrapo al primer intento.)
    expect(ENTREGAS.length).toBeGreaterThan(0);
    expect(HTML_VIGENTE).toContain(ENTREGAS[ENTREGAS.length - 1]);
    expect(HTML_VIGENTE.endsWith("ATLAS_v8.html")).toBe(true);
  });
});
