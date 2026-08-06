import { describe, expect, it } from "vitest";

import { resolvePatron, type PatronAnswer } from "@/clinical-engine/patron";
import { FREQ_OPC, FREQ_SUP } from "@/clinical-engine/frozen/engine.patron.js";

// Los cuatro estados del reader del patron. La clave: separar "no respondio" (dato faltante) de "no lo
// entendi" (defecto), y no mostrar un score sobre datos incompletos o vacios.

const GROUPS = Array.from({ length: 15 }, (_, i) => `d1_${i + 1}_i`);
const HORARIOS = ["d1f_sal_i", "d1f_des_i", "d1f_noche_i"];
const DECLARED = [...GROUPS, ...HORARIOS];

// Responde un grupo con un ordinal, via el TEXTO canonico de FREQ_OPC (como lo guarda el intake).
const ans = (fieldKey: string, ordinal: number): PatronAnswer => ({ fieldKey, answerValue: FREQ_OPC[ordinal] });

// Caso "Optimo" del golden: protectores(1-7) y neutros(8,9,10,15) en 4, riesgo(11-14) en 0.
function optimoAnswers(): PatronAnswer[] {
  const out: PatronAnswer[] = [];
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15]) out.push(ans(`d1_${n}_i`, 4));
  for (const n of [11, 12, 13, 14]) out.push(ans(`d1_${n}_i`, 0));
  return out;
}

describe("resolvePatron: los cuatro estados", () => {
  it("no_capturado: la version no declara field_keys de patron (anterior a C9)", () => {
    expect(resolvePatron([], [])).toEqual({ status: "no_capturado" });
    // declara solo campos que NO son de patron -> tampoco captura
    expect(resolvePatron(["d5_39", "d3_23"], [])).toEqual({ status: "no_capturado" });
  });

  it("sin_respuestas: declara patron pero no respondio ningun grupo (no muestra 'Deficiente')", () => {
    expect(resolvePatron(DECLARED, [])).toEqual({ status: "sin_respuestas" });
    // responder SOLO un horario no cuenta como grupo -> sigue sin_respuestas
    const soloHorario: PatronAnswer[] = [{ fieldKey: "d1f_sal_i", answerValue: FREQ_SUP[0].opts[1] }];
    expect(resolvePatron(DECLARED, soloHorario)).toEqual({ status: "sin_respuestas" });
  });

  it("ok: responde al menos un grupo -> calcPatron (caso Optimo = score 82)", () => {
    const r = resolvePatron(DECLARED, optimoAnswers());
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.respondidos).toBe(15);
      expect(r.patron.score).toBe(82);
      expect(r.patron.nivel.l).toBe("Óptimo");
      expect(r.grupos).toHaveLength(15); // los 15 para la grilla
      expect(r.grupos.every((g) => g.ordinal !== null)).toBe(true);
    }
  });

  it("ilegible: una respuesta no coincide con la opcion canonica (un guion cambiado) -> defecto, SIN score", () => {
    const answers = optimoAnswers();
    // d1_3_i respondido con guion normal "1-2 días" en vez del en-dash "1–2 días": no coincide.
    const bad = answers.find((a) => a.fieldKey === "d1_3_i")!;
    bad.answerValue = "1-2 días";
    const r = resolvePatron(DECLARED, answers);
    expect(r.status).toBe("ilegible");
    if (r.status === "ilegible") {
      expect(r.offenders).toContainEqual({ fieldKey: "d1_3_i", value: "1-2 días" });
      // los otros 14 grupos SI se leyeron (grupos con ordinal != null); d1_3_i quedo en null
      expect(r.grupos.filter((g) => g.ordinal !== null).length).toBe(14);
      expect(r.grupos.find((g) => g.n === 3)?.ordinal).toBe(null);
      expect(r).not.toHaveProperty("patron"); // no se calcula el score sobre datos incompletos
    }
  });

  it("grupo sin responder va a -1, NO a ilegible: ausente es dato faltante, no defecto", () => {
    const answers = optimoAnswers().filter((a) => a.fieldKey !== "d1_1_i"); // 14 grupos, d1_1_i ausente
    const r = resolvePatron(DECLARED, answers);
    expect(r.status).toBe("ok"); // no es ilegible
    if (r.status === "ok") expect(r.respondidos).toBe(14);
  });

  it("una respuesta vacia ('') tampoco es ilegible: es no-respondida", () => {
    const answers = [...optimoAnswers(), { fieldKey: "d1f_sal_i", answerValue: "" }];
    const r = resolvePatron(DECLARED, answers);
    expect(r.status).toBe("ok");
  });
});
