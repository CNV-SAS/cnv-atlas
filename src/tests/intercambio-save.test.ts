import { describe, expect, it } from "vitest";

import { INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { intercambioSignature } from "@/modules/treatment/data/protocol-signature";
import type { IntercambioSaved } from "@/modules/treatment/data/treatment-view-types";
import { saveIntercambioSchema } from "@/modules/treatment/validations";

// Piezas puras de CP1.2a, POR ALIMENTO (opcion A, ronda P-29): la firma de remonte (orden-independiente, cuidado c)
// y la validacion estricta del campo estructurado (cuidado a: rechaza forma incorrecta; cuidado b: los alimentos
// validos salen de INTER_TABLA_A, no de una lista aparte).

// Un intercambio valido: los 21 alimentos con una porcion cada uno (forma completa; el contexto del desfase
// exige los 21). El valor concreto no importa para estas pruebas de forma.
function intercambioValido(objetivoBase = 2000): IntercambioSaved {
  const porciones: Record<string, number> = {};
  for (const r of INTER_TABLA_A) porciones[r.sub] = 2;
  return { objetivoBase, porciones };
}

describe("intercambioSignature: orden-independiente (cuidado c)", () => {
  const base = intercambioValido();
  const sig = (i: IntercambioSaved | null) => intercambioSignature({ treatmentId: "t-1", intercambio: i });

  it("reordenar las claves del objeto NO mueve la firma", () => {
    const reordenado: IntercambioSaved = {
      objetivoBase: base.objetivoBase,
      // reconstruye porciones en orden INVERSO
      porciones: Object.fromEntries(Object.entries(base.porciones).reverse()),
    };
    expect(sig(reordenado)).toBe(sig(base));
  });

  it("cambiar una porcion mueve la firma", () => {
    const p = intercambioValido();
    p.porciones[INTER_TABLA_A[0].sub] = 9;
    expect(sig(p)).not.toBe(sig(base));
  });

  it("cambiar el objetivoBase mueve la firma (opcion 3: el desfase se detecta)", () => {
    expect(sig(intercambioValido(2500))).not.toBe(sig(base));
  });

  it("null (sin guardar) y otro tratamiento tienen firmas distintas y estables", () => {
    expect(sig(null)).toBe("t-1§none");
    expect(intercambioSignature({ treatmentId: "t-2", intercambio: base })).not.toBe(sig(base));
  });

  // REGRESION del 500 (2026-08-22): el writer relee el jsonb CRUDO de la BD y se lo pasa a la firma. Una fila
  // guardada con la FORMA VIEJA (por-grupo: {grupos}, sin `porciones`) hacia Object.keys(undefined) y tumbaba
  // el guardado con 500. El camino real (no el de prueba a mano) pasa cualquier shape almacenado; la firma NO
  // debe reventar: una forma que no es la actual == "none" (igual que el reader la normaliza a null), asi el
  // baseSignature del cliente (§none) coincide y el guardado sobrescribe la fila vieja.
  it("una forma VIEJA/ajena (sin `porciones`) NO revienta: firma == none (camino real del writer)", () => {
    const vieja = { objetivoBase: 2000, grupos: { G1: { porciones: 3, sub: "Cereales" } } } as unknown as IntercambioSaved;
    expect(() => sig(vieja)).not.toThrow();
    expect(sig(vieja)).toBe("t-1§none");
    // y un objeto vacio/raro tampoco revienta.
    expect(sig({} as unknown as IntercambioSaved)).toBe("t-1§none");
  });
});

describe("saveIntercambioSchema: validacion estricta (cuidado a) derivada de INTER_TABLA_A (cuidado b)", () => {
  const parse = (intercambio: unknown) =>
    saveIntercambioSchema.safeParse({ evaluationId: "00000000-0000-0000-0000-000000000000", intercambio, baseSignature: "" });

  it("un intercambio con los 21 alimentos PASA", () => {
    expect(parse(intercambioValido()).success).toBe(true);
  });

  it("distribuir dentro de un grupo (varios alimentos del mismo grupo con porciones) PASA (opcion A)", () => {
    const p = intercambioValido();
    // dos leches distintas con porciones a la vez: lo que la granularidad por-alimento habilita.
    const lecheG = INTER_TABLA_A.filter((r) => r.gr === "G4");
    expect(lecheG.length).toBeGreaterThan(1);
    p.porciones[lecheG[0].sub] = 2;
    p.porciones[lecheG[1].sub] = 1;
    expect(parse(p).success).toBe(true);
  });

  it("con un alimento de menos (falta uno) se RECHAZA", () => {
    const p = intercambioValido();
    delete p.porciones[INTER_TABLA_A[0].sub];
    expect(parse(p).success).toBe(false);
  });

  it("con un alimento que no existe se RECHAZA", () => {
    const p = intercambioValido();
    p.porciones["Alimento inventado"] = 1;
    expect(parse(p).success).toBe(false);
  });

  it("con porciones negativas o no enteras se RECHAZA", () => {
    const neg = intercambioValido();
    neg.porciones[INTER_TABLA_A[0].sub] = -1;
    expect(parse(neg).success).toBe(false);
    const frac = intercambioValido();
    frac.porciones[INTER_TABLA_A[0].sub] = 1.5;
    expect(parse(frac).success).toBe(false);
  });
});
