import { describe, expect, it } from "vitest";

import { saveNutraDecisionSchema } from "@/modules/treatment/validations";

// CANDADO DE LA DECISION SOBRE LOS NUTRACEUTICOS (CP-N1, 2026-08-24).
//
// Lo que se blinda son las reglas que hacen que el dato SIRVA, no que exista. Antes de esto el bloque de
// entrega asumia que el paciente compra: no se preguntaba si PUEDE tomarlos (lo decide el profesional) ni
// si QUIERE (lo decide el paciente), y no quedaba razon de por que no.

const base = {
  evaluationId: "3bfbcc45-0000-4000-8000-000000000001",
  decision: "no" as "si" | "no" | "pendiente",
  reason: null as string | null,
  note: null as string | null,
  contraindicationFor: null as string | null,
};
const parse = (o: Partial<typeof base>) => saveNutraDecisionSchema.safeParse({ ...base, ...o });

describe("saveNutraDecisionSchema", () => {
  it("acepta 'si' y 'pendiente' SIN razon: pedirla seria pedir explicacion por decidir bien o por no haber decidido", () => {
    expect(parse({ decision: "si" }).success).toBe(true);
    expect(parse({ decision: "pendiente" }).success).toBe(true);
  });

  it("'pendiente' es respuesta VALIDA, no un vacio", () => {
    // Es la decision de diseño: el paciente puede volver, y forzar un si/no fabricaria un dato que nadie
    // dio y que la direccion leeria como decision tomada.
    expect(parse({ decision: "pendiente" }).success).toBe(true);
  });

  it("'no' SIN razon se RECHAZA: un no sin razon no le sirve a nadie", () => {
    expect(parse({ decision: "no", reason: null }).success).toBe(false);
  });

  it("una razon en 'si' o 'pendiente' se RECHAZA (la razon es del no)", () => {
    expect(parse({ decision: "si", reason: "costo" }).success).toBe(false);
  });

  it("las DOS razones del profesional exigen motivo escrito", () => {
    // Estan separadas a proposito: clasifica el profesional, no el sistema. Y el motivo ES el dato,
    // sobre todo en la clinica, que ademas se guarda como contraindicacion del paciente.
    expect(parse({ reason: "profesional_clinica", note: null }).success).toBe(false);
    expect(parse({ reason: "profesional_no_clinica", note: null }).success).toBe(false);
    expect(parse({ reason: "profesional_clinica", note: "Alergia al calostro" }).success).toBe(true);
    expect(parse({ reason: "profesional_no_clinica", note: "Ya toma un multivitamínico de otra marca" }).success).toBe(true);
  });

  it("'otra' exige texto: si no, se vuelve el cajon donde muere la informacion", () => {
    expect(parse({ reason: "otra", note: null }).success).toBe(false);
    expect(parse({ reason: "otra", note: "Se va del país" }).success).toBe(true);
  });

  it("las razones SIN texto obligatorio se aceptan solas", () => {
    for (const reason of ["costo", "lo_piensa", "ya_toma_otros"]) {
      expect(parse({ reason }).success, reason).toBe(true);
    }
  });

  it("una razon desconocida se RECHAZA (la lista es cerrada: es dato de dirección)", () => {
    expect(parse({ reason: "porque_si" }).success).toBe(false);
  });

  it("acota el tamaño del motivo (limite de payload, regla dura)", () => {
    expect(parse({ reason: "otra", note: "x".repeat(2000) }).success).toBe(false);
  });
});
