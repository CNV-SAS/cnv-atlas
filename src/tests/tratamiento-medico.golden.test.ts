import { describe, expect, it } from "vitest";

import { motorTratMedico } from "@/clinical-engine/frozen/atlas-tratamiento.js";

// Golden del motor medico (D-008). Pin de metas por condicion + interacciones farmaco-nutriente.
// Motor INDEPENDIENTE (nadie consume su salida). Profesional-facing.

describe("golden motorTratMedico", () => {
  it("HTA + metformina -> meta de PA y nota de interaccion B12", () => {
    const r = motorTratMedico({ d5_36: "Sí", d5_40: ["Metformina"] }, {});
    expect(r.metas.join(" ")).toMatch(/130\/80/);
    expect(r.medNotas.join(" ")).toMatch(/B12/);
  });

  it("sin condiciones ni medicamentos -> metas y notas vacias", () => {
    const r = motorTratMedico({}, {});
    expect(r.metas).toEqual([]);
    expect(r.medNotas).toEqual([]);
  });
});
