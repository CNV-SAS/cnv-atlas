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

// ── Piezas nuevas (2026-08-26) ────────────────────────────────────────────────────────────────
// Al aprobar Gildardo su 3.2 (alergias a los cuatro profesionales, y como RESTRICCION del plan en
// nutricion) entran dos consumidores nuevos de la encuesta. Siguiendo el PATRON declarado arriba,
// sus listas van aqui ANTES de construirlos: si el guard solo cubre lo viejo, deja lo nuevo fuera,
// que es exactamente como quedo el parrafo de dieta.

// Lo que el GENERADOR DE MENU necesita para no proponerle carne a un vegano ni marisco a un
// alergico. d4_34 es el que Gildardo marco como "entra antes que cualquier otra cosa".
const MENU_FIELDS = ["d4_34", "d6_43", "d6_44", "d6_qx", "d4_35", "d4_32", "d4_33"];

// Lo que el DIAGNOSTICO POR PROFESION necesita, de la lista que Gildardo aprobo completa.
// El tamizaje de apnea (d3_28 + d3_27 + d3_26 + IMC) esta pendiente de que el de el instrumento y
// sus puntos de corte (pregunta 4 de la ronda del 26): los campos ya deben llegar.
const PROFESION_FIELDS = ["d3_25", "d3_27", "d3_28", "d3_31", "d5_37", "d6_45", "d6_46", "d6_47",
  "d6_48", "d6_49", "d6_50", "d6_51"];

describe("insumo llega completo: el generador de menu", () => {
  it.each(MENU_FIELDS)("%s tiene field_key en el seed", (key) => {
    expect(hasFieldKey(key)).toBe(true);
  });
});

describe("insumo llega completo: el diagnostico por profesion", () => {
  it.each(PROFESION_FIELDS)("%s tiene field_key en el seed", (key) => {
    expect(hasFieldKey(key)).toBe(true);
  });
});

// El texto libre de "Otra" es la otra mitad del mismo problema: el campo puede TENER field_key y aun
// asi perder su contenido, porque la glue filtra los elementos "Otra: <texto>" salvo en los campos
// declarados en FREE_TEXT_TO_ENGINE. La lista cerrada cubre los casos comunes, asi que lo que se
// pierde son los RAROS, que son los que el profesional no adivina. Este candado fija los campos
// donde el motor ACTUA sobre el contenido y por tanto el texto libre debe sobrevivir.
const OTRA_DEBE_LLEGAR = ["d5_39", "d5_38", "d6_44", "d6_43", "d6_qx", "d4_34", "d4_35", "d2_21",
  "d5_40", "d3_25"];

describe("insumo llega completo: el texto libre de 'Otra' sobrevive donde el motor actua", () => {
  const GLUE = readFileSync("src/modules/clinical-pipeline/services/build-engine-input.ts", "utf8");
  const bloque = GLUE.slice(GLUE.indexOf("const FREE_TEXT_TO_ENGINE"), GLUE.indexOf("]);", GLUE.indexOf("const FREE_TEXT_TO_ENGINE")));

  it.each(OTRA_DEBE_LLEGAR)("%s esta en FREE_TEXT_TO_ENGINE", (key) => {
    // Si esto falla: el paciente marca "Otra" y escribe su alergeno / medicamento / patron, y la glue
    // lo TIRA. El motor lo ve como si no hubiera respondido. Y la historia clinica SI lo muestra
    // (lee crudo), asi que el documento y el calculo se contradicen sin que nada falle.
    expect(bloque).toContain(`"${key}"`);
  });

  it("d8_59 se queda FUERA a proposito (exclusion documentada en resumen-dieta.ts)", () => {
    expect(bloque).not.toContain('"d8_59"');
  });
});
