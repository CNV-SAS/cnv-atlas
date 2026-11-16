import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  computeSurveyGapsFromDomains,
  totalMissing,
} from "@/modules/clinical-pipeline/services/survey-completeness";
import { dominiosQueSePresentan } from "@/modules/evaluations/lo-que-se-presenta";
import { GI_NUNCA } from "@/modules/followups/modulo-s";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL GATE CUENTA LO QUE SE PRESENTA  ·  EL CANDADO DEL SMOKE DEL 2026-11-15  ·  BLOQUEABA LA CNV-S
//
// ═══ LOS DOS CASOS, de Santiago, con dos pacientes de prueba ═══
//
//   a) CONSULTA ANTERIOR SIN NUTRACEUTICOS: *"el formulario no muestra S1 ni S2 (decision 34) y la barra
//      dice 100 %, pero importar la BIS dice «falta completar la encuesta: faltan 2 respuestas
//      (Seguimiento (2))», y la vista de la encuesta muestra S1 y S2 «Sin responder»"*.
//   b) CON OMEGA COMPLEX "Todos los dias" Y MULTI-CELL BASE "5 o mas": *"el S2 no se presenta, pero el
//      gate dice «falta 1 respuesta (Seguimiento (1))»"*.
//
// ═══ POR QUE ES LA PEOR FORMA DEL HAZARD 6 ═══
//
// Una exigencia sobre algo que NO SE PUEDE alcanzar. El formulario decide no presentar la pregunta y la
// puerta la reclama: la profesional no tiene ninguna manera de satisfacerla, asi que la consulta de
// seguimiento se queda sin diagnostico y sin medicion. No es un contador que sobra: es un bloqueo.
//
// ═══ Y EL TERCER CASO QUE EL SMOKE NO PODIA VER ═══
//
// El gate del diagnostico contaba las preguntas de la VERSION sellada, que es la del cuestionario. O sea
// que en una CNV-S fallaba por los DOS lados a la vez: exigia los cuatro `retirar` (que no se preguntan,
// se heredan) y **no veia las siete del Modulo S**, que viven en su propia version. Un S3 sin responder
// pasaba la puerta, y el S3 es la mitad de la adherencia de su tabla 6. Por eso el caso "alguno no
// adherente" esta aqui: es el unico de los tres donde el S2 SI tiene que exigirse.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const TODOS_LOS_DIAS = "Todos los días";
const CINCO_O_MAS = "5 o más días por semana";
const NO_LO_TOMO = "No lo tomó";

/** Las siete claves digestivas que su §7.2 puede saltar. */
const SIETE = ["gi1", "gi2", "gi3", "gi4", "gi5", "gi6", "gi7"];

type Item = {
  questionId: string;
  fieldKey: string | null;
  comportamiento?: "repetir" | "repetir_con_filtro" | "confirmar" | "retirar" | "propio";
  answerValue: string | null;
};

const item = (
  fieldKey: string,
  comportamiento: Item["comportamiento"],
  answerValue: string | null,
): Item => ({ questionId: `q-${fieldKey}`, fieldKey, comportamiento, answerValue });

/**
 * El instrumento CNV-S en DOS dominios, como lo lee cualquiera de las tres puertas: el Modulo S en
 * "Seguimiento" y el resto en su dominio. El `retirar` llega SIN responder a proposito en el peor caso,
 * para comprobar que no suma un hueco por una pregunta que no se hizo.
 */
const instrumento = (opts: {
  s1: string | null;
  s2: string | null;
  s3: string | null;
  filtro: string | null;
  siete: string | null;
  retirado: string | null;
}) => [
  {
    section: "Seguimiento",
    questions: [
      item("cnvs_s1", "propio", opts.s1),
      item("cnvs_s2", "propio", opts.s2),
      item("cnvs_s3", "propio", opts.s3),
    ],
  },
  {
    section: "Alergias y digestión",
    questions: [
      item("cnvs_gi_filtro", "propio", opts.filtro),
      ...SIETE.map((k) => item(k, "repetir_con_filtro", opts.siete)),
    ],
  },
  {
    section: "Antecedentes",
    questions: [item("d5_38", "retirar", opts.retirado), item("d5_39", "repetir", "No")],
  },
];

/** La anterior con los siete en "Nunca": la condicion de su §7.2 para que el salto pueda aplicar. */
const anteriores = Object.fromEntries(SIETE.map((k) => [k, GI_NUNCA])) as Record<string, string | null>;

