import { readFileSync } from "node:fs";
import { sinComentarios } from "./helpers/sin-comentarios";
import { describe, expect, it } from "vitest";

import {
  activeWarnings,
  computeContraindicated,
} from "@/modules/bis-intake/services/contraindication";
import { condicionesParaDiagnosticar, evaluarRequisitosDelImport } from "@/modules/bis-intake/services/import-gate";
import { buildValidityCaveats } from "@/modules/bis-intake/services/validity";
import type { BisCondition, BisConditionCatalog, BisIntakeRecord } from "@/modules/bis-intake/types";
import {
  type SaveBisConditionsInput,
  validateBisConditionsCapture,
} from "@/modules/bis-intake/validations";

// Catalogo de prueba fiel al vigente (subconjunto suficiente): generales + validez + femeninas.
//
// EL EJEMPLO DE "validez" ERA `edema_anasarca` Y PASO A SER `amputacion` (2026-09-07). No es un
// arreglo de un rojo: este catalogo es SINTETICO y prueba el MECANISMO (validez -> caveat que no
// bloquea), asi que habria seguido verde con una clave que la v2 del catalogo ya no tiene. Y eso es
// justo la trampa de las listas escritas a mano: verde describiendo un mundo que cambio. Se cambia a
// la unica condicion de validez que queda de verdad.
const CONDS: BisCondition[] = [
  { key: "placas_metalicas", label: "Placas", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, compromisesValidity: false, orderIndex: 1 },
  { key: "marcapasos", label: "Marcapasos", scope: "general", kind: "contraindicacion", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, compromisesValidity: false, orderIndex: 2 },
  { key: "diuretico", label: "Diuretico", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "¿Cual?", detailType: "text", compromisesValidity: false, orderIndex: 3 },
  { key: "amputacion", label: "Amputacion de un segmento", scope: "general", kind: "validez", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, compromisesValidity: true, orderIndex: 4 },
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
    amputacion: { value: false },
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
    // amputacion es kind='validez'; aunque sea true, no bloquea el import.
    expect(computeContraindicated(CONDS, { amputacion: { value: true } })).toBe(false);
  });

  it("validez NO exige reconocimiento (a diferencia del embarazo)", () => {
    const res = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), amputacion: { value: true } } },
      NOW,
      false,
    );
    expect(res.ok).toBe(true); // sin checkbox, se guarda igual
  });

  it("buildValidityCaveats sella las que comprometen validez respondidas si (validez + embarazo)", () => {
    const caveats = buildValidityCaveats(CONDS, {
      amputacion: { value: true },
      embarazo: { value: true, detail: 5, acknowledgedAt: NOW },
      marcapasos: { value: true }, // contraindicacion, no compromete validez -> no entra
      placas_metalicas: { value: true }, // calidad -> no entra
    });
    expect(caveats.map((c) => c.key).sort()).toEqual(["amputacion", "embarazo"]);
  });

  it("sin condiciones que comprometan validez, no hay caveats", () => {
    expect(buildValidityCaveats(CONDS, { placas_metalicas: { value: true } })).toEqual([]);
  });
});

describe("evaluarRequisitosDelImport (orden + seguridad del import)", () => {
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
    const g = evaluarRequisitosDelImport(null, []);
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.message).toContain("guardar las condiciones de la toma BIS");
  });

  it("con contraindicacion (marcapasos) bloquea el import", () => {
    const g = evaluarRequisitosDelImport(intake({ contraindicated: true }), []);
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.reason).toBe("contraindicated");
  });

  it("con condiciones respondidas y sin contraindicacion habilita el import", () => {
    expect(evaluarRequisitosDelImport(intake({}), []).allowed).toBe(true);
  });
});

// ═══ EL BOTON ES EL GUARDIAN (Santiago, 2026-09-22) ═══
describe("el import BIS exige condiciones y encuesta completa, todo en un mensaje", () => {
  const intake = (): BisIntakeRecord => ({
    versionId: "v1",
    answers: {},
    contraindicated: false,
    gripStrengthKg: null,
    weightGoalKg: null,
    updatedAt: NOW,
  });

  it("con la encuesta incompleta no deja pasar y dice cuántas faltan por dominio", () => {
    const g = evaluarRequisitosDelImport(intake(), [{ section: "Hábitos", missing: 2 }]);
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.message).toBe("Para importar la medición falta completar la encuesta: faltan 2 respuestas (Hábitos (2)).");
  });

  it("sin encuesta y sin condiciones, lo dice todo junto", () => {
    const g = evaluarRequisitosDelImport(null, null);
    if (!g.allowed) {
      expect(g.message).toContain("guardar las condiciones de la toma BIS");
      expect(g.message).toContain(" y que el paciente responda la encuesta");
    } else throw new Error("dejó pasar");
  });

  it("la contraindicación manda sobre lo demás", () => {
    const g = evaluarRequisitosDelImport({ ...intake(), contraindicated: true }, null);
    if (!g.allowed) expect(g.reason).toBe("contraindicated");
  });

  it("el action lo aplica con la misma cuenta que el diagnóstico, y la pantalla ya no bloquea", () => {
    const action = readFileSync("src/modules/bis/actions.ts", "utf8");
    expect(action).toContain("evaluarRequisitosDelImport(intake, domains ? computeSurveyGapsFromDomains(domains) : null)");
    const pantalla = readFileSync("src/modules/evaluations/components/entrada-evaluacion.tsx", "utf8");
    expect(pantalla).not.toContain("Primero, las condiciones de la toma");
    expect(pantalla).toContain("<BisImportForm evaluation={bisImportEval} />");
    const form = readFileSync("src/modules/bis/components/bis-import-form.tsx", "utf8");
    expect(form).not.toContain("disabledReason");
    // Y el archivo elegido sobrevive a un error (hazard 2 de formularios).
    expect(form).toContain("onSubmit={enviarSinReset(action)}");
  });
});

