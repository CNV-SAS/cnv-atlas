import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LA SEPARACION DE LA CADENA CALORICA en sus dos bloques (§8.1, 2026-08-26 Parte 2).
//
// LO QUE FIJA, y es una decision suya que va contra la nuestra: habiamos propuesto FUNDIR el objetivo y la
// cadena en un solo bloque, y dijo que no. Su razon no es estetica, es de ORDEN DE TRABAJO:
//
//   "La formula desarrollada depende de la decision del nutricionista de subir o bajar las calorias.
//    PRIMERO SE DECIDE LA META; DESPUES SE VE LA CADENA QUE LA PRODUCE. Fundirlas invierte el orden y
//    empuja al profesional a mover la calculadora cuando lo que queria era fijar un objetivo."
//
// Por eso el candado no mira "que haya dos secciones" y ya: mira que el OBJETIVO se edite en la de la meta
// y NO en la de la formula, que es donde la fusion volveria a colarse sin que se note.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

/** Trozo del panel entre dos marcas, para poder preguntar por CADA bloque y no por el archivo entero. */
function bloque(desde: string, hasta: string): string {
  const i = PANEL.indexOf(desde);
  const j = PANEL.indexOf(hasta, i + 1);
  expect(i, `no encuentro el bloque que empieza en "${desde}"`).toBeGreaterThan(-1);
  expect(j, `no encuentro el fin del bloque "${desde}"`).toBeGreaterThan(i);
  return PANEL.slice(i, j);
}

const META = () => bloque("<h3 className={tituloBloqueCls(\"decision\")}>Objetivo del plan", "BLOQUE 2");
const FORMULA = () => bloque("BLOQUE 2", "Un solo boton para los dos bloques");

describe("la cadena calórica va en DOS bloques, no en uno", () => {
  it("existen los dos, y en el orden que él fijó: primero la meta", () => {
    const meta = PANEL.indexOf("Objetivo del plan");
    const formula = PANEL.indexOf("Cómo se llega a ese objetivo");
    expect(meta).toBeGreaterThan(-1);
    expect(formula).toBeGreaterThan(-1);
    // El orden ES la instrucción: "primero se decide la meta, después se ve la cadena que la produce".
    expect(meta).toBeLessThan(formula);
  });

  it("el peso meta y el objetivo se EDITAN en el bloque de la meta", () => {
    expect(META()).toContain('name="adjPesoMeta"');
    expect(META()).toContain('name="adjKcalObj"');
  });

  it("y el objetivo NO se edita en el de la fórmula: ahí va en lectura", () => {
    // Es su instrucción literal para el dato que aparece en los dos bloques: "editable en uno solo y en
    // lectura en el otro". Un segundo input aquí es exactamente la fusión volviendo por la puerta de atrás.
    expect(FORMULA()).not.toContain('name="adjKcalObj"');
    expect(FORMULA()).toContain('label="Objetivo calórico"');
    expect(FORMULA()).toContain('tag="lo fijas arriba"');
  });

  it("la fórmula lleva GEB, PAL y el cuadre de macros", () => {
    // Los tres beneficios que pedimos y él concedió SIN fundir: el cuadre de macros va en el bloque de la
    // fórmula, no en el de la meta.
    for (const marca of ['name="adjGeb"', 'name="adjPal"', 'name="adjProtGkg"', 'name="adjFatPct"']) {
      expect(FORMULA()).toContain(marca);
    }
    expect(FORMULA()).toContain("Reparto de macronutrientes");
    expect(FORMULA()).toContain("Carbohidratos");
    // Y el cuadre en sí: la suma de los tres contra el objetivo.
    expect(FORMULA()).toContain("Suma de los tres");
  });

  it("la distinción entre CALCULADO y AJUSTADO está visible en la meta", () => {
    // El otro beneficio concedido. Sin esto el profesional no sabe si el número que ve lo puso él o el
    // modelo, que es justo lo que le hace falta para decidir si moverlo.
    expect(META()).toContain("fijado por ti");
    expect(META()).toContain("sugerido por el modelo");
  });
});

describe("se partió la PRESENTACIÓN, no el guardado", () => {
  it("hay UN solo formulario y UN solo botón para los dos bloques", () => {
    // Los seis ajustes son una columna cada uno pero UNA unidad clínica: `saveAdjustments` las escribe de
    // golpe y `adjustmentSignature` cubre las seis. Partir el guardado obligaría a dos firmas sobre las
    // mismas columnas, y un guardado parcial dejaría que la cadena de un profesional pisara la meta de
    // otro. Si alguien parte el form, esto truena antes de que ese defecto llegue a un paciente.
    const seccion = bloque("function CadenaCaloricaSection", "export function TreatmentPanel");
    expect((seccion.match(/<form /g) ?? []).length).toBe(1);
    expect((seccion.match(/type="submit"/g) ?? []).length).toBe(1);
    expect((seccion.match(/name="baseSignature"/g) ?? []).length).toBe(1);
  });

  it("los seis ajustes siguen viajando juntos en ese único formulario", () => {
    const seccion = bloque("function CadenaCaloricaSection", "export function TreatmentPanel");
    for (const n of ["adjPesoMeta", "adjGeb", "adjPal", "adjKcalObj", "adjProtGkg", "adjFatPct"]) {
      expect(seccion, `falta ${n} en el formulario de la cadena`).toContain(`name="${n}"`);
    }
  });
});

describe("el desliz del doble nombre del factor de actividad", () => {
  it("Atlas dice PAL en los dos sitios; nunca 'Actividad prescrita (FA)'", () => {
    // §8.1: "«Actividad prescrita (FA)» y «Factor actividad (PAL)» son el mismo factor con dos nombres.
    // Unifíquenlo en el suyo." El desliz es de SU archivo, no del nuestro: Atlas siempre dijo PAL, y él nos
    // manda conservarlo. El candado impide que el doble nombre entre al portar otra pieza suya.
    expect(PANEL).not.toContain("Actividad prescrita");
    expect(PANEL).not.toContain("(FA)");
    expect(PANEL).toContain('label="PAL (factor)"');
    expect(PANEL).toContain("Nivel de actividad física (PAL)");
  });
});
