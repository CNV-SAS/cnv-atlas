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
    // Y VA PEGADA AL AVISO DE "MEDICION IMPORTADA", no como sección propia abajo: importar el archivo
    // equivocado es un caso RARO, no una parte del flujo. La primera versión fue una sección y era
    // desproporcionada.
    //
    // SE VERIFICA POR ORDEN Y NO POR DISTANCIA: un umbral de caracteres se afina al valor de hoy y
    // enseña a subirlo cuando estorba. Lo que de verdad se pide es que el desplegable vaya JUSTO DESPUÉS
    // del aviso y ANTES de las medidas, o sea dentro del mismo bloque.
    const jsx = sinComentarios(ENTRADA);
    const iAviso = jsx.indexOf("Medición BIS importada");
    const iReemplazo = jsx.indexOf("¿Importaste el archivo equivocado?");
    const iMedidas = jsx.indexOf("<AntropometriaEditable");
    expect(iReemplazo, "el desplegable de reemplazo desapareció").toBeGreaterThan(-1);
    expect(iReemplazo, "el reemplazo quedó ANTES del aviso de que hay medición").toBeGreaterThan(iAviso);
    expect(
      iReemplazo,
      "el reemplazo se fue debajo de las medidas: vuelve a leerse como una sección del flujo",
    ).toBeLessThan(iMedidas);
    // Y el formulario tiene que RENDERIZARSE aunque ya haya medición cuando está en ese modo.
    expect(FORM).toContain("&& !modoReemplazo");
  });

  it("la tabla de Wang nace ABIERTA (punto 6 de su cotejo)", () => {
    // EL DEFECTO: escribio "no estan los datos antropometricos por nivel de Wang, por que". Y si estaban:
    // estaban plegados. Que la pieza exista no basta si no se ve. Se afirma por la PROP, que es lo que
    // decide el estado inicial, y junto al titulo para que no pueda quedar en otro desplegable.
    const jsx = sinComentarios(ENTRADA);
    const i = jsx.indexOf("Composición corporal (Niveles de Wang)");
    expect(i, "desapareció la tabla de Wang de Antropometría").toBeGreaterThan(-1);
    const apertura = jsx.slice(i, jsx.indexOf(">", i) + 1);
    expect(apertura, "la tabla de Wang volvió a nacer plegada").toContain("defaultOpen");
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
    expect(ANTRO).toContain("Guardar medidas del profesional");
    expect(ENTRADA).toContain("sellada={diagnosticoGenerado}");
  });
});
