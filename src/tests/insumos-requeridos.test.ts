import { describe, expect, it } from "vitest";

import { BIODY_COLUMNS, ENGINE_REQUIRED } from "@/clinical-engine";
import { REQUIRED_COLUMNS } from "@/clinical-engine/edge/biody-columns";

// ═══ UNA SOLA LISTA DE "REQUERIDO" (2026-09-23) ═══
//
// HABIA DOS, Y SE SEPARARON. `BIODY_COLUMNS[x].required` es lo que exige el lector de la fila
// (`parseBiodyRow`); `ENGINE_REQUIRED` es lo que exigen las PUERTAS: el import del XLSX, la revision del
// lote del HTML y el pipeline. A la segunda le faltaba FFM.
//
// Mientras todo entro por un export real del Biody no se noto: ese archivo trae todas las columnas, asi que
// la puerta floja nunca decidio nada. Aparecio con el primer camino que ARMA la fila desde valores guardados
// (una medicion importada del HTML): la puerta decia "no le falta nada", se importaba, y al generar el
// diagnostico reventaba el lector pidiendo una columna de Excel en una medicion que no tiene Excel.
//
// El caso general: cuando una regla vive en dos listas, no falla el dia que se separan, falla el dia que
// aparece un camino nuevo que las distingue.

describe("los insumos requeridos son una sola lista", () => {
  it("ENGINE_REQUIRED es exactamente lo que la tabla declara requerido", () => {
    expect([...ENGINE_REQUIRED].sort()).toEqual([...REQUIRED_COLUMNS].sort());
  });

  it("y FFM está entre ellos (el que faltaba)", () => {
    expect(ENGINE_REQUIRED).toContain("FFM");
    expect(BIODY_COLUMNS.FFM.required).toBe(true);
  });

  it("todos existen como columna, con su header", () => {
    for (const campo of ENGINE_REQUIRED) {
      expect(BIODY_COLUMNS[campo], `${campo} no es una columna`).toBeTruthy();
      expect(BIODY_COLUMNS[campo].header.length).toBeGreaterThan(0);
    }
  });
});
