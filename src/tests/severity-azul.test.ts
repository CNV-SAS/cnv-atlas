import { describe, expect, it } from "vitest";

import * as core from "@/clinical-engine/frozen/engine.core.derived.js";
import { colorSev, veredictoSev } from "@/clinical-engine/severity";

// CANDADO DEL AZUL (2026-08-24). El frozen usa el azul para DOS cosas opuestas, asi que leer la severidad
// por el tono pintaba de "optimo" un deficit y una sospecha de anabolizantes. Un test por cada clasificador
// que emite azul, con el VALOR que lo dispara y la severidad esperada.

/* eslint-disable @typescript-eslint/no-explicit-any */
const c = core as any;

describe("el azul de los clasificadores se desambigua por la etiqueta", () => {
  it("cFMI bajo: DEFICIT de masa grasa, no óptimo", () => {
    const v = c.cFMI(2, "M");
    expect(v.l).toBe("Bajo");
    expect(colorSev(v.c), "el tono solo decia óptimo: ese era el defecto").toBe(0);
    expect(veredictoSev(v)).toBe(2);
  });

  it("cFFMI alto: SOSPECHA DE ANABOLIZANTES, no óptimo", () => {
    // El mas grave de los dos: un veredicto que pide mirar al paciente se pintaba en verde.
    const v = c.cFFMI(25.25, "M");
    expect(v.l).toContain("anabolizantes");
    expect(colorSev(v.c)).toBe(0);
    expect(veredictoSev(v)).toBe(2);
  });

  it("cEISG bajo: déficit, no óptimo", () => {
    const v = c.cEISG(-20, "M");
    expect(v.l).toBe("Bajo");
    expect(veredictoSev(v)).toBe(2);
  });

  it("cSMM en azul SI es óptimo: no se puede tratar todo azul como alteración", () => {
    // Es la razon por la que el arreglo NO puede ser "azul = deficit": aqui el azul es el mejor nivel.
    const v = c.cSMM(33.25, "M");
    expect(v.l).toBe("Óptimo");
    expect(veredictoSev(v)).toBe(0);
  });

  it("un azul desconocido cae del lado SEGURO (alteración), no de 'óptimo'", () => {
    expect(veredictoSev({ l: "Etiqueta que nadie previó", c: "#3b82f6" })).toBe(2);
  });

  it("los tonos NO azules siguen exactamente como estaban", () => {
    expect(veredictoSev({ l: "x", c: "#10b981" })).toBe(0); // verde
    expect(veredictoSev({ l: "x", c: "#f59e0b" })).toBe(2); // ambar
    expect(veredictoSev({ l: "x", c: "#ef4444" })).toBe(3); // rojo
    expect(veredictoSev({ l: "x", c: "#94a3b8" })).toBeNull(); // gris
    expect(veredictoSev(null)).toBeNull();
  });

  it("NO se introduce un color nuevo: la severidad sigue siendo 0-3", () => {
    // El azul es exclusivo del radar (decision 2026-08-15) y alli significa lo CONTRARIO (lo optimo).
    // Traerlo aqui como "deficit" habria creado una lectura cruzada entre dos superficies del mismo caso.
    for (const n of ["cFMI", "cFFMI", "cEISG", "cSMM"]) {
      for (const sexo of ["M", "F"]) {
        for (let v = -20; v <= 60; v += 0.5) {
          const s = veredictoSev(c[n](v, sexo));
          expect(s === null || (s >= 0 && s <= 3), `${n}(${v},${sexo}) dio ${s}`).toBe(true);
        }
      }
    }
  });
});
