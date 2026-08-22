import { describe, expect, it } from "vitest";

import { INTER_GRUPOS, INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { intercambioSignature } from "@/modules/treatment/data/protocol-signature";
import type { IntercambioSaved } from "@/modules/treatment/data/treatment-view-types";
import { saveIntercambioSchema } from "@/modules/treatment/validations";

// Piezas puras de CP1.2a: la firma de remonte (orden-independiente, cuidado c) y la validacion estricta del
// primer campo ESTRUCTURADO que guardamos (cuidado a: rechaza forma incorrecta; cuidado b: los grupos validos
// salen de INTER_GRUPOS, no de una lista aparte).

// Un intercambio valido: los 12 grupos con su alimento por defecto (el primer sub de cada grupo en la tabla).
function intercambioValido(objetivoBase = 2000): IntercambioSaved {
  const grupos: Record<string, { porciones: number; sub: string }> = {};
  for (const g of INTER_GRUPOS) {
    const sub = INTER_TABLA_A.find((r) => r.gr === g.id)!.sub;
    grupos[g.id] = { porciones: 2, sub };
  }
  return { objetivoBase, grupos };
}

describe("intercambioSignature: orden-independiente (cuidado c)", () => {
  const base = intercambioValido();
  const sig = (i: IntercambioSaved | null) => intercambioSignature({ treatmentId: "t-1", intercambio: i });

  it("reordenar las claves del objeto NO mueve la firma", () => {
    const reordenado: IntercambioSaved = {
      objetivoBase: base.objetivoBase,
      // reconstruye grupos en orden INVERSO (G12..G1)
      grupos: Object.fromEntries(Object.entries(base.grupos).reverse()),
    };
    expect(sig(reordenado)).toBe(sig(base));
  });

  it("cambiar una porcion mueve la firma", () => {
    const p = intercambioValido();
    p.grupos.G1.porciones = 9;
    expect(sig(p)).not.toBe(sig(base));
  });

  it("cambiar el objetivoBase mueve la firma (opcion 3: el desfase se detecta)", () => {
    expect(sig(intercambioValido(2500))).not.toBe(sig(base));
  });

  it("cambiar el alimento (sub) de un grupo mueve la firma", () => {
    const p = intercambioValido();
    p.grupos.G1.sub = "Raíces, tubérculos y plátanos"; // otro alimento de G1
    expect(sig(p)).not.toBe(sig(base));
  });

  it("null (sin guardar) y otro tratamiento tienen firmas distintas y estables", () => {
    expect(sig(null)).toBe("t-1§none");
    expect(intercambioSignature({ treatmentId: "t-2", intercambio: base })).not.toBe(sig(base));
  });
});

describe("saveIntercambioSchema: validacion estricta (cuidado a) derivada de INTER_GRUPOS (cuidado b)", () => {
  const parse = (intercambio: unknown) =>
    saveIntercambioSchema.safeParse({ evaluationId: "00000000-0000-0000-0000-000000000000", intercambio, baseSignature: "" });

  it("un intercambio con los 12 grupos y alimentos validos PASA", () => {
    expect(parse(intercambioValido()).success).toBe(true);
  });

  it("con 11 grupos (falta uno) se RECHAZA", () => {
    const p = intercambioValido();
    delete p.grupos.G12;
    expect(parse(p).success).toBe(false);
  });

  it("con un id de grupo que no existe se RECHAZA", () => {
    const p = intercambioValido();
    delete p.grupos.G12;
    (p.grupos as Record<string, { porciones: number; sub: string }>).G99 = { porciones: 1, sub: "Cereales" };
    expect(parse(p).success).toBe(false);
  });

  it("con un alimento que NO pertenece a su grupo se RECHAZA", () => {
    const p = intercambioValido();
    p.grupos.G1.sub = "Carnes magras"; // sub de G6, no de G1
    expect(parse(p).success).toBe(false);
  });

  it("con porciones negativas o no enteras se RECHAZA", () => {
    const neg = intercambioValido();
    neg.grupos.G1.porciones = -1;
    expect(parse(neg).success).toBe(false);
    const frac = intercambioValido();
    frac.grupos.G1.porciones = 1.5;
    expect(parse(frac).success).toBe(false);
  });
});
