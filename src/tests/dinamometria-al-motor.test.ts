import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { classifyFenotipo, dxSarcopenia } from "@/clinical-engine/protocolo-fenotipo";

// CANDADO DE LA DINAMOMETRIA CONECTADA AL MOTOR (Gildardo 2026-08-30 §6).
//
// SU INSTRUCCION: "Que la dinamometría se capture y no llegue al motor significa que `dxSarcopenia`
// devolvía 'ingrese la fuerza prensil' SIEMPRE, incluso con el dato registrado, y que la rama que emite
// sarcopenia probable, confirmada o severa nunca se ejecutó. Conéctenla." Y su razon, que no habiamos
// visto: "los tres criterios son un diagnóstico, y un criterio que se captura lejos del cálculo termina
// no llegando a él".
//
// EL DEFECTO QUE ESTE CANDADO EVITA QUE VUELVA no es que `dxSarcopenia` este mal: su transcripcion
// siempre fue fiel y el golden la ejercitaba con fuerza > 0. Era una OMISION en el SITIO DE LLAMADA:
// nadie le pasaba el dato. Un candado sobre la funcion habria pasado verde durante los tres meses en que
// el diagnostico de sarcopenia no se emitio ni una vez. Por eso las aserciones de abajo son sobre la
// CADENA: el reader lo lee, el input lo lleva, y los dos llamadores lo pasan.

const RUTAS = {
  reader: "src/modules/clinical-pipeline/data/pipeline-reader.ts",
  input: "src/modules/clinical-pipeline/services/build-engine-input.ts",
  engine: "src/clinical-engine/engine.ts",
  protocolo: "src/clinical-engine/protocolo.ts",
  correccion: "src/modules/corrections/services/correct-evaluation.ts",
  simulacion: "src/modules/clinical-pipeline/data/simular-con-ciencia-de-hoy.ts",
  ciclo: "src/modules/clinical-pipeline/services/run-pipeline.ts",
} as const;
const leer = (k: keyof typeof RUTAS) => readFileSync(RUTAS[k], "utf8");

describe("la cadena completa: de la BD al clasificador", () => {
  it("el reader saca la fuerza de las condiciones de la toma", () => {
    const src = leer("reader");
    expect(src).toContain("evaluationBisIntake.gripStrengthKg");
    expect(src).toContain("gripStrengthKg: number | null");
  });

  it("y el input del motor la lleva", () => {
    expect(leer("input")).toContain("fuerzaPrensil: raw.gripStrengthKg");
  });

  it("los TRES sitios que arman el input la pasan, no dos", () => {
    // El que se olvidaria es el de la CORRECCION: un diagnostico regenerado tras corregir la encuesta
    // volveria a perder la fuerza, y el profesional veria el defecto reaparecer sin entender por que.
    for (const k of ["ciclo", "simulacion", "correccion"] as const) {
      expect(leer(k), `${RUTAS[k]} no pasa la fuerza prensil`).toContain("gripStrengthKg: inputs.gripStrengthKg");
    }
  });

  it("y los DOS llamadores de classifyFenotipo la pasan", () => {
    // Si solo la pasara uno, el diagnostico y el protocolo clasificarian al mismo paciente distinto.
    for (const k of ["engine", "protocolo"] as const) {
      expect(leer(k), `${RUTAS[k]} no pasa la fuerza a classifyFenotipo`).toContain(
        "fuerzaPrensil: input.fuerzaPrensil",
      );
    }
  });
});

