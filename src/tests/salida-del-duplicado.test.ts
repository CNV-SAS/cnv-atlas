import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// TODA PANTALLA QUE BLOQUEA TIENE QUE TENER SALIDA (Santiago, 2026-09-10).
//
// EL DEFECTO: al crear un paciente parecido a otro salía el bloque de posible duplicado, con su porcentaje
// de similitud y un botón de confirmar. Pero NO había forma de decir "no es la misma persona", y sin
// confirmar la evaluación se queda en borrador: las condiciones BIS no aparecen y no se puede seguir. Con
// una coincidencia falsa, el flujo se quedaba sin salida.
//
// Y LO QUE SE VERIFICÓ ANTES DE CONSTRUIR CAMBIÓ EL DISEÑO: **confirmar no fusiona nada**.
// `confirmEvaluationIdentity` hace tres cosas (el muro del consentimiento, draft -> in_progress y
// auditar) y no toca a los candidatos. El botón nunca significó "es la misma persona"; el texto le
// atribuía una consecuencia que no tiene, y esa atribución era la que creaba el callejón.
//
// POR ESO ESTE CANDADO MIRA DOS COSAS: que confirmar SIGA sin fusionar (si algún día fusionara, el botón
// tendría que decirlo, porque no se puede deshacer) y que la salida exista y deje rastro.

const WRITER = readFileSync("src/modules/evaluations/data/evaluations-writer.ts", "utf8");
const ACCION = readFileSync("src/modules/evaluations/actions.ts", "utf8");
const PANTALLA = readFileSync(
  "src/modules/evaluations/components/identity-confirmation.tsx",
  "utf8",
);

describe("confirmar identidad NO fusiona pacientes", () => {
  it("el writer no escribe en `patients` ni mueve nada de un paciente a otro", () => {
    // SI ESTO SE PONE ROJO, no basta con ajustar el candado: hay que decirlo EN EL BOTÓN, porque una
    // fusión no se puede deshacer y hoy el profesional pulsa creyendo que solo sigue adelante.
    const cuerpo = sinComentarios(
      WRITER.slice(
        WRITER.indexOf("export async function confirmEvaluationIdentity"),
        WRITER.indexOf("export type AbandonEvaluationInput"),
      ),
    );
    expect(cuerpo, "confirmar identidad empezó a escribir en patients").not.toContain(
      "update(patients)",
    );
    expect(cuerpo, "confirmar identidad empezó a borrar algo").not.toContain("delete(");
    // Lo único que cambia de estado es la evaluación.
    expect(cuerpo).toContain('.set({ status: "in_progress" })');
  });
});

describe("hay salida cuando NO es la misma persona", () => {
  it("el botón dice qué decide, no solo que confirma", () => {
    expect(PANTALLA).toContain("No es la misma persona · continuar");
  });

  it("y el texto ya no manda a un callejón", () => {
    // Decía "Confirma solo si es la misma persona", que con una coincidencia falsa deja al profesional
    // sin nada que pulsar. Y era falso además: confirmar no tiene nada que ver con el duplicado.
    expect(sinComentarios(PANTALLA), "volvió la instrucción que dejaba sin salida").not.toContain(
      "Confirma solo si es la misma",
    );
  });

  it("el descarte QUEDA REGISTRADO, con quién y con qué candidatos", () => {
    // Una decisión de identidad sin rastro es una que nadie puede revisar después: si mañana resulta que
    // sí era la misma persona, lo primero que se pregunta es quién miró y cuándo.
    expect(PANTALLA).toContain('name="descartados"');
    expect(ACCION).toContain("duplicadosDescartados");
    expect(WRITER).toContain('event: "evaluation.duplicate_dismissed"');
  });

  it("y va INLINE en la transacción, nunca por el bus (regla dura 8)", () => {
    const cuerpo = WRITER.slice(WRITER.indexOf("export async function confirmEvaluationIdentity"));
    const iTx = cuerpo.indexOf("db.transaction");
    const iAudit = cuerpo.indexOf('event: "evaluation.duplicate_dismissed"');
    expect(iTx).toBeGreaterThan(-1);
    expect(iAudit, "el descarte se audita fuera de la transacción").toBeGreaterThan(iTx);
  });

  it("con el SCORE de cada candidato, no solo su id", () => {
    // Dentro de un año, saber si la coincidencia era del 55% o del 95% es lo que dice si la decisión fue
    // fácil o difícil.
    expect(WRITER).toContain("score: d.score");
  });

  it("y el caso contrario se DICE, en vez de ofrecer un botón que finja resolverlo", () => {
    // Atlas no fusiona pacientes. Si de verdad es la misma persona, quedó registrada dos veces con
    // documentos distintos: lo honesto es decir qué pasa y qué no hacer.
    expect(PANTALLA).toContain("¿Sí es la misma persona?");
    expect(PANTALLA).toMatch(/no puede unir dos pacientes/);
  });
});
