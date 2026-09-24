import { describe, expect, it } from "vitest";

import {
  archivoDeExportacionSchema,
  porQueNoPasa,
} from "@/modules/importacion-html/validations/archivo";

// ═══ UN RECHAZO QUE DICE QUE PASO (Santiago, 2026-09-24) ═══
//
// El primer archivo REAL de una profesional fue rechazado con "El archivo no tiene el formato del exportador
// (versión 1). Pídele al profesional que lo exporte otra vez". Ella dice que siguió los pasos, y puede que
// sea cierto: ese mensaje le echa la culpa al formato sin saberlo, y manda a repetir un trabajo que quizá ya
// estaba bien hecho.
//
// Zod YA SABÍA qué campo falló. Lo que faltaba era decirlo. Y decirlo SIN EL VALOR: el camino del campo es
// una clave y un índice; el valor sería el documento o el nombre de un paciente.

const base = {
  formato: "atlas-exportacion-html",
  version: 1,
  exportadoEn: "2026-09-24T10:00:00.000Z",
  profesional: null,
  declaracion: { version: "1.0", texto: ["a", "b", "c"], aceptadaEn: "2026-09-24T10:00:00.000Z" },
  pacientes: [{ documento: "123", clave: "atlas:123", historia: "[]", relacionadas: {} }],
};

const motivo = (crudo: unknown) => {
  const r = archivoDeExportacionSchema.safeParse(crudo);
  expect(r.success, "el caso tiene que FALLAR para que haya motivo que dar").toBe(false);
  return porQueNoPasa(crudo, r.success ? [] : r.error.issues);
};

describe("por qué no pasó un archivo", () => {
  it("CONTROL: el archivo bien formado SÍ pasa (si no, los demás casos no probarían nada)", () => {
    expect(archivoDeExportacionSchema.safeParse(base).success).toBe(true);
  });

  it("no es del exportador: lo dice, y ahí sí hay que exportar de nuevo", () => {
    const m = motivo({ pacientes: [] });
    expect(m).toContain("no trae su marca");
    expect(m).not.toContain("versión 1");
  });

  it("es del exportador pero de OTRA VERSIÓN: repetir el export no sirve, falta la copia al día", () => {
    const m = motivo({ ...base, version: 2 });
    expect(m).toContain("versión 2");
    expect(m).toContain("copia vieja");
  });

  it("SALIÓ VACÍO: es el navegador equivocado, y repetirlo ahí daría lo mismo", () => {
    // El caso de Safari o de otro perfil: el exportador corrió, pero ese navegador no tenía los pacientes.
    const m = motivo({ ...base, pacientes: [] });
    expect(m).toContain("SIN PACIENTES");
    expect(m).toContain("navegador");
  });

  it("le falta un campo: lo NOMBRA, con su camino", () => {
    const sinDeclaracion = { ...base, declaracion: { version: "1.0", texto: ["a"], aceptadaEn: "2026-09-24" } };
    const m = motivo(sinDeclaracion);
    expect(m).toContain("declaracion.texto");
    expect(m).toContain("1 paciente(s)");
  });

  it("y NUNCA dice el valor del campo, que sería PII", () => {
    const conDocumentoMalo = {
      ...base,
      pacientes: [{ documento: "", clave: "atlas:CC-1020304050", historia: null, relacionadas: {} }],
    };
    const m = motivo(conDocumentoMalo);
    // Nombra dónde está el problema...
    expect(m).toContain("pacientes.[1].documento");
    // ...y no el documento ni la clave, que identifican a una persona.
    expect(m).not.toContain("1020304050");
    expect(m).not.toContain("atlas:");
  });
});
