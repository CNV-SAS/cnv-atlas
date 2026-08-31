import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Modulo congelado en JS; `allowJs` lo resuelve.
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";

// CANDADO DE "EL MOTOR QUE GOBIERNA ES EL QUE SE MUESTRA" (Gildardo, respuesta a la ronda del 2026-08-23).
//
// SU DECISION, textual: "`motorTratNutri` gobierna la prescripcion nutricional. Es el que tiene la ciencia
// actualizada, y el sodio lo demuestra: 1.500 mg en hipertension es lo que sostienen OMS, DASH/NHLBI y
// AHA/ACC 2025. Los 2.300 del otro motor son el corte viejo. Porten las nueve filas de `motorTratNutri`."
//
// EL DEFECTO QUE CIERRA, y es el mas caro de la semana: el motor estaba PORTADO desde el 26 de agosto, con
// sus tres correcciones y su golden, y NADIE LO LLAMABA. De los CUATRO motores de tratamiento, tres
// llegaban a pantalla (medico, ejercicio, psico) y el del nutricionista no. Lo que el profesional leia, y
// lo que viajaba al generador de menus, salia de `atlas-protocolo`: a un hipertenso le decia "Sodio < 2300
// mg/dia" ocho dias despues de que el ordenara 1.500. El mismo nos habia señalado esa incoherencia.
//
// POR QUE SE NOS ESCAPO: una nota de la cola decia "VERIFICADO contra sus respuestas: no esta contestada",
// escrita ANTES de que llegara la respuesta. Una nota que dice "verificado" es mas peligrosa que una
// suposicion, porque nadie la vuelve a comprobar.
//
// POR ESO ESTE CANDADO VA SOBRE LOS SITIOS DE LLAMADA y no sobre el motor: el motor siempre estuvo bien.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const MENU = readFileSync("src/modules/treatment/services/generate-menu.ts", "utf8");
const READER = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");
const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");

/** Paciente hipertenso: el caso que hacia visible el defecto. */
const HIPERTENSO = { d5_39: ["Hipertensión arterial"], edad: 50, sexo: "Masculino" };
const BIS = { sexo: "Masculino", peso: 92, talla: 171, FMI: 8, FFMI: 19 };

describe("el sodio que ve el hipertenso es el que él ordenó", () => {
  it("el motor que gobierna prescribe 1.500, no 2.300", () => {
    const m = motorTratNutri(HIPERTENSO, BIS, {}) as { sodioMax: number; attrs: string[] };
    expect(m.sodioMax).toBe(1500);
    expect(m.attrs.join(" ")).toContain("Hiposódica");
    expect(m.attrs.join(" ")).toContain("DASH");
  });

  it("y el 2.300 del otro motor sigue existiendo, congelado, para que se note si vuelve a la pantalla", () => {
    // No se edita el frozen: `atlas-protocolo` es transcripcion byte a byte y su 2300 es lo que su archivo
    // dice. Lo que cambia es QUE MOTOR alimenta la pantalla, no lo que cada motor calcula.
    const protocolo = readFileSync("src/clinical-engine/frozen/atlas-protocolo.js", "utf8");
    expect(protocolo).toContain("< 2300 mg/día");
  });
});

describe("los dos consumidores leen del motor que gobierna, y de UNA sola fuente", () => {
  it("hay un solo lector (`getPrescripcionNutricional`) y corre el motor correcto", () => {
    expect(READER).toContain("motorTratNutri(enc, bis, {})");
    expect(READER).toContain("export async function getPrescripcionNutricional");
  });

  it("la PANTALLA del nutricionista muestra esa prescripción, no las restricciones selladas", () => {
    expect(PANEL).toContain("Prescripción del modelo");
    // El bloque sellado sigue existiendo SOLO como respaldo, y rotulado como "de la emisión": si volviera a
    // ser la fuente principal, el hipertenso vería otra vez el 2.300.
    expect(PANEL).toContain("Restricciones del modelo (de la emisión)");
    expect(PANEL, "el bloque sellado volvió a ser la fuente principal").toContain("{prescripcion ? (");
  });

  it("y el PROMPT DEL MENÚ recibe las mismas, no las del snapshot", () => {
    // Es la mitad que no se ve: la IA recibia "Sodio < 2300" y adaptaba el menu contra el corte viejo.
    expect(MENU).toContain("getPrescripcionNutricional(");
    expect(MENU).toContain("const restriccionesModelo = prescripcion");
    // Y con los LIMITES, no con todas las filas: la proteina objetivo es una meta y contarla abriria el
    // gate de la IA para todos los pacientes, rompiendo su §13.
    expect(MENU).toContain("prescripcion.limites.concat");
  });

  it("la página la computa y se la pasa al panel", () => {
    expect(PAGE).toContain("getPrescripcionNutricional(");
    expect(PAGE).toContain("prescripcion={prescripcionNutricional}");
  });
});

describe("lo que NO se conectó, y es deliberado", () => {
  it("las cifras calóricas del motor NO se muestran: su fórmula de gasto difiere de la cadena", () => {
    // `motorTratNutri` usa Mifflin siempre sobre el peso meta; la cadena que el profesional edita usa
    // Cunningham cuando hay masa libre de grasa, que es siempre (medimos bioimpedancia). El lo nombro y
    // dijo "no lo cambien ahora". Mostrar las dos seria repetir el defecto que esto cierra: dos numeros del
    // mismo concepto en la misma pantalla. Esta preguntado en la ronda del 31.
    expect(READER, "se filtraron las kcal del otro motor a la pantalla").not.toContain("kcalObjetivo:");
    expect(READER).not.toContain("geb:");
  });

  it("CONTROL: el motor SÍ calcula esas cifras; lo que se decide es no mostrarlas", () => {
    // Sin este control, el test de arriba pasaria verde tambien si el motor hubiera dejado de calcularlas,
    // que seria haberlo roto en vez de haber decidido algo.
    const m = motorTratNutri(HIPERTENSO, BIS, {}) as { kcalObjetivo: number; geb: number };
    expect(m.kcalObjetivo).toBeGreaterThan(0);
    expect(m.geb).toBeGreaterThan(0);
  });
});
