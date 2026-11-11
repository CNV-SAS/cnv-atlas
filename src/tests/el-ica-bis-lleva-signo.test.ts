import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { icaBisDeLaPabu, icaBisDelSello, PHI } from "@/clinical-engine/ica-bis";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ICA-BIS LLEVA SIGNO, Y EL HISTORICO SE LEE BIEN SIN TOCAR UN SELLO  ·  v17 §4  ·  2026-11-11
//
// ═══ EL ERROR ═══
//
// El motor sellaba `|PABU - 1,618|`. El valor absoluto pierde la DIRECCION, que es la mitad del
// significado: por encima de φ es deficit estructural, por debajo es exceso de adiposidad. Medido en la
// nube antes de arreglarlo: **245 de 441 consultas vigentes (55,6 %)** tienen la PABU por debajo de φ, o
// sea que a mas de la mitad se les mostraba una desviacion positiva teniendo exceso de adiposidad.
//
// ═══ LA PARTE QUE ESTE CANDADO FIJA, Y QUE NO ES OBVIA ═══
//
// Que el historico se lea bien **sin reescribir ningun informe sellado**. Un sello es inmutable (regla
// 7), y el ICA-BIS es una funcion pura de la PABU, que ya esta sellada y es correcta. Asi que se DERIVA
// al leer. Si alguien "optimiza" leyendo el `icaBis` guardado primero, los informes anteriores a esta
// version vuelven a mostrar la magnitud y el defecto revive en silencio para mas de la mitad de la
// cohorte: es justo lo que el primer caso de `icaBisDelSello` impide.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("el ICA-BIS de una PABU", () => {
  it("es positivo por encima de φ y negativo por debajo", () => {
    expect(icaBisDeLaPabu(1.9925)).toBeCloseTo(0.3745, 4);
    expect(icaBisDeLaPabu(1.2)).toBeCloseTo(-0.418, 4);
    expect(icaBisDeLaPabu(PHI)).toBe(0);
  });

  it("sin PABU no se inventa una desviacion", () => {
    expect(icaBisDeLaPabu(null)).toBeNull();
    expect(icaBisDeLaPabu(undefined)).toBeNull();
    // El 0 del motor significa "sin dato" (lo dice `calcPABU`: sin sexo o sin insumos devuelve 0), no
    // "PABU de cero": tratarlo como cifra daria un ICA-BIS de -1,618, la desviacion maxima posible.
    expect(icaBisDeLaPabu(0)).toBeNull();
    expect(icaBisDeLaPabu(Number.NaN)).toBeNull();
  });

  it("redondea a cuatro decimales, como el resto de los indicadores", () => {
    expect(icaBisDeLaPabu(1.23456789)).toBe(-0.3834);
  });
});

describe("el ICA-BIS de un informe ya sellado", () => {
  // EL CASO DEL HISTORICO: el sello trae la MAGNITUD (0,418) y la PABU buena (1,2). Tiene que salir
  // NEGATIVO, porque la PABU manda.
  it("prefiere la PABU sellada sobre el icaBis sellado en magnitud", () => {
    expect(icaBisDelSello({ pabu: 1.2, icaBis: 0.418 })).toBeCloseTo(-0.418, 4);
  });

  it("y con los dos ya correctos da lo mismo", () => {
    expect(icaBisDelSello({ pabu: 1.9925, icaBis: 0.3745 })).toBeCloseTo(0.3745, 4);
  });

  it("sin PABU cae al valor sellado, que es lo unico que hay", () => {
    expect(icaBisDelSello({ pabu: null, icaBis: 0.42 })).toBe(0.42);
    expect(icaBisDelSello({ pabu: null, icaBis: null })).toBeNull();
    expect(icaBisDelSello(null)).toBeNull();
  });
});

describe("la forma: ni el motor sella la magnitud, ni las pantallas la leen", () => {
  const fuente = (r: string) => sinComentarios(readFileSync(r, "utf8"));

  it("el motor y el adaptador sellan la desviacion con signo", () => {
    for (const ruta of ["src/clinical-engine/engine.ts", "src/clinical-engine/analysis.ts"]) {
      const src = fuente(ruta);
      expect(src, `${ruta} volvio a sellar la magnitud`).not.toContain("Math.abs(PABU - 1.618)");
      expect(src, `${ruta} volvio a sellar la magnitud`).not.toContain("Math.abs(a.indices.PABU - 1.618)");
      expect(src, `${ruta} no pasa por la unica definicion`).toContain("icaBisDeLaPabu(");
    }
  });

  it("y las tres superficies que lo muestran lo DERIVAN del sello", () => {
    // Las tres leian `indicators.icaBis` directo, que en los informes anteriores es la magnitud.
    for (const ruta of [
      "src/modules/diagnoses/components/evaluation-results.tsx",
      "src/modules/reports/data/hc-composicion.ts",
    ]) {
      expect(fuente(ruta), `${ruta} no deriva el ICA-BIS del sello`).toContain("icaBisDelSello(");
    }
    // La pantalla del diagnostico lo normaliza UNA vez (lee `indicators.icaBis` en tres sitios).
    const pantalla = fuente("src/modules/diagnoses/components/evaluation-results.tsx");
    expect(pantalla).toContain("icaBis: icaBisDelSello(indicadoresSellados)");
  });

  it("la version del motor subio MENOR, no mayor: la serie de los pacientes no se parte", () => {
    const version = readFileSync("src/clinical-engine/version.ts", "utf8");
    expect(version).toContain('export const ENGINE_VERSION = "3.3.0"');
    // `sonComparables` compara la MAYOR: con un 4.x la tarjeta de respuesta a la intervencion
    // desapareceria para todos hasta la segunda consulta con la version nueva, y eso se paga cuando
    // cambia una clasificacion. Aqui no cambia ninguna.
    expect(version, "la explicacion del bump menor desaparecio").toContain("POR QUE SUBE **MINOR**");
  });

  it("la referencia de la fila en la HC sigue siendo la de SU archivo", () => {
    // La tentacion era escribir "−0,15 a +0,15" para que cuadrara con el signo. Seria inventar texto
    // suyo: su v17 reemplaza esa lectura por los percentiles del sexo, y hasta entonces manda la suya.
    const hc = readFileSync("src/modules/reports/data/hc-indices-ani.ts", "utf8");
    expect(hc).toContain('referencia: () => "0.00–0.15 Zona φ"');
  });
});
