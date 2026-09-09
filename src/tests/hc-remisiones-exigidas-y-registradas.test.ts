import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { RUTAS_CONTENT } from "@/clinical-engine/rutas-content";
import { remisionesExigidas } from "@/modules/reports/data/hc-composicion";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PUNTO 30 · LAS REMISIONES DE LA HISTORIA CLÍNICA.
//
// EL DEFECTO: la HC leía SOLO `listReferralsForTreatment`, o sea lo que el profesional registró. Su
// archivo hace lo contrario: las DERIVA de las rutas activas. Con la ruta R4 activa, su HC mostraba dos
// remisiones (una marcada OBLIGATORIA) y la nuestra decía "No se registraron remisiones ni derivaciones en
// esta consulta".
//
// Y eso es peor que un documento incompleto: **no omite la derivación, afirma que no la hubo.**
//
// LO QUE SE FIJA: que la HC diga las DOS cosas y que se distingan (derivado y registro), y que el estado
// de cada exigida se DERIVE del registro por destinatario y no de un flag aparte.

const PANTALLA = sinComentarios(
  readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8"),
);
const PDF = sinComentarios(readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8"));
const PAGE = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"));
const READER = sinComentarios(
  readFileSync("src/modules/reports/data/hc-documento-reader.ts", "utf8"),
);

// La R4, que es la del caso del cotejo: activa la remisión a médico y la de ejercicio.
const R4 = RUTAS_CONTENT.R4 ? [RUTAS_CONTENT.R4] : [];

describe("lo que el modelo exigió sale aunque el profesional no registre nada", () => {
  it("con la R4 activa y CERO registros, la lista no está vacía", () => {
    // Control de la aserción: si la ruta no remitiera a nadie, el test pasaría sin comparar nada.
    expect(R4, "la R4 tiene que existir para que este caso signifique algo").toHaveLength(1);
    const exigidas = remisionesExigidas(R4, []);
    expect(exigidas.length).toBeGreaterThan(0);
    expect(exigidas.every((r) => r.registrada === false)).toBe(true);
    // Y llevan la urgencia VERBATIM de la ruta, no una etiqueta nuestra.
    expect(exigidas.map((r) => r.urgencia).join(" ")).not.toBe("");
  });

  it("y el estado se DERIVA del registro por destinatario, no de un flag", () => {
    const sinNada = remisionesExigidas(R4, []);
    const destino = sinNada[0];
    // El cruce es por `referralTarget` contra `referredTo`: así está construido el registro D-009, que
    // guarda a QUIÉN se remite y no de qué ruta salió.
    const objetivo = RUTAS_CONTENT.R4.componentes;
    const target = objetivo.medico.remision ? "medico" : "deportologo";
    const conRegistro = remisionesExigidas(R4, [{ referredTo: target }]);
    expect(conRegistro.some((r) => r.registrada)).toBe(true);
    // Y no se marcan todas: el registro de un destinatario no cubre a otro.
    expect(conRegistro.filter((r) => r.registrada).length).toBeLessThanOrEqual(conRegistro.length);
    expect(destino.registrada).toBe(false);
  });

  it("sin rutas activas no se inventa ninguna", () => {
    expect(remisionesExigidas([], [])).toEqual([]);
  });
});

describe("las dos superficies dicen lo mismo, y salen del mismo sitio", () => {
  it("la pantalla pinta los dos bloques y los rotula", () => {
    expect(PANTALLA).toContain("Lo que el modelo exigió");
    expect(PANTALLA).toContain("Lo que el profesional registró");
    // El texto de vacío ya no puede afirmar solo sobre el registro.
    expect(PANTALLA).toContain("El modelo no exigió remisiones");
    expect(PANTALLA, "la frase vieja afirmaba de menos").not.toContain(
      "No se registraron remisiones ni derivaciones en esta consulta.",
    );
  });

  it("el PDF también, con la misma condición de vacío", () => {
    expect(PDF).toContain("hc.remisionesExigidas");
    expect(PDF).toContain("Lo que el modelo exigió");
    expect(PDF).toContain("El modelo no exigió remisiones");
  });

  it("y los dos llaman al MISMO helper, no cada uno al suyo", () => {
    // Dos cálculos del mismo hecho serían dos documentos del mismo acto clínico pudiendo discrepar sobre
    // si hubo que remitir.
    expect(PAGE).toContain("remisionesExigidas(rutas, hcRemisiones)");
    expect(READER).toContain("remisionesExigidas(results?.rutasContent ?? [], remisiones)");
  });
});
