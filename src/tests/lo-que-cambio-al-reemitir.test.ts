import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loQueCambioAlReemitir } from "@/clinical-engine/lo-que-cambio-al-reemitir";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL PANEL DE LA REEMISION DICE LO QUE CAMBIO  ·  Santiago, 2026-11-08
//
// ═══ EL DEFECTO, SOBRE LA PACIENTE DE VERIFICACION ═══
//
// *"'Lo que decía el documento anterior' muestra EB-BIS 76,4 e IAE +12,4, que no cambiaron (ya eran v7
// desde el 29-oct). Lo que cambió fue el dominio 3 (Enlentecido -> Acelerado), el riesgo y las rutas
// (0 -> 3)."*
//
// Y lo que lo hace grave no es que falte un dato: es que el panel se titula "lo que decía el documento
// anterior" y pone dos cifras IDENTICAS a las de arriba. Quien lo abre buscando que cambio encuentra que
// nada cambio, cierra el desplegable, y se pierde que su paciente paso de cero rutas a tres.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El caso de `ed83ff97`: la EB-BIS no se movio, todo lo demas si. */
const ANTES = {
  ebBis: { eb: 76.4, iae: 12.4 },
  dfi: {
    rutas: [],
    riesgo: { nivel: "BAJO", score: 15 },
    domains: [
      { id: "d1", nombre: "Celular-Eléctrico", sev: 1, clasif: "IFC Normal · IRC Bajo" },
      { id: "d3", nombre: "Envejecimiento", sev: 0, clasif: "IAE +12,4 años · Enlentecido" },
    ],
  },
};
const AHORA = {
  ebBis: { eb: 76.4, iae: 12.4 },
  dfi: {
    rutas: ["R1 · Restauración Celular", "R2 · Equilibrio Metabólico", "R4 · Desaceleración"],
    riesgo: { nivel: "ALTO", score: 65 },
    domains: [
      { id: "d1", nombre: "Celular-Eléctrico", sev: 2, clasif: "IFC Normal · IRC Normal" },
      { id: "d3", nombre: "Envejecimiento", sev: 3, clasif: "IAE +12,4 años · Acelerado" },
    ],
  },
};

describe("el caso de la paciente de verificacion", () => {
  const cambios = loQueCambioAlReemitir(ANTES, AHORA);

  it("NO lista la EB-BIS, porque no cambio", () => {
    // Es el punto de Santiago, y el unico que de verdad hay que fijar: mostrarla era mostrar dos veces
    // la misma cifra, en el sitio de la pantalla que promete decir que cambio.
    expect(cambios.map((c) => c.que)).not.toContain("Edad biológica estimada");
  });

  it("y SI lista las rutas, el riesgo y los dos dominios", () => {
    expect(cambios.map((c) => c.que)).toEqual([
      "Rutas de atención",
      "Riesgo funcional integrado",
      "Celular-Eléctrico",
      "Envejecimiento",
    ]);
  });

  it("las rutas dicen CUALES, no cuantas", () => {
    // "3 rutas" no dice nada si antes habia otras tres, y el borde de esta paciente (0 -> 3) es justo
    // donde una comparacion por cantidad diria "cambio" sin decir a que.
    const r = cambios.find((c) => c.que === "Rutas de atención");
    expect(r?.antes).toBe("ninguna");
    expect(r?.ahora).toContain("R1 · Restauración Celular");
    expect(r?.ahora).toContain("R4 · Desaceleración");
  });

  it("el riesgo lleva su nivel Y su cifra", () => {
    // El nivel solo esconde un salto de veinte puntos dentro de la misma banda; la cifra sola no dice si
    // eso cruzo un corte.
    const r = cambios.find((c) => c.que === "Riesgo funcional integrado");
    expect(r?.antes).toBe("BAJO (15 de 100)");
    expect(r?.ahora).toBe("ALTO (65 de 100)");
  });

  it("y cada dominio se cita CON LAS PALABRAS DE SU PROPIO DOCUMENTO", () => {
    // Es la leccion que ya costo una ronda: ponerle la etiqueta de hoy a una cifra de ayer AFIRMA QUE UN
    // DOCUMENTO CLINICO DIJO ALGO QUE NO DIJO, justo en el sitio que pretende citarlo.
    const d3 = cambios.find((c) => c.que === "Envejecimiento");
    expect(d3?.antes).toBe("IAE +12,4 años · Enlentecido");
    expect(d3?.ahora).toBe("IAE +12,4 años · Acelerado");
  });
});