// DIV-18 SE CERRO AL REVES DE COMO ESTABA (2026-09-07, punto 4 de su cotejo), y por eso este bloque se
// reescribio entero en vez de ajustarse.
//
// Lo que decia antes: el peso meta y la fuerza prensil se MUESTRAN en Antropometria y se EDITAN en las
// condiciones de la toma, porque en Atlas las condiciones son un formulario con su propio gate y partirlo
// en dos guardados empeoraba el flujo. Ese razonamiento tenia su pregunta abierta escrita al lado: "si
// quiere que sean editables en Antropometria, se hace, y el precio es el segundo guardado".
//
// Gildardo la contesto, y con una razon que no habiamos oido y que no es de ubicacion sino de SECUENCIA:
// *"el peso meta se establece al revisar al paciente y sus datos; si lo ponen antes el profesional NO
// tiene como acordarse del contexto del paciente. NO puede ir ahi."* Se decide DESPUES de ver la
// composicion. Las condiciones se responden ANTES de medir.
//
// Y EL MOTIVO TECNICO DE DIV-18 NO SOBREVIVIO A LA VERIFICACION: decia que un update parcial desde otra
// pantalla podia afectar cero filas. El peso meta no vive en esa tabla (vive en `evaluations`, cuya fila
// siempre existe) y la prensil esta detras de un orden que la app impone. Aun asi el writer lo comprueba
// y falla en voz alta, que es lo que fija el ultimo caso de aqui.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CONDICIONES DE LA TOMA VIVEN EN ANTROPOMETRIA Y BIS, Y EN UN SOLO SITIO (v12 §3, 2026-10-30)
//
// EL MOVIMIENTO ES SUYO y su argumento es el mismo de la correccion del 25-oct: *"se verifica justo antes
// de subir la bioimpedancia"*. Vivian al final de Encuesta.
//
// Y ESTE CANDADO EXISTE POR LO QUE PASO AL MOVERLAS: la suite entera siguio verde. Ningun caso decia EN
// QUE PESTAÑA estaban, asi que el bloque se podia mudar (o duplicar) sin que nada lo dijera. Lo que se
// afirma no es que exista, es que esta en UNA pestaña y es la de la medicion.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
describe("las condiciones de la toma, en la pestaña de la medición y en un solo sitio", () => {
  const SRC = sinComentarios(
    readFileSync("src/modules/evaluations/components/entrada-evaluacion.tsx", "utf8"),
  );
  const encuesta = SRC.slice(
    SRC.indexOf("const encuestaPanel = ("),
    SRC.indexOf("const condicionesDeLaToma ="),
  );
  // ACOTADO AL PANEL, no "de aquí hasta el final": despues viven las HOJAS IMPRIMIBLES, que tambien
  // montan las condiciones selladas, y un corte abierto haria que este candado las confundiera con la
  // pantalla (y entonces pasaria verde con el bloque en el sitio equivocado).
  const antropometria = SRC.slice(
    SRC.indexOf("const antropometriaPanel = ("),
    SRC.indexOf("const hojaDeLaEncuesta ="),
  );

  it("Encuesta ya NO monta el bloque de condiciones", () => {
    expect(encuesta.length, "no se encontró el panel de Encuesta").toBeGreaterThan(500);
    expect(encuesta, "las condiciones volvieron a Encuesta").not.toContain("<BisConditionsCapture");
    expect(encuesta, "la captura sellada volvió a Encuesta").not.toContain("<BisConditionsReadonly");
  });

  it("y Antropometría y BIS lo monta ENCIMA del import", () => {
    expect(antropometria).toContain("{condicionesDeLaToma}");
    expect(
      antropometria.indexOf("{condicionesDeLaToma}"),
      "las condiciones quedaron debajo del import: dejan de ser la comprobación previa",
    ).toBeLessThan(antropometria.indexOf("Medición BIS</h3>"));
  });

  it("y NO queda en las dos: una sola captura de las mismas respuestas", () => {
    // Dos sitios que capturan lo mismo es el hazard 4 de CLAUDE.md, y con un formulario que SELLA, la
    // segunda copia es la que se queda sin guardar. Se cuenta sobre el archivo entero: una sola montura.
    expect((SRC.match(/<BisConditionsCapture/g) ?? []).length).toBe(1);
    // LA DE SOLO LECTURA SALE DOS VECES, Y LA SEGUNDA ES EL PAPEL: la hoja imprimible de la encuesta
    // lleva las condiciones SELLADAS junto a las respuestas, y eso es un documento, no una captura. Se
    // afirma donde esta cada una, en vez de contar y quedarse con la duda.
    expect((SRC.match(/<BisConditionsReadonly/g) ?? []).length).toBe(2);
    // Una es la del bloque que monta la pestaña (`condicionesDeLaToma`) y la otra la del papel.
    const bloque = SRC.slice(
      SRC.indexOf("const condicionesDeLaToma ="),
      SRC.indexOf("const antropometriaPanel = ("),
    );
    expect(bloque).toContain("<BisConditionsReadonly data={bisReadonly} />");
    const papel = SRC.slice(SRC.indexOf("const hojaDeLaEncuesta ="));
    expect(papel).toContain("<BisConditionsReadonly data={bisReadonly} />");
  });

  it("y los avisos que mandan a guardarlas nombran la pestaña NUEVA", () => {
    // Un aviso que manda a la pestaña equivocada es peor que ninguno: el profesional va, no encuentra
    // nada y concluye que el sistema se contradice. Son los tres sitios que la nombraban.
    const g = evaluarRequisitosDelImport(null, [{ section: "Hábitos", missing: 1 }]);
    if (g.allowed) throw new Error("dejó pasar sin condiciones");
    expect(g.message).toContain("en esta misma pestaña, encima del import");
    const d = condicionesParaDiagnosticar(null);
    if (d.allowed) throw new Error("dejó generar sin condiciones");
    expect(d.message).toContain("subpestaña Antropometría y BIS");
    const PRENSIL = readFileSync(
      "src/modules/bis-intake/data/medidas-profesional-writer.ts",
      "utf8",
    );
    expect(PRENSIL).toContain("subpestaña Antropometría y BIS");
    const SARCO = readFileSync("src/modules/diagnoses/components/sarcopenia-card.tsx", "utf8");
    expect(SARCO).toContain("(subpestaña Antropometría y BIS)");
  });

  it("y ninguna superficie sigue mandando a la subpestaña Encuesta por las condiciones", () => {
    for (const ruta of [
      "src/modules/bis-intake/services/import-gate.ts",
      "src/modules/bis-intake/data/medidas-profesional-writer.ts",
      "src/modules/diagnoses/components/sarcopenia-card.tsx",
    ]) {
      expect(readFileSync(ruta, "utf8"), `${ruta} sigue nombrando Encuesta`).not.toContain(
        "subpestaña Encuesta",
      );
    }
  });

  it("y al guardarlas el aviso NO manda al módulo donde ya estamos", () => {
    // EL DEFECTO (Santiago, 2026-11-03): *"cuando uno guarda las condiciones bis aparece «Condiciones
    // guardadas. Ya puedes ir al módulo de Antropometría y BIS». Este mensaje debe ser cambiado, ya que
    // nos encontramos en dicho modulo jeje."*
    //
    // Y ES EL MISMO DEFECTO QUE ESE PUENTE VINO A CERRAR, al reves: un aviso que describe un sitio en vez
    // de derivar del sitio donde se pinta. Cuando el bloque vivia en Encuesta el enlace era correcto; al
    // mudarlo (v12 §3) quedo apuntando a donde ya se esta, y un puente a ninguna parte se lee como un
    // sistema que no sabe donde esta el profesional.
    // SIN COMENTARIOS: el comentario del componente CITA el texto viejo para explicar por qué se retiró,
    // así que una aserción sobre el archivo crudo se cazaría a sí misma. Ya nos pasó con `--clinical-*`.
    const CAPTURA = sinComentarios(
      readFileSync("src/modules/bis-intake/components/bis-conditions-capture.tsx", "utf8"),
    );
    expect(CAPTURA, "el aviso volvió a mandar al módulo donde ya estamos").not.toContain(
      "ir al módulo de Antropometría y BIS",
    );
    expect(CAPTURA, "volvió a enlazar a una etapa desde dentro de esa etapa").not.toContain("etapa=");
    // Y SIGUE DICIENDO QUE SIGUE: retirar el puente sin decir nada dejaria al profesional sin saber que
    // el import ya quedo habilitado, que es la mitad util del aviso.
    expect(CAPTURA).toContain("Condiciones guardadas. El bloque");
  });
});

