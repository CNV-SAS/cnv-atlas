import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { analizarDFI, calcLE8 } from "@/clinical-engine/analysis";
import { FREQ_OPC } from "@/clinical-engine/frozen/engine.patron.js";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// CANDADO DEL ENCENDIDO DEL LE8 (`LE8_MAPEO_CORREGIDO`). Escrito el 2026-09-05, ANTES del porte, y
// tiene que nacer ROJO: un candado que nace verde no prueba nada.
//
// QUE PROBLEMA CIERRA, y no es "que el porte rompa algo". Es que el porte QUEDE A MEDIAS SIN QUE NADA
// AVISE. Hay cuatro estados posibles y tres se parecen:
//
//   A · hoy, con el interruptor en false ......... Alimentacion 30 constante · Hidratacion 20 constante
//   B · flip solo (calcPatron fuera de ambito) ... Alimentacion 30 (cae al catch) · Hidratacion real
//   C · flip + import, SIN el adaptador .......... Alimentacion 10 constante · Hidratacion real
//   D · correcto ................................. Alimentacion real (varia) · Hidratacion real
//
// EL ESTADO C ES EL PELIGROSO. `calcPatron` NO revienta cuando le llega el TEXTO de la opcion en vez del
// ordinal 0-4: simplemente ninguna comparacion `v >= 3` se cumple, el score sale `0 + 10 = 10`, y un 10
// se lee en pantalla como "dieta deficiente" y no como "el porte esta mal". Es PEOR que el catch, porque
// el catch al menos deja el valor viejo.
//
// Por eso las aserciones van sobre DOS pacientes que difieren SOLO en la matriz de frecuencia, y con su
// control: los dos valores tienen que ser DISTINTOS ENTRE SI. Un helper que devuelva cualquier constante
// dentro del rango pasaria la primera asercion y no la del control.
//
// LAS CIFRAS ESTAN DERIVADAS A MANO de la tabla de puntuacion de `calcPatron`, nunca pegadas de la
// salida (regla de `golden-que-pega-la-salida-no-ve-un-error-de-diseno`). La derivacion va escrita al
// lado de cada una para que se pueda revisar sin ejecutar nada.
//
// Plan completo: docs/PLAN_LE8_ENCENDIDO.md

const ORIGINAL = "src/clinical-engine/frozen/engine.dfi.js";
const GENERADO = "src/clinical-engine/frozen/engine.dfi.authorized.js";
const MANIFIESTO = "src/clinical-engine/frozen/authorized-modifications.js";
const ANALYSIS = "src/clinical-engine/analysis.ts";
const lee = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// Los cinco textos canonicos, en su orden (que ES el ordinal). Se pinchan aparte, en su propio caso, y
// las fixturas se construyen desde `FREQ_OPC` para que una errata de transcripcion mia no se confunda
// con un defecto del porte.
const NUNCA = 0;
const TRES_A_CUATRO = 2;
const UNO_A_DOS = 1;
const TODOS = 4;

const PROTECTORES = [1, 2, 3, 4, 5, 6, 7];
const NEUTROS = [8, 9, 10, 15];
const RIESGO = [11, 12, 13, 14];

/** La matriz de 15 grupos como la guarda Atlas: el TEXTO de la opcion, no su ordinal. */
function matriz(prot: number, neutro: number, riesgo: number): Record<string, string> {
  const m: Record<string, string> = {};
  for (const n of PROTECTORES) m[`d1_${n}_i`] = FREQ_OPC[prot];
  for (const n of NEUTROS) m[`d1_${n}_i`] = FREQ_OPC[neutro];
  for (const n of RIESGO) m[`d1_${n}_i`] = FREQ_OPC[riesgo];
  return m;
}

// Los seis insumos que `calcLE8` EXIGE (guarda CA-3: sin ellos devuelve total null). Identicos en las
// tres fixturas, para que lo unico que cambie sea la matriz. `d7_agua` = 6 vasos -> Hidratacion 75.
const BASE = {
  d3_23: "3", // dias de actividad
  d3_24: "30–45 min", // 37 min -> metMin 111 -> Actividad fisica 60
  d3_30: "Nunca he fumado", // Tabaco 100
  d3_26: "7–8 horas", // Sueño 100
  d5_39: [] as string[], // sin diagnosticos -> Glucosa 100, Colesterol 100
  d5_36: "No", // Presion 100
  d7_agua: "6", // 6 vasos -> Hidratacion 75 (encendido) / 20 (apagado)
};

const dominio = (enc: Record<string, unknown>, dom: string): number | undefined =>
  (calcLE8(enc) as { scores: { dom: string; v: number }[] }).scores.find((s) => s.dom === dom)?.v;

