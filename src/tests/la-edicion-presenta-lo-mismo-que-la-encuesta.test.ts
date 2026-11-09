import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  dominiosQueSePresentan,
  loQueSeConservaSinPreguntar,
  loQueSePresenta,
} from "@/modules/evaluations/lo-que-se-presenta";
import { GI_NUNCA } from "@/modules/followups/modulo-s";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES PANTALLAS PRESENTAN LO MISMO  ·  EL CANDADO DEL DEFECTO DEL 2026-11-09 (TARDE)
//
// ═══ EL CASO, de Santiago ═══
//
// *"En /encuesta/editar, con los dos productos en «5 o más días», la pregunta 2 sale sin responder y
// marcada como OBLIGATORIA. Un profesional puede creer que tiene que llenarla."*
//
// Es el MISMO defecto que por la mañana en la encuesta del paciente, en otra pantalla: lo que se presenta
// estaba escrito dentro de un componente, así que las otras dos superficies tenían su propia lista, y su
// lista era "todas las preguntas del instrumento".
//
// ═══ LAS TRES SUPERFICIES, Y POR QUE LA SEGUNDA ES LA QUE MAS ENGAÑA ═══
//
//   · la encuesta del paciente (`survey-phase-form`);
//   · el bloque de la pestaña Evaluación que avisa en ÁMBAR *"Faltan N preguntas por responder"* y las
//     enlaza una por una (`entrada-evaluacion`). No encontramos ningún rótulo literal "OBLIGATORIA" en
//     estas pantallas: lo que se lee como una obligación es este aviso, con su color de advertencia y su
//     lista de enlaces;
//   · la pantalla de completar/corregir (`survey-edit-form`), más su contador y su acordeón.
//
// ═══ Y LA MITAD PELIGROSA: LO QUE NO SE PRESENTA PERO NO SE PUEDE BORRAR ═══
//
// El writer de la edición REEMPLAZA el snapshot completo, así que quitar un ítem de la pantalla sin más
// lo BORRA. Entre los cuatro `retirar` está `d5_38`, que alimenta el diagnóstico: arreglar la pantalla
// sin esto habría dejado toda consulta CNV-S editada en *"Encuesta incompleta: faltan 1 de 29"*.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const TODOS_LOS_DIAS = "Todos los días";
const CINCO_O_MAS = "5 o más días por semana";
const NO_LO_TOMO = "No lo tomó";

/** Las siete claves digestivas que su §7.2 puede saltar (las de la base son `d3_*`). */
const SIETE = ["gi1", "gi2", "gi3", "gi4", "gi5", "gi6", "gi7"];

type Fila = {
  questionId: string;
  fieldKey: string | null;
  comportamiento?: "repetir" | "repetir_con_filtro" | "confirmar" | "retirar" | "propio";
  answerValue: string | null;
};

const fila = (
  fieldKey: string | null,
  comportamiento?: Fila["comportamiento"],
  answerValue: string | null = null,
): Fila => ({ questionId: `q-${fieldKey}`, fieldKey, comportamiento, answerValue });

/** Un instrumento CNV-S mínimo: el Modulo S, el filtro con sus siete, un `retirar` y una normal. */
const instrumento = (s1: string | null, filtro: string | null, siete: string | null): Fila[] => [
  fila("cnvs_s1", "propio", s1),
  fila("cnvs_s2", "propio", null),
  fila("cnvs_s3", "propio", "Todo"),
  fila("cnvs_gi_filtro", "propio", filtro),
  ...SIETE.map((k) => fila(k, "repetir_con_filtro", siete)),
  fila("d5_38", "retirar", "No"),
  fila("d1_1", "repetir", "A veces"),
];

const SIN_SALTO = { anteriores: {} as Record<string, string | null>, productos: [{ id: "p1" }] };
/** La anterior con los siete en "Nunca": es la condición de su §7.2 para que el salto pueda aplicar. */
const CON_SALTO = {
  anteriores: Object.fromEntries(SIETE.map((k) => [k, GI_NUNCA])) as Record<string, string | null>,
  productos: [{ id: "p1" }, { id: "p2" }],
};

