import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Candado del mensaje de la salvaguarda de TCA.
//
// NACIO COMO CANDADO DE CA-2 Y AHORA ES UN CANDADO DE PORTE, porque CA-2 SE RETIRO el 2026-08-29:
// Gildardo absorbio la correccion en su propio archivo, con sus palabras. Mientras fue nuestra, la
// divergencia vivia en el manifiesto y el original conservaba su texto viejo; ahora el texto correcto es
// EL SUYO y va en el original, asi que ya no hay nada que generar y el `.authorized.js` se retiro.
//
// El fondo no cambia y por eso el candado sigue: el mensaje viejo AFIRMABA que el modulo "PAUSA la
// restriccion calorica", y ademas mentia (nada consume tcaFlag en la cadena calorica de Atlas: el deficit
// no se anula). Un texto que describe mal lo que hace el motor es un defecto de seguridad, no de
// redaccion. Esto truena si el texto viejo reaparece o el corregido desaparece.

const motor = readFileSync("src/clinical-engine/frozen/atlas-tratamiento.js", "utf8");

describe("salvaguarda de TCA: el mensaje dice lo que SÍ pasa (alerta, no bloqueo)", () => {
  it("ya no dice que pausa la restricción calórica", () => {
    expect(motor).not.toContain("PAUSA la restricción calórica");
    expect(motor).not.toContain("el módulo nutricional PAUSA");
  });

  it("dice que avisa, que marca remisión y que el plan NO se pausa", () => {
    // Texto suyo, del ATLAS_v8.html del 29. Se cita en piezas y no entero para que un retoque de
    // redaccion suyo no truene el candado, pero un cambio de SIGNIFICADO sí.
    expect(motor).toContain("AVISA y marca remisión");
    expect(motor).toContain("NO pausa el plan");
    expect(motor).toContain("la decisión de restringir es del profesional");
  });

  it("y el mensaje viene de SU archivo, no de una paráfrasis nuestra", () => {
    // Es lo que cambió al retirar CA-2. Antes el texto correcto era nuestro; ahora es el suyo, y esa
    // diferencia importa: sobre lo clínico manda su archivo, aunque las dos versiones dijeran lo mismo.
    const suyo = readFileSync(
      "docs/entregas/Gildardo responses/html actualizado 29 agosto/ATLAS_v8.html",
      "utf8",
    );
    const linea = /var salvaguarda=tcaFlag\?"([^"]+)"/.exec(motor);
    expect(linea, "no encuentro la línea de la salvaguarda en el motor").not.toBe(null);
    expect(suyo.includes(linea![1])).toBe(true);
  });

  it("el manifiesto ya no lleva CA-2, y deja escrito por qué", () => {
    // Una modificacion autorizada que el absorbe se RETIRA, no se deja "por si acaso": dejarla haria que
    // el generado sobrescribiera su texto con el nuestro. El manifiesto lo exige en su propia cabecera.
    const manifiesto = readFileSync(
      "src/clinical-engine/frozen/authorized-modifications.js",
      "utf8",
    );
    expect(manifiesto).not.toContain('caId: "CA-2"');
    expect(manifiesto).toContain("CA-2 RETIRADA");
  });
});
