import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import { SERIE_MAX } from "@/modules/followups/data/serie-types";

// CANDADO DE LAS TRES VISUALES DE SEGUIMIENTO (2026-08-25). Se portan sus tres bloques y se arreglan sus
// dos defectos; lo que se blinda es justamente que los arreglos no se pierdan al tocar el dibujo.

const LINEA = readFileSync("src/modules/followups/components/serie-linea.tsx", "utf8");
const VISUAL = readFileSync("src/modules/followups/components/seguimiento-visual.tsx", "utf8");
const RADAR = readFileSync("src/modules/diagnoses/components/dfi-radar.tsx", "utf8");
const READER = readFileSync("src/modules/followups/data/serie-reader.ts", "utf8");
const TYPES = readFileSync("src/modules/followups/data/serie-types.ts", "utf8");

describe("el gráfico no se desborda", () => {
  it("el SVG lleva viewBox: es el arreglo de su defecto", () => {
    // El suyo emite width fijo de 560 con overflow visible y SIN viewBox, asi que el dibujo no encoge y lo
    // que sobra se pinta encima del grafico vecino.
    expect(LINEA).toContain("viewBox={`0 0 ${W} ${H}`}");
    expect(LINEA).not.toContain('overflow: "visible"');
  });

  it("y NO fija un ancho en píxeles", () => {
    expect(LINEA).toContain('className="h-auto w-full"');
  });

  it("el radar también lo tiene (ya lo tenía)", () => {
    expect(RADAR).toContain("viewBox=");
  });
});

describe("PABU e ICA-BIS van en dos gráficos", () => {
  it("cada uno con su referencia: tienen objetivos distintos", () => {
    // Acercarse a phi no es lo mismo que tender a cero; juntarlos en un eje habria sido peor.
    expect(VISUAL).toContain("referencia={1.618}");
    expect(VISUAL).toContain("referencia={0}");
  });
});

describe("el tramo sin cambio es NEUTRO, no verde ni rojo", () => {
  it("no se colorea lo que no sabemos leer", () => {
    // Un valor que no se mueve puede ser estabilidad o un cambio por debajo de lo que la medicion
    // distingue, y no tenemos el cambio minimo detectable (9.1 de la ronda).
    expect(LINEA).toContain("const igual = Math.abs(delta) < 1e-9");
    expect(LINEA).toContain("stroke-muted-foreground");
  });
});

describe("nada se trunca en silencio", () => {
  it("el tope de la serie sale del intervalo comparable, no de un número redondo", () => {
    // 12 semanas de intervalo minimo comparable -> 8 puntos son ~2 anos de seguimiento trimestral.
    expect(SERIE_MAX).toBe(8);
    expect(TYPES).toContain("12 semanas");
  });

  it("y cuando recorta, lo dice", () => {
    expect(VISUAL).toContain("no se grafican");
  });

  it("el radar dice cuántas mediciones intermedias no dibuja", () => {
    expect(VISUAL).toContain("mediciones intermedias");
  });
});

describe("la evaluación reemplazada no es un punto de la trayectoria", () => {
  it("se filtra superseded_at, como en la comparación", () => {
    expect(READER).toContain("superseded_at != null");
  });

  it("y una evaluación sin medición tampoco (no hay punto en el tiempo)", () => {
    expect(READER).toContain("if (fechas.length === 0) continue");
  });
});

describe("el estado de una sola consulta", () => {
  it("dice que falta la segunda Y cuándo correspondería", () => {
    // Su pantalla dibuja igual con una medicion: el radar compara la medicion contra si misma.
    expect(VISUAL).toContain("Este paciente tiene una sola medición");
    expect(VISUAL).toContain("correspondería alrededor del");
  });
});
