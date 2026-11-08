import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  adherenciaAdecuada,
  clavesAConfirmar,
  CLAVE_ANTECEDENTES_FAMILIARES,
  medicionComparable,
  saltoDeLosDigestivos,
  S1_OPCIONES,
  tocaReconfirmacionAnual,
} from "@/modules/followups/modulo-s";
import { CNVS_ACTIVA, instrumentoParaLaConsulta } from "@/modules/evaluations/instrumento";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CUATRO REGLAS DEL MODULO S  ·  v15 §2.3, §2.7, §7.2 y §7.3
//
// Son reglas de Gildardo sobre lo que se le pregunta a un paciente y sobre si su medicion entra a un
// analisis. Cada una tiene un error facil que no falla en voz alta, y cada caso de aqui existe por uno
// de ellos: el O donde el escribio un Y, el salto que deja huecos, el item 38 que no vuelve nunca, y la
// adherencia que se declara insuficiente sobre una encuesta a medias.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const DOS_PRODUCTOS = { "prod-a": "Todos los días", "prod-b": "5 o más días por semana" };

describe("la adherencia: las DOS mitades de su regla", () => {
  it("adecuada cuando los productos van bien Y el plan tambien", () => {
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: "Todo", s4: [] })).toBe(true);
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: "Casi todo", s4: [] })).toBe(true);
  });

  it("y basta UN producto flojo para que no lo sea", () => {
    expect(
      adherenciaAdecuada({
        s1: { ...DOS_PRODUCTOS, "prod-c": "Menos de 5 días por semana" },
        s3: "Todo",
        s4: [],
      }),
      "su regla dice «para todos los indicados»",
    ).toBe(false);
  });

  it("y el plan flojo tambien la tumba, aunque los productos vayan perfecto", () => {
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: "La mitad", s4: [] })).toBe(false);
  });

  it("SIN NINGUN PRODUCTO INDICADO se decide solo con el S3, que es la decision 34", () => {
    // Su razon esta medida: de los 30 pacientes con dos o mas consultas, 18 no tienen ningun
    // nutraceutico en la anterior. Exigir el S1 ahi dejaria a la mayoria sin adherencia calculable, y
    // `cnvsAdherenciaAdecuada` es uno de los dos ejes de su tabla 6.
    expect(adherenciaAdecuada({ s1: null, s3: "Todo", s4: [] })).toBe(true);
    expect(adherenciaAdecuada({ s1: {}, s3: "Poco", s4: [] })).toBe(false);
  });

  it("y SIN S3 no se dice nada: null, no «insuficiente»", () => {
    // Declarar insuficiente sobre una encuesta a medias le atribuye al paciente algo que no dijo, y su
    // tabla 6 cruzaria el delta con un eje inventado.
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: null, s4: [] })).toBeNull();
    expect(adherenciaAdecuada({ s1: DOS_PRODUCTOS, s3: "  ", s4: [] })).toBeNull();
  });

  it("las cinco opciones del S1 son las suyas, en su orden", () => {
    expect([...S1_OPCIONES]).toEqual([
      "Todos los días",
      "5 o más días por semana",
      "Menos de 5 días por semana",
      "No lo tomó",
      "Lo suspendió",
    ]);
  });
});

describe("la medicion no comparable: SUS TRES eventos, no los seis", () => {
  it("los tres que el nombra la vuelven no comparable", () => {
    for (const e of [
      "Enfermedad aguda (fiebre, infección, diarrea)",
      "Hospitalización o cirugía",
      "Embarazo o lactancia",
    ]) {
      expect(medicionComparable({ s1: null, s3: "Todo", s4: [e] }), e).toBe(false);
    }
  });

  it("y los otros tres NO, que es donde esta el error facil", () => {
    // Un medicamento nuevo, un cambio de turno o un evento estresante son contexto que el profesional
    // tiene que ver, pero no invalidan la bioimpedancia. Metidos aqui, casi nadie entraria al delta y la
    // tarjeta de seguimiento no compararia nunca.
    for (const e of ["Medicamento nuevo", "Cambio de turno o de trabajo", "Evento estresante mayor"]) {
      expect(medicionComparable({ s1: null, s3: "Todo", s4: [e] }), e).toBe(true);
    }
  });

  it("sin S4 respondido, comparable: lo que la encuesta no dice no es un evento", () => {
    expect(medicionComparable({ s1: null, s3: null, s4: null })).toBe(true);
    expect(medicionComparable({ s1: null, s3: null, s4: ["Ninguno"] })).toBe(true);
  });
});

