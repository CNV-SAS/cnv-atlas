import { describe, expect, it } from "vitest";

import {
  buildRemisiones,
  consolidateRemisiones,
  RUTAS_CONTENT,
  resolveRutasContent,
  type Remision,
  type RutaContent,
} from "@/clinical-engine/rutas-content";

// Candado del contenido clínico de las rutas portado VERBATIM de Gildardo. Cualquier edición del
// texto (que sería tocar autoría ajena, ver el encabezado de rutas-content.ts) rompe este test.

const IDS = ["R1", "R2", "R3", "R4", "R5", "R6"];

describe("RUTAS_CONTENT (contenido clínico verbatim de Gildardo)", () => {
  it("tiene las 6 rutas R1-R6 con estructura completa", () => {
    expect(Object.keys(RUTAS_CONTENT).sort()).toEqual(IDS);
    for (const id of IDS) {
      const r: RutaContent = RUTAS_CONTENT[id];
      expect(r.id).toBe(id); // la clave coincide con el id
      expect(r.n).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.activacion.length).toBeGreaterThan(0);
      // Los 4 componentes por profesión.
      for (const prof of ["nutricional", "ejercicio", "psicologico", "medico"] as const) {
        expect(r.componentes[prof]).toBeTruthy();
        expect(Array.isArray(r.componentes[prof].indicaciones)).toBe(true);
      }
      // Seguimiento.
      expect(r.seguimiento.frecuencia.length).toBeGreaterThan(0);
      expect(r.seguimiento.criterioEgreso.length).toBeGreaterThan(0);
    }
  });

  it("ancla textos verbatim clave (activación, urgencia como string libre, seguimiento)", () => {
    expect(RUTAS_CONTENT.R1.activacion).toBe("IFC bajo + IRC alto + IAE acelerado");
    expect(RUTAS_CONTENT.R1.seguimiento.frecuencia).toBe("Cada 30 días");
    expect(RUTAS_CONTENT.R1.componentes.nutricional.indicaciones[0]).toBe(
      "Omega-3 dietario: ≥2 porciones pescado graso/semana",
    );
    // Signo menos U+2212 verbatim (no guion ASCII).
    expect(RUTAS_CONTENT.R2.componentes.nutricional.indicaciones[0]).toBe(
      "Déficit calórico moderado: −400 a −500 kcal/día",
    );
    // urgencia = string LIBRE con condición clínica, no un enum.
    expect(RUTAS_CONTENT.R2.componentes.medico.urgencia).toBe("obligatoria si HTA o DM2 activa");
    expect(RUTAS_CONTENT.R4.componentes.ejercicio.urgencia).toBe(
      "OBLIGATORIA — sin ejercicio los nutracéuticos son insuficientes",
    );
    expect(RUTAS_CONTENT.R3.componentes.psicologico.urgencia).toBe(
      "OBLIGATORIA — primera acción antes que cualquier intervención nutricional",
    );
    expect(RUTAS_CONTENT.R4.componentes.medico.urgencia).toBe("recomendada si IAE > 10 años");
  });

  it("las remisiones se marcan con remision:true y traen urgencia (string)", () => {
    // R2: médico y ejercicio remiten; psicológico no.
    expect(RUTAS_CONTENT.R2.componentes.medico.remision).toBe(true);
    expect(RUTAS_CONTENT.R2.componentes.ejercicio.remision).toBe(true);
    expect(RUTAS_CONTENT.R2.componentes.psicologico.remision).toBe(false);
    // Toda remisión activa trae urgencia (string libre).
    for (const id of IDS) {
      for (const prof of ["ejercicio", "psicologico", "medico"] as const) {
        const c = RUTAS_CONTENT[id].componentes[prof];
        if (c.remision) expect(typeof c.urgencia).toBe("string");
      }
    }
  });
});

describe("resolveRutasContent (rutas activas -> contenido, para congelar en el snapshot)", () => {
  it("resuelve por el id (prefijo antes del primer espacio) de los strings de dfi.rutas", () => {
    const res = resolveRutasContent([
      "R2 · Reducción Riesgo Cardiometabólico",
      "R4 · Desaceleración del Envejecimiento",
    ]);
    expect(res.map((r) => r.id)).toEqual(["R2", "R4"]);
  });

  it("omite ids desconocidos y tolera lista vacía", () => {
    expect(resolveRutasContent(["R9 · inexistente", "R1 · Restauración Celular"]).map((r) => r.id)).toEqual([
      "R1",
    ]);
    expect(resolveRutasContent([])).toEqual([]);
  });
});

describe("consolidateRemisiones (§9: por destinatario, no ruta por ruta)", () => {
  const mk = (over: Partial<Remision>): Remision => ({
    profesional: "Médico",
    referralTarget: "medico",
    urgencia: "",
    rutaId: "R1",
    rutaLabel: "R1",
    indicaciones: [],
    ...over,
  });

  it("agrupa por destinatario, une indicaciones sin duplicar y toma la urgencia más alta", () => {
    const c = consolidateRemisiones([
      mk({ rutaId: "R2", urgencia: "recomendada si IAE > 10 años", indicaciones: ["A", "B"] }),
      mk({ rutaId: "R4", urgencia: "obligatoria si HTA o DM2 activa", indicaciones: ["B", "C"] }),
    ]);
    expect(c).toHaveLength(1); // una sola línea para el médico
    expect(c[0].referralTarget).toBe("medico");
    expect(c[0].indicaciones).toEqual(["A", "B", "C"]); // unión sin duplicar (B no se repite)
    expect(c[0].urgencia).toBe("obligatoria si HTA o DM2 activa"); // la más alta
    expect(c[0].rutaIds).toEqual(["R2", "R4"]); // las rutas de origen, como referencia
  });

  it("preserva el orden de primera aparición de los destinatarios", () => {
    const c = consolidateRemisiones([
      mk({ referralTarget: "medico", profesional: "Médico" }),
      mk({ referralTarget: "psicologo", profesional: "Psicólogo/a" }),
      mk({ referralTarget: "medico", profesional: "Médico" }),
    ]);
    expect(c.map((x) => x.referralTarget)).toEqual(["medico", "psicologo"]);
  });

  it("lista vacía -> sin remisiones", () => {
    expect(consolidateRemisiones([])).toEqual([]);
  });
});

describe("buildRemisiones (agrega las remisiones de las rutas activas)", () => {
  it("agrega medico/psicologico/ejercicio con remision, en orden por ruta (el nutricional nunca)", () => {
    // R2 y R4 (las de la captura): cada una remite médico y ejercicio; su psicológico no aplica.
    const rem = buildRemisiones([RUTAS_CONTENT.R2, RUTAS_CONTENT.R4]);
    expect(rem.map((r) => `${r.rutaId}:${r.profesional}`)).toEqual([
      "R2:Médico",
      "R2:Entrenador/Fisioterapeuta",
      "R4:Médico",
      "R4:Entrenador/Fisioterapeuta",
    ]);
    // Urgencia VERBATIM.
    expect(rem[0].urgencia).toBe("obligatoria si HTA o DM2 activa");
    expect(rem[3].urgencia).toBe("OBLIGATORIA — sin ejercicio los nutracéuticos son insuficientes");
  });

  it("una ruta sin remisiones no aporta (R6)", () => {
    expect(buildRemisiones([RUTAS_CONTENT.R6])).toEqual([]);
    expect(buildRemisiones([])).toEqual([]);
  });
});
