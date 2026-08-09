import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Candado del mensaje de la salvaguarda de TCA (CA-2, enmienda 2 a D-002). El que CORRE es el
// atlas-tratamiento.authorized.js. Gildardo (§5): la salvaguarda ALERTA, no bloquea; avisa con marca de
// remision y el peso meta acordado sigue gobernando el calculo. El mensaje viejo AFIRMABA que el modulo
// "PAUSA la restriccion calorica" (ademas de mentir: en Atlas nada consume tcaFlag en la cadena calorica,
// el deficit no se anula). Este test truena si el texto viejo reaparece o el corregido desaparece.

const authorized = readFileSync(
  "src/clinical-engine/frozen/atlas-tratamiento.authorized.js",
  "utf8",
);

describe("salvaguarda de TCA: el mensaje dice lo que SI pasa (alerta, no bloqueo)", () => {
  it("el authorized (el que corre) YA NO dice que pausa la restriccion calorica", () => {
    expect(authorized).not.toContain("PAUSA la restricción calórica");
    expect(authorized).not.toContain("Salvaguarda activa");
  });
  it("dice alerta + remision + que el peso meta sigue gobernando (el plan no se bloquea)", () => {
    expect(authorized).toContain("Alerta de conducta alimentaria");
    expect(authorized).toContain("El plan no se bloquea");
    expect(authorized).toContain("el peso meta acordado sigue gobernando");
  });
  it("el ORIGINAL queda intacto (byte-identico a Gildardo): aun trae el texto viejo", () => {
    // La correccion vive en el manifiesto, no en el original; el original conserva su byte-identidad
    // (lo prueba frozen-tratamiento-diff). Aqui se documenta el contraste.
    const original = readFileSync("src/clinical-engine/frozen/atlas-tratamiento.js", "utf8");
    expect(original).toContain("PAUSA la restricción calórica");
  });
});
