import { readFileSync } from "node:fs";
import { sinComentarios } from "./helpers/sin-comentarios";
import { describe, expect, it } from "vitest";

import {
  activeWarnings,
  computeContraindicated,
} from "@/modules/bis-intake/services/contraindication";
import { evaluateBisImportGate } from "@/modules/bis-intake/services/import-gate";
import { buildValidityCaveats } from "@/modules/bis-intake/services/validity";
import type { BisCondition, BisConditionCatalog, BisIntakeRecord } from "@/modules/bis-intake/types";
import {
  type SaveBisConditionsInput,
  validateBisConditionsCapture,
} from "@/modules/bis-intake/validations";

// Catalogo de prueba fiel a la v1 (subconjunto suficiente): generales + validez + femeninas.
const CONDS: BisCondition[] = [
  { key: "placas_metalicas", label: "Placas", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, compromisesValidity: false, orderIndex: 1 },
  { key: "marcapasos", label: "Marcapasos", scope: "general", kind: "contraindicacion", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, compromisesValidity: false, orderIndex: 2 },
  { key: "diuretico", label: "Diuretico", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "¿Cual?", detailType: "text", compromisesValidity: false, orderIndex: 3 },
  { key: "edema_anasarca", label: "Edema o anasarca", scope: "general", kind: "validez", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, compromisesValidity: true, orderIndex: 4 },
  { key: "embarazo", label: "Embarazo", scope: "mujeres", kind: "advertencia", inputType: "boolean", requiresDetail: true, detailLabel: "Mes de gestacion", detailType: "number", compromisesValidity: true, orderIndex: 5 },
  { key: "menstruacion", label: "Menstruacion", scope: "mujeres", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "Dia del periodo", detailType: "number", compromisesValidity: false, orderIndex: 6 },
  { key: "semana_ciclo", label: "Semana del ciclo", scope: "mujeres", kind: "calidad", inputType: "number", requiresDetail: false, detailLabel: null, detailType: null, compromisesValidity: false, orderIndex: 7 },
];
const CATALOG: BisConditionCatalog = { versionId: "v1", versionNumber: 1, conditions: CONDS };
const NOW = "2026-07-24T12:00:00.000Z";

// Respuestas validas del bloque general (base para variar el caso bajo prueba).
function generalAnswers(marcapasos: boolean): SaveBisConditionsInput["answers"] {
  return {
    placas_metalicas: { value: false },
    marcapasos: { value: marcapasos },
    diuretico: { value: false },
    edema_anasarca: { value: false },
  };
}

describe("computeContraindicated (compuerta de seguridad)", () => {
  it("marca contraindicacion solo con booleano estricto true en una condicion contraindicacion", () => {
    expect(computeContraindicated(CONDS, { marcapasos: { value: true } })).toBe(true);
    expect(computeContraindicated(CONDS, { marcapasos: { value: false } })).toBe(false);
    expect(computeContraindicated(CONDS, {})).toBe(false);
  });

  it("un numero o texto NO dispara la compuerta (=== true, no truthy)", () => {
    // Aunque una condicion contraindicacion recibiera un numero/texto (truthy), no bloquea.
    expect(computeContraindicated(CONDS, { marcapasos: { value: 3 } })).toBe(false);
    expect(computeContraindicated(CONDS, { semana_ciclo: { value: 3 } })).toBe(false);
  });

  it("activeWarnings devuelve las advertencias respondidas true", () => {
    const w = activeWarnings(CONDS, { embarazo: { value: true } });
    expect(w.map((c) => c.key)).toEqual(["embarazo"]);
    expect(activeWarnings(CONDS, { embarazo: { value: false } })).toEqual([]);
  });
});

