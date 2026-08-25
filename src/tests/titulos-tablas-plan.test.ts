import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DE LOS TITULOS DE LAS TABLAS DEL PLAN (cotejo del nutricionista, 2026-08-24).
//
// Los titulos van VERBATIM de su archivo porque la REFERENCIA es parte del dato: una tabla titulada
// "Lista de intercambio" a secas parece una lista nuestra; "Lista de intercambio U de A · ICBF 2025" dice
// de donde salen las porciones. Y "meta ICN ≈ 1" dice como se lee la columna, que es lo que vuelve util la
// validacion. Acortarlos no es una decision de presentacion: quita informacion.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

describe("titulos de las tablas del plan", () => {
  it("la lista de intercambio lleva su FUENTE", () => {
    expect(PANEL).toContain("Lista de intercambio U de A · ICBF 2025");
    expect(PANEL).not.toContain(">Lista de intercambio</h3>");
  });

  it("la distribucion lleva 'de comida', como en su archivo", () => {
    expect(PANEL).toContain("Distribución por tiempos de comida");
  });

  it("la validacion dice QUE muestra y COMO se lee (meta ICN ≈ 1)", () => {
    expect(PANEL).toContain("Validación del plan · % de cubrimiento e ICN (meta ICN ≈ 1)");
  });

  it("el objetivo conserva su nombre completo", () => {
    expect(PANEL).toContain("Objetivo del tratamiento nutricional");
  });
});