/** LA CUENTA QUE HACEN LAS TRES PUERTAS, exactamente como la hace `huecosDeLoPresentado`. */
const huecos = (dominios: { section: string; questions: Item[] }[], productos: { id: string }[]) =>
  computeSurveyGapsFromDomains(dominiosQueSePresentan(dominios, { anteriores, productos }));

describe("los tres casos del smoke: la puerta no pide lo que no se presento", () => {
  // ─── a) SIN NUTRACEUTICOS EN LA ANTERIOR (decision 34) ───────────────────────────────────────────
  it("sin nutraceuticos indicados, el S1 y el S2 vacios NO son huecos", () => {
    const dominios = instrumento({
      s1: null,
      s2: null,
      s3: "Todo",
      filtro: "No",
      siete: GI_NUNCA,
      retirado: null,
    });
    expect(huecos(dominios, []), "era «faltan 2 respuestas (Seguimiento (2))»").toEqual([]);
  });

  // ─── b) TODOS LOS PRODUCTOS ADHERENTES (su §2.3) ─────────────────────────────────────────────────
  it("con los dos productos adherentes, el S2 vacio NO es un hueco", () => {
    const dominios = instrumento({
      s1: JSON.stringify({ p1: TODOS_LOS_DIAS, p2: CINCO_O_MAS }),
      s2: null,
      s3: "Casi todo",
      filtro: "No",
      siete: GI_NUNCA,
      retirado: null,
    });
    expect(huecos(dominios, [{ id: "p1" }, { id: "p2" }]), "era «falta 1 respuesta»").toEqual([]);
  });

  // ─── c) ALGUNO NO ADHERENTE: AQUI SI SE EXIGE ────────────────────────────────────────────────────
  it("con uno de los dos no adherente, el S2 sin responder SI es un hueco, y en su dominio", () => {
    const dominios = instrumento({
      s1: JSON.stringify({ p1: TODOS_LOS_DIAS, p2: NO_LO_TOMO }),
      s2: null,
      s3: "Todo",
      filtro: "No",
      siete: GI_NUNCA,
      retirado: null,
    });
    expect(huecos(dominios, [{ id: "p1" }, { id: "p2" }])).toEqual([
      { section: "Seguimiento", missing: 1 },
    ]);
  });

  it("y respondido, la encuesta esta completa", () => {
    const dominios = instrumento({
      s1: JSON.stringify({ p1: TODOS_LOS_DIAS, p2: NO_LO_TOMO }),
      s2: JSON.stringify({ p2: "Lo olvidé" }),
      s3: "Todo",
      filtro: "No",
      siete: GI_NUNCA,
      retirado: null,
    });
    expect(huecos(dominios, [{ id: "p1" }, { id: "p2" }])).toEqual([]);
  });
});

// ── LO QUE EL SMOKE NO PODIA VER: EL GATE DEL DIAGNOSTICO IGNORABA EL MODULO S ───────────────────
describe("y lo que se presenta SI se exige, venga de la version que venga", () => {
  it("el S3 sin responder frena, aunque viva en la version del Modulo S", () => {
    const dominios = instrumento({
      s1: null,
      s2: null,
      s3: null,
      filtro: "No",
      siete: GI_NUNCA,
      retirado: null,
    });
    // Es la mitad de la adherencia de su tabla 6: sin el S3, `adherenciaAdecuada` devuelve null.
    expect(huecos(dominios, [])).toEqual([{ section: "Seguimiento", missing: 1 }]);
  });

  it("los siete digestivos SALTADOS no cuentan, y presentados si", () => {
    const saltados = instrumento({
      s1: null,
      s2: null,
      s3: "Todo",
      filtro: "No",
      siete: null,
      retirado: null,
    });
    expect(huecos(saltados, []), "su §7.2 los salta: no se preguntaron").toEqual([]);
    const conSintomas = instrumento({
      s1: null,
      s2: null,
      s3: "Todo",
      filtro: "Sí",
      siete: null,
      retirado: null,
    });
    expect(totalMissing(huecos(conSintomas, [])), "con sintomas se presentan los siete").toBe(7);
  });

  it("un `retirar` sin valor heredado no suma un hueco: esa pregunta no se hizo", () => {
    const dominios = instrumento({
      s1: null,
      s2: null,
      s3: "Todo",
      filtro: "No",
      siete: GI_NUNCA,
      retirado: null,
    });
    expect(huecos(dominios, []).find((g) => g.section === "Antecedentes")).toBeUndefined();
  });
});

