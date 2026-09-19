import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { RUTAS_CONTENT } from "@/clinical-engine/rutas-content";

vi.mock("server-only", () => ({}));

const { esParaElPaciente } = await import("@/modules/reports/data/informe-paciente-reader");

// ═══ EL INFORME NO LE MANDA AL PACIENTE EL LENGUAJE DEL MODELO ═══
//
// LA INSTRUCCIÓN ES DE GILDARDO (§7.1): *"lo que hoy le mandan -IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el
// código N_N_N_A- NO DEBE SALIR ASÍ. Ningún índice del modelo va al paciente. Eso es el documento del
// profesional."*
//
// Y EL RIESGO ENTRÓ POR LA PUERTA DE AL LADO (2026-09-19). Ya había un candado que miraba el CÓDIGO del
// documento y prohibía esos nombres escritos a mano. Al sumar las rutas al informe, los índices dejaron de
// llegar por el código y empezaron a poder llegar por los DATOS: su texto de rutas está escrito para el
// profesional, y junto a "Omega-3 dietario: ≥2 porciones pescado graso/semana" viene "Valoración médica si
// IRC > 5.0 — descartar patología inflamatoria subyacente".
//
// POR ESO ESTE CANDADO CORRE EL CONTENIDO REAL, no una cadena de ejemplo: recorre las seis rutas y sus
// cuatro componentes tal como están en el motor. Un candado sobre un texto inventado no dice nada sobre lo
// que el paciente recibe.

describe("lo que viaja al paciente no nombra índices del modelo", () => {
  it("CONTROL: el contenido real SÍ tiene líneas con índices, o este candado no probaría nada", () => {
    const todas = Object.values(RUTAS_CONTENT).flatMap((r) =>
      Object.values(r.componentes).flatMap((c) => c.indicaciones),
    );
    expect(todas.length, "no se leyó el contenido de rutas").toBeGreaterThan(20);
    expect(
      todas.some((i) => !esParaElPaciente(i)),
      "ninguna indicación nombra un índice: o el contenido cambió, o el filtro dejó de mirar",
    ).toBe(true);
  });

  it("ninguna indicación que pase el filtro nombra un índice, en las SEIS rutas", () => {
    const prohibidos = ["IFC", "IRC", "PABU", "ICA-BIS", "ISCM", "IEHH", "FFMI", "FMI", "EB-BIS", "IAE"];
    for (const ruta of Object.values(RUTAS_CONTENT)) {
      // Las tres que el paciente puede accionar. La médica viaja como remisión (a quién acudir), no como
      // texto: su indicación es justo la que cita índices y paraclínicos.
      const paraElPaciente = [
        ruta.componentes.nutricional,
        ruta.componentes.ejercicio,
        ruta.componentes.psicologico,
      ]
        .filter((c) => c.aplica)
        .flatMap((c) => c.indicaciones)
        .filter(esParaElPaciente);

      for (const linea of paraElPaciente) {
        for (const idx of prohibidos) {
          expect(linea, `${ruta.id}: "${linea}" nombra ${idx}`).not.toMatch(
            new RegExp(`(^|[^A-Za-zÁÉÍÓÚÑ0-9-])${idx}([^A-Za-zÁÉÍÓÚÑ0-9-]|$)`),
          );
        }
      }
    }
  });

  it("y el filtro no se lleva por delante lo que el paciente SÍ puede hacer", () => {
    // Un filtro que descartara todo cumpliría la regla y dejaría el bloque vacío, que es la forma
    // silenciosa de que una sección deje de existir.
    const utiles = Object.values(RUTAS_CONTENT).flatMap((r) =>
      r.componentes.nutricional.indicaciones.filter(esParaElPaciente),
    );
    expect(utiles.length, "el filtro dejó al paciente sin una sola indicación de alimentación").toBeGreaterThan(
      10,
    );
  });

  it("distingue la sigla suelta de la palabra que la contiene", () => {
    expect(esParaElPaciente("Camina 30 minutos al día")).toBe(true);
    expect(esParaElPaciente("Valoración médica si IRC > 5.0")).toBe(false);
    // "BIS" dentro del nombre del modelo no descarta la línea: si lo hiciera, cualquier frase que nombrara
    // ANI-BIS-E se perdería.
    expect(esParaElPaciente("Tu evaluación ANI-BIS-E de hoy")).toBe(true);
  });
});

describe("el informe reúne, no construye (Regla 0)", () => {
  const LECTOR = readFileSync("src/modules/reports/data/informe-paciente-reader.ts", "utf8");

  it("las remisiones salen del MISMO derivador que la historia clínica", () => {
    // Si aquí se dedujeran otra vez, el documento del paciente y el del profesional podrían nombrar
    // remisiones distintas de la misma consulta, y eso ya pasó una vez con esta misma sección.
    expect(LECTOR).toContain("remisionesExigidas(");
  });

  it("los suplementos del modelo salen del protocolo, no de una lista escrita aquí", () => {
    expect(LECTOR).toContain("recommendedNutraceuticals");
    expect(LECTOR).toContain("protocolo?.nutraceuticals");
  });

  it("las rutas salen del snapshot CONGELADO, no del registry vivo", () => {
    // El documento tiene que decir lo que se prescribió ese día, no lo que diría el modelo de hoy.
    expect(LECTOR).toContain("rutasContent");
    expect(LECTOR, "el informe no puede resolver rutas contra el contenido vivo").not.toContain(
      "resolveRutasContent(",
    );
  });
});
