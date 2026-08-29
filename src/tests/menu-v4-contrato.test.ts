import { describe, expect, it } from "vitest";

import {
  buildMenuAdaptarPrompt,
  MENU_PROMPT_VERSION,
  parseCambiosMenu,
  TIEMPOS_CONTRATO,
  verificarCita,
  type MenuAdaptarInput,
} from "@/modules/treatment/ai/prompts/menu.v4";

// CANDADO DEL CONTRATO v4: la IA ADAPTA, no genera.
//
// Su instrucción (§13, 2026-08-28): "El ciclo de 21 días es la base y la IA solo lo adapta cuando hay
// restricciones. Un modelo componiendo un menú desde cero no es lo que este software hace."

const input = (over: Partial<MenuAdaptarInput> = {}): MenuAdaptarInput => ({
  kcalObjetivo: 1800,
  proteinaGramos: 90,
  fenotipoEstructural: "Normal/Normal",
  sectorFuncional: "Reserva funcional",
  rutasAtencion: ["R2"],
  restriccionesModelo: [{ nombre: "Sodio", valor: "< 2000 mg", ref: "OMS" }],
  restriccionesProfesional: ["Sin gluten"],
  patronAlimentario: ["vegetariano"],
  base: [
    { dia: 0, tiempo: "desayuno", texto: "Pan blanco con huevo" },
    { dia: 0, tiempo: "almuerzo", texto: "Sopa de lentejas con arroz" },
  ],
  ...over,
});

describe("el prompt manda ADAPTAR, no componer", () => {
  const [system, user] = buildMenuAdaptarPrompt(input());

  it("el texto de sistema por defecto dice que NO compone menús", () => {
    // Un texto de sistema que describe mal la tarea es de la familia que ya nos mordió: el modelo obedece
    // lo que lee, no lo que quisimos decir.
    expect(system.content).toContain("NO compones menus");
    expect(system.content).toContain("ADAPTAS");
  });

  it("el mensaje lleva el MENÚ BASE, que es lo que se adapta", () => {
    expect(user.content).toContain("MENU BASE");
    expect(user.content).toContain("dia 0 | desayuno: Pan blanco con huevo");
  });

  it("pide EXPLÍCITAMENTE no incluir lo que no incumple nada", () => {
    // Es la mitad del contrato: lo que no aparece en la respuesta es lo que no se movió. Si esta
    // instrucción se cae, el modelo devuelve la semana entera y perdemos la trazabilidad del cambio.
    expect(user.content).toContain("NO la incluyas");
    expect(user.content).toContain("se queda como esta");
  });

  it("exige la restricción CONCRETA como motivo, no una justificación general", () => {
    // Sin esto el modelo escribe "más saludable", que no es revisable: el profesional no puede contrastar
    // esa frase contra nada.
    expect(user.content).toContain("LA RESTRICCION CONCRETA");
    expect(user.content).toContain("mas saludable");
  });

  it("y no queda rastro del contrato viejo de generación", () => {
    expect(user.content).not.toContain("Genera un menu de un dia");
    expect(MENU_PROMPT_VERSION).toBe(4);
  });

  it("las restricciones siguen viajando, y son la razón de que la IA entre", () => {
    expect(user.content).toContain("Sodio: < 2000 mg (OMS)");
    expect(user.content).toContain("Sin gluten");
    expect(user.content).toContain("vegetariano");
  });

  it("NO viaja ninguna PII: solo objetivos, restricciones y el menú base", () => {
    // Regla dura 15. El candado mira que no aparezcan las llaves de identificación en el mensaje armado.
    for (const prohibido of ["nombre", "documento", "cedula", "celular", "correo", "email"]) {
      expect(user.content.toLowerCase()).not.toContain(prohibido);
    }
  });
});

