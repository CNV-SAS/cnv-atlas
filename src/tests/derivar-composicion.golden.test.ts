import { describe, expect, it } from "vitest";

import { parseBiodyRow } from "@/clinical-engine/edge/biody-import";
import { derivarFaltantes } from "@/clinical-engine/frozen/derivar-composicion.js";

import zm3 from "./fixtures/clinical-engine/biody-hombre-zm3-anon.json";

// GOLDEN de las identidades de derivacion (frozen derivar-composicion.js). Ancla NO circular: se toma un
// export COMPLETO real (el ZM3, que trae la composicion MEDIDA por el equipo), se BORRAN los campos que la
// derivacion reconstruye, se corre derivarFaltantes, y se compara lo DERIVADO contra lo que MIDIO el equipo.
// Si las identidades de Gildardo valen (dice R2=1.000000 sobre 5.073 registros), coinciden. Asi el golden
// prueba las identidades contra el resultado del equipo, no contra nuestra propia re-corrida.

// Campos que derivarFaltantes reconstruye y que el ZM3 SI trae medidos (para comparar).
// Los 5 confirmados por Gildardo + los definicionales (que aqui quedan verificados empiricamente tambien).
const CAMPOS = [
  "FFW",
  "ECW_sg",
  "ICW_sg",
  "protActiva", // MPM
  "MCA",
  "ECM_BCM",
  "hidSG",
  "smmW",
] as const;

describe("derivar-composicion: identidades ancladas contra el equipo real (ZM3)", () => {
  const imp = parseBiodyRow(zm3 as Record<string, unknown>);
  const raw = imp.raw as Record<string, number | null>;

  // Valores MEDIDOS por el equipo (referencia de verdad).
  const medido: Record<string, number | null> = {};
  for (const c of CAMPOS) medido[c] = raw[c];

  // Copia con esos campos AUSENTES (simula el export corto que no los trae), y se derivan.
  const d: Record<string, number | null | undefined> = { ...raw };
  for (const c of CAMPOS) d[c] = null;
  derivarFaltantes(d);

  it("el fixture ZM3 trae medidos los campos a comparar (si no, la prueba no valdria)", () => {
    for (const c of CAMPOS) expect(medido[c], `${c} medido presente`).toBeTypeOf("number");
  });

  it("cada identidad derivada coincide con lo que midio el equipo (paridad, R2=1)", () => {
    for (const c of CAMPOS) {
      const med = medido[c] as number;
      const der = d[c] as number;
      expect(der, `${c} derivado presente`).toBeTypeOf("number");
      // Tolerancia relativa 0,5%: las identidades son exactas; la holgura absorbe el redondeo del equipo y
      // el toFixed(4) de la derivacion. Si una identidad estuviera MAL, el desvio seria grande, no de redondeo.
      const rel = Math.abs(der - med) / Math.max(1e-9, Math.abs(med));
      expect(rel, `${c}: derivado ${der} vs medido ${med} (rel ${rel.toFixed(5)})`).toBeLessThan(0.005);
    }
  });

  it("no pisa un valor ya presente (solo rellena lo ausente)", () => {
    // FM estaba medido; derivarFaltantes no lo toca.
    const d2: Record<string, number | null | undefined> = { ...raw };
    const fmAntes = d2.FM;
    derivarFaltantes(d2);
    expect(d2.FM).toBe(fmAntes);
  });
});
