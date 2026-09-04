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
  efrCompose: (i: string, r: string, f: string, m: string) => Record<string, string>;
} {
  const lineas = readFileSync(archivo, "utf8").replace(/\r\n/g, "\n").split("\n");
  const ini = lineas.findIndex((l) => /^const DX = \{/.test(l));
  const desdeGetDx = lineas.findIndex((l, k) => k > ini && /^const getDX = /.test(l));
  if (ini < 0 || desdeGetDx < 0) throw new Error(`no encuentro DX/getDX en ${archivo}`);
  // El final se localiza cerrando las llaves de `getDX`, que es estructura y no posicion.
  let fin = desdeGetDx;
  let prof = 0;
  do {
    prof += (lineas[fin].match(/[{[(]/g) ?? []).length - (lineas[fin].match(/[}\])]/g) ?? []).length;
    fin++;
  } while (prof > 0 && fin < lineas.length);

  const ctx: Record<string, unknown> = {};
  createContext(ctx);
  // `kl` traduce banda (1/2/3) a letra (B/N/A). Vive fuera del rango extraido, asi que se reproduce; es
  // la UNICA linea que no sale de su archivo, y es un mapeo de tres valores, no contenido clinico.
  runInContext(
    "var kl = b => (b===1?'B':b===2?'N':'A');\n" +
      lineas.slice(ini, fin).join("\n").replace(/^const /gm, "var "),
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
        if (a !== b) difs.push(`#${s.stateNumber} ${s.key}.${String(nuestro)}: suyo=${a} | nuestro=${b}`);
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
    expect(Object.keys(uno).length, "la extraccion no devolvio nada").toBeGreaterThan(3);
    expect(uno.dx, "el diagnostico salio vacio: la extraccion no corrio").toBeTruthy();
    // Y que un valor cambiado se detecte de verdad.
    const alterado = { ...estados[0], mechanism: "TEXTO QUE EL NO ESCRIBIO" };
    const [i, r, f, m] = alterado.key.split("_").map((b) => BANDA[b]);
    expect(String(suyo.getDX(i, r, f, m).mec ?? "")).not.toBe(alterado.mechanism);
  });
});

describe("los 21 estados con raya: la ausencia es de SU contenido, no del porte", () => {
  // ESTE BLOQUE EXISTE PARA QUE NADIE LO "ARREGLE" DESDE AQUI.
  //
  // Veintiun estados muestran "—" en mecanismo, en biomarcadores o en los dos. Verificado contra su
  // entrega vigente: la raya esta EN SU ARCHIVO, byte por byte. No es un campo que se nos perdiera al
  // portar, y por eso no se rellena ni se oculta desde Atlas: ocultar el campo vacio seria un arreglo de
  // FORMA que taparia un hueco de CONTENIDO suyo, y rellenarlo seria escribirle el diagnostico.
  //
  // LO QUE SI ENCONTRAMOS, y es lo que se le pregunta (ronda del 2026-09-04, P-102): SU PROPIO
  // `efrCompose` YA PRODUCE ESOS TEXTOS. Para el estado 21 devuelve "Homeostasis celular y metabólica
  // conservada." y "Biomarcadores dentro del rango esperado.". Lo que impide que lleguen es la forma de
  // la caida de `getDX`, que solo compone cuando falta la CLAVE ENTERA:
  //
  //     const base = DX[key] ? { ...DX[key] } : efrCompose(...)
  //
  // y las 21 claves existen, con "—" dentro. Su OTRO visor del mismo archivo cae CAMPO POR CAMPO
  // (`{d: base.d||comp.d, m: base.m||comp.m, ...}`), asi que el mismo paciente ve texto en una pantalla
  // suya y una raya en la otra. La pregunta no es "escriba veintiun textos": es cual de sus dos caidas
  // manda.
  const conRaya = estados.filter((s) => [s.mechanism, s.biomarkers].some((v) => String(v).trim() === "—"));

  it("son veintiuno, y la raya viene de su archivo", () => {
    expect(conRaya).toHaveLength(21);
    const suyo = motorSuyo(HTML_VIGENTE);
    for (const s of conRaya) {
      const [i, r, f, m] = s.key.split("_").map((b) => BANDA[b]);
      const d = suyo.getDX(i, r, f, m);
      const suyas = [d.mec, d.bio].filter((v) => String(v ?? "").trim() === "—").length;
      expect(suyas, `#${s.stateNumber} ${s.key}: la raya no esta en su archivo, es nuestra`).toBeGreaterThan(0);
    }
  });

  it("su propio efrCompose ya escribe los veintiuno: es una caida, no un hueco de redaccion", () => {
    // Este caso es el que sostiene la pregunta. Si algun dia deja de ser cierto, la pregunta cambia.
    const suyo = motorSuyo(HTML_VIGENTE);
    for (const s of conRaya) {
      const [i, r, f, m] = s.key.split("_");
      const comp = suyo.efrCompose(i, r, f, m);
      if (String(s.mechanism).trim() === "—")
        expect(String(comp.mec ?? "").trim(), `#${s.stateNumber}`).not.toBe("");
      if (String(s.biomarkers).trim() === "—")
        expect(String(comp.bio ?? "").trim(), `#${s.stateNumber}`).not.toBe("");
    }
  });

  it("ninguno pierde el diagnostico, el riesgo ni los nutraceuticos", () => {
    // El alcance del hueco, medido. Lo que falta son las dos columnas explicativas; lo que el profesional
    // necesita para actuar (que es, que arriesga, que se le sugiere) esta completo en los 81.
    for (const s of estados) {
      for (const c of ["diagnosisName", "risks", "suggestedNutraceuticals"] as const) {
        expect(String(s[c] ?? "").trim(), `#${s.stateNumber} ${s.key}.${c}`).not.toBe("");
        expect(String(s[c] ?? "").trim(), `#${s.stateNumber} ${s.key}.${c}`).not.toBe("—");
      }
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