describe("las dos medidas del profesional se editan en Antropometría (punto 4)", () => {
  const ANTRO = readFileSync(
    "src/modules/bis-intake/components/antropometria-editable.tsx",
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
  const MEDIDAS_WRITER = readFileSync(
    "src/modules/bis-intake/data/medidas-profesional-writer.ts",
    "utf8",
  );
  const INTAKE_WRITER = readFileSync("src/modules/bis-intake/data/bis-intake-writer.ts", "utf8");

  it("los dos campos son EDITABLES en Antropometría", () => {
    expect(ANTRO).toContain('name="weightGoalKg"');
    expect(ANTRO).toContain('name="gripStrengthKg"');
    expect(ANTRO).toContain("saveMedidasProfesionalAction");
  });

  it("y ya no están en las condiciones de la toma", () => {
    const limpio = sinComentarios(CAPTURA);
    expect(limpio, "el peso meta volvió a las condiciones").not.toContain("weightGoalKg");
    expect(limpio, "la prensil volvió a las condiciones").not.toContain("gripStrengthKg");
    expect(limpio).not.toContain('id="medidas-del-profesional"');
  });

  it("EL WRITER DE LAS CONDICIONES NO LOS TOCA, que es la otra mitad del arreglo", () => {
    // Y es la que se podia olvidar: si el formulario deja de mandarlos pero el writer los sigue
    // escribiendo, cada re-guardado de condiciones los pone en null y BORRA en silencio lo que el
    // profesional acaba de escribir en la otra subpestaña. El hazard del campo que deja de viajar, por
    // el extremo del que deja de recibirse.
    const limpio = sinComentarios(INTAKE_WRITER);
    expect(limpio, "el writer de condiciones volvería a pisar el peso meta").not.toContain("weightGoalKg");
    expect(limpio, "el writer de condiciones volvería a pisar la prensil").not.toContain("gripStrengthKg");
  });

  it("el guardado propio falla EN VOZ ALTA si la fila de condiciones no existe", () => {
    // La prensil vive en `evaluation_bis_intake`, que es opcional. Un update sobre una fila que no está
    // afecta cero filas y no da error: el valor desaparecería sin decirlo. Se comprueba antes.
    expect(MEDIDAS_WRITER).toContain("Primero guarda las condiciones de la toma");
    expect(MEDIDAS_WRITER).toContain("evaluationBisIntake.evaluationId");
  });

  it("y el gate del diagnóstico vive DENTRO de la transacción, no en la pantalla", () => {
    // Un botón oculto no es un candado. Mismo criterio que la corrección de medidas.
    expect(MEDIDAS_WRITER).toContain("El diagnóstico ya se generó");
    expect(MEDIDAS_WRITER).toContain(".from(diagnoses)");
  });

  it("el peso meta llega TAMBIÉN en la vista sellada", () => {
    // La mitad silenciosa del mismo dato: la vista de solo lectura (después del diagnóstico) traía la
    // prensil y no el peso meta, así que habría dicho "Sin registrar" sobre un valor que existe. Es el
    // campo que deja de viajar, en el camino que menos se mira. Sigue valiendo con la edición movida.
    expect(READER).toContain("weightGoalKg: intake.weightGoalKg");
    expect(ENTRADA).toContain("bisReadonly?.weightGoalKg");
  });
});

// CANDADO DE LA NOTA DEL FORMULARIO DE CONDICIONES (smoke de Santiago, 2026-09-07).
//
// EL DEFECTO: encima del boton salia siempre *"Responde todas las condiciones (Sí o No) para poder
// guardar. La semana del ciclo es opcional."*, tambien con un paciente HOMBRE, a quien esa pregunta ni se
// le muestra: `visible` la filtra por `scope` y el bloque femenino solo se pinta si `patientIsFemale`.
//
// Una cadena fija describiendo un estado que no habia mirado. Misma familia que el titulo de la Diana
// ("inicial y última" con una sola medicion) y que la salida del seed ("Sembradas 12" sin decir donde).
//
// Y AL BARRER LA MISMA PANTALLA aparecio dos veces mas: el aviso del reconocimiento decia "el embarazo" a
// mano (la CONDICION se derivaba, el TEXTO no; acertaba porque hoy es la unica advertencia del catalogo),
// y el comentario del gate nombraba tambien la semana del ciclo. Tres sitios describiendo a mano lo que
// el catalogo ya dice.
//
// LO QUE SE FIJA: que las dos notas se DERIVEN del catalogo visible, no que digan una frase concreta. Por
// eso se afirma sobre el codigo que las arma, no sobre el texto: fijar el texto seria escribir la cuarta
// copia a mano.
describe("las notas del formulario de condiciones se derivan de lo que se pinta", () => {
  const CAPTURA = readFileSync(
    "src/modules/bis-intake/components/bis-conditions-capture.tsx",
    "utf8",
  );
  const limpio = sinComentarios(CAPTURA);

  it("la nota ya NO nombra la semana del ciclo a mano", () => {
    expect(
      limpio,
      "volvió la frase fija: se la enseña a un hombre, que no ve esa pregunta",
    ).not.toContain("La semana del ciclo es opcional");
  });

  it("las opcionales salen del catálogo VISIBLE, que es el que ya filtra por sexo", () => {
    // `visible` es el mismo arreglo del que sale `missingRequired`. Derivarlas de otro sitio (del
    // catálogo entero, por ejemplo) volvería a nombrar la del ciclo con un paciente hombre.
    expect(limpio).toContain("const opcionales = visible.filter((c) => c.inputType !== \"boolean\")");
    expect(limpio).toContain("opcionales.map((c) => c.label)");
  });

  it("y son EXACTAMENTE el complemento de las obligatorias", () => {
    // Las dos definiciones tienen que partir el mismo conjunto: obligatoria = boolean, opcional = lo
    // demás. Si una de las dos cambia sola, quedan condiciones que no son ni una cosa ni la otra.
    expect(limpio).toContain('c.inputType === "boolean" && answers[c.key].bool === null');
    expect(limpio).toContain('c.inputType !== "boolean"');
  });

  it("el aviso del reconocimiento nombra la advertencia real, no \"el embarazo\"", () => {
    expect(limpio, "volvió a nombrar el embarazo a mano").not.toContain(
      "Marca el reconocimiento del embarazo",
    );
    expect(limpio).toContain("activeAdvertencias");
    expect(limpio).toContain("!answers[c.key].acknowledged");
  });

  it("el control: el bloque femenino SIGUE oculto para un hombre", () => {
    // Sin esto, las aserciones de arriba pasarían igual si alguien mostrara todas las preguntas a todos,
    // que es la otra forma de "arreglar" la contradicción y sería mucho peor.
    expect(limpio).toContain('c.scope === "general" || patientIsFemale');
    expect(limpio).toContain("{patientIsFemale && female.length > 0 ?");
  });
});

describe("las superficies que el smoke encontró faltando (2026-09-05)", () => {
  const ENTRADA = readFileSync(
    "src/modules/evaluations/components/entrada-evaluacion.tsx",
    "utf8",
  );
  const FORM = readFileSync("src/modules/bis/components/bis-import-form.tsx", "utf8");
  // ERA `medidas-del-profesional-resumen.tsx`, que se retiro el 2026-09-07 al pasar la EDICION de las dos
  // medidas a Antropometria (punto 4): el resumen existia porque se editaban en otra pantalla. La
  // asercion no cambia, cambia el archivo donde vive el estado sellado.
  const ANTRO = readFileSync(
    "src/modules/bis-intake/components/antropometria-editable.tsx",
    "utf8",
  );

  // ═══ EL REEMPLAZO ES UN SOLO BOTON, Y LO MIDEN LOS TRES CASOS DE ABAJO (v12 §1.3, 2026-11-03) ═══
  //
  // LO QUE PROTEGIAN ANTES, Y SIGUEN PROTEGIENDO: que exista un camino alcanzable para reemplazar la toma
  // en los DOS estados de la consulta, con nombre. Lo que cambia es la superficie: estaba partido en un
  // `details` plegado (sin diagnostico) mas un parrafo que nombraba otro camino (con diagnostico), y
  // Santiago, mirando la pestaña, reporto que no habia ningun boton. Ahora es un bloque, un boton y una
  // pregunta de motivo.
  //
  // POR QUE LOS CASOS SE REESCRIBEN EN VEZ DE BORRARSE: la regla no caduco, se mudo. Un candado que se
  // borra al mover la pieza deja la pieza sin candado justo cuando mas cambia.
  const REEMPLAZO = readFileSync(
    "src/modules/corrections/components/reemplazar-la-medicion-bis.tsx",
    "utf8",
  );
  const PAGINA = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");

  it("con medición y SIN diagnóstico hay por dónde reemplazar el archivo", () => {
    // EL DEFECTO ORIGINAL: el portón del reimport se movió a "¿ya hay diagnóstico?" y el panel seguía
    // ocultando el formulario en cuanto había medición. El guard quedó construido y sin superficie que
    // llegara a él: un guard que nadie puede ejercitar no es un guard, es código muerto que además hace
    // creer que el caso está cubierto.
    //
    // SE MIDE LA CADENA COMPLETA, que es lo que hace que el camino exista de verdad: la pestaña le pasa
    // el formulario de reemplazo al bloque, y se apaga SOLO cuando no hay import posible (con diagnóstico
    // `bisImportEval` ya es null); el bloque lo recibe como slot y solo lo pinta sin diagnóstico.
    expect(sinComentarios(ENTRADA), "la pestaña ya no monta el formulario de reemplazo").toMatch(
      // LA CONDICION GANO UNA MITAD (2026-11-05): en una version REEMPLAZADA el reimport tampoco se
      // monta, porque cambiaria la medicion de una version que ya no es la vigente, o sea escribiria
      // sobre el registro de lo que se emitio. Lo que el candado protege no cambia: que el reimport se
      // apague SOLO, por derivacion, y no por una bandera que alguien tenga que acordarse de bajar.
      /reimportar=\{\s*bisImportEval && !versionReemplazada/,
    );
    const jsx = sinComentarios(REEMPLAZO);
    expect(jsx, "el slot del reimport desapareció del bloque").toContain("{reimportar ?? (");
    expect(jsx, "el reimport dejó de estar acotado a antes del diagnóstico").toContain(
      "if (!diagnosticoGenerado) {",
    );
    // Y el formulario tiene que RENDERIZARSE aunque ya haya medición cuando está en ese modo.
    expect(FORM).toContain("&& !modoReemplazo");
  });

  it("los dos caminos se VEN, sin un paso que los esconda, y una sola vez", () => {
    // Decía solo "¿Importaste el archivo equivocado?". Quien viene buscando cómo quitar una toma mala (en
    // su HTML hay un botón "Eliminar toma BIS") no reconoce esa pregunta como el sitio y concluye que en
    // Atlas no se puede: un control que no se encuentra se reporta como que no existe.
    //
    // ═══ Y UN BOTÓN QUE ABRE UNA PREGUNTA TAMPOCO SIRVE (Santiago, 2026-11-03) ═══
    //
    // *"No sé si para el profesional le quede clara esta ruta solo con darle a un botón que diga
    // reemplazar BIS y la explicación corta."* Es la duda correcta: para saber qué se le va a preguntar
    // hay que pulsar a ciegas, y el que no sabe si es su caso no pulsa. Es el mismo defecto que cuando
    // era un desplegable plegado, con otra forma.
    //
    // ASÍ QUE SE AFIRMAN LOS DOS BOTONES, no el genérico: cada camino se lee antes de pulsarlo.
    const jsx = sinComentarios(REEMPLAZO);
    expect(jsx).toContain("Repetir la toma (salió mal)");
    expect(jsx).toContain("El archivo es de otra persona");
    // Y QUE LOS PINTE EL ESTADO CERRADO, que es lo que de verdad los hace visibles: si volvieran a vivir
    // solo tras el clic, los dos literales seguirían estando y el candado pasaría en verde.
    const cerrado = jsx.slice(jsx.indexOf("if (!abierto) {"), jsx.indexOf("if (!causa) {"));
    expect(cerrado, "los dos motivos dejaron de verse sin pulsar nada").toContain("MOTIVOS.map");
    expect(cerrado).toContain("{m.boton}");
    // LOS DOS MOTIVOS SIGUEN SIENDO LO QUE DECIDE lo que queda escrito en la historia.
    expect(jsx).toContain("La toma quedó mal");
    expect(jsx).toContain("Importé el archivo de otra persona");
    // Y UNA SOLA ENTRADA AL ACTO. Dos entradas parciales al mismo acto es exactamente lo que había (un
    // `details` plegado junto a la medición y un párrafo que nombraba otro camino) y lo que lo volvía
    // inencontrable. Se mide por las dos cosas que lo garantizan: el bloque se monta una vez, y el
    // formulario de import en modo reemplazo solo se construye para dárselo a él.
    const entrada = sinComentarios(ENTRADA);
    expect((entrada.match(/<ReemplazarLaMedicionBis/g) ?? []).length).toBe(1);
    expect(
      (entrada.match(/modoReemplazo/g) ?? []).length,
      "hay un segundo formulario de reemplazo fuera del bloque: son dos sitios otra vez",
    ).toBe(1);
    expect(entrada, "volvió el desplegable plegado de antes").not.toContain("<details");
  });

  it("y con diagnóstico generado el bloque NOMBRA el camino en vez de callar", () => {
    // Antes no mostraba nada: quien descubría la toma mala DESPUÉS de generar se quedaba sin pista. El
    // reemplazo directo está cerrado a propósito (el diagnóstico está sellado sobre esa medición) y lo
    // que corresponde es versionar.
    const jsx = sinComentarios(REEMPLAZO);
    expect(jsx).toContain("Esta consulta tiene diagnóstico, y está sellado sobre esa medición");
    expect(jsx).toContain("versión nueva sin medición");
    // Y NO PROMETE QUE SE BORRA: la versión anterior queda registrada, que es lo que de verdad pasa.
    expect(jsx).toContain("queda <strong>reemplazada</strong>");
    // Y EL REIMPORT SE APAGA SOLO EN ESE ESTADO: con diagnóstico, la página deja `bisImportEval` en null
    // y el slot queda vacío. Es una bandera DERIVADA y no una que haya que acordarse de bajar, que es la
    // forma en que estas dos ramas se desincronizan.
    expect(PAGINA, "la rama con diagnóstico volvió a ofrecer el import").toContain(
      "bisImportEval: null",
    );
  });

  it("la tabla de Wang nace ABIERTA (punto 6 de su cotejo)", () => {
    // EL DEFECTO: escribio "no estan los datos antropometricos por nivel de Wang, por que". Y si estaban:
    // estaban plegados. Que la pieza exista no basta si no se ve. Se afirma por la PROP, que es lo que
    // decide el estado inicial, y junto al titulo para que no pueda quedar en otro desplegable.
    // EL DESPLEGABLE SE MUDO (2026-09-09): estaba en `entrada-evaluacion` envolviendo la tabla, y paso a
    // `medidas-con-tabla`, donde vive el estado que la recalcula al escribir. Lo intentamos primero con el
    // envoltorio pasado desde fuera y ESO ROMPIO LA RUTA: una funcion no cruza la frontera servidor ->
    // cliente. La asercion no cambia (la tabla nace abierta); cambia el archivo donde mirar. El TITULO
    // sigue viniendo de la pagina, asi que se comprueba en los dos sitios.
    expect(sinComentarios(ENTRADA), "la página dejó de titular la tabla de Wang").toContain(
      'tituloTabla="Composición corporal (Niveles de Wang)"',
    );
    const TABLA = sinComentarios(
      readFileSync("src/modules/bis-intake/components/medidas-con-tabla.tsx", "utf8"),
    );
    expect(TABLA, "la tabla de Wang volvió a nacer plegada").toContain(
      "<DetailsSection title={tituloTabla} defaultOpen>",
    );
  });

  it("y el texto dice que REEMPLAZA, no que añade", () => {
    // Sin esto el profesional puede creer que se suma una segunda medición, que es lo que el writer
    // impide: la anterior se borra en la misma transacción.
    expect(FORM).toContain("Esto reemplaza la medición actual");
    expect(FORM).toContain("Reemplazar la medición");
  });

  it("y los campos desaparecen cuando los valores están sellados", () => {
    // Antes esto miraba un ENLACE de "editar en las condiciones": prometer editar y no dejar manda al
    // profesional a buscar un campo que no existe. Con la edicion ya aqui, lo que no puede aparecer es el
    // campo mismo. Se afirma por las DOS ramas para que el verde signifique algo: sellada pinta una lista
    // de datos, no sellada pinta el formulario.
    expect(ANTRO).toContain("Quedaron selladas con el diagnóstico");
    expect(ANTRO, "la rama sellada tiene que pintar datos, no campos").toContain("<dl");
    // ALCANCE AJUSTADO (2026-09-09), no la asercion: el boton "Guardar medidas del profesional" SE
    // RETIRO, porque esos dos campos pasan a guardarse al salir del campo (peticion de Gildardo). Este
    // caso lo citaba como prueba de que la rama NO sellada pinta el formulario, y ese es el punto que se
    // conserva: se afirma por los CAMPOS, que es lo que de verdad distingue las dos ramas y no depende
    // de que exista un boton.
    expect(ANTRO, "la rama no sellada tiene que pintar los campos editables").toContain(
      'name="weightGoalKg"',
    );
    expect(ANTRO).toContain('name="gripStrengthKg"');
    expect(ENTRADA).toContain("sellada={diagnosticoGenerado}");
  });
});

// ═══ EL DIAGNOSTICO TAMBIEN EXIGE LAS CONDICIONES (2026-09-22) ═══
// La medicion del paciente importado del HTML no pasa por el boton de importar. Sin este gate se diagnosticaria
// como si la toma no tuviera ningun reparo.
describe("el diagnóstico exige las condiciones de la toma, venga de donde venga la medición", () => {
  it("sin condiciones no deja generar, y con contraindicación tampoco", () => {
    const sin = condicionesParaDiagnosticar(null);
    expect(sin.allowed).toBe(false);
    if (!sin.allowed) expect(sin.message).toContain("guardar las condiciones de la toma BIS");
    expect(condicionesParaDiagnosticar({ contraindicated: true }).allowed).toBe(false);
    expect(condicionesParaDiagnosticar({ contraindicated: false }).allowed).toBe(true);
  });

  it("el pipeline lo aplica después del gate de encuesta completa", () => {
    const pipeline = readFileSync("src/modules/clinical-pipeline/services/run-pipeline.ts", "utf8");
    const encuesta = pipeline.indexOf("formatIncompleteSurveyMessage(inputs.surveyGaps)");
    const condiciones = pipeline.indexOf("condicionesParaDiagnosticar(inputs.bisConditions)");
    expect(encuesta).toBeGreaterThan(-1);
    expect(condiciones).toBeGreaterThan(encuesta);
    const lector = readFileSync("src/modules/clinical-pipeline/data/pipeline-reader.ts", "utf8");
    // El lector lleva DOS cosas a la puerta desde la 0170: si hay contraindicación y si las condiciones las
    // REGISTRÓ alguien. Lo segundo se agregó porque una fila puede existir sin que nadie las respondiera: la
    // consulta importada del HTML crea esa fila para traer la fuerza prensil y el peso meta.
    expect(lector).toContain("contraindicated: intake.contraindicated");
    expect(lector).toContain("registradas: intake.conditionsRegisteredAt != null");
  });
});

// ═══ Y LA CINTURA Y LA CADERA (smoke de Santiago, 2026-09-22) ═══
// Un paciente importado del HTML sin cadera genero diagnostico: su guarda vivia solo en el boton del XLSX.
describe("el diagnóstico exige la cintura y la cadera, venga de donde venga la medición", () => {
  it("dice cuál falta y qué hacer", async () => {
    const { circunferenciasParaDiagnosticar } = await import("@/modules/bis-intake/services/import-gate");
    expect(circunferenciasParaDiagnosticar({ cintura: 84, cadera: 106 }).allowed).toBe(true);
    const sinCadera = circunferenciasParaDiagnosticar({ cintura: 84, cadera: null });
    expect(sinCadera.allowed).toBe(false);
    if (!sinCadera.allowed) {
      expect(sinCadera.message).toContain("falta la cadera de la medición");
      expect(sinCadera.message).toContain("re-importa el XLSX");
    }
    const ninguna = circunferenciasParaDiagnosticar({ cintura: 0, cadera: 0 });
    if (!ninguna.allowed) expect(ninguna.message).toContain("la cintura y la cadera");
  });

  it("el pipeline la aplica, con las circunferencias medidas", () => {
    const pipeline = readFileSync("src/modules/clinical-pipeline/services/run-pipeline.ts", "utf8");
    expect(pipeline).toContain("circunferenciasParaDiagnosticar(inputs.circunferencias, inputs.importada)");
    const lector = readFileSync("src/modules/clinical-pipeline/data/pipeline-reader.ts", "utf8");
    expect(lector).toContain("cintura: bisRaw[normalizeHeader(MEASURED_WAIST_HEADER)] ?? null");
    expect(lector).toContain("cadera: bisRaw[normalizeHeader(MEASURED_HIPS_HEADER)] ?? null");
  });
});

// El remedio no es el mismo en los dos caminos (Santiago, 2026-09-22).
describe("lo que se le ofrece al profesional depende del camino", () => {
  it("en una importada se teclean; en una de Atlas se vuelve a medir", async () => {
    const { circunferenciasParaDiagnosticar } = await import("@/modules/bis-intake/services/import-gate");
    const importada = circunferenciasParaDiagnosticar({ cintura: 84, cadera: null }, true);
    if (!importada.allowed) {
      expect(importada.message).toContain("Escríbela en Antropometría");
      expect(importada.message).toContain("no se puede repetir");
    }
    const deAtlas = circunferenciasParaDiagnosticar({ cintura: 84, cadera: null }, false);
    if (!deAtlas.allowed) expect(deAtlas.message).toContain("Vuelve a tomar la medida en Biody Manager");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UNA VERSION REEMPLAZADA NO OFRECE NINGUN ACTO QUE CREE VERSION  ·  2026-11-05
//
// Santiago: *"al abrir la version antigua todavia se ofrecen «Reemplazar medicion BIS», «Corregir
// evaluacion» y lo demas, y al usarlos responde «Esta evaluacion ya fue corregida». El freno esta bien,
// pero ofrecer botones que llevan a un error se siente roto."*
//
// ═══ LAS DOS CAPAS, Y LAS DOS HACEN FALTA ═══
//
// El FRENO del servicio se queda: es la cerradura, y una superficie no es un control (la URL del acto se
// puede escribir a mano). Lo que cambia es que la SUPERFICIE deje de ofrecerlo. Un boton que solo puede
// fallar no es una salida: gasta el tiempo de alguien y le hace dudar del sistema entero.
//
// Y LO QUE SE VIGILA ES QUE LA BANDERA VIAJE, no el texto de cada aviso: la pagina la calcula una vez
// (`supersession.superseded`) y la pasa en sus DOS ramas; cada superficie la recibe. Asi un acto nuevo que
// se monte en esa pestaña la tiene sin que nadie se acuerde de pasarla.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("en una version reemplazada no se ofrece ningun acto que cree version", () => {
  const PAGINA = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
  const BLOQUE = readFileSync(
    "src/modules/corrections/components/reemplazar-la-medicion-bis.tsx",
    "utf8",
  );

  it("la pagina pasa la bandera en sus DOS ramas, con y sin diagnostico", () => {
    const veces = (PAGINA.match(/versionReemplazada: supersession\.superseded/g) ?? []).length;
    expect(veces, "la bandera no llega a las dos ramas de la pagina").toBe(2);
    // Y con su destino: un aviso sin enlace obliga a buscar la version vigente a mano.
    expect((PAGINA.match(/versionVigenteId: supersession\.newEvaluationId/g) ?? []).length).toBe(2);
  });

  it("el bloque de reemplazar la medicion no pinta ningun acto cuando esta reemplazada", () => {
    const bloque = sinComentarios(BLOQUE);
    expect(bloque).toContain("if (versionReemplazada) {");
    // El estado va ANTES que todos los demas: en una version reemplazada no hay nada que hacer ahi, ni
    // con aviso de huella ni sin el.
    expect(bloque.indexOf("if (versionReemplazada)")).toBeLessThan(bloque.indexOf("if (!abierto"));
    // Y dice a donde ir.
    expect(bloque).toContain("Ir a la versión vigente");
  });

  it("y la correccion de la encuesta se bloquea con su razon, no con un boton que falla", () => {
    const lector = readFileSync("src/modules/corrections/data/correction-availability-reader.ts", "utf8");
    expect(lector).toContain("clinical_corrections");
    expect(lector).toContain("Esta versión ya fue reemplazada");
    // VA PRIMERO: es la razon que manda, y de paso ahorra la consulta de la version de encuesta.
    expect(lector.indexOf("Esta versión ya fue reemplazada")).toBeLessThan(
      lector.indexOf("survey_responses"),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS BANDEJAS DE ADMINISTRACION AVISAN DE QUE EXISTEN  ·  2026-11-05
//
// Santiago: *"Pedí una eliminación y no la encuentro."* Y la peticion SI estaba (verificado en
// produccion: una pendiente del 5 de noviembre). El defecto no era el registro, era que no habia forma de
// enterarse: las tres bandejas de /admin solo se pintan cuando tienen algo (correcto: una seccion vacia
// permanente entrena a no mirarla) y estan al pie de una pagina larga.
//
// Es la forma de la "pieza terminada sin el ultimo cable": el acto se registra, la bandeja existe, la
// resolucion funciona, y nadie se entera de que hay algo que resolver.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("lo que espera en /admin se ve desde cualquier pantalla", () => {
  const FRANJA = readFileSync(
    "src/modules/patients/components/aviso-de-bandejas-de-admin.tsx",
    "utf8",
  );
  const LAYOUT = readFileSync("src/app/(app)/layout.tsx", "utf8");

  it("la franja va montada en el layout, no en una pantalla", () => {
    // Si viviera en /admin no serviria de nada: quien no sabe que hay algo no entra a mirar.
    expect(LAYOUT).toContain("<AvisoDeBandejasDeAdmin user={user} />");
  });

  it("cuenta las TRES bandejas y las distingue", () => {
    // Un aviso que no las distingue obliga a entrar para saber si corre prisa.
    expect(FRANJA).toContain("peticionesDeEliminacionPendientes");
    expect(FRANJA).toContain("propuestasDePruebaPendientes");
    expect(FRANJA).toContain("leerHuellasConfirmadas");
    expect(FRANJA).toContain("petición");
    expect(FRANJA).toContain("como de prueba");
    expect(FRANJA).toContain("sobre otra historia");
  });

  it("no se pinta cuando no hay nada, y la autorizacion va por policy", () => {
    expect(FRANJA).toContain("if (partes.length === 0) return null;");
    expect(FRANJA, "la franja tiene que respetar la policy de admin").toContain("canAccessAdmin(user)");
  });

  it("y NO lleva ni un nombre de paciente: solo conteos y el enlace", () => {
    // La franja sale en cualquier pantalla y la puede ver quien comparte el escritorio. El nombre y el
    // documento viven en /admin, donde el acto se resuelve.
    for (const pii of ["nombre", "documento", "first_name", "documentNumber"]) {
      expect(
        sinComentarios(FRANJA).includes(pii),
        `${pii} no puede aparecer en una franja que sale en toda la app`,
      ).toBe(false);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ICC Y EL ICT SIGUEN A LA CINTURA QUE SE TECLEO  ·  2026-11-05
//
// ═══ LA DECISION (Santiago, y era suya, no de Gildardo) ═══
//
// *"Si el profesional teclea cintura o cadera, Atlas recalcula ICC e ICT con lo tecleado, como el HTML; si
// no, usa lo del equipo."*
//
// ═══ EL DEFECTO QUE CIERRA ═══
//
// El equipo exporta su ICC y su ICT calculados con la cintura que tenia AL MEDIR. Atlas deja corregir esa
// cintura despues (0089/0090: el valor corregido pasa a ser el vigente y el del equipo queda como
// evidencia), y el indice no se movia. O sea que la pantalla se contradecia consigo misma: la fila de la
// cintura mostraba el valor corregido y la del ICC un indice que sale de la cintura ANTERIOR, sin decirlo.
//
// Y EL ICC ENTRA EN EL PREDICADO DE LA RUTA R2, asi que no era solo una fila que se lee mal.
//
// ═══ POR QUE SOLO CUANDO SE TECLEA ═══
//
// Con la cintura del equipo, el indice del equipo es el correcto; recalcular siempre moveria el indice de
// TODAS las consultas por una diferencia de redondeo que nadie pidio. La regla es la conservadora.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("el ICC y el ICT se recalculan con lo que se teclea", () => {
  const MAPA = readFileSync("src/modules/diagnoses/data/composition-map.ts", "utf8");
  const LECTOR = readFileSync("src/modules/diagnoses/data/composition-reader.ts", "utf8");

  it("la condicion se DERIVA de una correccion registrada, no de una bandera", () => {
    // Las claves de `corrections` son las medidas que el profesional corrigio: un hecho que ya esta en la
    // base (`bis_value_corrections`), no algo que alguien tenga que acordarse de pasar.
    expect(LECTOR).toContain("const tecleadas = new Set(Object.keys(corrections));");
    expect(LECTOR).toContain("buildComposition(raw, meas.measurement_date, hasDerived, tecleadas)");
  });

  it("recalcula con las formulas de su HTML, y solo cuando corresponde", () => {
    const codigo = sinComentarios(MAPA);
    // ICC = cintura / cadera; ICT = cintura / talla (v9, L7154-7155).
    expect(codigo).toContain("(cintura / cadera).toFixed(3)");
    expect(codigo).toContain("(cintura / _talla).toFixed(2)");
    // SIN TECLEAR, el del equipo: es la mitad conservadora de la regla.
    expect(codigo).toContain("iccDelEquipo");
    expect(codigo).toContain("ictDelEquipo");
  });

  it("el ICT depende de la CINTURA, no de la cadera: la cadera no entra en su formula", () => {
    // Es el error facil de cometer al escribir las dos condiciones juntas, y daria un ICT recalculado por
    // teclear una medida que no aparece en su formula.
    const codigo = sinComentarios(MAPA);
    const bloqueIct = codigo.slice(codigo.indexOf("  const ict ="), codigo.indexOf("  const ict =") + 240);
    expect(bloqueIct).toContain("seTecleoLaCintura");
    expect(bloqueIct).not.toContain("seTecleoLaCadera");
  });
});
