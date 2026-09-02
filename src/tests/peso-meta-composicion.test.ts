import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Modulo congelado en JS; `allowJs` lo resuelve.
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";
import { PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";

import { funcionDelHtml } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PESO META POR COMPOSICION (Gildardo, entrega del 2026-09-01, punto 3).
//
// SU CAMBIO: el peso meta pasa de calcularse por IMC a la identidad peso = (FMI + FFMI) x talla². Cada
// indice se lleva a su rango y el resto se deja como esta: el FMI al limite si se pasa o si no llega
// (3-6 en hombres, 5-9 en mujeres) y el FFMI al minimo SOLO si esta por debajo (17 y 15).
//
// POR QUE PESA TANTO: el peso meta es la palanca de toda la cadena calorica. Con el IMC como criterio, un
// deportista con masa muscular alta recibia un recorte de kilos que no son grasa, y una obesidad
// sarcopenica con IMC normal recibia un objetivo de mantenimiento. Son sus dos casos, y los dos son
// reales en nuestros datos.

const FROZEN = "src/clinical-engine/frozen/atlas-tratamiento-nutri.js";
const NUTRI = readFileSync(FROZEN, "utf8");
const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

const BIS = (sexo: string, peso: number, talla: number, FMI: number, FFMI: number) => ({
  sexo,
  peso,
  talla,
  FMI,
  FFMI,
});
const ENC = { d5_39: [], edad: 40 };
type Salida = { pesoMeta: number; protG: number; protKg: number };
const correr = (bis: object, edit: object = {}) => motorTratNutri(ENC, bis, edit) as Salida;

describe("el porte es VERBATIM del archivo vigente", () => {
  it("el cuerpo del motor coincide con el de su HTML, sin espacios", () => {
    // Se compara contra la entrega VIGENTE (derivada del directorio), no contra una ruta escrita a mano:
    // un candado anclado a una entrega superada pasa verde por construccion.
    const suyo = funcionDelHtml("motorTratNutri");
    const sinEsp = (s: string) => s.replace(/\s+/g, "");
    // Se cuenta la llave, como hace `funcionDelHtml`. `lastIndexOf("}")` NO sirve: cae en la llave del
    // `module.exports = { motorTratNutri };` del final, y el cuerpo sale 31 caracteres más largo. Lo cazó
    // este mismo test en su primera corrida, que es para lo que está.
    const i = NUTRI.indexOf("function motorTratNutri(");
    let prof = 0;
    let j = -1;
    for (let k = NUTRI.indexOf("{", i); k < NUTRI.length; k++) {
      if (NUTRI[k] === "{") prof++;
      else if (NUTRI[k] === "}") {
        prof--;
        if (prof === 0) {
          j = k;
          break;
        }
      }
    }
    expect(j, "el motor no cierra en el frozen").toBeGreaterThan(i);
    expect(sinEsp(NUTRI.slice(i, j + 1))).toBe(sinEsp(suyo));
  });

  it("y la version del protocolo subió: sin eso el cambio entra en silencio", () => {
    // Si la version no sube, nada distingue una cadena sellada con la formula vieja de una con la nueva.
    expect(PROTOCOL_ENGINE_VERSION).toBe("anibise-protocolo-2026-09-01");
  });
});

describe("los dos casos que su cambio corrige", () => {
  it("el DEPORTISTA: composición normal, IMC alto, y la meta ya no le recorta músculo", () => {
    // Su caso, y es el de un paciente real nuestro: talla 177, FMI 5,76 (rango normal 3-6), FFMI 19,9.
    // Su IMC es 25,7, así que la fórmula por IMC lo trataba como obeso y le recortaba kilos que no son
    // grasa. Con los dos índices en rango, la identidad devuelve su propio peso.
    const m = correr(BIS("Masculino", 80.4, 177, 5.759, 19.904));
    expect(m.pesoMeta).toBe(80.4);
  });

  it("la OBESIDAD SARCOPÉNICA: el FMI baja al límite y el músculo se protege", () => {
    // FMI 12 (muy por encima de 6) y FFMI 16 (por debajo de 17). La meta recorta grasa y APUNTA a
    // recuperar masa magra, en vez de dejar el objetivo en mantenimiento.
    const m = correr(BIS("Masculino", 80.9, 170, 12, 16));
    expect(m.pesoMeta).toBe(66.5);
    expect(m.pesoMeta).toBeLessThan(80.9);
  });
});

describe("el piso del FFMI: su decisión explícita, y no produce el problema inverso", () => {
  it("el DESNUTRIDO: sin piso la meta salía POR DEBAJO de su peso actual", () => {
    // Su razón literal: "al conservar un FFMI deficitario, la meta heredaba la desnutrición". Con el piso,
    // la meta apunta a recuperar la masa magra que falta.
    const m = correr(BIS("Masculino", 52.1, 175, 2, 15));
    expect(m.pesoMeta).toBeGreaterThan(52.1);
  });

  it("y NINGÚN perfil con IMC alto sale mandado a subir", () => {
    // EL RIESGO INVERSO, comprobado en vez de razonado: que el piso empuje hacia arriba a alguien que
    // debería bajar. Se recorre una malla de perfiles donde el piso SÍ se activa (FFMI bajo el mínimo).
    const fallos: string[] = [];
    for (const sexoM of [true, false]) {
      const sexo = sexoM ? "Masculino" : "Femenino";
      const ffmiTope = sexoM ? 17 : 15;
      for (let talla = 150; talla <= 190; talla += 5) {
        for (let fmi = 1; fmi <= 20; fmi += 1) {
          for (let ffmi = 10; ffmi < ffmiTope; ffmi += 0.5) {
            const peso = Math.round((fmi + ffmi) * Math.pow(talla / 100, 2) * 10) / 10;
            const imc = peso / Math.pow(talla / 100, 2);
            if (imc < 25) continue; // solo interesa a quien deberia bajar
            const m = correr(BIS(sexo, peso, talla, fmi, ffmi));
            if (m.pesoMeta > peso) {
              fallos.push(`${sexo} t${talla} FMI${fmi} FFMI${ffmi}: ${peso} -> ${m.pesoMeta}`);
            }
          }
        }
      }
    }
    expect(fallos, `el piso mandó a SUBIR a un IMC>=25:\n${fallos.slice(0, 5).join("\n")}`).toEqual([]);
  });

  it("CONTROL: la malla de verdad recorre perfiles con el piso activo", () => {
    // Sin este control, el test de arriba pasaría verde también si la malla no hubiera evaluado nada.
    let conPiso = 0;
    for (let talla = 150; talla <= 190; talla += 5) {
      for (let fmi = 1; fmi <= 20; fmi += 1) {
        for (let ffmi = 10; ffmi < 17; ffmi += 0.5) {
          const peso = Math.round((fmi + ffmi) * Math.pow(talla / 100, 2) * 10) / 10;
          if (peso / Math.pow(talla / 100, 2) >= 25) conPiso++;
        }
      }
    }
    expect(conPiso).toBeGreaterThan(200);
  });
});

describe("lo que NO cambia por sí solo, y es lo que hay que saber", () => {
  it("nuestra cadena SIGUE pasándole su propio peso, así que la fórmula nueva no gobierna", () => {
    // EL HALLAZGO QUE CAMBIA EL ALCANCE: `getPrescripcionNutricional` le pasa SIEMPRE `edit.peso_meta`
    // (el peso efectivo de la cadena, que sale de `atlas-protocolo.pesoCalculo`), y con eso la fórmula
    // interna de `motorTratNutri` NUNCA se ejecuta en nuestro camino. Su corrección está en el motor que
    // bypaseamos; la fórmula que gobierna nuestra cadena es la otra, y esa él no la cambió.
    //
    // Está preguntado en la ronda. Este test fija el estado de HOY para que el día que se decida, se vea
    // que cambió algo.
    const READER = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");
    expect(sinComentarios(READER)).toContain("edit.peso_meta = pesoMeta");
    const PROTOCOLO = readFileSync("src/clinical-engine/frozen/atlas-protocolo.js", "utf8");
    expect(PROTOCOLO).toContain("imc<25 ? peso : PI+0.25*(peso-PI)");
  });

  it("y la diferencia entre las dos fórmulas es real, no teórica", () => {
    // Mismo paciente, los dos caminos. Si algún día coincidieran, este test lo diría.
    const conSuya = correr(BIS("Masculino", 80.4, 177, 5.759, 19.904));
    const conLaNuestra = correr(BIS("Masculino", 80.4, 177, 5.759, 19.904), { peso_meta: 72.79 });
    expect(conSuya.pesoMeta).not.toBe(conLaNuestra.pesoMeta);
    expect(conSuya.protG).toBeGreaterThan(conLaNuestra.protG);
  });
});

describe("el desfase de versión se avisa donde se ve la cifra", () => {
  it("el panel compara la versión sellada de la cadena contra la vigente", () => {
    // EL HUECO: el mecanismo de vigencia de emisión mira tres dimensiones y NO el protocolo. La versión
    // del motor calórico se sella dentro de `protocol_suggested` y no la miraba nadie: al medirlo había
    // CINCO versiones distintas vivas. Subir la versión, por sí solo, no avisaba a nadie.
    expect(PANEL).toContain("snap.protocolEngineVersion !== PROTOCOL_ENGINE_VERSION");
    expect(PANEL).toContain("los gramos de proteína pueden moverse");
  });
});
