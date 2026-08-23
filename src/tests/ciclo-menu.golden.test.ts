import { describe, expect, it } from "vitest";

import { CICLO_MENU_21, DIAS_DEL_CICLO, diaDelCiclo, diaInicioDerivado } from "@/clinical-engine/menu-ciclo";

// Extracto verbatim en JS (sin tipos), a proposito: es la REFERENCIA, no codigo de la app.
import { CICLO_MENU_21 as REF } from "./fixtures/reference/ciclo-menu-vigente.js";

// CANDADO del ciclo de menus (21 dias x 5 tiempos). Mismo criterio que INTER_TABLA_B: el deep-equal
// prueba que la copia es fiel, y aparte van los chequeos de coherencia INTERNA, que miran lo que el
// deep-equal no puede ver (si el error viniera del HTML, las dos copias coincidirian).

const REF_CICLO = REF as Record<string, string>[];
const TIEMPOS_DEL_CICLO = ["desayuno", "mediasOnces", "almuerzo", "algo", "cena"] as const;

describe("CICLO_MENU_21: transcripcion verbatim de la entrega vigente", () => {
  it("es IDENTICO al extracto del v8", () => {
    expect(CICLO_MENU_21).toEqual(REF_CICLO);
  });

  it("son 21 dias, y el orden se conserva (la rotacion depende de el)", () => {
    expect(DIAS_DEL_CICLO).toBe(21);
    expect(CICLO_MENU_21.map((d) => d.desayuno)).toEqual(REF_CICLO.map((d) => d.desayuno));
  });

  it("ningun dia tiene un tiempo vacio: un menu en blanco se ve como un fallo de carga", () => {
    CICLO_MENU_21.forEach((dia, i) => {
      for (const t of TIEMPOS_DEL_CICLO) {
        expect(dia[t]?.trim().length, `dia ${i + 1}, ${t}`).toBeGreaterThan(0);
      }
    });
  });

  it("el ciclo NO trae merienda: es la brecha declarada, y si algun dia aparece hay que enterarse", () => {
    // No es un defecto que arreglar: Gildardo no la cubre y no vamos a inventarla. Pero si un dia la
    // agrega, este test se pone rojo y sabemos que la columna ya se puede llenar sola.
    for (const dia of CICLO_MENU_21) {
      expect(Object.keys(dia).sort()).toEqual([...TIEMPOS_DEL_CICLO].sort());
    }
  });
});

describe("diaDelCiclo: la rotacion del v8", () => {
  it("recorre 7 dias consecutivos desde el arranque", () => {
    expect(diaDelCiclo(3, 0)).toBe(CICLO_MENU_21[3]);
    expect(diaDelCiclo(3, 4)).toBe(CICLO_MENU_21[7]);
  });

  it("da la vuelta al llegar al final (arranque 18 + 5 dias -> dia 2)", () => {
    expect(diaDelCiclo(18, 5)).toBe(CICLO_MENU_21[2]);
  });

  it("tolera un arranque fuera de rango o negativo sin devolver undefined", () => {
    // El diaInicio viene de un jsonb guardado: un valor raro no debe dejar la grilla en blanco.
    expect(diaDelCiclo(21, 0)).toBe(CICLO_MENU_21[0]);
    expect(diaDelCiclo(-1, 0)).toBe(CICLO_MENU_21[20]);
    expect(diaDelCiclo(999, 0)).toBeDefined();
  });

  it("una semana desde cualquier arranque no repite dia (7 < 21)", () => {
    for (const inicio of [0, 5, 15, 20]) {
      const semana = [0, 1, 2, 3, 4, 5, 6].map((i) => diaDelCiclo(inicio, i).desayuno);
      expect(new Set(semana).size).toBe(7);
    }
  });
});

describe("diaInicioDerivado: la semilla de la precarga", () => {
  // La decision que esto blinda: el v8 arranca el ciclo en un dia ALEATORIO y puede permitirselo porque su
  // menu es transitorio. Aqui el plan se GUARDA, y un menu que cambia al recargar no es un plan.
  const T1 = "3bfbcc45-0000-4000-8000-000000000001";
  const T2 = "3bfbcc45-0000-4000-8000-000000000002";

  it("es DETERMINISTA: el mismo tratamiento da siempre la misma semana (nada de parpadeo al recargar)", () => {
    expect(diaInicioDerivado(T1)).toBe(diaInicioDerivado(T1));
  });

  it("DIFIERE entre evaluaciones: en el seguimiento no se le repite la misma semana al paciente", () => {
    expect(diaInicioDerivado(T1)).not.toBe(diaInicioDerivado(T2));
  });

  it("siempre cae dentro del ciclo, para cualquier id", () => {
    for (const id of [T1, T2, "", "x", "a".repeat(200)]) {
      const d = diaInicioDerivado(id);
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(DIAS_DEL_CICLO);
    }
  });

  it("REPARTE: 200 tratamientos no caen todos en el mismo dia", () => {
    // Si el hash colapsara, todos los pacientes verian la misma semana y la derivacion no serviria de nada.
    const dias = new Set(
      Array.from({ length: 200 }, (_, i) => diaInicioDerivado(`3bfbcc45-0000-4000-8000-${String(i).padStart(12, "0")}`)),
    );
    expect(dias.size).toBeGreaterThan(DIAS_DEL_CICLO / 2);
  });
});
