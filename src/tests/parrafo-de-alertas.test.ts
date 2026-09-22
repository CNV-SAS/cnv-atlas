import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { insertarParrafoDeAlertas, parrafoDeAlertas } from "@/modules/diagnoses/services/parrafo-de-alertas";

import { sinComentarios } from "./helpers/sin-comentarios";

vi.mock("server-only", () => ({}));
const { direccionDeLaPabu } = await import("@/modules/diagnoses/data/criterion-input-reader");

// ═══ CANDADO DEL PARRAFO DE ALERTAS QUE ESCRIBE ATLAS (v8, 2026-09-21) ═══
//
// En tres pruebas el modelo fallo la lista: omitio los digestivos, coló lo que no era rojo y, dos veces, se
// comio la alerta CRITICA de TCA. Desde la v8 el parrafo lo compone Atlas. Lo que este candado guarda es lo
// que el modelo no podia garantizar: TODAS y SOLO ESAS, y nunca la conducta de la regla.

const alertas = [
  { nivel: "moderado", titulo: "Estrés alto + azúcares elevados", dominio: "D3+D1" },
  { nivel: "crítico", titulo: "TCA activo detectado", dominio: "D2" },
  { nivel: "alto", titulo: "Deshidratación probable", dominio: "D1+D7" },
];
const rojas = [
  { dominio: "D6 · Salud Digestiva", pregunta: "Hinchazón abdominal", respuesta: "Siempre" },
  { dominio: "D6 · Salud Digestiva", pregunta: "Náuseas", respuesta: "Siempre" },
  { dominio: "D3 · Hábitos de Vida", pregunta: "¿Cuántas horas duerme por noche?", respuesta: "Menos de 5h" },
];

describe("el párrafo", () => {
  const p = parrafoDeAlertas(alertas, rojas, "Masculino") ?? "";

  it("trae TODAS las alertas, la crítica primero", () => {
    expect(p.indexOf("TCA activo detectado (crítico)")).toBeGreaterThan(-1);
    expect(p.indexOf("TCA activo detectado")).toBeLessThan(p.indexOf("Deshidratación probable"));
    expect(p.indexOf("Deshidratación probable")).toBeLessThan(p.indexOf("Estrés alto"));
  });

  it("y TODAS las rojas, agrupadas por dominio, tal cual respondió", () => {
    expect(p).toContain("en salud digestiva, hinchazón abdominal: Siempre; náuseas: Siempre");
    expect(p).toContain("en hábitos de vida, cuántas horas duerme por noche: Menos de 5h");
  });

  it("y nada más: ni la conducta de la regla ni una respuesta que no se le dio", () => {
    expect(p).not.toContain("Derivación");
    expect(p).not.toContain("carnes");
  });

  it("respeta el género", () => {
    expect(parrafoDeAlertas([], rojas, "Femenino")).toContain("la paciente");
    expect(parrafoDeAlertas([], rojas, "Masculino")).toContain("el paciente");
  });

  it("sin nada, no hay párrafo", () => {
    expect(parrafoDeAlertas([], [], "Masculino")).toBeNull();
  });
});

describe("dónde va", () => {
  it("después de la apertura que escribió el modelo", () => {
    const texto = "Apertura del caso.\n\nDominio celular.\n\nCierre.";
    expect(insertarParrafoDeAlertas(texto, "ALERTAS.")).toBe("Apertura del caso.\n\nALERTAS.\n\nDominio celular.\n\nCierre.");
  });

  it("si el modelo no separó párrafos, va detrás de todo: nunca se pierde", () => {
    expect(insertarParrafoDeAlertas("Un solo bloque.", "ALERTAS.")).toBe("Un solo bloque.\n\nALERTAS.");
  });

  it("sin párrafo que insertar, el texto queda igual", () => {
    expect(insertarParrafoDeAlertas("Texto.", null)).toBe("Texto.");
  });

  it("y el servicio lo inserta sobre el texto ya limpio, con los datos del prompt", () => {
    const S = sinComentarios(readFileSync("src/modules/diagnoses/services/generate-criterion.ts", "utf8"));
    expect(S).toContain("insertarParrafoDeAlertas(");
    expect(S).toContain("parrafoDeAlertas(input.alertas, input.respuestasEnRojo, input.sexo)");
  });
});

describe("la dirección de la PABU, resuelta de la cifra", () => {
  it("por debajo y por encima de φ", () => {
    expect(direccionDeLaPabu(1.202)).toBe("por debajo de φ = 1,618 (1,202)");
    expect(direccionDeLaPabu(2.362)).toBe("por encima de φ = 1,618 (2,362)");
    expect(direccionDeLaPabu(null)).toBeNull();
  });
});
