import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as core from "@/clinical-engine/frozen/engine.core.derived.js";
import { calcIEHH_ISCM, IEHH_ISCM_REF } from "@/clinical-engine/frozen/engine.indices.js";

import { CAMBIOS_NUEVOS, htmlDeCambioNuevo } from "./fixtures/html-vigente";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DIFF-indices/v17: el IEHH y el ISCM-BIS con z POR SEXO  ·  su §5 y §6  ·  2026-11-12
//
// ═══ POR QUE ESTE CANDADO EXISTE ═══
//
// `frozen-deriva-vigente` compara `engine.indices.js` contra `HTML_VIGENTE`, que resuelve al v9. Con el
// paso 5 este modulo gana la tabla de referencias por sexo y la funcion que la usa, que no existen en
// ninguna entrega anterior: quedan toleradas alla y ancladas aqui, contra el archivo del que salieron.
//
// LO QUE SE COMPARA, y son tres cosas distintas:
//
//   1. LA TABLA, numero por numero, contra su §5 (siete componentes x dos sexos = 28 cifras). Es lo unico
//      de este porte que hace ciencia: una media o una desviacion movida cambia los dos indices de toda
//      la cohorte, y no hay forma de verlo en pantalla;
//   2. LA FUNCION, verbatim contra su archivo (la formula, el orden de los terminos, los tres decimales
//      y la regla de "sin sexo o sin un componente, no se emite");
//   3. SUS CASOS M, N, O, P, I y J de la §13, que es la prueba de que los dos primeros se portaron bien.
//      El caso N es el que lo demuestra mejor: son LOS MISMOS DATOS leidos como hombre, y los dos
//      indices se mueven (IEHH −0,099 -> −0,569 · ISCM 0,834 -> −4,172). Si las z fueran globales, los
//      dos numeros serian identicos y este caso pasaria igual de verde con el porte mal hecho.
//
// Y FALLA RUIDOSO SIN EL ARCHIVO, que es lo correcto: su HTML vive solo en la maquina de Santiago.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const ENTREGA = "9 noviembre";
const NUESTRO = "src/clinical-engine/frozen/engine.indices.js";

const sinEspacio = (t: string) => t.replace(/\s+/g, "");

// Su §5, transcrita del documento (no del codigo): media y DE de cada componente, por sexo.
// Si una de estas 28 cifras no coincide con la tabla del motor, el candado dice CUAL.
const SU_TABLA = {
  F: {
    ReRinf: [1.3576, 0.05356],
    AECAICsg: [0.64249, 0.03081],
    C: [1.42565, 0.38338],
    IFC: [2.75488, 1.02404],
    MCA: [27.07077, 2.63022],
    FMI: [6.61699, 2.47673],
    FFW: [29.09765, 2.97138],
  },
  M: {
    ReRinf: [1.42314, 0.06253],
    AECAICsg: [0.5836, 0.0287],
    C: [2.30023, 0.59151],
    IFC: [5.69408, 2.02351],
    MCA: [39.99478, 4.22063],
    FMI: [5.22687, 2.17192],
    FFW: [43.29803, 5.03682],
  },
} as const;

// Los nueve componentes de sus casos M, N y O (su §13), tal como el los escribe.
const CASO_M = { Re: 700, Rinf: 520, C: 1.4, MCA: 27.0, AECsg: 12.5, AICsg: 19.5, FMI: 6.6, FFW: 32.0 };
const CASO_O = { Re: 560, Rinf: 400, C: 2.3, MCA: 40.0, AECsg: 15.5, AICsg: 26.5, FMI: 5.2, FFW: 42.0 };

