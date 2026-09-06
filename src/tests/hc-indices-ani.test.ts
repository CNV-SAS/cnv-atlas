import { describe, expect, it } from "vitest";

import { INDICES_ANI, indicesAniAlterados } from "@/modules/reports/data/hc-indices-ani";

// CANDADO DEL BLOQUE ANI-BIS-E DE LA HISTORIA CLINICA (2026-08-24).
//
// Hallazgo que lo motiva: su HC muestra IEHH e IAE y la nuestra no mostraba NINGUNO de los ocho, porque en
// Atlas viven en una tabla aparte del Diagnostico. Por la regla del cotejo, un indicador que el muestra y
// nosotros no es siempre accionable, y estos son los mas propios del modelo.

const clas = { IEHH: { label: "Leve" }, IAE: { label: "Acelerado" }, IFC: { label: "Función óptima" } };

describe("indices ANI-BIS-E de la historia clinica", () => {
  it("porta las OCHO filas de su tabla, en su orden", () => {
    expect(INDICES_ANI.map((f) => f.codigo)).toEqual([
      "IFC",
      "IRC",
      "ISCM",
      "IEHH",
      "EB",
      "IAE",
      "PABU",
      "ICA-BIS",
    ]);
  });

  it("el NOMBRE completo sale de SU archivo, no de nuestro glosario", () => {
    // La HC la puede leer otro profesional y un medico no tiene por que saber que es un IAE. Los nombres
    // son los que el usa ("IFC · Funcion Celular"): el glosario interno marca varios como "confirmar
    // Gildardo", asi que escribir ahi un nombre nuestro seria afirmar algo que el no confirmo.
    const n = Object.fromEntries(INDICES_ANI.map((f) => [f.codigo, f.nombre]));
    expect(n.IFC).toBe("Función Celular");
    expect(n.IRC).toBe("Riesgo Celular");
    expect(n.ISCM).toBe("Síndrome Celular");
    expect(n.IEHH).toBe("Hidro-Homeostasis");
    expect(n.IAE).toBe("Aceleración del Envejecimiento");
  });

  it("PABU va SIN nombre: su archivo no le da uno y no se inventa", () => {
    expect(INDICES_ANI.find((f) => f.codigo === "PABU")!.nombre).toBeNull();
  });

  it("EB-BIS va SIN nombre: el suyo dice 'Edad Biológica' y nosotros NO la rotulamos como edad", () => {
    // Divergencia deliberada ya registrada (D-010/D-011): la EB-BIS es un indice funcional bioelectrico,
    // no la edad del cuerpo. Poner "Edad Biologica" en la historia clinica la contradiria.
    expect(INDICES_ANI.find((f) => f.codigo === "EB")!.nombre).toBeNull();
  });

  it("las referencias son las suyas, verbatim y por sexo", () => {
    const ifc = INDICES_ANI.find((f) => f.codigo === "IFC")!;
    expect(ifc.referencia(true)).toBe("≥6,68 óptimo");
    expect(ifc.referencia(false)).toBe("≥3,28 óptimo");
    expect(INDICES_ANI.find((f) => f.codigo === "IAE")!.referencia(true)).toBe("−5 a +5 años");
  });

  it("muestra el caso de su captura: IEHH leve e IAE acelerado", () => {
    // COMA DECIMAL desde el 2026-09-06, y no es cosmetico: en la MISMA fila la referencia ya decia
    // "≥6,68 óptimo" (coma) y el valor "0.89" (punto), porque la referencia es nuestra y el formato del
    // valor venia copiado del suyo. Es el "sistema mezclado" que la regla de ortografia por superficie
    // nombra, y en un documento clinico en español. Los DECIMALES tambien salen ahora de `decimalesDe`.
    const r = indicesAniAlterados({ IEHH: 0.89, IAE: 12.3 }, clas, { IEHH: 2, IAE: 3 }, true);
    expect(r.map((x) => `${x.codigo} ${x.valor} ${x.clasificacion}`)).toEqual([
      "IEHH 0,89 Leve",
      "IAE +12,3 a Acelerado",
    ]);
  });

  it("el IAE positivo lleva su signo, como en su tabla", () => {
    const r = indicesAniAlterados({ IAE: 12.3 }, { IAE: { label: "Acelerado" } }, { IAE: 3 }, true);
    expect(r[0].valor).toBe("+12,3 a");
  });

  it("los decimales salen de la tabla unica, no de un numero escrito en esta fila", () => {
    // El PABU lleva TRES porque su corte es φ = 1,618, y el ICA-BIS DOS. Antes esta tabla decia 3 y 4
    // (los suyos verbatim), asi que la HC y la pantalla mostraban la misma cifra con distinta precision.
    const pabu = indicesAniAlterados({ PABU: 1.2023 }, { PABU: { label: "Desviación por exceso" } }, { PABU: 2 }, true);
    expect(pabu[0].valor).toBe("1,202");
    const ica = indicesAniAlterados({ "ICA-BIS": 0.4157 }, { "ICA-BIS": { label: "Desviación leve" } }, { "ICA-BIS": 2 }, true);
    expect(ica[0].valor).toBe("0,42");
  });

  it("aplica los MISMOS dos filtros del resto de la tabla: sin valor y sin alteración quedan fuera", () => {
    expect(indicesAniAlterados({ IEHH: null }, clas, { IEHH: 3 }, true)).toEqual([]);
    expect(indicesAniAlterados({ IFC: 7.2 }, clas, { IFC: 0 }, true)).toEqual([]);
  });

  it("sin clasificación no se afirma que está alterado", () => {
    expect(indicesAniAlterados({ IEHH: 0.89 }, {}, { IEHH: 2 }, true)).toEqual([]);
  });
});