describe("validateBisConditionsCapture", () => {
  it("acepta el bloque general completo y computa contraindicated", () => {
    const okRes = validateBisConditionsCapture(CATALOG, { evaluationId: "e", answers: generalAnswers(true) }, NOW, false);
    expect(okRes.ok).toBe(true);
    if (okRes.ok) expect(okRes.value.contraindicated).toBe(true);

    const noRes = validateBisConditionsCapture(CATALOG, { evaluationId: "e", answers: generalAnswers(false) }, NOW, false);
    expect(noRes.ok && noRes.value.contraindicated).toBe(false);
  });

  it("exige que el bloque general este completo (el femenino es opcional)", () => {
    const res = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { placas_metalicas: { value: false }, marcapasos: { value: false } } },
      NOW,
      false,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fields?.diuretico).toBeDefined();
  });

  it("con paciente mujer, las si/no femeninas son obligatorias; la semana (numero) no", () => {
    // Solo el bloque general (omite las femeninas). Con patientIsFemale=true, embarazo y
    // menstruacion (si/no) faltan -> error; semana_ciclo (numero) es opcional -> sin error.
    const res = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: generalAnswers(false) },
      NOW,
      true,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.fields?.embarazo).toBeDefined();
      expect(res.error.fields?.menstruacion).toBeDefined();
      expect(res.error.fields?.semana_ciclo).toBeUndefined();
    }
  });

  it("valida el rango 1-6 de semana_ciclo y no lo trata como booleano", () => {
    const good = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), semana_ciclo: { value: 3 } } },
      NOW,
      false,
    );
    expect(good.ok).toBe(true);
    const bad = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), semana_ciclo: { value: 9 } } },
      NOW,
      false,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.fields?.semana_ciclo).toBeDefined();
  });

  it("advertencia (embarazo) en true exige reconocimiento explicito y lo sella con timestamp", () => {
    const sinAck = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), embarazo: { value: true, detail: 5 } } },
      NOW,
      false,
    );
    expect(sinAck.ok).toBe(false);
    if (!sinAck.ok) expect(sinAck.error.fields?.embarazo).toBeDefined();

    const conAck = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), embarazo: { value: true, detail: 5, acknowledged: true } } },
      NOW,
      false,
    );
    expect(conAck.ok).toBe(true);
    if (conAck.ok) {
      expect(conAck.value.answers.embarazo?.acknowledgedAt).toBe(NOW);
      expect(conAck.value.answers.embarazo?.detail).toBe(5);
      expect(conAck.value.warnings).toContain("embarazo");
    }
  });

  it("mes de gestacion: valida 1-9 (el mes 10 no existe) con mensaje con contexto", () => {
    const res = validateBisConditionsCapture(
      CATALOG,
      {
        evaluationId: "e",
        answers: {
          ...generalAnswers(false),
          embarazo: { value: true, detail: 10, acknowledged: true },
          menstruacion: { value: false },
        },
      },
      NOW,
      true,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fields?.embarazo).toContain("entre 1 y 9");
  });

  it("mes de gestacion vacio: el mensaje dice que falta, no un rango tecnico", () => {
    const res = validateBisConditionsCapture(
      CATALOG,
      {
        evaluationId: "e",
        answers: {
          ...generalAnswers(false),
          embarazo: { value: true, acknowledged: true },
          menstruacion: { value: false },
        },
      },
      NOW,
      true,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.fields?.embarazo).toMatch(/Ingresa/);
      expect(res.error.fields?.embarazo).not.toContain("1-");
    }
  });

  it("marcapasos + embarazo (con mes y reconocimiento) guarda limpio y queda contraindicado", () => {
    // El caso raro del smoke era el mes vacio disparando la validacion, no un conflicto entre las
    // dos condiciones: con el mes lleno, guarda y queda contraindicado (por el marcapasos).
    const res = validateBisConditionsCapture(
      CATALOG,
      {
        evaluationId: "e",
        answers: {
          ...generalAnswers(true),
          embarazo: { value: true, detail: 5, acknowledged: true },
          menstruacion: { value: false },
        },
      },
      NOW,
      true,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.contraindicated).toBe(true);
  });

  it("exige el detalle del diuretico cuando es true y lo sella como texto", () => {
    const sinDetalle = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), diuretico: { value: true } } },
      NOW,
      false,
    );
    expect(sinDetalle.ok).toBe(false);

    const conDetalle = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), diuretico: { value: true, detail: "Furosemida" } } },
      NOW,
      false,
    );
    expect(conDetalle.ok).toBe(true);
    if (conDetalle.ok) expect(conDetalle.value.answers.diuretico?.detail).toBe("Furosemida");
  });

  it("rechaza respuestas a condiciones que no existen en el catalogo", () => {
    const res = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), inventada: { value: true } } },
      NOW,
      false,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fields?.inventada).toBeDefined();
  });
});

describe("validez (no bloquea, no exige reconocimiento, sella caveat)", () => {
  it("una condicion validez respondida si NO dispara la contraindicacion", () => {
    // edema_anasarca es kind='validez'; aunque sea true, no bloquea el import.
    expect(computeContraindicated(CONDS, { edema_anasarca: { value: true } })).toBe(false);
  });

  it("validez NO exige reconocimiento (a diferencia del embarazo)", () => {
    const res = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), edema_anasarca: { value: true } } },
      NOW,
      false,
    );
    expect(res.ok).toBe(true); // sin checkbox, se guarda igual
  });

  it("buildValidityCaveats sella las que comprometen validez respondidas si (validez + embarazo)", () => {
    const caveats = buildValidityCaveats(CONDS, {
      edema_anasarca: { value: true },
      embarazo: { value: true, detail: 5, acknowledgedAt: NOW },
      marcapasos: { value: true }, // contraindicacion, no compromete validez -> no entra
      placas_metalicas: { value: true }, // calidad -> no entra
    });
    expect(caveats.map((c) => c.key).sort()).toEqual(["edema_anasarca", "embarazo"]);
  });

  it("sin condiciones que comprometan validez, no hay caveats", () => {
    expect(buildValidityCaveats(CONDS, { placas_metalicas: { value: true } })).toEqual([]);
  });
});