describe(`engine.indices.js: el IEHH y el ISCM-BIS salen de su ATLAS del ${ENTREGA}`, () => {
  it("la entrega existe en disco (sin ella, este candado no compara nada)", () => {
    expect(CAMBIOS_NUEVOS, `no esta la entrega ${ENTREGA}`).toContain(ENTREGA);
    expect(existsSync(htmlDeCambioNuevo(ENTREGA))).toBe(true);
  });

  const suyo = () => readFileSync(htmlDeCambioNuevo(ENTREGA), "utf8").replace(/\r\n/g, "\n");

  it("la tabla de referencias es la de su §5, cifra por cifra", () => {
    for (const sexo of ["F", "M"] as const) {
      for (const [comp, par] of Object.entries(SU_TABLA[sexo])) {
        const nuestro = IEHH_ISCM_REF[sexo][comp as keyof (typeof IEHH_ISCM_REF)["F"]];
        expect(nuestro[0], `${sexo} · ${comp} · media`).toBe(par[0]);
        expect(nuestro[1], `${sexo} · ${comp} · desviación`).toBe(par[1]);
      }
    }
  });

  it("y esa misma tabla esta en SU archivo (no es una transcripcion nuestra que cuadra sola)", () => {
    // El caso de arriba compara el codigo contra el DOCUMENTO; este lo compara contra el ARCHIVO. Son
    // dos fuentes suyas, y las dos tienen que decir lo mismo: si su docx y su HTML se contradijeran,
    // esto lo destapa en vez de elegir uno.
    //
    // SE COMPARAN NUMEROS, NO CADENAS, y la razon importa: el escribe `1.35760` y JavaScript lee ese
    // literal como 1.3576, asi que buscar la cadena daria un rojo por el cero final. Lo que tiene que
    // coincidir es el VALOR.
    const bloque = suyo().match(/const IEHH_ISCM_REF = \{[\s\S]*?\n\};/);
    expect(bloque, "no se encontro IEHH_ISCM_REF en su archivo").not.toBe(null);
    for (const sexo of ["F", "M"] as const) {
      // Su bloque va `F: { ... },` y `M: { ... }`: se parte por sexo antes de buscar los componentes,
      // para que un numero del otro sexo no pueda hacer pasar el caso.
      const porSexo = new RegExp(`${sexo}:\\s*\\{([\\s\\S]*?)\\}`).exec(bloque![0]);
      expect(porSexo, `su bloque no trae el sexo ${sexo}`).not.toBe(null);
      for (const [comp, par] of Object.entries(SU_TABLA[sexo])) {
        const m = new RegExp(`${comp}:\\s*\\[\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*\\]`).exec(porSexo![1]);
        expect(m, `su archivo no trae el componente ${comp} del sexo ${sexo}`).not.toBe(null);
        expect(Number(m![1]), `${sexo} · ${comp} · media en SU archivo`).toBe(par[0]);
        expect(Number(m![2]), `${sexo} · ${comp} · desviación en SU archivo`).toBe(par[1]);
      }
    }
  });

  for (const linea of [
    "const iehh = re && ri && c && zEI != null",
    "? parseFloat((0.25 * z(re / ri, \"ReRinf\") + 0.25 * zEI + 0.50 * z(c, \"C\")).toFixed(3)) : 0;",
    "const iscm = c && ri && mca && fmi && ffw && zEI != null",
    "? parseFloat((z(calcIFC(c, ri), \"IFC\") + z(mca, \"MCA\") + zEI + z(fmi, \"FMI\") + z(ffw, \"FFW\")).toFixed(3)) : 0;",
    "const zEI = aec && aic ? z(aec / aic, \"AECAICsg\") : null;",
    "const z = (v, k) => (v - r[k][0]) / r[k][1];",
    "const n = v => { const x = parseFloat(v); return isFinite(x) && x > 0 ? x : null; };",
  ]) {
    it(`la formula es la suya: ${linea.slice(0, 56)}`, () => {
      expect(sinEspacio(readFileSync(NUESTRO, "utf8")).includes(sinEspacio(linea)), `falta en ${NUESTRO}`).toBe(true);
      expect(sinEspacio(suyo()).includes(sinEspacio(linea)), "no aparece en su ATLAS_v17").toBe(true);
    });
  }

  // ── SUS CASOS DE LA §13 ──
  it("M · mujer: IEHH −0,099 (óptimo) e ISCM-BIS 0,834", () => {
    const r = calcIEHH_ISCM({ sexo: "F", ...CASO_M });
    expect(r.iehh).toBe(-0.099);
    expect(r.iscm).toBe(0.834);
    expect(core.cIEHH(r.iehh).l).toBe("Óptimo");
  });

  it("N · LOS MISMOS DATOS como hombre: IEHH −0,569 e ISCM-BIS −4,172", () => {
    // *"el sexo cambia el resultado"*, dice su documento. Este es el caso que prueba que las z son por
    // sexo y no globales: con z globales los dos numeros serian los mismos del caso M.
    const r = calcIEHH_ISCM({ sexo: "M", ...CASO_M });
    expect(r.iehh).toBe(-0.569);
    expect(r.iscm).toBe(-4.172);
    const comoMujer = calcIEHH_ISCM({ sexo: "F", ...CASO_M });
    expect(r.iehh, "el sexo NO esta cambiando el IEHH").not.toBe(comoMujer.iehh);
    expect(r.iscm, "el sexo NO esta cambiando el ISCM-BIS").not.toBe(comoMujer.iscm);
  });

  it("O · hombre: IEHH −0,081 (óptimo) e ISCM-BIS −0,196", () => {
    const r = calcIEHH_ISCM({ sexo: "M", ...CASO_O });
    expect(r.iehh).toBe(-0.081);
    expect(r.iscm).toBe(-0.196);
  });

  it("P · sin sexo, o sin un componente, los dos quedan en 0 (sin dato)", () => {
    expect(calcIEHH_ISCM({ sexo: null, ...CASO_M })).toEqual({ iehh: 0, iscm: 0 });
    // Sin AEC SG: su regla dice que un componente ausente ya NO entra como z = 0 (que lo ubicaria en la
    // media de su sexo), asi que el indice no se emite.
    expect(calcIEHH_ISCM({ sexo: "F", ...CASO_M, AECsg: null })).toEqual({ iehh: 0, iscm: 0 });
    // Y el ISCM-BIS tambien cae sin MCA, que es uno de los suyos y no del IEHH.
    expect(calcIEHH_ISCM({ sexo: "F", ...CASO_M, MCA: null }).iscm).toBe(0);
  });

  it("I · ISCM-BIS 4,25: P75 a P90 en mujer, > P90 en hombre", () => {
    expect(core.cISCM(4.25, "F").banda).toBe("P75 a P90");
    expect(core.cISCM(4.25, "M").banda).toBe("> P90");
  });

  it("J · IEHH −1,5 / −1 / +1 / +1,2: déficit / óptimo / óptimo / capacitancia alta", () => {
    expect([-1.5, -1, 1, 1.2].map((v) => core.cIEHH(v).l)).toEqual([
      "Déficit",
      "Óptimo",
      "Óptimo",
      "Capacitancia alta",
    ]);
  });

  it("y la referencia del IEHH que muestra la HC es la cadena de su v17", () => {
    // Su v17 escribe `ref: "−1 a +1 óptimo"` en la fila del IEHH de su historia clinica. La nuestra dice
    // lo mismo, y aqui se comprueba contra su archivo porque el ancla de `hc-indices-ani` es el v16.
    const hc = readFileSync("src/modules/reports/data/hc-indices-ani.ts", "utf8");
    expect(hc).toContain('referencia: () => "−1 a +1 óptimo"');
    expect(sinEspacio(suyo())).toContain(sinEspacio('ref:"−1 a +1 óptimo"'));
  });
});