describe("el salto de los sintomas digestivos: sus DOS condiciones son un Y", () => {
  const SIETE = ["d6_45", "d6_46", "d6_47", "d6_48", "d6_49", "d6_50", "d6_51"];
  const todasNunca = Object.fromEntries(SIETE.map((k) => [k, "Nunca"]));

  it("se salta con «No» hoy Y los siete en «Nunca» la vez pasada", () => {
    const r = saltoDeLosDigestivos("No", todasNunca, SIETE);
    expect(r.seSalta).toBe(true);
    // Y SE GUARDAN LOS SIETE: un salto que deja huecos convierte una regla de ahorro en una encuesta
    // incompleta, y el gate del diagnostico la frenaria.
    expect(r.seSalta && r.seGuardan).toEqual(Array(7).fill("Nunca"));
  });

  it("NO se salta con «No» hoy si la vez pasada habia algun sintoma", () => {
    // Es el error de escribirlo como un O: se saltarian los siete de un paciente que la vez pasada tenia
    // reflujo frecuente, y su historia diria "Nunca" sobre un sintoma que nadie volvio a preguntar.
    const conReflujo = { ...todasNunca, d6_50: "Frecuente" };
    expect(saltoDeLosDigestivos("No", conReflujo, SIETE).seSalta).toBe(false);
  });

  it("no se salta con «Sí», aunque la vez pasada fueran todas nunca", () => {
    expect(saltoDeLosDigestivos("Sí", todasNunca, SIETE).seSalta).toBe(false);
  });

  it("no se salta sin consulta anterior, ni si falta alguno de los siete", () => {
    expect(saltoDeLosDigestivos("No", null, SIETE).seSalta).toBe(false);
    const faltaUno = { ...todasNunca };
    delete (faltaUno as Record<string, string>).d6_48;
    expect(saltoDeLosDigestivos("No", faltaUno, SIETE).seSalta).toBe(false);
  });

  it("y sin responder el filtro tampoco: se presenta", () => {
    expect(saltoDeLosDigestivos(null, todasNunca, SIETE).seSalta).toBe(false);
  });
});

describe("la reconfirmacion anual, y el item 38 que vuelve con ella", () => {
  it("un año o mas, con el corte CERRADO como el lo escribio", () => {
    expect(tocaReconfirmacionAnual("2025-11-07", "2026-11-07")).toBe(true);
    expect(tocaReconfirmacionAnual("2026-01-01", "2026-11-07")).toBe(false);
  });

  it("sin confirmacion completa anterior no toca, y no se inventa una", () => {
    expect(tocaReconfirmacionAnual(null, "2026-11-07")).toBe(false);
  });

  it("EL ITEM 38 VUELVE SOLO EN LA RECONFIRMACION, y es el unico retirado que vuelve", () => {
    // En una CNV-S normal el 38 (antecedentes familiares) esta RETIRADO por su tabla 3, asi que no se
    // pregunta nunca. Sin esto, los antecedentes familiares de un paciente se preguntarian UNA VEZ en su
    // vida, y la reconfirmacion anual existe justo para eso.
    const OCHO = ["d3_28", "d4_34", "d5_39", "d5_40", "d5_42", "d6_43", "d6_44", "d8_59"];
    expect(clavesAConfirmar(OCHO, false)).not.toContain(CLAVE_ANTECEDENTES_FAMILIARES);
    expect(clavesAConfirmar(OCHO, true)).toContain(CLAVE_ANTECEDENTES_FAMILIARES);
    expect(clavesAConfirmar(OCHO, true)).toHaveLength(9);
    // Y no se duplica si ya estuviera en la lista.
    expect(clavesAConfirmar([...OCHO, CLAVE_ANTECEDENTES_FAMILIARES], true)).toHaveLength(9);
  });
});

describe("y la CNV-S NO esta activa para ningun paciente", () => {
  it("el interruptor esta apagado", () => {
    expect(CNVS_ACTIVA, "la CNV-S se activo sin el smoke en navegador").toBe(false);
  });

  it("asi que un seguimiento sigue usando la encuesta completa", () => {
    expect(instrumentoParaLaConsulta("inicial")).toBe("CNV v2.0");
    expect(instrumentoParaLaConsulta("seguimiento")).toBe("CNV v2.0");
  });

  it("y el instrumento lo decide UNA sola funcion, no cada pantalla", () => {
    // Si cada pantalla resolviera su instrumento, el dia que la regla cambie habria que encontrarlas
    // todas, y la que se quede atras aplicaria OTRO cuestionario sin que nada fallara.
    const FUENTE = sinComentarios(readFileSync("src/modules/evaluations/instrumento.ts", "utf8"));
    expect(FUENTE).toContain("export function instrumentoParaLaConsulta");
    expect(FUENTE).toContain("export const CNVS_ACTIVA = false;");
  });
});
