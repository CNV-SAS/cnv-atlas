import { describe, expect, it } from "vitest";

import { alertasCriticas, type InsumosDeLasAlertas } from "@/clinical-engine/alertas-criticas";
import * as core from "@/clinical-engine/frozen/engine.core.derived.js";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS ALERTAS CRITICAS, CON SUS CASOS S, T, U y V  ·  v17 §2.9 y §13  ·  2026-11-12
//
// Son los cuatro casos de su §13 que faltaban, y los cuatro prueban cosas distintas:
//
//   S · el MISMO paciente en los dos sexos: mujer sin alertas, hombre con el IFC critico. Es el caso que
//       demuestra para que sirve el corte por sexo, igual que el G lo demostraba para el PABU;
//   T · las tres a la vez en una mujer;
//   U · las tres a la vez en un hombre, con el ICA-BIS por el otro lado (exceso en vez de deficit);
//   V · sin sexo, o con los indicadores en cero, NINGUNA se emite.
//
// Y UN QUINTO BLOQUE que no es suyo: las tres alertas que su v17 NO cambia (IAE, FFMI y obesidad
// sarcopenica) tambien se portan, porque en Atlas tampoco existian. Van con su propio caso.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const vacio: InsumosDeLasAlertas = {
  sexo: null, ifc: null, irc: null, pabu: null, iae: null, ffmi: null, sectorId: null,
};
const caso = (x: Partial<InsumosDeLasAlertas>) => alertasCriticas({ ...vacio, ...x });

describe("v17 §13 · las alertas criticas por sexo (casos S, T, U y V)", () => {
  it("S · IFC 1,9 · IRC 2,0 · PABU 1,60: la mujer sin alertas, el hombre con el IFC critico", () => {
    // Su resultado esperado, palabra por palabra: *"Mujer: sin alertas. Hombre: alerta de IFC crítico
    // (< 3,49)"*. La aritmetica: el P10 del IFC es 1,73 en mujeres (1,9 queda ENCIMA, no hay alerta) y
    // 3,49 en hombres (1,9 queda debajo). El P90 del IRC es 3,13 y 2,30: un 2,0 no lo pasa en ninguno.
    const datos = { ifc: 1.9, irc: 2.0, pabu: 1.6 };
    expect(caso({ ...datos, sexo: "F" })).toEqual([]);
    const hombre = caso({ ...datos, sexo: "M" });
    expect(hombre).toHaveLength(1);
    expect(hombre[0]).toContain("IFC crítico");
    expect(hombre[0]).toContain("3,49");
    expect(hombre[0]).toContain("hombres");
  });

  it("T · mujer con IFC 1,6 · IRC 3,2 · PABU 2,60: las tres alertas, el ICA-BIS por déficit", () => {
    // IFC 1,6 < 1,73 (su P10) · IRC 3,2 > 3,13 (su P90) · ICA-BIS = 2,60 − 1,618 = 0,982, que pasa el
    // P90 femenino (0,86) de su Tabla 7.3, asi que es la cola de DEFICIT.
    const a = caso({ sexo: "F", ifc: 1.6, irc: 3.2, pabu: 2.6 });
    expect(a).toHaveLength(3);
    expect(a[0]).toContain("IFC crítico");
    expect(a[1]).toContain("IRC muy elevado");
    expect(a[2]).toContain("ICA-BIS crítico (> P90 en mujeres)");
    expect(a[2]).toContain("por déficit");
  });

  it("U · hombre con IFC 3,0 · IRC 2,4 · PABU 1,018: las tres, y el ICA-BIS por EXCESO", () => {
    // IFC 3,0 < 3,49 · IRC 2,4 > 2,30 · ICA-BIS = 1,018 − 1,618 = −0,600, por debajo del P10 masculino
    // (−0,50): la otra cola. Es el caso que prueba que la DIRECCION se lee y no se asume.
    const a = caso({ sexo: "M", ifc: 3.0, irc: 2.4, pabu: 1.018 });
    expect(a).toHaveLength(3);
    expect(a[2]).toContain("ICA-BIS crítico (< P10 en hombres)");
    expect(a[2]).toContain("por exceso");
  });

  it("V · sin sexo, o con los indicadores en cero, no se emite ninguna", () => {
    // Las dos mitades de su caso V. La primera es la que importa mas: sin sexo no hay percentil contra
    // el que comparar, y emitir la alerta con el corte de un sexo cualquiera seria peor que no emitirla.
    expect(caso({ sexo: null, ifc: 1.0, irc: 6.0, pabu: 5.0 })).toEqual([]);
    expect(caso({ sexo: "F", ifc: 0, irc: 0, pabu: 0 })).toEqual([]);
  });

  it("y los cortes de las tres salen de SU tabla, no de un numero escrito aqui", () => {
    // El candado de la fuente: si el moviera un percentil, las cadenas se mueven con el. Se comprueba
    // que el numero que aparece en el texto es el de `ALERTA_CRITICA_REF`, leido del frozen.
    for (const sexo of ["F", "M"] as const) {
      const ref = core.ALERTA_CRITICA_REF[sexo];
      const ifcAlerta = caso({ sexo, ifc: ref.ifcP10 - 0.01 })[0];
      expect(ifcAlerta, `${sexo}: no se emitio el IFC critico justo por debajo del P10`).toBeDefined();
      expect(ifcAlerta).toContain(ref.ifcP10.toFixed(2).replace(".", ","));
      // Y en el corte EXACTO no se emite: su condicion es `<`, no `<=`.
      expect(caso({ sexo, ifc: ref.ifcP10 })).toEqual([]);
      const ircAlerta = caso({ sexo, irc: ref.ircP90 + 0.01 })[0];
      expect(ircAlerta, `${sexo}: no se emitio el IRC muy elevado justo por encima del P90`).toBeDefined();
      expect(ircAlerta).toContain(ref.ircP90.toFixed(2).replace(".", ","));
      expect(caso({ sexo, irc: ref.ircP90 })).toEqual([]);
    }
  });

  it("los umbrales UNICOS de su v16 no sobreviven en ninguna parte (su criterio §14)", () => {
    // *"ni los umbrales únicos de alerta IFC < 2,0, IRC > 5,0 e ICA-BIS > 3,0"*. Con los cortes por sexo
    // un IFC de 1,9 en mujer NO alerta (el viejo si lo haria) y un IRC de 2,4 en hombre SI alerta (el
    // viejo no, porque pedia pasar de 5,0). Los dos sentidos, para que no quede ninguno a medias.
    expect(caso({ sexo: "F", ifc: 1.9 })).toEqual([]);
    expect(caso({ sexo: "M", irc: 2.4 })).toHaveLength(1);
  });
});

