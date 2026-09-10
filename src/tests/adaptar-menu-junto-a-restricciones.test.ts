import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PUNTO 25 DEL COTEJO (2026-09-05): el botón de adaptar el menú vive JUNTO a las
// restricciones, y eso obliga a cerrar un hazard que la distancia tapaba.
//
// LO QUE PIDIÓ SANTIAGO: unir "Adaptar el menú a las restricciones (IA)" con "Restricciones alimentarias
// del profesional", "colocando un botón al lado que diga adaptar las restricciones al menú con ayuda de
// IA". La ACCIÓN sube; las PROPUESTAS se quedan abajo, al lado de la grilla que modifican, porque los dos
// bloques hablan de cosas distintas (uno es `decision`, lo que el profesional escribe; el otro es
// `derivado`, lo que el sistema produce) y ésos son los dos niveles con los que toda la app dice quién
// decidió qué.
//
// EL HAZARD, que es la razón de la mitad de este archivo: `generateMenuAction` lee las restricciones de la
// BASE, no del formulario. Con el botón a media pantalla, la distancia hacía de guarda. Pegado al campo,
// escribir "sin lactosa" y pulsar adaptar produciría una adaptación que IGNORA lo recién escrito, sin
// decirlo. Es la familia de "dos partes de la pantalla que leen fuentes distintas": el arreglo no es
// avisar, es que no se pueda.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const SIN = sinComentarios(PANEL);

describe("el botón de adaptar vive junto a las restricciones (cotejo punto 25)", () => {
  it("el bloque de restricciones lo renderiza", () => {
    expect(SIN).toContain("{adaptar(sinGuardar)}");
    expect(SIN).toContain("<AdaptarMenuBoton");
  });

  it("y va como HERMANO del formulario, no anidado dentro", () => {
    // Un formulario dentro de otro es HTML inválido y el navegador lo desarma en silencio: el botón de
    // adaptar acabaría enviando el formulario de guardar, o al revés.
    const i = SIN.indexOf("{adaptar(sinGuardar)}");
    const cierre = SIN.lastIndexOf("</form>", i);
    expect(cierre, "el formulario de restricciones ya cerró antes del botón").toBeGreaterThan(-1);
    expect(cierre).toBeLessThan(i);
  });

  it("las PROPUESTAS se quedan en su bloque derivado, no suben con el botón", () => {
    // Si la lista subiera, un bloque de `decision` mostraría salida del sistema y el nivel dejaría de
    // significar algo.
    expect(SIN).toContain("Propuestas de la IA para el menú");
    const iLista = SIN.indexOf("<MenuCard");
    const iBoton = SIN.indexOf("{adaptar(sinGuardar)}");
    expect(iLista).toBeGreaterThan(-1);
    expect(iBoton).toBeGreaterThan(-1);
  });
});

describe("el hazard que abre acercar el botón, cerrado", () => {
  it("el botón se APAGA mientras haya restricciones sin guardar", () => {
    // No basta con avisar: la acción no puede estar disponible cuando produciría un resultado que
    // contradice lo que se ve en el campo.
    // ALCANCE AJUSTADO (2026-09-09), no la asercion. Se fijaba la linea LITERAL, y al retirar el candado
    // de la prescripcion desaparecio `locked` de la expresion (nada bloquea ya el panel). Se puso roja
    // por un termino de menos, no por la regla.
    //
    // LA REGLA, que no cambia: el boton se apaga mientras haya restricciones sin guardar. Se afirma la
    // condicion, no la lista entera de terminos.
    expect(SIN).toMatch(
      /const disabled = pending || !cadenaLista || !hayRestricciones || sinGuardar;/,
    );
  });

  it("y dice POR QUÉ, en la capa de atención y no en la clínica", () => {
    // "Mira esta cifra" es operativo. El color clínico significa un veredicto sobre una persona.
    const i = SIN.indexOf("Guarda las restricciones primero");
    expect(i, "el motivo se dice").toBeGreaterThan(-1);
    expect(SIN.slice(i - 200, i)).toContain("text-attention");
  });

  it("`sinGuardar` compara la pantalla con la base, y cuenta el campo a medio escribir", () => {
    // El caso que se olvida: una restricción tecleada y NO agregada todavía. Si no cuenta, el profesional
    // escribe, pulsa adaptar, y la adaptación no la ve.
    expect(SIN).toContain(
      'JSON.stringify(restricciones) !== JSON.stringify(protocol.restricciones) || restrInput.trim() !== ""',
    );
  });
});