describe("1 · los textos canonicos de la matriz, que son el acoplamiento", () => {
  it("FREQ_OPC son estos cinco y en este orden, porque el orden ES el ordinal", () => {
    // Se pincha aparte: las fixturas se construyen DESDE FREQ_OPC, asi que sin esto un cambio en los
    // textos moveria fixturas y motor a la vez y el candado no lo veria (la trampa de comparar dos
    // copias). Aqui el texto queda escrito una vez, a mano.
    expect(FREQ_OPC).toEqual(["Nunca", "1–2 días", "3–4 días", "5–6 días", "Todos los días"]);
  });
});

describe("2 · la Alimentacion deja de estar clavada, y varia con lo que come el paciente", () => {
  // DERIVACION A MANO, de la tabla de `calcPatron`:
  //   protectores (solo los SEIS primeros puntuan): 4 -> +10 · 3 -> +8 · 2 -> +5 · 1 -> +2
  //   riesgo (los cuatro):                          4 -> -10 · 3 -> -7 · 2 -> -4 · 1 -> -1
  //   neutros (los cuatro): +3 cada uno si es >= 2
  //   score = max(0, min(100, suma + 10))

  it("ALTO: protectores a diario y riesgo nunca -> 70", () => {
    // 6 x (+10) = 60 · riesgo en Nunca = 0 · neutros en Nunca (no llegan a 2) = 0 · +10 base = 70
    const enc = { ...BASE, ...matriz(TODOS, NUNCA, NUNCA) };
    expect(dominio(enc, "Alimentación")).toBe(70);
  });

  it("MEDIO: todo moderado -> 48", () => {
    // 6 x (+5) = 30 · riesgo 4 x (-1) = -4 -> 26 · neutros 4 x (+3) = +12 -> 38 · +10 base = 48
    const enc = { ...BASE, ...matriz(TRES_A_CUATRO, TRES_A_CUATRO, UNO_A_DOS) };
    expect(dominio(enc, "Alimentación")).toBe(48);
  });

  it("BAJO: protectores nunca y riesgo a diario -> 0", () => {
    // protectores 0 · riesgo 4 x (-10) = -40 · neutros 0 · +10 base = -30, y el clamp lo sube a 0
    const enc = { ...BASE, ...matriz(NUNCA, NUNCA, TODOS) };
    expect(dominio(enc, "Alimentación")).toBe(0);
  });

  it("EL CONTROL: los tres son DISTINTOS entre si", () => {
    // Sin esto, cualquier implementacion que devuelva una constante podria colarse en alguno de los
    // rangos. Y es la asercion que separa los tres estados malos: en A y B los tres dan 30, en C los
    // tres dan 10. Solo el porte completo produce tres numeros distintos.
    const vals = [
      dominio({ ...BASE, ...matriz(TODOS, NUNCA, NUNCA) }, "Alimentación"),
      dominio({ ...BASE, ...matriz(TRES_A_CUATRO, TRES_A_CUATRO, UNO_A_DOS) }, "Alimentación"),
      dominio({ ...BASE, ...matriz(NUNCA, NUNCA, TODOS) }, "Alimentación"),
    ];
    expect(new Set(vals).size, `los tres dieron ${JSON.stringify(vals)}`).toBe(3);
  });

  it("y NO se queda en los defaults de los estados a medias (30 del catch, 10 del texto crudo)", () => {
    // Aserciones nombradas para que el rojo diga QUE estado es, no solo que fallo.
    const alto = dominio({ ...BASE, ...matriz(TODOS, NUNCA, NUNCA) }, "Alimentación");
    expect(alto, "sigue en 30: el interruptor esta apagado, o calcPatron cae al catch").not.toBe(30);
    expect(alto, "sale 10: a calcPatron le llega el TEXTO y no el ordinal (falta el adaptador)").not.toBe(10);
  });
});

describe("3 · la Hidratacion deja de leer un campo inexistente", () => {
  // Apagado lee `d1_16`, que la encuesta no captura: 0 vasos -> 20, para todo el mundo.
  // Encendido lee `d7_agua`: >=8 -> 100 · >=6 -> 75 · >=4 -> 50 · resto 20.
  const conAgua = (vasos: string) => ({ ...BASE, ...matriz(TRES_A_CUATRO, TRES_A_CUATRO, UNO_A_DOS), d7_agua: vasos });

  it("ocho vasos -> 100", () => {
    expect(dominio(conAgua("8"), "Hidratación")).toBe(100);
  });

  it("dos vasos -> 20", () => {
    expect(dominio(conAgua("2"), "Hidratación")).toBe(20);
  });

  it("EL CONTROL: los dos son distintos, que es lo que el estado apagado no puede dar", () => {
    // Apagado los dos dan 20. El caso de los dos vasos TAMBIEN da 20 estando bien, asi que por si solo
    // no distingue nada: es este par el que lo hace.
    expect(dominio(conAgua("8"), "Hidratación")).not.toBe(dominio(conAgua("2"), "Hidratación"));
  });
});