describe("las otras tres alertas suyas, que en Atlas tampoco existian", () => {
  it("el IAE por encima de 10 años", () => {
    expect(caso({ iae: 10.1 })[0]).toContain("IAE >10 años");
    expect(caso({ iae: 10 })).toEqual([]);
    // Sin sexo TAMBIEN se emite, y es correcto: esta no depende de ningun percentil por sexo.
    expect(caso({ sexo: null, iae: 12 })).toHaveLength(1);
  });

  it("el FFMI critico, con SUS cortes (15 y 13), que no son los de la banda baja", () => {
    // Su alerta usa 15 en hombres y 13 en mujeres; la banda baja de `cFFMI` empieza en 17 y 15. Son dos
    // lecturas distintas y a proposito: la banda dice "riesgo de desnutricion" y la alerta "severa".
    expect(caso({ sexo: "M", ffmi: 14.9 })[0]).toContain("FFMI crítico");
    expect(caso({ sexo: "M", ffmi: 15 })).toEqual([]);
    expect(caso({ sexo: "F", ffmi: 12.9 })[0]).toContain("FFMI crítico");
    expect(caso({ sexo: "F", ffmi: 13 })).toEqual([]);
    // Y la diferencia con la banda, escrita: un hombre con FFMI 16 esta en banda BAJA y NO alerta.
    expect(core.cFFMI(16, "M").k).toBe(1);
    expect(caso({ sexo: "M", ffmi: 16 })).toEqual([]);
  });

  it("la obesidad sarcopenica es el sector S9 (v17 §7), no un calculo aparte", () => {
    expect(caso({ sectorId: "S9" })[0]).toContain("Obesidad sarcopénica confirmada");
    for (const otro of ["S1", "S5", "S7", "S8", null]) {
      expect(caso({ sectorId: otro })).toEqual([]);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL CABLE: LAS TRES ALERTAS LLEGAN A LAS DOS SUPERFICIES
//
// Construir las alertas y no cablearlas es el defecto que ya nos paso con la cintura del dominio 2: una
// pieza terminada, verde en sus pruebas, que no se enciende nunca porque nadie la llama. Aqui se vigila
// la FORMA en los dos sitios donde su archivo las pone: la pantalla del profesional y el texto de la IA.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("las alertas criticas llegan a la pantalla y a la IA", () => {
  it("la pantalla del diagnostico las calcula y las pinta", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8");
    expect(src, "la pantalla no calcula las alertas").toContain("alertasCriticas({");
    expect(src, "las calcula y no las pinta").toContain("alertasDeLaMedicion.map");
    // Y del SNAPSHOT SELLADO, no de un recomputo: es lo que las hace aparecer en el historico.
    expect(src).toContain("sexo: snapshot.sexo");
  });

  it("el texto de la IA las lleva, y con un bloque propio", async () => {
    const { readFileSync } = await import("node:fs");
    const lector = readFileSync("src/modules/diagnoses/data/criterion-input-reader.ts", "utf8");
    expect(lector, "el insumo de la IA no las trae").toContain("alertasCriticas: alertasCriticas({");
    const prompt = readFileSync("src/modules/diagnoses/ai/prompts/criterion.v2.ts", "utf8");
    expect(prompt, "el prompt recibe el campo y no lo usa").toContain("input.alertasCriticas");
    // EL BLOQUE SE ESCRIBE TAMBIEN VACIO, que es la regla de este prompt: sin la linea que dice que no
    // hay ninguna, el modelo no distingue "no hay" de "no me las mandaron" y las deduce de los datos.
    expect(prompt).toContain("ALERTAS CRÍTICAS DE LA MEDICIÓN: ninguna");
  });
});
