import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DIET_CONTEXT_TEXTS, resumenDietaParrafo } from "@/clinical-engine/resumen-dieta";

// CANDADO DE ACOPLAMIENTO del parrafo de dieta con la encuesta (pieza 1b), para los campos de CONTEXTO
// (d8_59/60/61/62) que el parrafo lee por TEXTO crudo. Si manana cambia un texto de opcion en el seed y no
// aqui, el campo deja de reconocerse y el parrafo sale incompleto EN SILENCIO (la funcion omite lo que no
// puede leer). Este candado hace que eso TRUENE, por el consumidor de dieta.
//
// Los campos de FRECUENCIA (d1_N_i, d1f_*) NO se cubren aqui: el reader los resuelve con la CANON del motor
// de patron (FREQ_OPC/FREQ_SUP), que ya tiene su candado compartido (patron-coupling). Reusar esa CANON es
// justo lo que garantiza que un cambio de texto de frecuencia truene por AMBOS consumidores, no solo patron.
//
// Se lee el SEED como TEXTO (no se importa: seed.ts tiene side-effects). Es el acoplamiento real: contra la
// fuente de la encuesta, no contra una copia.

const SEED = readFileSync("supabase/seed.ts", "utf8");

// Extrae el array `options: [...]` de la linea que define la pregunta `key`. Una linea por pregunta en el seed.
function seedOptions(key: string): string[] {
  const line = SEED.split("\n").find((l) => l.includes(`key: "${key}"`) && l.includes("options:"));
  if (!line) throw new Error(`resumen-dieta-coupling: no se hallo la pregunta ${key} con options en el seed`);
  const m = line.match(/options:\s*\[([^\]]*)\]/);
  if (!m) throw new Error(`resumen-dieta-coupling: no se pudo extraer options de ${key}`);
  // Extrae cada cadena entre comillas (NO split por coma: hay opciones con coma, p. ej. "No, nunca").
  return Array.from(m[1].matchAll(/"([^"]*)"/g), (x) => x[1]);
}

describe("candado: el parrafo de dieta reconoce los textos de opcion vigentes de la encuesta", () => {
  for (const [key, recognized] of Object.entries(DIET_CONTEXT_TEXTS)) {
    it(`${key}: cada texto que el parrafo reconoce sigue siendo una opcion del seed`, () => {
      const options = seedOptions(key);
      for (const t of recognized) {
        // Si esto falla: el seed cambio el texto de una opcion y el parrafo quedo con el viejo -> el campo se
        // saltaria en silencio. Sincronizar el texto en resumen-dieta.ts (o al reves) para que vuelvan a coincidir.
        expect(options).toContain(t);
      }
    });
  }

  it("d8_59 ofrece 'Otra' pero el parrafo NO la mapea (texto libre, sin frase canonica): decision explicita", () => {
    // Guarda contra el hazard "Otra/Otras": si alguien agregara "Otra" al mapeo, saldria una frase con texto
    // libre crudo. Se documenta que su ausencia es intencional, no un olvido.
    expect(seedOptions("d8_59")).toContain("Otra");
    expect(DIET_CONTEXT_TEXTS.d8_59).not.toContain("Otra");
  });

  it("reconocimiento efectivo: un texto de contexto del seed produce su frase (no se cae al fallback)", () => {
    // Prueba de humo del acoplamiento: alimentar el texto EXACTO del seed produce una frase reconocida.
    const opt = seedOptions("d8_62").find((o) => o === "Frecuentemente");
    expect(opt).toBeDefined();
    const out = resumenDietaParrafo({ sexo: "M", d8_62: opt });
    expect(out).toContain("inseguridad alimentaria frecuente");
  });
});
