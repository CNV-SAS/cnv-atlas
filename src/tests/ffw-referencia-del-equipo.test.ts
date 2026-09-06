import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import { buildComposition } from "@/modules/diagnoses/data/composition-map";
import { computeRefPob } from "@/modules/diagnoses/data/composition-display";

// CANDADO DE LA REFERENCIA DEL FFW (cotejo 2026-09-06, punto 9e). Santiago preguntó lo correcto: si la
// celda de referencia del FFW quedó vacía porque su HTML la tiene vacía, sería portar un error.
//
// NO LO ES, Y ESTE CANDADO LO DEMUESTRA CORRIENDO LOS DOS CASOS:
//
//   · CON el dato del equipo (`FFW_dif`, la columna "Fat free water ... ECARTTHEORIQUEEXPORT L"), la fila
//     SIGUE mostrando su referencia: `FFW − FFW_dif`. Es una cifra MEDIDA por el Biody, no una nuestra, y
//     no se tocó.
//   · SIN ese dato, la celda queda vacía. Lo que se retiró (DIV-17) es la reserva que la RELLENABA con la
//     referencia del AGUA CORPORAL TOTAL (`FFW_ref = tbwR`), que es otra cantidad: en el paciente del
//     cotejo daba 48,55 contra un FFW de 41,95, o sea un déficit de -6,60 que nadie mide.
//
// O sea que la celda vacía no es una copia de su pantalla: es lo que queda cuando dejamos de escribir un
// número que no existía. El equipo manda; cuando el equipo calla, callamos.

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/clinical-engine/biody-juan-esteban-anon.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

const HEADER_FFW_DIF = "Fat free water measurementDetails.ECARTTHEORIQUEEXPORT L";

function crudo(sinDif = false): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [k, v] of Object.entries(fixture)) {
    if (sinDif && k === HEADER_FFW_DIF) continue;
    if (typeof v === "number") raw[normalizeHeader(k)] = v;
  }
  return raw;
}

const filaFFW = (raw: Record<string, number>) =>
  buildComposition(raw, null)
    .diag.flatMap((l) => l.rows)
    .find((r) => r.key === "FFW");

describe("la referencia del FFW sale del EQUIPO, y sigue saliendo (cotejo punto 9e)", () => {
  it("con la columna del equipo, la fila trae su referencia medida", () => {
    const f = filaFFW(crudo());
    expect(f, "la fila FFW existe").toBeDefined();
    expect(f!.value).toBeCloseTo(47.391, 3);
    // FFW − FFW_dif = 47,391 − 0,266. La cifra es del Biody, no nuestra.
    expect(f!.reference).toBeCloseTo(47.125, 3);
  });

  it("y sin esa columna queda vacía: no se inventa", () => {
    const f = filaFFW(crudo(true));
    expect(f!.value).toBeCloseTo(47.391, 3);
    expect(f!.reference, "sin dato del equipo no hay referencia").toBeNull();
  });

  it("la reserva que la rellenaba con la del AGUA CORPORAL TOTAL ya no existe (DIV-17)", () => {
    // El control de que la celda vacía del caso anterior no se vuelve a llenar por otra vía: `computeRefPob`
    // solo rellena lo que el equipo no trajo, y ya no produce una entrada para el FFW.
    const refPob = computeRefPob(80, 175, true, () => null);
    expect(Object.keys(refPob)).not.toContain("FFW_ref");
    // Y el control positivo: sí sigue produciendo las que SÍ son suyas (el reparto de Wang que Gildardo
    // confirmó), para que este caso no pase verde por estar mirando un objeto vacío.
    expect(Object.keys(refPob)).toContain("TBW_ref");
    expect(Object.keys(refPob)).toContain("MCA_ref");
  });
});
