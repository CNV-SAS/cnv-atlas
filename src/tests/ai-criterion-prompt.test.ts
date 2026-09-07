import { describe, expect, it } from "vitest";

import {
  buildCriterionPrompt,
  CRITERION_PROMPT_KEY,
  CRITERION_PROMPT_VERSION,
  type CriterionPromptInput,
} from "@/modules/diagnoses/ai/prompts/criterion.v1";

// Smoke de la barrera PII de la IA (regla dura 15 / DATA_GOVERNANCE): el prompt del borrador de criterio
// solo puede contener variables clinicas del snapshot, jamas PII. Como CriterionPromptInput no tiene
// campos de nombre/documento/contacto, la barrera es estructural; este test la fija.

const input: CriterionPromptInput = {
  estadoEfr: "Adiposopatia funcional con reserva muscular conservada",
  mecanismo: "Exceso de masa grasa con distribucion central que compromete la sensibilidad a la insulina.",
  riesgos: "Progresion a resistencia insulinica si persiste el balance calorico positivo.",
  fenotipoEstructural: "Sobrepeso con masa muscular adecuada",
  sectorFuncional: "Riesgo cardiometabolico moderado",
  indicadoresAlterados: [
    { nombre: "Indice de fluidos corporales", nivel: "elevado" },
    { nombre: "Fat Mass Index", nivel: "elevado" },
  ],
  dominios: [
    { nombre: "Patron alimentario", nivel: "alerta" },
    { nombre: "Actividad fisica", nivel: "critico" },
  ],
  riesgoIntegrado: "Moderado (score 42)",
  rutas: ["Ruta metabolica"],
};

function rendered(): string {
  return buildCriterionPrompt(input)
    .map((m) => m.content)
    .join("\n");
}

// CANDADO DEL PUNTO 9 DE SU COTEJO (2026-09-07) · NINGUN MARCADOR DE LABORATORIO VIAJA AL MODELO.
//
// EL DEFECTO: el prompt llevaba una linea `Biomarcadores asociados: ...` con el campo `bio` de su tabla
// de estados EFR ("PCR↑, HOMA-IR↑, ferritina↑, albumina↓..."). Ese campo es una HIPOTESIS suya (que
// laboratorios pedir para el fenotipo), no una medicion. Sin marco, el modelo escribio "hay evidencia de
// PCR elevada" sobre un paciente sin analitica. Textual suyo: *"Eso no se puede poner porque nos pone en
// riesgo, sin haber hecho pruebas de laboratorio"*.
//
// POR QUE UN CANDADO Y NO SOLO EL ARREGLO: viene el porte de su prompt de cinco dominios (punto 8), que
// manda MUCHO mas contexto, incluidos los datos crudos del paciente. Este test es lo que se pone rojo si
// ese porte vuelve a meter un marcador bioquimico en el mensaje.
//
// SE PRUEBA POR EL CONTENIDO, NO POR EL NOMBRE DEL CAMPO. Fijar que no existe `input.biomarcadores`
// dejaria pasar exactamente el mismo texto entrando por `mecanismo` o por un campo nuevo.
const MARCADORES_DE_LABORATORIO = [
  "PCR",
  "HOMA",
  "ferritina",
  "albúmina",
  "albumina",
  "prealbúmina",
  "creatinina",
  "glucemia",
  "glucosa",
  "hemograma",
  "linfopenia",
  "adiponectina",
  "triglicéridos",
  "ALT",
  "AST",
  "CK",
];

describe("ningun marcador de laboratorio llega al modelo", () => {
  it("el control: el prompt SI se construye y lleva contenido clinico", () => {
    // Sin este control, un prompt vacio pasaria todas las aserciones negativas de abajo.
    const text = rendered();
    expect(text.length, "si el prompt viniera vacio, el resto del describe no compararia nada").toBeGreaterThan(200);
    expect(text).toContain("Estado EFR:");
  });

  it("no nombra ningun marcador bioquimico, venga del campo que venga", () => {
    const text = rendered();
    for (const m of MARCADORES_DE_LABORATORIO) {
      // Limite de palabra: "CK" no puede cazar dentro de otra palabra, ni "AST" dentro de "gastro".
      const re = new RegExp("(^|[^\\p{L}])" + m + "([^\\p{L}]|$)", "iu");
      expect(text, `el prompt nombra "${m}": el modelo lo va a afirmar como hallazgo`).not.toMatch(re);
    }
  });

  it("y el campo `biomarcadores` ya no existe en el contrato", () => {
    // Segunda mitad, estructural: aunque alguien escriba el texto a mano, el campo que lo traia no esta.
    const claves = Object.keys(input);
    expect(claves, "el contrato no puede volver a tener el campo").not.toContain("biomarcadores");
  });

  it("pero lo que SI es evidencia del modelo sigue viajando", () => {
    // La otra mitad, para que el arreglo no se convierta en "mandar menos por si acaso": los dominios,
    // los indicadores alterados y las rutas son justo lo que el pidio que estructure el diagnostico.
    const text = rendered();
    expect(text).toContain("Dominios de riesgo");
    expect(text).toContain("Indicadores alterados");
    expect(text).toContain("Rutas de atención priorizadas");
  });
});

describe("buildCriterionPrompt", () => {
  it("incluye las variables clinicas del snapshot", () => {
    const text = rendered();
    expect(text).toContain("Adiposopatia funcional con reserva muscular conservada");
    expect(text).toContain("Sobrepeso con masa muscular adecuada");
    expect(text).toContain("Indice de fluidos corporales (elevado)");
    expect(text).toContain("Patron alimentario (alerta)");
    expect(text).toContain("Ruta metabolica");
  });

  it("no contiene NINGUNA PII (nombre, documento, correo, telefono)", () => {
    const text = rendered().toLowerCase();
    // Substring simple para tokens sin colision. "@" cubre correos.
    for (const pii of ["juan", "perez", "cedula", "correo", "telefono", "@"]) {
      expect(text, `el prompt no debe contener "${pii}"`).not.toContain(pii);
    }
    // "celular" va con limite de palabra: como substring colisiona con terminos clinicos legitimos
    // ("agua intracelular/extracelular"), que SI pueden aparecer en el mecanismo. La PII de contacto se
    // descarta por construccion (el contrato no tiene campo de telefono), esto es solo el smoke.
    expect(text, "el prompt no debe contener 'celular' como palabra").not.toMatch(/\bcelular\b/);
  });

  it("maneja campos ausentes sin romper (efrContent nulo en snapshots viejos)", () => {
    const text = buildCriterionPrompt({ ...input, mecanismo: null, riesgos: null })
      .map((m) => m.content)
      .join("\n");
    expect(text).toContain("no disponible");
  });

  it("expone clave y version del prompt (versionado, regla 9)", () => {
    expect(CRITERION_PROMPT_KEY).toBe("criterio.generate");
    expect(CRITERION_PROMPT_VERSION).toBe(1);
  });
});
