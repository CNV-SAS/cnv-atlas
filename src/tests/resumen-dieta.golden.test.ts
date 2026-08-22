import { describe, expect, it, vi } from "vitest";

import { resumenDietaParrafo } from "@/clinical-engine/resumen-dieta";

// GOLDEN DIFERENCIAL del parrafo de dieta del Resumen Clinico (pieza 1b).
//
// El modulo `resumen-dieta` porta _resumenNutriParrafo, que el frozen no tenia. Se prueba la PARIDAD contra la
// PROPIA FUNCION vigente de Gildardo (fixtures/reference/resumen-dieta-vigente.js, extraida de ATLAS_v8.html
// 2026-08-19 L13013-13057), no contra una lectura del codigo: mismo `enc` a los dos, assert byte-identico.
// Ambos importan FREQ_GROUPS del MISMO frozen, asi el golden aisla la logica de redaccion.
//
// Casos: (A) completo con varias ramas encendidas; (B) INCOMPLETO (solo sexo) -> ambos "" (cuidado d: no queda
// un parrafo roto, queda vacio, y el llamador lo omite); (C) PARCIAL -> frase valida byte-identica.

vi.mock("server-only", () => ({}));

import { resumenDietaRef } from "./fixtures/reference/resumen-dieta-vigente.js";

const ref = resumenDietaRef as (enc: Record<string, unknown>) => string;

// enc COMPLETO: frecuencia como ORDINAL (asi lo entrega el reader, via CANON de patron), contexto como TEXTO,
// contadores como numero. Varios d1_*_i en extremos (0 y 4) para encender defic/riesgo; contexto variado.
const ENC_COMPLETO: Record<string, unknown> = {
  sexo: "M",
  d1_1_i: 0, // verduras: si es protector y <=1 -> deficit
  d1_2_i: 0,
  d1_3_i: 4,
  d1_4_i: 4,
  d1_5_i: 2,
  d1_6_i: 3,
  d1_7_i: 1,
  d1_8_i: 4,
  d1_9_i: 4, // grupos de riesgo altos -> consumo elevado
  d1_10_i: 4,
  d1_11_i: 4,
  d1_12_i: 3,
  d1_13_i: 0,
  d1_14_i: 2,
  d1_15_i: 1,
  d8_59: "Restaurante o fonda",
  d8_60: "3–4 veces/semana",
  d1f_des_i: 2, // rara vez o nunca desayuna
  d1f_noche_i: 3, // cena despues de las 9
  d1f_sal_i: 3, // sal extra (>=2)
  d8_62: "Frecuentemente",
  d8_61: "Generalmente es difícil",
  d7_agua: 2,
  d7_55: 3, // gaseosas
  d7_56: 1, // energeticas
};

const ENC_PARCIAL: Record<string, unknown> = {
  sexo: "F",
  d8_59: "Yo mismo/a",
  d7_agua: 8,
  // sin frecuencia, sin cena/desayuno, sin inseguridad: la funcion omite esas frases con sus guards.
};

const ENC_INCOMPLETO: Record<string, unknown> = { sexo: "M" }; // nada legible

describe("resumen-dieta: golden diferencial contra la funcion vigente de Gildardo", () => {
  it("A · completo: el port reproduce byte-a-byte el parrafo del reference", () => {
    const mine = resumenDietaParrafo(ENC_COMPLETO);
    expect(mine).toBe(ref(ENC_COMPLETO));
    expect(mine.length).toBeGreaterThan(0); // sanity: el caso completo SI produce texto
  });

  it("C · parcial: frase valida y byte-identica (las frases sin datos se omiten, no salen rotas)", () => {
    const mine = resumenDietaParrafo(ENC_PARCIAL);
    expect(mine).toBe(ref(ENC_PARCIAL));
    // No queda degenerado: es una frase con sujeto y al menos una clausula, terminada en punto.
    expect(mine).toMatch(/^La paciente .+\.$/);
    expect(mine).not.toContain("undefined");
    expect(mine).not.toContain("null");
  });

  it("B · incompleto (cuidado d): ambos devuelven \"\" (no un parrafo roto); el llamador lo omite", () => {
    const mine = resumenDietaParrafo(ENC_INCOMPLETO);
    expect(mine).toBe(ref(ENC_INCOMPLETO));
    expect(mine).toBe(""); // degenerado -> cadena vacia, senal de "no mostrar"
  });
});
