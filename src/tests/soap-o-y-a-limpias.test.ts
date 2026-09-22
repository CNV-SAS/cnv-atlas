import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { alertasDeLaConsulta } from "@/clinical-engine/alertas-de-la-consulta";
import { alertasParaElSoap, CAMPOS_DEL_PARRAFO_DE_DIETA } from "@/modules/reports/services/alertas-en-el-soap";

import { sinComentarios } from "./helpers/sin-comentarios";

vi.mock("server-only", () => ({}));
const { sinConducta } = await import("@/modules/reports/data/hc-soap-reader");
const { siglasEnMayuscula } = await import("@/modules/treatment/data/dieta-resumen-reader");

// ═══ LA O Y LA A DEL SOAP, SIN LO QUE SOBRABA (2026-09-21, segunda prueba de Santiago) ═══
//
// La O repetia peso y talla, mezclaba punto y coma, y traia conductas dentro de los rotulos ("considerar
// colágeno"). La A repetia en la lista roja lo que el parrafo de dieta ya decia, y ese parrafo traia una
// sigla en minusculas ("(pcbu)"). Cada caso aqui es uno de esos.

describe("la O", () => {
  it("un rótulo con conducta detrás del guion largo se queda con la lectura", () => {
    expect(sinConducta("Déficit matriz — considerar colágeno")).toBe("Déficit matriz");
    expect(sinConducta("Matriz limítrofe — vigilar colágeno")).toBe("Matriz limítrofe");
    // Un rótulo sin guion no cambia.
    expect(sinConducta("Sobrepeso adiposo")).toBe("Sobrepeso adiposo");
  });

  it("peso y estatura no se repiten en la tabla: ya abren la O", () => {
    const LECTOR = sinComentarios(readFileSync("src/modules/reports/data/hc-soap-reader.ts", "utf8"));
    expect(LECTOR).toContain('.filter((f) => f.clave !== "peso" && f.clave !== "talla")');
  });

  it("los valores de la composición salen con coma, como los índices", () => {
    const COMPOSICION = sinComentarios(readFileSync("src/modules/diagnoses/data/composition-clasificada.ts", "utf8"));
    expect(COMPOSICION).toContain("fmtDec(v, decimals)");
    expect(COMPOSICION).not.toContain(".toFixed(");
    for (const f of ["src/modules/reports/services/soap-a-texto.ts", "src/modules/reports/components/hc-soap.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toContain("fmtDec(soap.objetivo.pesoKg)");
    }
  });
});

describe("la A", () => {
  const rojas = alertasDeLaConsulta([
    { fieldKey: "d8_60", pregunta: "¿Con qué frecuencia come fuera de casa?", valor: "Todos los días" },
    { fieldKey: "d6_45", pregunta: "Hinchazón abdominal", valor: "Siempre" },
  ]);

  it("lo que el párrafo de dieta ya dice no se repite en la lista roja", () => {
    const soap = alertasParaElSoap(rojas, CAMPOS_DEL_PARRAFO_DE_DIETA);
    const todas = soap?.rojas.flatMap((g) => g.respuestas) ?? [];
    expect(todas.some((r) => r.includes("come fuera de casa"))).toBe(false);
    expect(todas.some((r) => r.includes("hinchazón abdominal"))).toBe(true);
  });

  it("y si el párrafo de dieta no está, la lista es la única que lo dice y se queda entera", () => {
    const todas = alertasParaElSoap(rojas)?.rojas.flatMap((g) => g.respuestas) ?? [];
    expect(todas.some((r) => r.includes("come fuera de casa"))).toBe(true);
  });

  it("las siglas de los grupos vuelven a mayúscula al mostrarse", () => {
    expect(siglasEnMayuscula("consumo elevado de ultraprocesados (pcbu)")).toBe(
      "consumo elevado de ultraprocesados (PCBU)",
    );
    // Su función, que tiene golden, no se toca: se corrige al mostrar.
    const SU_FUNCION = readFileSync("src/clinical-engine/resumen-dieta.ts", "utf8");
    expect(SU_FUNCION).toContain("defic.push(g.label.toLowerCase())");
  });
});

// ═══ LA S Y LA P, TERCERA PRUEBA (2026-09-21) ═══
describe("la S", () => {
  it("las respuestas de opción múltiple salen como texto, no como JSON", async () => {
    const { redactarDominio } = await import("@/modules/reports/services/encuesta-redactada");
    const texto = redactarDominio({
      section: "D2",
      questions: [
        {
          questionId: "q1", number: 21, questionText: "¿Qué métodos ha usado para cambiar su peso?", questionHint: null,
          questionType: "opcion_multiple", fieldKey: "d2_21", usedInDiagnosis: true,
          answerValue: '["Ejercicio excesivo","Vómito"]', options: [],
        },
      ],
    }).texto;
    expect(texto).toContain("Ejercicio excesivo, Vómito");
    expect(texto).not.toContain('["');
  });

  it("lo que ya dicen los antecedentes no se repite en la encuesta", async () => {
    const { redactarDominio } = await import("@/modules/reports/services/encuesta-redactada");
    const q = {
      questionId: "hta", number: 36, questionText: "¿Le han diagnosticado hipertensión arterial?", questionHint: null,
      questionType: "opcion", fieldKey: "d5_36", usedInDiagnosis: true, answerValue: "Sí", options: [],
    };
    expect(redactarDominio({ section: "D5", questions: [q] }, new Set(["hta"])).texto).toBe("");
    expect(redactarDominio({ section: "D5", questions: [q] }).texto).toContain("hipertensión arterial: Sí");
  });

  it("y el rótulo del grupo no se repite en su fila", () => {
    const LECTOR = sinComentarios(readFileSync("src/modules/reports/data/hc-soap-reader.ts", "utf8"));
    expect(LECTOR).toContain("a.items.map((i) => sinRotuloRepetido(a.grupo, i))");
    expect(LECTOR).toContain("preguntasDeLosAntecedentes(");
  });
});

describe("la fecha de la consulta", () => {
  it("una fecha ya formateada no se vuelve a formatear (salía 8/10/2026 por 10/9/2026)", async () => {
    const { formatDate } = await import("@/lib/format/date");
    expect(formatDate("10/9/2026")).toBe("10/9/2026");
    const PAGINA = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/soap/page.tsx", "utf8"));
    expect(PAGINA).toContain("fecha={soap.fechaConsulta}");
  });
});

describe("la P", () => {
  it("coma decimal y sin guion largo, en la pantalla y en la copia", () => {
    for (const f of ["src/modules/reports/services/soap-a-texto.ts", "src/modules/reports/components/hc-soap.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain("fmtDec(plan.proteinaGKg)");
      expect(src, f).toContain("sinGuionLargo(r.urgencia)");
    }
  });

  it("la historia clínica habla en tercera persona; el plan del paciente, de tú", () => {
    const COMPOSICION = readFileSync("src/modules/reports/data/hc-composicion.ts", "utf8");
    expect(COMPOSICION).toContain('voz: "clinica"');
    const RECS = readFileSync("src/modules/reports/data/hc-recomendaciones.ts", "utf8");
    expect(RECS).toContain('voz === "clinica" ? "para su peso" : "para tu peso"');
  });
});

// ═══ LOS CINCO DETALLES DEL SOAP (Santiago, 2026-09-22) ═══
describe("el SOAP, los detalles del 22 de septiembre", () => {
  it("el rótulo que dice lo mismo que su grupo no se repite", async () => {
    const { sinRotuloRepetido } = await import("@/modules/reports/data/hc-soap-reader");
    expect(
      sinRotuloRepetido("Exposición a contaminantes", "Exposición habitual a contaminantes: Pesticidas / agroquímicos"),
    ).toBe("Pesticidas / agroquímicos");
    expect(sinRotuloRepetido("Diagnósticos personales", "Diagnósticos personales: Obesidad")).toBe("Obesidad");
    // Y el que dice otra cosa se queda.
    expect(sinRotuloRepetido("Alergias e intolerancias", "Alergias alimentarias: Ninguna")).toBe(
      "Alergias alimentarias: Ninguna",
    );
    expect(sinRotuloRepetido("Antecedentes quirúrgicos", "Cirugía digestiva o metabólica: Ninguna")).toBe(
      "Cirugía digestiva o metabólica: Ninguna",
    );
  });

  it("la sección que ya no trae alergias se llama Digestión", async () => {
    const { sinAlergiasSiNoLasTrae } = await import("@/modules/reports/data/hc-soap-reader");
    expect(sinAlergiasSiNoLasTrae("Alergias y digestión", "Refiere hinchazón abdominal: Siempre")).toBe("Digestión");
    expect(sinAlergiasSiNoLasTrae("Alergias y digestión", "Refiere alergias alimentarias: Maní")).toBe(
      "Alergias y digestión",
    );
  });

  it("sin paréntesis anidados en la clasificación", async () => {
    const { conClasificacion } = await import("@/modules/reports/services/soap-a-texto");
    expect(conClasificacion("Ganancia real (no agua/grasa)")).toBe(" · Ganancia real (no agua/grasa)");
    expect(conClasificacion("Normal")).toBe(" (Normal)");
    expect(conClasificacion(null)).toBe("");
  });
});