// ── LA FORMA: UNA SOLA CUENTA PARA LAS TRES PUERTAS, Y LA VISTA MUESTRA LO MISMO ─────────────────
describe("las tres puertas y la vista leen la misma lista", () => {
  const PUERTAS = {
    "el boton de importar la BIS": "src/modules/bis/actions.ts",
    "el gate del diagnostico": "src/modules/clinical-pipeline/services/run-pipeline.ts",
    "el gate de regenerar tras corregir": "src/modules/corrections/services/correct-evaluation.ts",
  };

  for (const [nombre, ruta] of Object.entries(PUERTAS)) {
    it(`${nombre} cuenta con huecosDeLoPresentado`, () => {
      const src = sinComentarios(readFileSync(ruta, "utf8"));
      expect(src, "no pide la cuenta unica").toContain("huecosDeLoPresentado(");
      // LAS DOS MANERAS DE VOLVER A CONTAR SIN FILTRAR. `computeSurveyGaps*` solo debe llamarse desde
      // `lo-presentado-de-la-consulta`, que es quien aplica la regla antes de contar.
      expect(src, "volvio a contar el instrumento entero").not.toMatch(/computeSurveyGaps\w*\(/);
    });
  }

  it("el lector unico aplica la regla ANTES de contar", () => {
    const src = sinComentarios(
      readFileSync("src/modules/evaluations/data/lo-presentado-de-la-consulta.ts", "utf8"),
    );
    const filtra = src.indexOf("dominiosQueSePresentan(");
    const cuenta = src.indexOf("computeSurveyGapsFromDomains(");
    expect(filtra).toBeGreaterThan(-1);
    expect(cuenta).toBeGreaterThan(filtra);
    // Y LAS SOBRESCRITURAS SE APLICAN ANTES DEL FILTRO: si la profesional corrige el S1, el S2 deja de
    // aplicar en el mismo acto. Aplicarlas despues contaria un S2 que ya no se presenta.
    expect(src.indexOf("sobrescritas.has(")).toBeLessThan(filtra);
  });

  // LA VISTA ERA LA TERCERA SUPERFICIE DEL REPORTE: *"la vista de la encuesta muestra S1 y S2 «Sin
  // responder»"*. Sus dos llamadores tienen que pasarle lo presentado, no el instrumento entero.
  it("la vista de la encuesta recibe lo presentado en sus DOS llamadores", () => {
    const pantalla = sinComentarios(
      readFileSync("src/app/(app)/ani-bis-e/[id]/encuesta/page.tsx", "utf8"),
    );
    expect(pantalla).toContain("dominiosQueSePresentan(domains ?? [], cnvs ?? null)");
    expect(pantalla).toContain("<SurveyReadonly domains={presentados} />");
    expect(pantalla, "el instrumento entero volvio a la vista").not.toContain(
      "<SurveyReadonly domains={domains ?? []} />",
    );

    const entrada = sinComentarios(
      readFileSync("src/modules/evaluations/components/entrada-evaluacion.tsx", "utf8"),
    );
    expect(entrada).toContain("<SurveyReadonly domains={domains} />");
    expect(entrada, "la hoja de papel volvio al instrumento entero").not.toContain(
      "<SurveyReadonly domains={surveyDomains} />",
    );
  });

  // LAS ALERTAS CLINICAS NO SE FILTRAN, y es deliberado: se derivan de las respuestas SELLADAS, y entre
  // ellas estan las heredadas de los cuatro `retirar` (el `d5_38` alimenta el diagnostico). Filtrarlas
  // perderia un dato que el paciente SI dio, solo que en otra consulta.
  it("y las alertas clinicas siguen leyendo TODAS las respuestas", () => {
    const pantalla = sinComentarios(
      readFileSync("src/app/(app)/ani-bis-e/[id]/encuesta/page.tsx", "utf8"),
    );
    expect(pantalla).toContain("encDesdeRespuestas((domains ?? []).flatMap((d) => d.questions))");
  });

  // Y EL LECTOR VIEJO NO VUELVE: `PipelineInputs` ya no lleva `surveyGaps`, para que no haya dos
  // contadores de la misma cosa capaces de divergir.
  it("el pipeline-reader ya no cuenta huecos por su cuenta", () => {
    const src = sinComentarios(
      readFileSync("src/modules/clinical-pipeline/data/pipeline-reader.ts", "utf8"),
    );
    expect(src).not.toContain("surveyGaps");
    expect(src).not.toMatch(/computeSurveyGaps\w*\(/);
  });
});
