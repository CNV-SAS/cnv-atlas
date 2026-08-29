import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FREQ_GROUPS } from "@/clinical-engine";

// CANDADO DE CORRESPONDENCIA entre el ORDEN de la encuesta y el de `FREQ_GROUPS` (2026-08-29).
//
// EL DEFECTO QUE FIJA, y es de contenido clinico, no de forma. Teniamos DOS fuentes del mismo orden y no
// coincidian:
//   - `FREQ_GROUPS` (frozen, portado byte a byte de su archivo) va por CATEGORIA CLINICA: 1-7 protector,
//     8-11 neutro, 12-15 riesgo. Las CARNES ROJAS ocupan la posicion 11 aunque su campo sea `d1_15_i`,
//     porque el 15 es el identificador y no el lugar.
//   - La ENCUESTA (seed) iba por el NUMERO DEL CAMPO, asi que las carnes rojas salian las ultimas,
//     despues de ultraprocesados: entre los de RIESGO.
//
// Su regla, textual: "nunca roten por posicion, siempre por `n`", y "la agrupacion que ve el paciente es
// esa misma: EL ORDEN ES EL MENSAJE". Con nuestro orden le deciamos al paciente que las carnes rojas son
// alimento de riesgo cuando su modelo las clasifica como NEUTRAS.
//
// POR QUE NINGUN TEST LO ENCONTRO: nuestro orden era coherente CONSIGO MISMO. El motor leia por
// `field_key`, las respuestas se guardaban bien, y el display del patron usaba `FREQ_GROUPS` (correcto).
// Lo unico que estaba mal era la SECUENCIA que veia el paciente, y eso no lo mira ningun test que no
// compare las dos fuentes. Lo encontro Santiago respondiendo la encuesta con el archivo de Gildardo al
// lado: LA CONSISTENCIA INTERNA NO PRUEBA FIDELIDAD.

// El orden de la encuesta se lee del SEED COMO TEXTO, no importandolo: `seed.ts` es un script destructivo
// (borra y re-inserta la version vigente) y basta con cargarlo para que corra. Lo que interesa aqui es el
// ORDEN en que estan declaradas las preguntas, y eso se ve en el archivo.
function ordenDeLaEncuesta(): string[] {
  const src = readFileSync("supabase/seed.ts", "utf8");
  return [...src.matchAll(/^\s*\{ key: "(d1_\d+_i)"/gm)].map((m) => m[1]);
}

describe("el orden de la encuesta sigue al de FREQ_GROUPS, no al numero del campo", () => {
  const enEncuesta = ordenDeLaEncuesta();
  const enMotor = FREQ_GROUPS.map((g) => `d1_${g.n}_i`);

  it("son los mismos quince grupos", () => {
    expect([...enEncuesta].sort()).toEqual([...enMotor].sort());
  });

  it("Y EN EL MISMO ORDEN: si dejan de coincidir, esto truena", () => {
    expect(enEncuesta).toEqual(enMotor);
  });

  it("las carnes rojas van entre los NEUTROS, no al final", () => {
    // El caso concreto que estaba mal. `d1_15_i` es el identificador; su lugar es el 11.
    const pos = enEncuesta.indexOf("d1_15_i") + 1;
    expect(pos).toBe(11);
    expect(FREQ_GROUPS.find((g) => g.n === 15)?.cat).toBe("neutro");
    // Y va DESPUES de carnes blancas y ANTES de los refinados, que es lo que hace la distincion
    // "separarlas de los embutidos" que el llama importante.
    expect(enEncuesta.indexOf("d1_15_i")).toBeGreaterThan(enEncuesta.indexOf("d1_10_i"));
    expect(enEncuesta.indexOf("d1_15_i")).toBeLessThan(enEncuesta.indexOf("d1_12_i"));
  });

  it("las tres categorias son CONTIGUAS en el orden de la encuesta", () => {
    // Es lo que hace posibles los tres encabezados de grupo, y lo que yo habia diagnosticado mal:
    // en SU orden las categorias son contiguas; lo que salta es el identificador, no la categoria.
    const cats = enEncuesta.map(
      (k) => FREQ_GROUPS.find((g) => `d1_${g.n}_i` === k)?.cat ?? "?",
    );
    const bloques = cats.filter((c, i) => c !== cats[i - 1]);
    expect(bloques).toEqual(["protector", "neutro", "riesgo"]);
  });
});

// SEGUNDO PAR DE LA MISMA FORMA, encontrado al barrer (2026-08-29): los QUINCE ROTULOS viven dos veces,
// como `label` en `FREQ_GROUPS` (frozen) y como `text` en el seed. Nada los comparaba.
//
// El barrido dio UNA diferencia y es presentacional, no semantica: el frozen mete los ejemplos dentro del
// rotulo ("Grasas saludables (aguacate, aceite de oliva y frutos secos)") y el seed los separa en el campo
// `sub`, mas completos. El paciente ve la misma informacion. Se documenta la tolerancia en vez de
// "arreglar" uno de los dos, porque los dos estan bien: son dos formas de presentar lo mismo.
//
// Lo que el candado SI atrapa es una divergencia de verdad: que uno diga un grupo de alimentos y el otro
// diga otro, que es como empezo el defecto del orden.
describe("los rotulos de los quince grupos no divergen entre el seed y el motor", () => {
  const seedTexts = new Map(
    [...readFileSync("supabase/seed.ts", "utf8").matchAll(
      /\{ key: "d1_(\d+)_i", type: "opcion", text: "([^"]+?) \(frecuencia de consumo\)"/g,
    )].map((m) => [Number(m[1]), m[2]]),
  );

  it("cada rotulo del motor empieza por el texto de su pregunta en la encuesta", () => {
    for (const g of FREQ_GROUPS) {
      const enSeed = seedTexts.get(g.n);
      expect(enSeed, `falta d1_${g.n}_i en el seed`).toBeDefined();
      // `startsWith` y no igualdad: el frozen puede llevar los ejemplos pegados al rotulo (caso n=5).
      // Lo que no puede es nombrar OTRO grupo.
      expect(g.label.startsWith(enSeed!)).toBe(true);
    }
  });
});