const claves = (dominios: { questions: Fila[] }[]) =>
  dominios.flatMap((d) => d.questions.map((q) => q.fieldKey));

describe("la regla de lo que se presenta", () => {
  const ctx = (extra: Partial<Parameters<typeof loQueSePresenta>[1]> = {}) => ({
    esCnvs: true,
    sinProductos: false,
    noAdherentes: new Set<string>(["p1"]),
    digestivosSePresentan: true,
    ...extra,
  });

  it("un `retirar` nunca se presenta, ni en la CNV-S ni en la linea base", () => {
    const items = [fila("d5_38", "retirar"), fila("d1_1", "repetir")];
    expect(loQueSePresenta(items, ctx()).map((q) => q.fieldKey)).toEqual(["d1_1"]);
    expect(
      loQueSePresenta(items, ctx({ esCnvs: false, noAdherentes: new Set() })).map((q) => q.fieldKey),
    ).toEqual(["d1_1"]);
  });

  // EL CASO EXACTO DE SANTIAGO.
  it("sin ningun producto no adherente, el S2 no se presenta", () => {
    const items = [fila("cnvs_s1", "propio"), fila("cnvs_s2", "propio")];
    expect(loQueSePresenta(items, ctx({ noAdherentes: new Set() })).map((q) => q.fieldKey)).toEqual([
      "cnvs_s1",
    ]);
  });

  it("con un producto no adherente, el S2 vuelve", () => {
    const items = [fila("cnvs_s1", "propio"), fila("cnvs_s2", "propio")];
    expect(loQueSePresenta(items, ctx()).map((q) => q.fieldKey)).toEqual(["cnvs_s1", "cnvs_s2"]);
  });

  it("sin productos indicados no se presentan ni el S1 ni el S2 (decision 34)", () => {
    const items = [fila("cnvs_s1", "propio"), fila("cnvs_s2", "propio"), fila("cnvs_s3", "propio")];
    expect(
      loQueSePresenta(items, ctx({ sinProductos: true, noAdherentes: new Set() })).map((q) => q.fieldKey),
    ).toEqual(["cnvs_s3"]);
  });

  it("los siete digestivos salen cuando su regla no los presenta, y solo ellos", () => {
    const items = [fila("cnvs_gi_filtro", "propio"), ...SIETE.map((k) => fila(k, "repetir_con_filtro"))];
    expect(loQueSePresenta(items, ctx({ digestivosSePresentan: false })).map((q) => q.fieldKey)).toEqual([
      "cnvs_gi_filtro",
    ]);
    expect(loQueSePresenta(items, ctx({ digestivosSePresentan: true })).length).toBe(8);
  });

  // `null` = el salto no aplica a esta consulta (no es CNV-S, o el instrumento no trae los siete). No es
  // lo mismo que `false`, y confundirlos dejaria la linea base sin sus preguntas digestivas.
  it("con el salto que no aplica, los siete se presentan", () => {
    const items = SIETE.map((k) => fila(k, "repetir_con_filtro"));
    expect(loQueSePresenta(items, ctx({ digestivosSePresentan: null })).length).toBe(7);
  });

  it("en la linea base no quita ni una pregunta", () => {
    const items = [fila("d1_1", "repetir"), fila("d2_21", "repetir"), fila("d5_39", "repetir")];
    expect(
      loQueSePresenta(items, {
        esCnvs: false,
        sinProductos: false,
        noAdherentes: new Set(),
        digestivosSePresentan: null,
      }).length,
    ).toBe(3);
  });
});

