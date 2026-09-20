import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ CANDADO DEL TAMAÑO DE HOJA (Santiago, 2026-09-20) ═══
//
// EL DEFECTO QUE CIERRA: el informe del paciente salía en A4 mientras la historia clínica y todo lo que se
// imprime desde pantalla salían en CARTA. El mismo documento tenía dos formas según por dónde se pidiera.
//
// Y NO SON LA MISMA HOJA CON OTRO NOMBRE: A4 son 210x297 mm y carta 216x279 mm. A4 es más angosta y más
// alta, así que un documento maquetado para una, impreso en la otra, deja márgenes desiguales y puede
// partir una página de más. En Colombia el papel es carta.
//
// UN SOLO TAMAÑO, y el candado lo sostiene: es de los que no duele hasta que alguien imprime.

const PDFS = [
  "src/modules/reports/pdf/report-document.tsx", // Informe ANI-BIS-E del paciente
  "src/modules/reports/pdf/hc-document.tsx", // Historia clínica
];

describe("todo lo que se imprime sale en carta", () => {
  for (const pdf of PDFS) {
    it(`${pdf} declara LETTER`, () => {
      const codigo = readFileSync(pdf, "utf8");
      expect(codigo).toContain('size="LETTER"');
      expect(codigo).not.toContain('size="A4"');
    });
  }

  it("y la impresión desde pantalla usa el mismo tamaño", () => {
    // Las hojas imprimibles (informe, plan, diagnóstico funcional) salen por el navegador, no por el
    // generador de PDF: si `@page` dijera otra cosa, volveríamos a tener dos formas del mismo documento.
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*letter/);
  });
});
