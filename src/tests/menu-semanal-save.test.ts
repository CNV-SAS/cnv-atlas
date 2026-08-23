import { describe, expect, it } from "vitest";

import { DIAS_DEL_CICLO } from "@/clinical-engine/menu-ciclo";
import { menuSemanalSignature } from "@/modules/treatment/data/protocol-signature";
import type { MenuSemanalSaved } from "@/modules/treatment/data/treatment-view-types";
import { saveMenuSemanalSchema } from "@/modules/treatment/validations";

// Candados del guardado del MENU SEMANAL (CP4). Dos cosas distintas:
//   - la FIRMA, que es la base del candado de concurrencia (cliente y servidor deben computar lo mismo);
//   - el SCHEMA, que valida el continente y no el contenido (el menu es texto libre del profesional).

const menu = (over: Partial<MenuSemanalSaved> = {}): MenuSemanalSaved => ({
  diaInicio: 5,
  celdas: { "0_desayuno": "Arepa con queso", "2_almuerzo": "Sancocho de gallina" },
  ...over,
});

describe("menuSemanalSignature", () => {
  const sig = (m: MenuSemanalSaved | null) => menuSemanalSignature({ treatmentId: "t-1", menu: m });

  it("reordenar las celdas NO mueve la firma (jsonb no garantiza orden al volver de la BD)", () => {
    const reordenado = menu({ celdas: Object.fromEntries(Object.entries(menu().celdas).reverse()) });
    expect(sig(reordenado)).toBe(sig(menu()));
  });

  it("cambiar el texto de una celda SI mueve la firma", () => {
    expect(sig(menu({ celdas: { ...menu().celdas, "0_desayuno": "Otra cosa" } }))).not.toBe(sig(menu()));
  });

  it("cambiar la SEMANA BASE mueve la firma: el dia de arranque es parte del plan", () => {
    expect(sig(menu({ diaInicio: 6 }))).not.toBe(sig(menu()));
  });

  it("null y una forma que NO es la actual dan la MISMA firma (§none), como el reader las normaliza", () => {
    // Es la defensa que costo un 500 la vez pasada: el writer relee el jsonb CRUDO, que puede traer una
    // forma vieja o ajena. Tratarla como "nunca guardado" deja que el guardado la sobrescriba en vez de
    // reventar. Ver la leccion del cambio de shape del intercambio.
    const vieja = { menuSem: { lunes: "algo" } } as unknown as MenuSemanalSaved;
    expect(sig(vieja)).toBe(sig(null));
    expect(sig(null)).toBe("t-1§none");
  });
});

describe("saveMenuSemanalSchema", () => {
  const ok = (m: unknown) =>
    saveMenuSemanalSchema.safeParse({
      evaluationId: "3bfbcc45-0000-4000-8000-000000000001",
      menu: m,
      baseSignature: "",
    });

  it("acepta un menu valido", () => {
    expect(ok(menu()).success).toBe(true);
  });

  it("rechaza una clave de celda mal formada (dia fuera de la semana o tiempo desconocido)", () => {
    expect(ok(menu({ celdas: { "9_desayuno": "x" } })).success).toBe(false);
    expect(ok(menu({ celdas: { "0_almuerzoTardio": "x" } })).success).toBe(false);
  });

  it("rechaza un dia de arranque fuera del ciclo", () => {
    expect(ok(menu({ diaInicio: DIAS_DEL_CICLO })).success).toBe(false);
    expect(ok(menu({ diaInicio: -1 })).success).toBe(false);
  });

  it("acota el tamaño: una celda enorme se rechaza (limite de payload, regla dura)", () => {
    expect(ok(menu({ celdas: { "0_desayuno": "x".repeat(5000) } })).success).toBe(false);
  });

  it("rechaza mas celdas de las que tiene la semana", () => {
    const muchas: Record<string, string> = {};
    for (let i = 0; i < 100; i++) muchas[`${i % 7}_desayuno${i}`] = "x";
    expect(ok(menu({ celdas: muchas })).success).toBe(false);
  });
});
