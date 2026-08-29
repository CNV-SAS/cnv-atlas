import { describe, expect, it } from "vitest";

import { cFFMI, cFMI } from "@/clinical-engine/frozen/engine.core.derived.js";
import {
  resumenEjercicioParrafo,
  resumenMedicoParrafo,
  resumenPsicoParrafo,
} from "@/clinical-engine/resumen-profesion";

import {
  _inyectar,
  _resumenEjercicioParrafo,
  _resumenMedicoParrafo,
  _resumenPsicoParrafo,
} from "./fixtures/reference/resumen-profesion-vigente.js";

// GOLDEN DIFERENCIAL de los tres párrafos por profesión: nuestro porte contra SU PROPIA FUNCIÓN, corriendo
// las dos sobre los mismos casos. Mismo patrón que `resumen-dieta.golden.test.ts`.
//
// POR QUE DIFERENCIAL Y NO UNA LISTA DE SALIDAS ESPERADAS: una lista la escribiría yo leyendo su código, y
// entonces el test probaría que entendí lo que leí, no que el porte hace lo mismo. Aquí el valor esperado
// lo produce SU función. Si diverjo en un "y" o en un umbral, sale.
//
// LA COPIA DE REFERENCIA TIENE VIGILANCIA PROPIA: `frozen-deriva-vigente.test.ts` la compara contra la
// entrega de hoy. Sin eso, este golden probaría paridad contra una versión suya que ya no existe, que es
// exactamente el defecto que nos costó el `cAF`.

_inyectar({ cFMI, cFFMI });

const CASOS: { nombre: string; enc: Record<string, unknown>; bis: Record<string, unknown> }[] = [
  {
    nombre: "vacío (todo ausente)",
    enc: {},
    bis: {},
  },
  {
    nombre: "hombre con comorbilidades, medicación y hábitos de riesgo",
    enc: {
      sexo: "M",
      d5_38: ["Diabetes tipo 2", "Hipertensión"],
      d5_39: ["Diabetes tipo 2"],
      d5_36: "Sí",
      d5_40: ["Metformina", "Losartán"],
      d6_qx: "Colecistectomía",
      d6_43: ["Maní"],
      d6_44: ["Lactosa"],
      d3_23: "0",
      d3_30: "Fumo a diario",
      d3_31: "Todos los días",
      d3_29: 9,
      d3_26: "Menos de 5h",
      d1_1_i: 0,
      d1_2_i: 0,
      d1_11_i: 4,
      d1_12_i: 4,
    },
    bis: {},
  },
  {
    nombre: "mujer activa, buena hidratación, sin banderas",
    enc: {
      sexo: "F",
      d3_23: "4",
      d3_24: "Más de 60 min",
      d3_25: ["Caminata", "Pesas"],
      d7_agua: "8",
      d3_29: 3,
      d1_1_i: 4,
      d1_2_i: 4,
      d1_11_i: 0,
    },
    bis: { FFMI: 14, FMI: 6, sexo: "F" },
  },
  {
    nombre: "hombre con HTA ya en la lista: no se duplica",
    enc: { sexo: "M", d5_39: ["Hipertensión arterial"], d5_36: "Sí", d3_23: "2" },
    bis: {},
  },
  {
    nombre: "discordancia entre percepción corporal y composición objetiva",
    enc: {
      sexo: "F",
      d2_19: "Muy delgado/a",
      d2_20: "Muy insatisfecho/a",
      d2_21: ["Laxantes", "Ayunos"],
      d2_22: "Frecuentemente",
      d3_29: 8,
      d3_27: "Muy mala",
    },
    bis: { FMI: 14, sexo: "F" },
  },
  {
    nombre: "percepción congruente",
    enc: { sexo: "M", d2_19: "Normal", d3_29: 5 },
    bis: { FMI: 5, sexo: "M" },
  },
  {
    nombre: "un solo día de ejercicio: singular, no plural",
    enc: { sexo: "M", d3_23: "1", d3_24: "15–30 min", d7_agua: "1" },
    bis: {},
  },
];

describe("resumen por profesión: paridad con la función de Gildardo", () => {
  for (const c of CASOS) {
    it(`médico · ${c.nombre}`, () => {
      expect(resumenMedicoParrafo(c.enc, c.bis)).toBe(_resumenMedicoParrafo(c.enc, c.bis));
    });
    it(`entrenador · ${c.nombre}`, () => {
      expect(resumenEjercicioParrafo(c.enc, c.bis)).toBe(_resumenEjercicioParrafo(c.enc, c.bis));
    });
    it(`psicólogo · ${c.nombre}`, () => {
      expect(resumenPsicoParrafo(c.enc, c.bis)).toBe(_resumenPsicoParrafo(c.enc, c.bis));
    });
  }
});

describe("los casos golden no son todos vacíos", () => {
  it("al menos cinco casos producen texto en alguna profesión", () => {
    // CONTROL del propio golden: comparar "" contra "" pasa verde y no prueba nada. Si los fixtures
    // dejaran de producir texto (porque cambió un nombre de campo, por ejemplo), la paridad seguiría
    // verde sobre el vacío. Esto exige que haya salida real que comparar.
    const conTexto = CASOS.filter(
      (c) =>
        resumenMedicoParrafo(c.enc, c.bis) !== "" ||
        resumenEjercicioParrafo(c.enc, c.bis) !== "" ||
        resumenPsicoParrafo(c.enc, c.bis) !== "",
    );
    expect(conTexto.length).toBeGreaterThanOrEqual(5);
  });

  it("y el caso vacío sí devuelve cadena vacía en las tres", () => {
    const vacio = CASOS[0];
    expect(resumenMedicoParrafo(vacio.enc, vacio.bis)).toBe("");
    expect(resumenEjercicioParrafo(vacio.enc, vacio.bis)).toBe("");
    expect(resumenPsicoParrafo(vacio.enc, vacio.bis)).toBe("");
  });
});
