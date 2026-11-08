import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fechaDeLaConsulta } from "@/modules/reports/fecha-de-la-consulta";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES DOCUMENTOS DE UNA CONSULTA DICEN LA MISMA FECHA  ·  Santiago, 2026-11-08
//
// ═══ EL DEFECTO, EN LA PACIENTE DE VERIFICACION ═══
//
// El INFORME decia *"25 de agosto"* y la HISTORIA CLINICA *"20/8/2026"*. No era formato: eran dos
// definiciones. El informe leia la fecha de la MEDICION (arreglado asi el 2026-11-03, porque la consulta
// salia ANTERIOR a la medicion); la historia clinica leia `evaluations.created_at`, que es cuando se
// ABRIO la ficha.
//
// ═══ Y EN LA HC ARRASTRABA ALGO MAS QUE UNA FECHA ═══
//
// La HC imprime la EDAD calculada a esa fecha. Con la de apertura de la ficha, la edad impresa en la
// historia clinica podia no ser la que el motor uso para diagnosticar, que la calcula a la fecha de la
// TOMA (su EB-BIS v7 §3.1). Dos edades del mismo paciente en el mismo caso.
//
// Es la regla de la casa: si dos partes dicen cosas distintas, no es que una este mal, es que LEEN
// FUENTES DISTINTAS, y el arreglo no es corregir el texto sino unir las fuentes.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("la definicion, una sola", () => {
  it("manda la fecha de la MEDICION, no la de apertura de la ficha", () => {
    expect(fechaDeLaConsulta("2026-08-20T14:00:00Z", ["2026-08-25"])).toBe("2026-08-25");
  });

  it("y `created_at` es el RESPALDO, para la consulta que todavia no tiene toma", () => {
    expect(fechaDeLaConsulta("2026-08-20T14:00:00Z", [])).toBe("2026-08-20T14:00:00Z");
    expect(fechaDeLaConsulta("2026-08-20T14:00:00Z", [null, undefined, "  "])).toBe(
      "2026-08-20T14:00:00Z",
    );
  });

  it("con varias tomas manda LA ULTIMA, que es la vigente", () => {
    // La misma regla que el resto de los lectores: la que entro despues es la que vale.
    expect(fechaDeLaConsulta("2026-08-01T00:00:00Z", ["2026-08-25", "2026-09-02", "2026-08-30"])).toBe(
      "2026-09-02",
    );
  });

  it("y NO pasa la fecha por `new Date()`, que es como se pierde un dia", () => {
    // Una fecha pura (yyyy-MM-dd) convertida a Date se interpreta en UTC y puede retroceder un dia al
    // mostrarse. Es el defecto que ya aparecio en la leyenda del radar.
    const FUENTE = sinComentarios(
      readFileSync("src/modules/reports/fecha-de-la-consulta.ts", "utf8"),
    );
    expect(FUENTE, "la comparacion volvio a pasar por Date").not.toContain("new Date(");
  });
});

describe("y los dos lectores la usan, en vez de tener la suya", () => {
  it("el repositorio de informes", () => {
    const S = sinComentarios(
      readFileSync("src/modules/reports/data/reports-repository.ts", "utf8"),
    );
    expect(S).toContain("fechaDeLaConsulta(");
  });

  it("y la cabecera de la historia clinica, que era la que se desviaba", () => {
    const S = sinComentarios(readFileSync("src/modules/reports/data/hc-header-reader.ts", "utf8"));
    expect(S).toContain("fechaDeLaConsulta(");
    expect(S, "la HC volvio a leer `created_at` a secas como fecha de consulta").not.toContain(
      "const fechaConsulta = data.created_at as string;",
    );
    // Y TRAE LAS MEDICIONES EN SU CONSULTA: sin ellas la funcion compartida siempre caeria al respaldo
    // y la HC seguiria diciendo la fecha de apertura, pero ahora en silencio y pareciendo arreglada.
    expect(S, "la HC no pide las mediciones: la fecha caeria siempre al respaldo").toContain(
      "bis_measurements(measurement_date)",
    );
  });
});