describe("y con la fuerza puesta, la rama muerta revive", () => {
  const base = { FMI: 8, FFMI: 19, MCA: 30, MCA_ref: 28, smmW: 40, ASMI: 6.0, AF: 6.8, sexoM: true };

  it("sin fuerza, `dxSarcopenia` sigue pidiendo el dato (y eso es lo correcto)", () => {
    expect(dxSarcopenia(0, 6.0, 6.8, true).l).toBe("Ingrese fuerza prensil");
    expect(dxSarcopenia(0, 6.0, 6.8, true).k).toBe(0);
  });

  it("con fuerza BAJA y masa BAJA emite sarcopenia confirmada · k=2, la rama que nunca corrio", () => {
    const d = dxSarcopenia(20, 6.0, 6.8, true); // H: fuerza <27 y ASMI <7.0
    expect(d.l).toBe("Sarcopenia confirmada");
    expect(d.k).toBe(2);
  });

  it("y esa k=2 es la que hace que `sarcopenia` voltee en el fenotipo", () => {
    // El disyunto `sarcoDx.k >= 2` de classifyFenotipo. Con smmW alto (40), el otro disyunto es falso,
    // asi que la unica via a `sarcopenia` es la dinamometria: es exactamente lo que estaba muerto.
    expect(classifyFenotipo({ ...base }).sarcopenia, "sin fuerza no deberia haber sarcopenia").toBe(false);
    expect(classifyFenotipo({ ...base, fuerzaPrensil: 20 }).sarcopenia).toBe(true);
  });

  it("CONTROL: una fuerza NORMAL no inventa sarcopenia", () => {
    // Sin esto, todo lo de arriba pasaria verde tambien si hubieramos hecho que la rama se active
    // siempre que llega el dato, que seria cambiar un defecto por otro peor.
    expect(classifyFenotipo({ ...base, fuerzaPrensil: 40 }).sarcopenia).toBe(false);
    expect(dxSarcopenia(40, 6.0, 6.8, true).k).toBeLessThan(2);
  });
});

describe("las versiones subieron: sin eso, la reemisión del 12b no puede dispararse", () => {
  const VERSION = readFileSync("src/clinical-engine/version.ts", "utf8");

  it("el motor sube de 1.1.0, porque cambian salidas selladas", () => {
    // Es el mecanismo entero: si la version no sube, `vigencia.alDia` da true para los diagnosticos
    // viejos, no se recomputa nada, y la comparacion de bandas NUNCA se ejecuta. El arreglo quedaria
    // aplicado solo para los pacientes nuevos, en silencio.
    //
    // ASERCION DERIVADA (2026-09-05), por la misma razon que su hermana de abajo y con un dia de
    // diferencia: fijaba "1.2.0" a mano, asi que el bump legitimo del LE8 la puso roja. Lo que este test
    // afirma no es "la version es esta", es "la version SUBIO respecto de la que habia cuando se conecto
    // la dinamometria". Eso es lo unico que no envejece.
    const PREVIA_A_LA_DINAMOMETRIA = "anibise-1.1.0";
    const m = /export const ENGINE_VERSION = "([^"]+)"/.exec(VERSION);
    expect(m, "no se encuentra ENGINE_VERSION").not.toBeNull();
    expect(m![1]).not.toBe(PREVIA_A_LA_DINAMOMETRIA);
    // Y que siga siendo una version del motor, no cualquier cadena.
    expect(m![1]).toMatch(/^anibise-\d+\.\d+\.\d+$/);
  });

  it("y el conjunto de protocolo también, porque el fenotipo alimenta la prescripción", () => {
    // LA ASERCION SE HIZO DERIVADA (2026-09-01), y la razon es la de siempre: fijaba la version del 31 a
    // mano, asi que el siguiente bump legitimo la ponia roja. Un candado que se pone rojo cuando el
    // sistema hace lo correcto entrena a actualizarlo sin leerlo, y ahi deja de ser candado.
    //
    // Lo que este test quiere afirmar no es "la version es esta", es "la version SUBIO respecto de la que
    // habia cuando se conecto la dinamometria". Eso es lo que hace falta para que la reemision del 12b
    // pueda dispararse, y es lo unico que no envejece.
    const PREVIA_A_LA_DINAMOMETRIA = "anibise-protocolo-2026-08-19b";
    const m = /PROTOCOL_ENGINE_VERSION = "([^"]+)"/.exec(VERSION);
    expect(m, "no se encuentra PROTOCOL_ENGINE_VERSION").not.toBeNull();
    expect(m![1]).not.toBe(PREVIA_A_LA_DINAMOMETRIA);
    // Y que siga siendo una version de protocolo, no cualquier cadena.
    expect(m![1]).toMatch(/^anibise-protocolo-/);
  });
});
