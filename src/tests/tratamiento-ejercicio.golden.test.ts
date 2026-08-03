import { describe, expect, it } from "vitest";

import { motorTratEjercicio } from "@/clinical-engine/frozen/atlas-tratamiento.js";

// Golden del motor de ejercicio (D-008). Pin de las ramas clinicas + faRec, el factor de actividad
// que el motor nutricional usa como default (P-02). Toda la salida es profesional-facing.

describe("golden motorTratEjercicio", () => {
  it("obesidad + edad >=45 -> faRec moderada, clearance con valoracion medica, enfasis de obesidad", () => {
    const r = motorTratEjercicio({ edad: 50, d5_39: [] }, { talla: 170, peso: 100, sexo: "M" });
    expect(r.faRec).toBe("moderada"); // el default que alimenta la cadena calorica
    expect(r.clearance).toMatch(/valoración médica/);
    expect(r.enfasis.join(" ")).toMatch(/masa magra|pérdida/);
  });

  it("sano y joven -> faRec ligera, clearance sin banderas", () => {
    const r = motorTratEjercicio({ edad: 30, d5_39: [] }, { talla: 170, peso: 65, sexo: "M" });
    expect(r.faRec).toBe("ligera");
    expect(r.clearance).toMatch(/sin banderas mayores/);
  });
});
