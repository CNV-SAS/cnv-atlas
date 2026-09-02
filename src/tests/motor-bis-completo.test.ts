import { readFileSync } from "node:fs";

import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";

import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";
import { BIODY_COLUMNS } from "@/clinical-engine/edge/biody-columns";

// AL MOTOR NO SE LE PASA UN `bis` SIN PESO NI TALLA, y este candado existe porque lo hice.
//
// EL DEFECTO (smoke de Santiago, 2026-09-03). Los callers pasaban `snapshot.indicators`, que trae FMI y
// FFMI pero NO peso ni talla. `motorTratNutri` no falla cuando le faltan: usa sus defaults (70 kg / 170
// cm), o sea IMC 24,2, y contesta **1,0 g/kg**. Un numero plausible, en la unidad correcta, que se lee
// como resultado.
//
// A QUIEN LE DOLIA: solo a las ramas que dependen del IMC. La obesidad se decide por FMI (que si llegaba)
// y la ERC por la encuesta, asi que esas dos salian bien y el defecto quedaba tapado. La que salia mal era
// la DESNUTRICION, o sea el perfil donde una proteina equivocada hace mas dano: 1,0 en vez de 1,5.
//
// Y ASI SE VEIA EN PANTALLA: el campo decia "modelo 1.5" (lo sellado), la validacion 73 g y la calculadora
// 44 g con 1 g/kg. Tres cifras del mismo concepto a la vez. Lo encontro Santiago mirando, no un test:
// el mio pasaba porque le construia el `bis` completo a mano, o sea que probaba la funcion y no el SITIO
// DE LLAMADA, que es donde estaba el hueco.
//
// POR ESO ESTE CANDADO MIRA LAS DOS COSAS: que la fuente de peso y talla exista de verdad (contra la base)
// y que el sitio de llamada la use.

vi.mock("server-only", () => ({}));

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

afterAll(async () => {
  await sql.end();
});

const LECTOR = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");

describe("el motor recibe peso y talla, o no se corre", () => {
  it("el `bis` de los callers (indicators) NO trae peso ni talla: por eso hace falta completarlo", async () => {
    // ESTE es el hecho que hacia falta verificar y no verifique. Se comprueba contra la base, no de
    // memoria: si algun dia `indicators` empezara a traerlos, este caso se pondria rojo y el completador
    // sobraria, que es informacion util y no un falso positivo.
    const [fila] = await sql<{ ind: Record<string, unknown> }[]>`
      SELECT snapshot->'indicators' AS ind FROM reports
      WHERE snapshot ? 'indicators' ORDER BY created_at DESC LIMIT 1`;
    expect(fila).toBeDefined();
    expect(fila.ind.peso).toBeUndefined();
    expect(fila.ind.talla).toBeUndefined();
    // Y el CONTROL de que la consulta no leyo un objeto vacio: lo que si trae.
    expect(fila.ind.FMI).toBeDefined();
  });

  it("la composición SÍ los trae, y son columnas requeridas del import", () => {
    // La fuente que el completador usa. `Altura cm` es el header real; "Estatura" es solo el rotulo de
    // pantalla, y confundirlos habria dejado la talla en null y el chip mudo para todos.
    expect(BIODY_COLUMNS.peso.header).toBe("Peso kg");
    expect(BIODY_COLUMNS.talla.header).toBe("Altura cm");
    expect(BIODY_COLUMNS.peso.required).toBe(true);
    expect(BIODY_COLUMNS.talla.required).toBe(true);
  });

  it("y en la base esas dos columnas están en las mediciones reales", async () => {
    const filas = await sql<{ n: string }[]>`
      SELECT DISTINCT variable_name AS n FROM bis_raw_values
      WHERE variable_name IN ('Peso kg', 'Altura cm')`;
    expect(filas.map((f) => f.n).sort()).toEqual(["Altura cm", "Peso kg"]);
  });

  it("EL SITIO DE LLAMADA los usa: las dos entradas al motor pasan por el completador", () => {
    // CANDADO SOBRE EL SITIO DE LLAMADA, que es la forma que corresponde cuando el defecto es una
    // OMISION: probar que el completador funciona no dice nada si nadie lo llama.
    expect(LECTOR).toContain("const completo = conPesoYTalla(bis, await getCompositionForEvaluation(");
    expect(LECTOR).toContain("const bisCompleto = conPesoYTalla(bis, await getCompositionForEvaluation(");
    expect(LECTOR).toContain("motorTratNutri(enc, completo, {})");
    expect(LECTOR).toContain("motorTratNutri(enc, bisCompleto, edit)");
    // Y que no quede ninguna llamada al motor con el `bis` crudo.
    expect(LECTOR).not.toContain("motorTratNutri(enc, bis,");
  });

  it("la diferencia que esto corrige, medida sobre el perfil que la sufría", () => {
    // El paciente del caso 2 del smoke: 43,7 kg / 155 cm (IMC 18,2), FMI 2,997, FFMI 15,19, sin
    // diagnosticos. Con el `bis` incompleto el motor contesta 1,0; con peso y talla, 1,5.
    const enc = { sexo: "F", d5_39: ["Ninguna"] };
    const indicadores = { sexo: "F", FMI: 2.997, FFMI: 15.19 };
    const incompleto = motorTratNutri(enc, indicadores, {}) as { protKg: number };
    const completo = motorTratNutri(
      enc,
      { ...indicadores, peso: 43.7, talla: 155 },
      {},
    ) as { protKg: number };
    expect(incompleto.protKg).toBe(1); // el default plausible, que es el defecto
    expect(completo.protKg).toBe(1.5); // la desnutrición, que es la respuesta
  });
});
