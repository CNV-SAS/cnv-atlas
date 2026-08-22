import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { FREQ_GROUPS } from "@/clinical-engine/frozen/engine.patron.js";

// GUARDA GENERALIZABLE: "el insumo llega completo". Para cada funcion clinica que consume campos de la
// encuesta, cada campo que lee DEBE tener field_key en el seed; si no, el reader lo filtra (query por
// field_key) y el dato no llega, aunque el paciente lo respondio. La funcion omite lo que no reconoce, asi
// que el fallo es SILENCIOSO. El golden NO lo cubre (le pasa el enc ya armado a las dos funciones). Esto si.
//
// Origen (1b, 2026-08-22): el parrafo de dieta consumia d8_59/d8_60/d7_agua/d7_55/d7_56 y esos 5 NO tenian
// field_key -> tres frases faltaban en produccion y el golden pasaba igual. Este test lo habria cazado.
//
// Se lee el SEED como texto (no se importa: tiene side-effects). Un campo "tiene field_key" si su definicion
// lleva un flag (engine / treatmentEngine / patternEngine): asi el seed le asigna field_key = key.
//
// PATRON PARA LAS PROXIMAS PIEZAS: cuando una pieza nueva lea la encuesta, agregar su lista de campos aqui.
// (Las 4 del plan alimentario leen la CADENA y el PROTOCOLO, no la encuesta, asi que no entran; si alguna
// terminara leyendo la encuesta, su lista va aqui antes de construirla.)

const SEED = readFileSync("supabase/seed.ts", "utf8");

// Un campo tiene field_key si el seed le pone un flag de motor en su linea de definicion.
function hasFieldKey(key: string): boolean {
  const line = SEED.split("\n").find((l) => l.includes(`key: "${key}"`) && l.includes("type:"));
  if (!line) return false; // ni siquiera existe la pregunta
  return /engine: true|treatmentEngine: true|patternEngine: true/.test(line);
}

// Campos que consume el parrafo de dieta del Resumen Clinico (resumen-dieta.ts). 15 grupos de FREQ_GROUPS +
// 3 horarios + 4 de contexto (d8) + 3 de hidratacion (d7). `sexo` no es campo de encuesta (viene del paciente).
const DIET_FIELDS: string[] = [
  ...FREQ_GROUPS.map((g: { n: number | string }) => `d1_${g.n}_i`),
  "d1f_des_i",
  "d1f_noche_i",
  "d1f_sal_i",
  "d8_59",
  "d8_60",
  "d8_61",
  "d8_62",
  "d7_agua",
  "d7_55",
  "d7_56",
];

describe("insumo llega completo: los campos que consume el parrafo de dieta tienen field_key", () => {
  it.each(DIET_FIELDS)("%s tiene field_key en el seed (si no, no llega al reader)", (key) => {
    // Si esto falla: el paciente responde el campo pero sin field_key el reader lo filtra y la frase
    // correspondiente desaparece del parrafo EN SILENCIO. Marcar el campo con treatmentEngine en el seed
    // (used_in_diagnosis=false) y agregar la data-migration para la version ya sembrada.
    expect(hasFieldKey(key)).toBe(true);
  });

  it("son 25 campos (15 grupos + 3 horarios + 4 contexto + 3 hidratacion): si baja, se perdio uno", () => {
    expect(DIET_FIELDS.length).toBe(25);
    expect(new Set(DIET_FIELDS).size).toBe(25); // sin duplicados
  });
});
