import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { corteDeLaSerie, dentroDelCorte } from "@/modules/followups/corte-de-la-serie";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO: UNA EVALUACION NO VE EL FUTURO (Santiago, 2026-09-20) ═══
//
// LO QUE ENCONTRO: la pestaña Seguimiento de la evaluación INICIAL mostraba el mismo radar y los mismos
// mapas que la del seguimiento 1. Los dos lectores de trayectoria resolvían el PACIENTE desde la
// evaluación y leían TODAS sus mediciones, sin techo.
//
// LO QUE ESTE CANDADO GUARDA es la regla, no el síntoma: una evaluación es un registro clínico sellado, y
// lo que se ve al abrirla tiene que ser lo que se vio ese día. Por eso prueba también que los DOS lectores
// la aplican: la regla escrita en un módulo que nadie llama no protege nada.

describe("el corte de una evaluación", () => {
  it("es su fecha de medición", () => {
    expect(corteDeLaSerie(["2026-07-13"], "2026-09-20T10:00:00Z")).toBe("2026-07-13");
  });

  it("con varias mediciones, la más reciente", () => {
    expect(corteDeLaSerie(["2026-07-13", "2026-07-15", null], "2026-09-20T10:00:00Z")).toBe(
      "2026-07-15",
    );
  });

  it("sin medición, el día en que se creó el registro", () => {
    // Una consulta abierta HOY ve toda la historia; una abierta en julio no ve septiembre.
    expect(corteDeLaSerie([], "2026-07-01T23:30:00Z")).toBe("2026-07-01");
    expect(corteDeLaSerie([null, undefined], "2026-07-01T23:30:00Z")).toBe("2026-07-01");
  });

  it("no se deja engañar por una medición con hora", () => {
    expect(corteDeLaSerie(["2026-07-13T00:00:00Z"], "2026-09-20T10:00:00Z")).toBe("2026-07-13");
  });
});

describe("qué puntos entran en la trayectoria de una evaluación", () => {
  const corte = "2026-07-13";

  it("lo anterior, sí", () => {
    expect(dentroDelCorte("2026-03-02", corte)).toBe(true);
  });

  it("el del mismo día, sí: es la propia consulta", () => {
    expect(dentroDelCorte("2026-07-13", corte)).toBe(true);
  });

  it("lo POSTERIOR, no: ese día no había ocurrido", () => {
    // El caso real verificado en la nube: un paciente con 2026-07-13 (inicial) y 2026-09-14 (seguimiento).
    expect(dentroDelCorte("2026-09-14", corte)).toBe(false);
  });
});

describe("los dos lectores de trayectoria aplican el techo", () => {
  // Son DOS, y esa es la razón de que la regla viva en su propio módulo: escrita dos veces, se convierte
  // en dos reglas distintas. Se comprueban por código porque ambos leen de la base.
  const LECTORES = [
    "src/modules/followups/data/serie-reader.ts", // radar y mapas de la pestaña Seguimiento
    "src/modules/reports/data/serie-del-paciente.ts", // gráfica del informe del paciente
  ];

  for (const lector of LECTORES) {
    it(`${lector} acota por la fecha de la evaluación`, () => {
      const codigo = sinComentarios(readFileSync(lector, "utf8"));
      expect(codigo).toContain("corteDeLaSerie(");
      expect(codigo).toContain("dentroDelCorte(");
    });
  }
});
