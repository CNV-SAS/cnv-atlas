import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  diasDeFrecuencia,
  fechaSugerida,
  rutaPrimaria,
} from "@/modules/followups/data/proximo-control";

// CANDADO DEL PROXIMO CONTROL (Seguimiento, pieza 1, 2026-08-25).
//
// Lo que se blinda son las tres decisiones que lo separan de su prototipo: la sugerencia sale de la
// FRECUENCIA de la ruta y no de un numero fijo; se suma a la fecha de la MEDICION y no a hoy; y la
// sugerida NO se guarda sola.

const ruta = (frecuencia: string, criterioEgreso: string) => [
  { id: "R4", label: "Desaceleración del Envejecimiento", seguimiento: { frecuencia, criterioEgreso } },
];

describe("frecuencia de la ruta", () => {
  it("lee los días del texto, como en su archivo", () => {
    expect(diasDeFrecuencia("Cada 90 días")).toBe(90);
    expect(diasDeFrecuencia("Cada 30 días")).toBe(30);
  });

  it("sin número no inventa una frecuencia", () => {
    expect(diasDeFrecuencia("Según evolución")).toBeNull();
    expect(diasDeFrecuencia(null)).toBeNull();
    expect(diasDeFrecuencia("")).toBeNull();
  });
});

describe("fecha sugerida", () => {
  it("suma desde la fecha de la MEDICIÓN, no desde hoy", () => {
    // Una evaluación corregida meses después tiene created_at de hoy: sumar sobre eso agendaría la cita
    // en el futuro equivocado. Misma ancla que usa comparison-chronology.
    expect(fechaSugerida("2026-08-25", "Cada 90 días")).toBe("2026-11-23");
    expect(fechaSugerida("2026-04-05", "Cada 30 días")).toBe("2026-05-05");
  });

  it("cruza el fin de año sin romperse", () => {
    expect(fechaSugerida("2026-12-20", "Cada 30 días")).toBe("2027-01-19");
  });

  it("sin frecuencia o sin medición NO sugiere nada (no cae a un número fijo)", () => {
    expect(fechaSugerida("2026-08-25", "Según evolución")).toBeNull();
    expect(fechaSugerida(null, "Cada 90 días")).toBeNull();
  });
});

describe("ruta primaria", () => {
  it("toma la primera activa, como su archivo", () => {
    const r = rutaPrimaria(ruta("Cada 90 días", "IAE < 5 años y FFMI en rango normal sostenido"));
    expect(r?.id).toBe("R4");
    expect(r?.frecuencia).toBe("Cada 90 días");
  });

  it("R6 es PERMANENCIA, no egreso: la pantalla no puede llamarlo criterio de egreso", () => {
    const r = rutaPrimaria(
      ruta("Cada 90 días", "Permanencia en R6 es el objetivo — escalar si algún índice sale de rango"),
    );
    expect(r?.esPermanencia).toBe(true);
  });

  it("las demás rutas sí tienen egreso", () => {
    const r = rutaPrimaria(ruta("Cada 30 días", "IFC ≥ 4.5 y IRC < 3.5 sostenido 2 controles"));
    expect(r?.esPermanencia).toBe(false);
  });

  it("sin rutas activas no se inventa una", () => {
    expect(rutaPrimaria([])).toBeNull();
  });
});

const WRITER = readFileSync("src/modules/followups/data/proximo-control-writer.ts", "utf8");
const UI = readFileSync("src/modules/followups/components/proximo-control.tsx", "utf8");
const REPORTS = readFileSync("src/modules/reports/data/reports-writer.ts", "utf8");

describe("la sugerida NO se guarda sola", () => {
  it("el componente no envía nada al montarse: solo hay un submit", () => {
    // En su prototipo un efecto persiste la fecha en cuanto la pantalla la propone, asi que una cita que
    // nadie confirmo figura como la del paciente. Y eso deja sin efecto su propia regla: un "empeoro" solo
    // se comunica CON cita agendada, y si el sistema la agenda solo, la condicion siempre esta cumplida.
    expect(UI).not.toContain("useEffect");
    expect(UI).toContain("onSubmit");
  });

  it("y la pantalla DICE que sugerida no es agendada", () => {
    expect(UI).toContain("el paciente aún no tiene cita agendada");
  });

  it("es el MISMO campo que fija el bloque del empeoró (un paciente no tiene dos citas)", () => {
    expect(WRITER).toContain("proximaCita: input.proximaCita");
    expect(WRITER).toContain("treatments");
  });
});

describe("la traza distingue quién puso la cita", () => {
  it("el writer de Seguimiento registra la previa y si se aceptó la sugerencia", () => {
    expect(WRITER).toContain('event: "treatment.next_appointment_set"');
    expect(WRITER).toContain("cita_previa");
    expect(WRITER).toContain("acepto_sugerida");
  });

  it("y el bloque del empeoró YA NO fija la cita: la verifica", () => {
    // Desde 2026-08-25 hay UN SOLO sitio donde se fija (Seguimiento) y el ámbar es la condición: verifica
    // que exista y confirma la comunicación. La regla de Gildardo se conserva entera; lo que se quitó es
    // que el mismo acto fuera también el de agendar.
    const fn = REPORTS.slice(REPORTS.indexOf("export async function confirmTrajectoryCommunication"));
    expect(fn).toContain("Agéndala en Seguimiento");
    expect(fn).not.toContain("set({ proximaCita:");
  });
});
