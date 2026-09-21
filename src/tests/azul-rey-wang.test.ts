import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

// ═══ LA FRANJA DE WANG VA EN SU AZUL REY (ATLAS_v9, cambio 2, 2026-09-21) ═══
//
// Su v9 unifica las cuatro bandas de nivel en UNA constante (`AZUL_REY_NIVEL`), en sus dos modulos. En un
// color que el eligio para su tabla, el suyo gana (Santiago). El candado lo DERIVA de su archivo vigente: si
// el cambia la constante, esto se pone rojo en vez de dejarnos con el azul de una entrega vieja.

const HTML = readFileSync(HTML_VIGENTE, "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");
const TABLA = readFileSync("src/modules/diagnoses/components/composition-section.tsx", "utf8");

describe("el azul de las franjas de Wang es el suyo", () => {
  it("nuestro token es su AZUL_REY_NIVEL", () => {
    const suyo = /const AZUL_REY_NIVEL = "(#[0-9A-Fa-f]{6})"/.exec(HTML)?.[1];
    expect(suyo, "no aparece AZUL_REY_NIVEL en su archivo").toBeDefined();
    const nuestro = /--nivel-wang:\s*(#[0-9A-Fa-f]{6})/.exec(CSS)?.[1];
    expect(nuestro?.toLowerCase()).toBe(suyo!.toLowerCase());
  });

  it("y las franjas lo usan, con la letra en blanco", () => {
    // `--primary` no: en el tema oscuro se vuelve casi blanco y la franja dejaria de leerse.
    expect((TABLA.match(/bg-nivel-wang/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(TABLA).not.toContain('<tr className="border-y border-primary bg-primary">');
  });
});
