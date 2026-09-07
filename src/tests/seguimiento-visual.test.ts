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
    expect(VISUAL).toContain("Este paciente tiene una sola medición");
    expect(VISUAL).toContain("correspondería alrededor del");
  });

  // LA DIANA SALE CON UNA SOLA MEDICION (punto 13 de su cotejo, 2026-09-07): *"en mod seguimiento se debe
  // poner la diana del DFI, ¿por qué la quitaron?"*
  //
  // Y ESTO YA ESTABA ESCRITO AQUI SIN APLICARSE. El comentario de la prueba de arriba decia, desde el
  // 2026-08-25, "su pantalla dibuja igual con una medicion". Lo sabiamos, quedo anotado en un comentario
  // de test, y el codigo siguio exigiendo dos. Un hecho documentado en el sitio donde nadie va a
  // aplicarlo es un hecho que no esta.
  //
  // POR QUE UNA SOLA SIRVE, y es mas fuerte que el caso de la capacitancia: alli hacia falta una
  // REFERENCIA para que un punto significara algo. Aqui la escala YA es la referencia (los cinco ejes van
  // de Optimo a Critico, que son niveles absolutos, no relativos a otra medicion). Un poligono solo se lee.
  it("la Diana ya NO exige dos mediciones", () => {
    expect(
      VISUAL,
      "volvió el portón que exigía dos: con una consulta no se dibujaría nada",
    ).not.toContain("conDominios.length > 1 ? conDominios[conDominios.length - 1] : null");
    expect(VISUAL).toContain("const ultima = conDominios[conDominios.length - 1] ?? null");
    // El bloque entero se pinta con que haya ULTIMA, no con que haya las dos.
    expect(VISUAL).toContain("{ultima ? (");
  });

  it("y con una sola NO se dibuja el polígono de fondo contra sí mismo", () => {
    // Dibujar el punteado exactamente encima del sólido diría "no ha cambiado nada" sobre algo que ni
    // siquiera se ha medido dos veces. Es lo que él parametrizó al reves: el fondo aparece con la segunda.
    expect(VISUAL).toContain("const inicial = conDominios.length > 1 ? conDominios[0] : null");
    expect(VISUAL).toContain("comparar={inicial?.dominios ?? undefined}");
  });

  it("y el TÍTULO deriva de si hay comparación, no es una cadena fija", () => {
    // Decir "inicial y última" con una sola medición sería afirmar una comparación que no hubo: el texto
    // que afirma un estado sin derivarlo, en la superficie que él acaba de pedir.
    expect(VISUAL).toContain("{inicial ? \"Diagnóstico funcional: inicial y última\" : \"Diagnóstico funcional\"}");
    expect(VISUAL).toContain("esta figura queda de fondo");
  });
});

// ── Las dos del smoke de Seguimiento (2026-08-25) ────────────────────────────────────────────────────

const TABLA = readFileSync("src/modules/followups/components/followup-comparison.tsx", "utf8");
const COMP = readFileSync("src/modules/followups/data/comparison-reader.ts", "utf8");

describe("la leyenda del radar", () => {
  it("dice cuál polígono es cuál, con su fecha", () => {
    // Sin ella el punteado no significa nada para quien no sepa que es la inicial. Su pantalla la tiene
    // (muestra de línea + fecha), así que es porte, no mejora.
    expect(RADAR).toContain("Inicial{fechaComparar");
    expect(RADAR).toContain("Actual{fechaActual");
    expect(RADAR).toContain("A menor polígono, mejor estado funcional");
  });

  it("solo aparece cuando hay comparación", () => {
    expect(RADAR).toContain("{cmpPoly ? (");
  });
});

describe("la lectura del cambio en la tabla de deltas", () => {
  it("NO sale del signo del delta", () => {
    // En unos índices subir es mejorar y en otros empeorar, y el PABU mejora al ACERCARSE a phi: el signo
    // no alcanza. Sale de comparar la severidad que el clasificador le da a cada valor.
    expect(COMP).toContain("indicatorSeverities(cur)");
    expect(COMP).toContain("indicatorSeverities(pre)");
    expect(COMP).toContain('sc < sp ? "mejora" : sc > sp ? "empeora" : "igual"');
  });

  it("un movimiento dentro de la MISMA banda no se llama mejora", () => {
    // Mientras no exista el cambio mínimo detectable (9.1), colorear un cambio de 0,02 como mejora
    // afirmaría más de lo que sabemos. Se dice "misma lectura", en neutro.
    expect(TABLA).toContain("misma lectura");
    expect(TABLA).toContain('igual: "text-muted-foreground"');
  });

  it("y la tabla explica qué significa el color", () => {
    expect(TABLA).toContain("no del signo");
    expect(TABLA).toContain("sigue en el mismo nivel clínico");
  });

  it("un indicador sin clasificador queda neutro y lo dice", () => {
    expect(TABLA).toContain("sin clasificar");
  });
});
