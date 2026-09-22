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
    expect(p).toContain("\nSalud digestiva. Hinchazón abdominal: Siempre; náuseas: Siempre.");
    expect(p).toContain("\nHábitos de vida. Cuántas horas duerme por noche: Menos de 5h.");
    // Lista limpia, no prosa encadenada (Santiago, 2026-09-22).
    expect(p).not.toContain(". Y en ");
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
    expect(direccionDeLaPabu(1.202)).toBe("la PABU (1,202) está por debajo de φ = 1,618, lo que se lee como exceso de adiposidad");
    expect(direccionDeLaPabu(2.362)).toBe("la PABU (2,362) está por encima de φ = 1,618, lo que se lee como déficit estructural");
    expect(direccionDeLaPabu(null)).toBeNull();
  });
});

// ═══ EL CIERRE LO ESCRIBE ATLAS (v10, 2026-09-22) ═══
describe("el cierre de las rutas", () => {
  const rutas = "Ruta 3 (Conductual), crítica; Ruta 4 (Desaceleración del Envejecimiento), prioritaria";

  it("nombra las rutas con su prioridad, sin códigos ni conductas, y el veto cuando lo hay", async () => {
    const { parrafoDeCierre } = await import("@/modules/diagnoses/services/parrafo-de-alertas");
    const c = parrafoDeCierre(rutas, true) ?? "";
    expect(c).toContain("se activan estas rutas de atención: Ruta 3 (Conductual), crítica;");
    expect(c).toContain("el abordaje psicológico va primero y se excluye la restricción calórica");
    expect(c).not.toMatch(/R\d\s*·|para abordar/);
    expect(parrafoDeCierre(rutas, false)).not.toContain("veto");
    expect(parrafoDeCierre(null, true)).toBeNull();
  });

  it("quita el cierre del modelo y pone el de Atlas, sin tocar los dominios", async () => {
    const { conCierreDeAtlas } = await import("@/modules/diagnoses/services/parrafo-de-alertas");
    const texto = [
      "Apertura.",
      "En el dominio Epigenético-Contextual, el ICEC es 33.",
      "Las Rutas de Atención son la R3 · Conductual (prioritaria) para abordar las conductas.",
      "El veto conductual activo exige priorizar la intervención psicológica.",
    ].join("\n\n");
    expect(conCierreDeAtlas(texto, "CIERRE.")).toBe(
      "Apertura.\n\nEn el dominio Epigenético-Contextual, el ICEC es 33.\n\nCIERRE.",
    );
    // Sin narrativa del DFI, el texto queda como estaba.
    expect(conCierreDeAtlas(texto, null)).toBe(texto);
  });

  it("y el servicio lo aplica sobre el texto con las alertas ya insertadas", () => {
    const S = sinComentarios(readFileSync("src/modules/diagnoses/services/generate-criterion.ts", "utf8"));
    expect(S).toContain("parrafoDeCierre(input.rutasActivadas, input.veto)");
    expect(S).toContain("conCierreDeAtlas(");
  });
});