describe("el parseo: la lista vacía es una respuesta, no un fallo", () => {
  it("acepta la lista vacía y la distingue de null", () => {
    // "Revisé y no había nada que sustituir" NO es "la IA falló". Confundirlas mostraría un menú que ya
    // cumplía como un error del sistema.
    expect(parseCambiosMenu('{"cambios":[]}')).toEqual({ cambios: [] });
    expect(parseCambiosMenu("no es json")).toBe(null);
    expect(parseCambiosMenu("")).toBe(null);
  });

  it("parsea un cambio completo y tolera el envoltorio de bloque de código", () => {
    const json = '{"cambios":[{"dia":2,"tiempo":"almuerzo","reemplazo":"Arroz con lentejas","motivo":"vegetariano"}]}';
    const esperado = {
      cambios: [{ dia: 2, tiempo: "almuerzo", reemplazo: "Arroz con lentejas", motivo: "vegetariano" }],
    };
    expect(parseCambiosMenu(json)).toEqual(esperado);
    expect(parseCambiosMenu("```json\n" + json + "\n```")).toEqual(esperado);
  });

  it("RECHAZA un día fuera de rango: escribiría en una celda que no existe", () => {
    expect(
      parseCambiosMenu('{"cambios":[{"dia":9,"tiempo":"cena","reemplazo":"x","motivo":"y"}]}'),
    ).toBe(null);
    expect(
      parseCambiosMenu('{"cambios":[{"dia":-1,"tiempo":"cena","reemplazo":"x","motivo":"y"}]}'),
    ).toBe(null);
  });

  it("RECHAZA un tiempo inventado: escribiría en el sitio equivocado", () => {
    expect(
      parseCambiosMenu('{"cambios":[{"dia":0,"tiempo":"brunch","reemplazo":"x","motivo":"y"}]}'),
    ).toBe(null);
    // Y acepta los seis del ciclo, incluida la merienda que hoy viene vacía.
    for (const t of TIEMPOS_CONTRATO) {
      expect(
        parseCambiosMenu(`{"cambios":[{"dia":0,"tiempo":"${t}","reemplazo":"x","motivo":"y"}]}`),
      ).not.toBe(null);
    }
  });

  it("RECHAZA un cambio SIN motivo: sin él la propuesta no es revisable", () => {
    expect(parseCambiosMenu('{"cambios":[{"dia":0,"tiempo":"cena","reemplazo":"x"}]}')).toBe(null);
    expect(
      parseCambiosMenu('{"cambios":[{"dia":0,"tiempo":"cena","reemplazo":"x","motivo":"  "}]}'),
    ).toBe(null);
  });

  it("RECHAZA un reemplazo vacío: borraría la celda en vez de sustituirla", () => {
    expect(
      parseCambiosMenu('{"cambios":[{"dia":0,"tiempo":"cena","reemplazo":"","motivo":"y"}]}'),
    ).toBe(null);
  });
});

describe("el cambio que no corresponde se puede VER, aunque no se bloquee", () => {
  const restricciones = ["Sin gluten", "vegetariano", "Sodio: < 2000 mg"];

  it("reconoce el motivo que cita una restricción real, con tildes y mayúsculas distintas", () => {
    // Exigir igualdad marcaría como no verificados casi todos los cambios legítimos, y un aviso que salta
    // siempre se aprende a ignorar.
    expect(verificarCita("sin gluten", restricciones)).toBe(true);
    expect(verificarCita("Vegetariano", restricciones)).toBe(true);
    expect(verificarCita("el paciente es vegetariano", restricciones)).toBe(true);
  });

  it("y marca el que cita algo que NADIE le pidió", () => {
    // Es el caso del cambio que no corresponde: una celda que no chocaba con nada, sustituida "porque
    // sí". No se bloquea (juzgarlo es clínico) pero el profesional puede verlo.
    expect(verificarCita("más saludable", restricciones)).toBe(false);
    expect(verificarCita("mejor opción", restricciones)).toBe(false);
    expect(verificarCita("", restricciones)).toBe(false);
  });

  it("sin restricciones, ningún motivo se verifica", () => {
    expect(verificarCita("sin gluten", [])).toBe(false);
  });
});
