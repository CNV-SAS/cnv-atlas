import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { alertasDeLaConsulta, type RespuestaConPregunta } from "@/clinical-engine/alertas-de-la-consulta";
import { alertasParaElSoap } from "@/modules/reports/services/alertas-en-el-soap";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO DE LAS ALERTAS DE LA CONSULTA (observación g, 2026-09-21) ═══
//
// LO QUE SE DECIDIO con Santiago y Gildardo: en el segundo parrafo del resumen de IA y en la primera linea
// de la A del SOAP van las alertas de sus reglas y las respuestas en ROJO de su clasificador. El ambar no,
// la composicion no, y sin duplicados.
//
// Y LO QUE PUEDE ROMPERSE SIN QUE NADA FALLE: que la IA y el SOAP dejen de leer la MISMA lista. Entonces
// el resumen nombraria lo que la historia no tiene, que es la peor forma de perder la confianza en las dos.

const p = (fieldKey: string, pregunta: string, valor: string): RespuestaConPregunta => ({ fieldKey, pregunta, valor });

const SUENO_ROJO = p("d3_26", "¿Cuántas horas duerme por noche?", "Menos de 5h");
const SUENO_AMBAR = p("d3_26", "¿Cuántas horas duerme por noche?", "6–7 horas");

describe("qué entra", () => {
  it("una respuesta en rojo entra, con su pregunta y lo que respondió", () => {
    const { respuestasEnRojo } = alertasDeLaConsulta([SUENO_ROJO]);
    expect(respuestasEnRojo).toEqual([
      { fieldKey: "d3_26", dominio: "D3 · Hábitos de Vida", pregunta: "¿Cuántas horas duerme por noche?", respuesta: "Menos de 5h" },
    ]);
  });

  it("el ámbar NO entra: su color dice vigilar, no alerta", () => {
    expect(alertasDeLaConsulta([SUENO_AMBAR]).respuestasEnRojo).toEqual([]);
  });

  it("D1 no entra por aquí: el patrón alimentario tiene su propia lectura", () => {
    expect(alertasDeLaConsulta([p("d1_13_i", "Azúcares", "Todos")]).respuestasEnRojo).toEqual([]);
  });
});

describe("sin duplicados", () => {
  it("si la respuesta dispara una regla suya, sale una vez, como la regla", () => {
    // Laxantes en la 21 es rojo en su clasificador Y dispara "TCA activo detectado". Sale la regla.
    const { reglas, respuestasEnRojo } = alertasDeLaConsulta([
      p("d2_21", "¿Ha usado alguna de estas conductas?", '["Laxantes"]'),
    ]);
    expect(reglas.map((a) => a.t)).toContain("TCA activo detectado");
    expect(respuestasEnRojo.map((r) => r.fieldKey)).not.toContain("d2_21");
  });

  it("la actividad física se juzga con dos preguntas y sale como un solo hallazgo", () => {
    const { respuestasEnRojo } = alertasDeLaConsulta([
      p("d3_23", "¿Cuántos días/semana hace actividad física?", "3"),
      p("d3_24", "¿Cuánto dura cada sesión?", "0 minutos a la semana"),
    ]);
    expect(respuestasEnRojo).toHaveLength(1);
    expect(respuestasEnRojo[0].respuesta).toBe("3 · 0 minutos a la semana");
  });
});

describe("lo primero de la A del SOAP", () => {
  const reglas = [
    { niv: "moderado" as const, ico: "", t: "Estrés alto + azúcares elevados", txt: "Patrón de alimentación emocional probable.", dom: "D3+D1" },
    { niv: "crítico" as const, ico: "", t: "TCA activo detectado", txt: "Derivación urgente a psicología/psiquiatría.", dom: "D2" },
  ];

  it("las alertas en una línea, ordenadas por nivel", () => {
    expect(alertasParaElSoap({ reglas, respuestasEnRojo: [] })?.reglas).toBe(
      "TCA activo detectado (crítico); Estrés alto + azúcares elevados (moderado)",
    );
  });

  it("y las respuestas en rojo AGRUPADAS POR DOMINIO: casi quince seguidas no se leían", () => {
    const soap = alertasParaElSoap({
      reglas: [],
      respuestasEnRojo: alertasDeLaConsulta([
        p("d6_45", "Hinchazón abdominal", "Siempre"),
        p("d3_26", "¿Cuántas horas duerme por noche?", "Menos de 5h"),
        p("d6_46", "Gases / flatulencia", "Siempre"),
      ]).respuestasEnRojo,
    });
    expect(soap?.rojas).toEqual([
      { dominio: "D6 · Salud Digestiva", respuestas: ["hinchazón abdominal: Siempre", "gases / flatulencia: Siempre"] },
      { dominio: "D3 · Hábitos de Vida", respuestas: ["cuántas horas duerme por noche: Menos de 5h"] },
    ]);
  });

  it("NUNCA lleva la conducta de la alerta: eso lo decide quien firma", () => {
    expect(JSON.stringify(alertasParaElSoap({ reglas, respuestasEnRojo: [] }))).not.toContain("Derivación");
  });

  it("sin nada que decir, no hay bloque", () => {
    expect(alertasParaElSoap({ reglas: [], respuestasEnRojo: [] })).toBeNull();
  });
});

describe("una sola fuente para la IA y el SOAP", () => {
  it("los dos leen `alertasDeLaConsulta`", () => {
    const IA = sinComentarios(readFileSync("src/modules/diagnoses/data/criterion-input-reader.ts", "utf8"));
    const SOAP = sinComentarios(readFileSync("src/modules/reports/data/hc-soap-reader.ts", "utf8"));
    expect(IA).toContain("alertasDeLaConsulta(");
    expect(SOAP).toContain("alertasDeLaConsulta(");
  });

  it("y la S sigue sin semáforo: la alerta es la lectura, no la respuesta", () => {
    const REDACCION = sinComentarios(readFileSync("src/modules/reports/services/encuesta-redactada.ts", "utf8"));
    expect(REDACCION).not.toContain("nivelDeRespuesta");
    expect(REDACCION).not.toContain("alertasDeLaConsulta");
  });

  it("la pantalla y el texto copiado imprimen la misma línea", () => {
    const PANTALLA = readFileSync("src/modules/reports/components/hc-soap.tsx", "utf8");
    const COPIA = readFileSync("src/modules/reports/services/soap-a-texto.ts", "utf8");
    expect(PANTALLA).toContain("soap.analisis.alertas.rojas.map(");
    expect(COPIA).toContain("alertasEnTexto(soap.analisis.alertas)");
    // Y la copia no arrastra el motor al navegador: el boton de copiar corre en el cliente.
    expect(COPIA).not.toContain("clinical-engine");
  });
});