describe("lo que la comparacion NO puede hacer", () => {
  it("si NADA cambio devuelve lista vacia, que no es lo mismo que no poder comparar", () => {
    // Una reemision que no cambio nada es un HECHO que el profesional necesita (explica por que su
    // documento dice lo mismo tras una recalibracion). La pantalla lo dice con palabras; `null` se
    // reserva para cuando falta un snapshot.
    expect(loQueCambioAlReemitir(ANTES, ANTES)).toEqual([]);
  });

  it("sin alguno de los dos snapshots no inventa nada", () => {
    expect(loQueCambioAlReemitir(null, AHORA)).toEqual([]);
    expect(loQueCambioAlReemitir(ANTES, null)).toEqual([]);
  });

  it("los dominios se emparejan por `id`, no por posicion", () => {
    // Un dominio que falte en uno de los dos desplazaria a todos los de abajo y la pantalla diria que
    // cambiaron cinco cuando cambio uno.
    const faltaUno = {
      dfi: {
        rutas: [],
        riesgo: { nivel: "BAJO", score: 15 },
        domains: [{ id: "d3", nombre: "Envejecimiento", sev: 0, clasif: "Enlentecido" }],
      },
    };
    const conDos = {
      dfi: {
        rutas: [],
        riesgo: { nivel: "BAJO", score: 15 },
        domains: [
          { id: "d1", nombre: "Celular-Eléctrico", sev: 1, clasif: "Normal" },
          { id: "d3", nombre: "Envejecimiento", sev: 0, clasif: "Enlentecido" },
        ],
      },
    };
    expect(loQueCambioAlReemitir(faltaUno, conDos)).toEqual([]);
  });

  it("y un dominio SIN MEDIR no se compara contra uno medido como si fuera un cambio de severidad", () => {
    const sinMedir = { dfi: { rutas: [], domains: [{ id: "d3", nombre: "Envejecimiento", sev: null }] } };
    const medido = { dfi: { rutas: [], domains: [{ id: "d3", nombre: "Envejecimiento", sev: 2 }] } };
    const r = loQueCambioAlReemitir(sinMedir, medido);
    expect(r).toHaveLength(1);
    expect(r[0].antes).toBe("sin medir");
    expect(r[0].ahora).toBe("severidad 2 de 3");
  });

  it("la EB-BIS si sale cuando SI cambio, con su signo", () => {
    const despues = { ...AHORA, ebBis: { eb: 70.1, iae: 6.2 } };
    const r = loQueCambioAlReemitir(ANTES, despues).find(
      (c) => c.que === "Edad biológica estimada",
    );
    expect(r?.antes).toBe("76,4 años (IAE +12,4)");
    expect(r?.ahora).toBe("70,1 años (IAE +6,2)");
  });
});

describe("y el panel usa la lista, no las dos cifras de siempre", () => {
  const PANEL = sinComentarios(
    readFileSync("src/modules/diagnoses/components/marca-de-reemision.tsx", "utf8"),
  );

  it("pinta los cambios cuando los hay", () => {
    expect(PANEL).toContain("reemision.cambios.map");
    expect(PANEL).toContain("Lo que cambió");
  });

  it("y dice con palabras que no cambio nada, en vez de dejar el panel en blanco", () => {
    expect(PANEL).toContain("Ninguna salida del diagnóstico cambió");
  });
});
