import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF-dfi (_ffmiLow, re-sync 2026-08-05): la expresion _ffmiLow de engine.dfi.js debe ser VERBATIM la
// del vigente. El vigente ES AHORA EL v8 (gildardo-2026-08-04/ATLAS_v8.html): el 07-30 quedo congelado.
// Ancla la sincronia de la frontera de desnutricion del DFI: _ffmiLow delega en cFFMI (H<17 / M<15) en
// vez del literal viejo 17.92/15.64. Si alguien lo re-edita, o Gildardo lo cambia en una entrega nueva,
// este test cae. El valor correcto sale de SU archivo, no de nuestra salida.
//
// (Este es el DIFF que FALTABA: _ffmiLow no estaba anclado, por eso el desfase 17.92/15.64 paso
// inadvertido meses. Es la leccion "el golden protege contra REGRESION, el DIFF contra DESFASE".)

const VIGENTE = "docs/entregas/gildardo-2026-08-04/ATLAS_v8.html";

// Extrae la expresion _ffmiLow del vigente (la parte tras "const _ffmiLow ="), normalizando espacios.
function ffmiLowExprFromVigente(): string {
  const src = readFileSync(VIGENTE, "utf8");
  const m = src.match(/const\s+_ffmiLow\s*=\s*([^;]+);/);
  if (!m) throw new Error("no se encontro _ffmiLow en el vigente v8");
  return m[1].replace(/\s+/g, " ").trim();
}

describe("DIFF-dfi: _ffmiLow verbatim del vigente (v8)", () => {
  const dfi = readFileSync("src/clinical-engine/frozen/engine.dfi.js", "utf8");
  const expr = ffmiLowExprFromVigente();

  it("el vigente delega en cFFMI (no un literal): la sincronia esperada", () => {
    expect(expr).toContain("cFFMI");
    expect(expr).toContain(".k === 1");
    expect(expr).not.toContain("17.92"); // el literal viejo NO debe estar en el vigente
  });

  it("engine.dfi.js contiene la MISMA expresion _ffmiLow que el vigente", () => {
    const ours = dfi.match(/const\s+_ffmiLow\s*=\s*([^;]+);/);
    expect(ours).not.toBeNull();
    const oursExpr = ours![1].replace(/\s+/g, " ").trim();
    expect(oursExpr).toBe(expr);
  });
});
