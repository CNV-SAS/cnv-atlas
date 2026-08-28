import { describe, expect, it } from "vitest";

import { bandToWord, efrRiskRank, efrSectorBands } from "@/clinical-engine";

// CANDADO DE LOS ROTULOS DE SECTOR DE LA DIANA (2026-08-27).
//
// POR QUE EXISTE. Su Diana rotula cada sector con el par de bandas que representa ("E9 · FMI Alto /
// FFMI Bajo") y la nuestra los pintaba con el codigo solo. Portamos el rotulo, y como son 81 celdas un
// rotulo equivocado no se nota: nadie se sabe el mapa de memoria, que es justo la razon por la que hay
// que rotular. Asi que el par se DERIVA de EFR_RISK_ORDER (la misma fuente que decide posicion y color)
// y este candado prueba las dos cosas que pueden salir mal.
//
// LO QUE SE COMPARA CONTRA SU PANTALLA son los SEIS sectores cuyos rotulos se leen en su captura
// (cotejo-visual/html/.../vista-completa-diagnostico-funcional-parte-3.png). Los otros tres estaban
// cortados o ilegibles: NO se inventan aqui, se dejan cubiertos por la coherencia interna.

// Los seis legibles en SU captura, transcritos verbatim.
const SUYOS: Record<number, { fmi: string; ffmi: string }> = {
  1: { fmi: "Bajo", ffmi: "Alto" },
  2: { fmi: "Normal", ffmi: "Alto" },
  4: { fmi: "Normal", ffmi: "Normal" },
  6: { fmi: "Alto", ffmi: "Normal" },
  8: { fmi: "Normal", ffmi: "Bajo" },
  9: { fmi: "Alto", ffmi: "Bajo" },
};

describe("rotulos de sector de la Diana", () => {
  it("los seis que se leen en SU captura coinciden exactamente", () => {
    for (const [eStr, esperado] of Object.entries(SUYOS)) {
      const sc = Number(eStr) - 1; // E1 es el indice 0
      const b = efrSectorBands(sc);
      expect(b, `E${eStr} sin bandas`).not.toBeNull();
      expect({ fmi: bandToWord(b!.fmi), ffmi: bandToWord(b!.ffmi) }, `E${eStr}`).toEqual(esperado);
    }
  });

  it("el rotulo es la INVERSA exacta de la posicion: no pueden desincronizarse", () => {
    // Control real del mecanismo: si el rotulo de E_n dice (ffmi, fmi), entonces un paciente con esas
    // bandas tiene que caer EN E_n. Si alguien reordena EFR_RISK_ORDER o escribe los pares a mano, esto
    // truena. Es lo que cubre los tres sectores que no se leen en su captura.
    for (let sc = 0; sc < 9; sc++) {
      const b = efrSectorBands(sc);
      expect(b).not.toBeNull();
      expect(efrRiskRank(b!.ffmi, b!.fmi), `E${sc + 1} no es su propia inversa`).toBe(sc);
    }
  });

  it("los nueve sectores son pares DISTINTOS y cubren las nueve combinaciones", () => {
    const vistos = new Set<string>();
    for (let sc = 0; sc < 9; sc++) {
      const b = efrSectorBands(sc)!;
      vistos.add(`${b.ffmi}-${b.fmi}`);
      expect([1, 2, 3]).toContain(b.ffmi);
      expect([1, 2, 3]).toContain(b.fmi);
    }
    expect(vistos.size).toBe(9);
  });

  it("fuera de rango devuelve null en vez de un rotulo inventado", () => {
    // Control negativo: sin esto, un indice malo pintaria el par del sector 0 en el sector equivocado,
    // que es exactamente el defecto que el candado existe para evitar.
    expect(efrSectorBands(-1)).toBeNull();
    expect(efrSectorBands(9)).toBeNull();
  });

  it("bandToWord cubre las tres bandas y nada mas", () => {
    expect(bandToWord(3)).toBe("Alto");
    expect(bandToWord(2)).toBe("Normal");
    expect(bandToWord(1)).toBe("Bajo");
  });
});