describe("4 · el ICEC total, que es lo que baja a la EB-BIS", () => {
  it("el paciente ALTO da 88, no 76", () => {
    // Encendido: (60 actividad + 70 alimentacion + 100 tabaco + 100 sueño + 100 glucosa + 100 colesterol
    //             + 100 presion + 75 hidratacion) / 8 = 705/8 = 88,125 -> 88
    // Apagado:   (60 + 30 + 100 + 100 + 100 + 100 + 100 + 20) / 8 = 610/8 = 76,25 -> 76
    const enc = { ...BASE, ...matriz(TODOS, NUNCA, NUNCA) };
    expect((calcLE8(enc) as { total: number | null }).total).toBe(88);
  });
});

describe("5 · el mecanismo: el flip va por el manifiesto, no a mano", () => {
  it("el GENERADO tiene el interruptor en true", () => {
    expect(lee(GENERADO)).toContain("const LE8_MAPEO_CORREGIDO = true;");
  });

  it("y el ORIGINAL sigue en false, byte-identico a su archivo", () => {
    // El original nunca se edita: es lo que conserva la identidad con el ATLAS_v8.html y lo que hace
    // que su DIFF-vs-fuente siga verde. La divergencia vive en el manifiesto.
    expect(lee(ORIGINAL)).toContain("const LE8_MAPEO_CORREGIDO = false;");
  });

  it("el manifiesto declara las DOS modificaciones, con su instruccion", () => {
    const m = lee(MANIFIESTO);
    expect(m, "falta la entrada del flip").toContain("LE8_MAPEO_CORREGIDO");
    // La segunda no es clinica: es reparacion de ambito (en su archivo todo vive en un solo scope).
    expect(m, "falta la entrada que mete calcPatron en el ambito de engine.dfi").toContain("calcPatron");
    expect(m, "la instruccion tiene que citar la fecha de SU decision").toContain("2026-09-02");
  });

  it("y el generado importa calcPatron, sin lo cual la rama cae al catch", () => {
    expect(lee(GENERADO)).toMatch(/require\('\.\/engine\.patron\.js'\)|calcPatron[^;]*require/);
  });
});

describe("6 · el candado sobre el SITIO DE LLAMADA, que es donde estaria la omision", () => {
  it("analizarDFI no le pasa el enc CRUDO a calcLE8", () => {
    // El defecto que esto vigila es una OMISION: que alguien llame al calcLE8 del frozen sin pasar por
    // el adaptador. Probar que el adaptador funciona no cubre eso (regla de
    // `candado-sobre-el-sitio-de-llamada-cuando-el-defecto-es-omision`).
    const src = lee(ANALYSIS);
    expect(src, "analizarDFI sigue llamando dfi.calcLE8(enc) sin adaptar").not.toMatch(
      /dfi\.calcLE8\(enc\)/,
    );
    expect(src, "falta el adaptador de ordinales en el camino del LE8").toContain("ordinalesPatron");
  });

  it("computeDFIFromData recibe el enc ADAPTADO, que es la segunda puerta", () => {
    // ESTA ES LA SEGUNDA PUERTA, y esta DENTRO del frozen: `computeDFIFromData` vuelve a llamar a
    // `calcLE8(d)` por su cuenta para el Dominio 5. Adaptar solo la llamada de `analizarDFI` dejaba el
    // DFI corriendo sobre un ICEC a medias, con el total correcto al lado. Lo destapo el golden.
    expect(lee(ANALYSIS), "le pasa el enc crudo a computeDFIFromData").not.toMatch(
      /computeDFIFromData\(enc,/,
    );
    expect(lee(ANALYSIS)).toContain("computeDFIFromData(encLe8,");
  });

  it("Y LA INVARIANTE, que es lo que de verdad lo prueba: el ICEC del dominio 5 == el de calcLE8", () => {
    // Las dos aserciones de arriba miran TEXTO. Esta mira CONDUCTA: si las dos puertas se separan otra
    // vez, por donde sea, los dos numeros dejan de coincidir. Es la unica que no depende de como se
    // escriba el codigo.
    const enc = { ...BASE, ...matriz(TODOS, NUNCA, NUNCA) };
    const r = analizarDFI(biody as Record<string, unknown>, enc);
    const d5 = r.domains.find((d) => d.id === "d5");
    const delDominio = Number(/ICEC (\d+)/.exec(d5?.clasif ?? "")?.[1]);
    expect(delDominio, "el dominio 5 y calcLE8 estan leyendo ICEC distintos").toBe(
      (calcLE8(enc) as { total: number | null }).total,
    );
  });

  it("y nadie fuera de analysis.ts importa el calcLE8 del frozen", () => {
    // Una sola puerta. Si aparece un segundo importador, el adaptador se puede saltar sin que nada falle.
    const fuera = [
      "src/clinical-engine/engine.ts",
      "src/clinical-engine/index.ts",
      "src/modules/clinical-pipeline/data/simular-con-ciencia-de-hoy.ts",
    ];
    for (const f of fuera) {
      expect(lee(f), `${f} importa calcLE8 del frozen y se salta el adaptador`).not.toMatch(
        /calcLE8[\s\S]{0,80}engine\.dfi/,
      );
    }
  });
});