describe("las pantallas del profesional, sobre los dominios ya leidos", () => {
  it("con los dos productos adherentes, el S2 no sale (lo que vio Santiago)", () => {
    const dominios = [
      {
        section: "Seguimiento",
        questions: instrumento(JSON.stringify({ p1: CINCO_O_MAS, p2: CINCO_O_MAS }), "Sí", "A veces"),
      },
    ];
    expect(claves(dominiosQueSePresentan(dominios, CON_SALTO))).not.toContain("cnvs_s2");
  });

  it("y con uno de los dos no adherente, si sale", () => {
    const dominios = [
      {
        section: "Seguimiento",
        questions: instrumento(JSON.stringify({ p1: TODOS_LOS_DIAS, p2: NO_LO_TOMO }), "Sí", "A veces"),
      },
    ];
    expect(claves(dominiosQueSePresentan(dominios, CON_SALTO))).toContain("cnvs_s2");
  });

  // ES LO QUE DISTINGUE LA PANTALLA DE EDICION DE LA DE LECTURA: ahi el S1 se puede corregir, y lo que se
  // presenta tiene que moverse con el, sin recargar.
  it("el S1 EN VIVO manda sobre el guardado", () => {
    const dominios = [
      {
        section: "Seguimiento",
        questions: instrumento(JSON.stringify({ p1: CINCO_O_MAS, p2: CINCO_O_MAS }), "Sí", "A veces"),
      },
    ];
    const conVivo = dominiosQueSePresentan(dominios, CON_SALTO, {
      s1: { p1: CINCO_O_MAS, p2: NO_LO_TOMO },
    });
    expect(claves(conVivo)).toContain("cnvs_s2");
  });

  it("el filtro EN VIVO decide los siete, y el `null` del salto no se confunde con el guardado", () => {
    const dominios = [
      { section: "Seguimiento", questions: instrumento(JSON.stringify({ p1: NO_LO_TOMO }), "No", GI_NUNCA) },
    ];
    // Guardado "No" + la anterior toda en Nunca: su §7.2 los salta.
    expect(claves(dominiosQueSePresentan(dominios, CON_SALTO))).not.toContain("gi1");
    // En vivo "Sí": el paciente (o la profesional) dice que hay sintomas, y vuelven.
    expect(claves(dominiosQueSePresentan(dominios, CON_SALTO, { filtroGi: "Sí" }))).toContain("gi1");
    // En vivo sin responder todavia, con el salto posible: tampoco se presentan (no se pregunta algo que
    // va a desaparecer al responder el filtro).
    expect(claves(dominiosQueSePresentan(dominios, CON_SALTO, { filtroGi: null }))).not.toContain("gi1");
  });

  it("si la anterior NO fue toda Nunca, los siete se presentan aunque el filtro diga No", () => {
    const dominios = [
      { section: "Seguimiento", questions: instrumento(JSON.stringify({ p1: NO_LO_TOMO }), "No", "A veces") },
    ];
    expect(claves(dominiosQueSePresentan(dominios, SIN_SALTO))).toContain("gi1");
  });

  it("una consulta de linea base no pierde nada salvo lo retirado, que ahi no existe", () => {
    const dominios = [
      { section: "Hábitos", questions: [fila("d1_1", "repetir", "A veces"), fila("d2_21", "repetir", null)] },
    ];
    expect(claves(dominiosQueSePresentan(dominios, null))).toEqual(["d1_1", "d2_21"]);
  });

  it("un dominio que se queda sin preguntas no se pinta", () => {
    const dominios = [
      { section: "Seguimiento", questions: [fila("cnvs_s2", "propio", null)] },
      { section: "Hábitos", questions: [fila("d1_1", "repetir", "A veces")] },
    ];
    const salida = dominiosQueSePresentan(dominios, { anteriores: {}, productos: [{ id: "p1" }] }, {
      s1: { p1: TODOS_LOS_DIAS },
    });
    expect(salida.map((d) => d.section)).toEqual(["Hábitos"]);
  });
});

