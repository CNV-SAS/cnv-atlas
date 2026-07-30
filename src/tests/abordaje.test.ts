import { describe, expect, it } from "vitest";

import { abordajeProfesional } from "@/clinical-engine";

// Abordaje por profesion (T2b subtarea 1, parte B): orientacion que se COMPUTA en tiempo de vista.
// Fija el guard de clave malformada y que las profesiones de arranque caen en su rol (no al else).

describe("abordajeProfesional", () => {
  it("clave malformada -> null (no computa sobre una clave incompleta)", () => {
    expect(abordajeProfesional("N_N_N", "medico")).toBeNull(); // 3 partes
    expect(abordajeProfesional("", "medico")).toBeNull();
    expect(abordajeProfesional("N__N_A", "medico")).toBeNull(); // parte vacia
  });

  it("las 3 profesiones de arranque caen en su rol, no al else por accidente", () => {
    const key = "B_A_B_A"; // las 4 bandas adversas: cada rol emite su rama con banderas
    expect(abordajeProfesional(key, "medico")).toMatch(/^Médico:/);
    expect(abordajeProfesional(key, "deportologo")).toMatch(/^Deportólogo/);
    expect(abordajeProfesional(key, "nutricionista")).toMatch(/^Nutricionista:/);
    // psicologo (diferido, pero verificamos que no cae al else)
    expect(abordajeProfesional(key, "psicologo")).toMatch(/^Psicólogo:/);
  });

  it("clave sin banderas adversas devuelve el texto de mantenimiento del rol", () => {
    const key = "N_N_N_N"; // ninguna adversa
    expect(abordajeProfesional(key, "nutricionista")).toContain("mantenimiento");
  });
});
