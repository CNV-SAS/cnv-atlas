import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LA FECHA DE LA EVALUACION (2026-08-29).
//
// LA REGLA, que ya existia escrita en `comparison-chronology`: la cronologia clinica se ancla a
// `measurement_date` y NO a `created_at`, porque una evaluacion CORREGIDA arrastra la medicion original y
// estrena `created_at` el dia de la correccion. Verificado en `correct-evaluation`: la correccion copia
// `measurementDate` del BIS viejo a la fila nueva.
//
// LO QUE ENCONTRO EL BARRIDO. La regla existia y TRES criterios distintos convivian:
//   - `measurement_date` puro: comparacion de seguimiento, serie, proximo control. Correcto.
//   - `measurement_date` con caida a `created_at`: la ficha del paciente y el roster. Correcto.
//   - `created_at` a secas: la cabecera de la evaluacion (y las tres pantallas que la usan) y, lo peor,
//     el PDF y el correo del REPORTE, donde ademas era el `created_at` del reporte y no el de la
//     evaluacion. En la BD local eso cambiaba la fecha de 37 de 40 reportes, hasta 35 dias.
//
// POR QUE EL CANDADO MIRA LA FUENTE Y NO EJECUTA. Lo que se protege es de DONDE sale el dato, y eso vive
// en dos lineas de dos readers. Un test de ejecucion pediria BD real con una evaluacion corregida
// sembrada; este atrapa la regresion mas probable, que es que alguien "simplifique" el reader quitando el
// embed de la medicion, y la atrapa en la suite rapida.

const READERS = [
  {
    ruta: "src/modules/diagnoses/data/results-reader.ts",
    que: "la cabecera de la evaluacion (y corregir, ver encuesta, editar encuesta)",
  },
  {
    ruta: "src/modules/reports/data/reports-repository.ts",
    que: "el PDF y el correo del reporte",
  },
];

describe("la fecha de una evaluacion sale de la MEDICION, no de created_at", () => {
  for (const r of READERS) {
    it(`${r.que} embebe la medicion en su consulta`, () => {
      const src = readFileSync(r.ruta, "utf8");
      expect(src).toContain("bis_measurements(measurement_date)");
    });

    it(`${r.que} NO asigna created_at directo a evaluationDate`, () => {
      const src = readFileSync(r.ruta, "utf8");
      // La forma exacta del defecto que se corrigio. La caida a created_at SI es valida, pero va detras
      // de la medicion (`... ?? data.created_at`), nunca sola.
      expect(src).not.toMatch(/evaluationDate:\s*data\.created_at\s*,/);
      expect(src).toMatch(/evaluationDate:\s*\w+\([^)]*\)\s*\?\?\s*data\.created_at/);
    });
  }

  it("y los tres criterios coinciden: medicion primero, created_at solo como caida", () => {
    // La ficha del paciente ya lo hacia asi antes del arreglo; se fija para que los tres no se separen.
    const roster = readFileSync("src/modules/patients/data/patients-list-reader.ts", "utf8");
    expect(roster).toContain("bis_measurements?.[0]?.measurement_date ?? e.created_at");
  });
});