describe("lo que no se presenta pero se conserva al guardar", () => {
  const dominios = [
    {
      section: "Seguimiento",
      questions: instrumento(JSON.stringify({ p1: CINCO_O_MAS, p2: CINCO_O_MAS }), "No", GI_NUNCA),
    },
  ];

  it("el `retirar` conserva su valor heredado, que es lo que alimenta el diagnostico", () => {
    const conservados = loQueSeConservaSinPreguntar(dominios, CON_SALTO);
    expect(conservados).toContainEqual({ questionId: "q-d5_38", answerValue: "No" });
  });

  it("los siete saltados se guardan como Nunca, que es lo que su §7.2 manda", () => {
    const conservados = loQueSeConservaSinPreguntar(dominios, CON_SALTO);
    for (const k of SIETE) expect(conservados).toContainEqual({ questionId: `q-${k}`, answerValue: GI_NUNCA });
  });

  it("el S2 que no se presenta NO se conserva: responderia una pregunta que ya no aplica", () => {
    const conS2 = [
      {
        section: "Seguimiento",
        questions: [
          fila("cnvs_s1", "propio", JSON.stringify({ p1: TODOS_LOS_DIAS })),
          fila("cnvs_s2", "propio", JSON.stringify({ p1: "Lo olvidé" })),
        ],
      },
    ];
    expect(loQueSeConservaSinPreguntar(conS2, { anteriores: {}, productos: [{ id: "p1" }] })).toEqual([]);
  });

  it("un `retirar` SIN valor no se inventa", () => {
    const sinHerencia = [{ section: "Antecedentes", questions: [fila("d5_38", "retirar", null)] }];
    expect(loQueSeConservaSinPreguntar(sinHerencia, SIN_SALTO)).toEqual([]);
    const vacio = [{ section: "Antecedentes", questions: [fila("d5_38", "retirar", "  ")] }];
    expect(loQueSeConservaSinPreguntar(vacio, SIN_SALTO)).toEqual([]);
  });

  it("y los siete NO se conservan cuando se presentan: los contesta quien los ve", () => {
    const presentados = [
      { section: "Seguimiento", questions: instrumento(null, "Sí", "A veces") },
    ];
    const conservados = loQueSeConservaSinPreguntar(presentados, CON_SALTO);
    expect(conservados.map((c) => c.questionId)).toEqual(["q-d5_38"]);
  });
});

// ── LA FORMA: NINGUNA DE LAS TRES PANTALLAS VUELVE A TENER SU PROPIA LISTA ───────────────────────
describe("las tres pantallas leen la regla compartida", () => {
  const sinComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  const FUENTES = {
    "la encuesta del paciente": "src/modules/evaluations/components/survey-phase-form.tsx",
    "la pantalla de edicion": "src/modules/evaluations/components/survey-edit-form.tsx",
    "la pestaña Evaluacion": "src/modules/evaluations/components/entrada-evaluacion.tsx",
  };

  for (const [nombre, ruta] of Object.entries(FUENTES)) {
    it(`${nombre} llama a la regla y no filtra por su cuenta`, () => {
      const src = sinComentarios(readFileSync(ruta, "utf8"));
      expect(src, "no llama a la regla compartida").toMatch(/loQueSePresenta|dominiosQueSePresentan/);
      // Las dos cadenas con las que se escribiria una segunda definicion de lo que se presenta.
      expect(src, "volvio a decidir el S2 por su cuenta").not.toContain('"cnvs_s2" &&');
      expect(src, "volvio a decidir los retirados por su cuenta").not.toContain('=== "retirar"');
    });
  }

  it("la pantalla de edicion manda lo que no presenta pero se conserva", () => {
    const src = readFileSync("src/modules/evaluations/components/survey-edit-form.tsx", "utf8");
    // Sin esto, arreglar la pantalla BORRA la herencia de los `retirar` (el writer reemplaza el snapshot).
    expect(src).toContain("loQueSeConservaSinPreguntar");
    expect(src).toContain("collectAnswers(new FormData(e.currentTarget), presentados, conservados)");
  });

  it("y los contadores de las dos pantallas salen de lo presentado", () => {
    const edicion = readFileSync("src/modules/evaluations/components/survey-edit-form.tsx", "utf8");
    expect(edicion).toContain("presentados.reduce((acc, d) => acc + d.questions.length, 0)");
    const entrada = readFileSync("src/modules/evaluations/components/entrada-evaluacion.tsx", "utf8");
    expect(entrada).toContain("dominiosQueSePresentan(surveyDomains ?? [], cnvs ?? null)");
  });
});