describe("evaluateBisImportGate (orden + seguridad del import)", () => {
  const intake = (over: Partial<BisIntakeRecord>): BisIntakeRecord => ({
    versionId: "v1",
    answers: {},
    contraindicated: false,
    gripStrengthKg: null,
    weightGoalKg: null,
    updatedAt: NOW,
    ...over,
  });

  it("sin captura de condiciones NO habilita el import (orden impuesto por el sistema)", () => {
    const g = evaluateBisImportGate(null);
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.reason).toBe("conditions_missing");
  });

  it("con contraindicacion (marcapasos) bloquea el import", () => {
    const g = evaluateBisImportGate(intake({ contraindicated: true }));
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.reason).toBe("contraindicated");
  });

  it("con condiciones respondidas y sin contraindicacion habilita el import", () => {
    expect(evaluateBisImportGate(intake({})).allowed).toBe(true);
  });
});

describe("las medidas del profesional se muestran donde él las pone (DIV-18, cotejo 4)", () => {
  const RESUMEN = readFileSync(
    "src/modules/bis-intake/components/medidas-del-profesional-resumen.tsx",
    "utf8",
  );
  const CAPTURA = readFileSync(
    "src/modules/bis-intake/components/bis-conditions-capture.tsx",
    "utf8",
  );
  const ENTRADA = readFileSync(
    "src/modules/evaluations/components/entrada-evaluacion.tsx",
    "utf8",
  );
  const READER = readFileSync("src/modules/bis-intake/data/bis-conditions-reader.ts", "utf8");

  it("el enlace cae en el BLOQUE, no en la subpestaña entera", () => {
    // Su cuidado (a). Un enlace a la subpestaña deja al profesional buscando los dos campos entre las
    // condiciones. Y lleva la ETAPA explícita, que es la lección del punto 5 de este mismo cotejo: sin
    // ella la página cae a su default.
    expect(RESUMEN).toContain("?etapa=evaluacion&ev=encuesta#medidas-del-profesional");
    expect(CAPTURA, "el ancla de destino desapareció del bloque").toContain(
      'id="medidas-del-profesional"',
    );
  });

  it("y se ve que aquí son de solo lectura, sin campos deshabilitados", () => {
    // Su cuidado (b). Un input deshabilitado se lee como "esto debería poder tocarse"; una lista de
    // datos con su enlace dice dónde se editan. Por eso el resumen no monta inputs.
    expect(RESUMEN).toContain("Aquí solo se consultan");
    expect(sinComentarios(RESUMEN), "el resumen montó campos: se leería como editable").not.toMatch(
      /<(input|Input|textarea|Textarea)\b/,
    );
  });

  it("y el peso meta llega TAMBIÉN en la vista sellada", () => {
    // La mitad silenciosa del mismo dato: la vista de solo lectura (después del diagnóstico) traía la
    // prensil y no el peso meta, así que el resumen habría dicho "Sin registrar" sobre un valor que
    // existe. Es el campo que deja de viajar, en el camino que menos se mira.
    expect(READER).toContain("weightGoalKg: intake.weightGoalKg");
    expect(ENTRADA).toContain("bisReadonly?.weightGoalKg");
  });
});

describe("las superficies que el smoke encontró faltando (2026-09-05)", () => {
  const ENTRADA = readFileSync(
    "src/modules/evaluations/components/entrada-evaluacion.tsx",
    "utf8",
  );
  const FORM = readFileSync("src/modules/bis/components/bis-import-form.tsx", "utf8");
  const RESUMEN = readFileSync(
    "src/modules/bis-intake/components/medidas-del-profesional-resumen.tsx",
    "utf8",
  );

  it("con medición y SIN diagnóstico hay por dónde reemplazar el archivo", () => {
    // EL DEFECTO: el portón del reimport se movió a "¿ya hay diagnóstico?" y este panel seguía ocultando
    // el formulario en cuanto había medición, que era correcto cuando reimportar era imposible. El guard
    // quedó construido y sin superficie que llegara a él. Es la pieza sin su último cable, y esta vez en
    // lo recién hecho: un guard que nadie puede ejercitar no es un guard, es código muerto que además
    // hace creer que el caso está cubierto.
    expect(ENTRADA, "no hay superficie de reemplazo").toContain("modoReemplazo");
    expect(ENTRADA, "la superficie no está acotada a antes del diagnóstico").toContain(
      "!diagnosticoGenerado && bisImportEval",
    );
    // Y el formulario tiene que RENDERIZARSE aunque ya haya medición cuando está en ese modo.
    expect(FORM).toContain("&& !modoReemplazo");
  });

  it("y el texto dice que REEMPLAZA, no que añade", () => {
    // Sin esto el profesional puede creer que se suma una segunda medición, que es lo que el writer
    // impide: la anterior se borra en la misma transacción.
    expect(FORM).toContain("Esto reemplaza la medición actual");
    expect(FORM).toContain("Reemplazar la medición");
  });

  it("y el enlace de editar desaparece cuando los valores están sellados", () => {
    // Un enlace que promete editar y no deja editar es peor que no tenerlo: manda al profesional a buscar
    // un campo que no existe y a concluir que el sistema está roto.
    expect(RESUMEN).toContain("sellada ? null : (");
    expect(RESUMEN).toContain("Quedaron selladas con el diagnóstico");
    expect(ENTRADA).toContain("sellada={diagnosticoGenerado}");
  });
});
