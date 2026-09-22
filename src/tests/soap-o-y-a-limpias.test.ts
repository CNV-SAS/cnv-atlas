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
