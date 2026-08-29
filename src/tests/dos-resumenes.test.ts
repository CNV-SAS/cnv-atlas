import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LOS DOS RESUMENES (su §11c, 2026-08-28). Su diagnostico del malentendido, textual:
//
//   "Estaban fundiendo en un solo bloque DOS RESUMENES que van en sitios distintos y responden preguntas
//    distintas. En mod ruta de atencion: el resumen del diagnostico, LAS CONDICIONES ALTERADAS DEL DFI.
//    Nada mas. En profesional: el resumen de TODAS LAS CONDICIONES CLINICAS a las que se tiene acceso con
//    la encuesta y la composicion corporal."
//
// Y su definicion de que es "el resumen del diagnostico" esta en su propio archivo, para que no lo
// interpretemos: "Resumen del diagnostico = DFI redactado como parrafo (transcripcion de los 5 dominios;
// NO redaccion libre de IA)". Por eso el candado exige el parrafo del DFI en Rutas, no una lista nuestra
// de dominios alterados.

const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");
const SECCION = readFileSync(
  "src/modules/treatment/components/profession-treatment-section.tsx",
  "utf8",
);

describe("son dos resúmenes en dos sitios, no uno fundido", () => {
  it("el del DFI va en Rutas de atención", () => {
    const rutas = PAGE.slice(PAGE.indexOf("rutas={"), PAGE.indexOf('profesion={'));
    expect(rutas).toContain("Resumen del diagnóstico");
    expect(rutas).toContain("treatmentNarrative.parrafo");
  });

  it("y va ANTES de las rutas activadas: primero qué está alterado, luego qué se activó", () => {
    const resumen = PAGE.indexOf("Resumen del diagnóstico");
    const activadas = PAGE.indexOf("Rutas de atención activadas");
    expect(resumen).toBeGreaterThan(-1);
    expect(activadas).toBeGreaterThan(-1);
    expect(resumen).toBeLessThan(activadas);
  });

  it("el del PROFESIONAL va en su subpestaña, y ya NO lleva el del DFI", () => {
    // Que el parrafo del DFI no aparezca aqui es la mitad que importa: si se queda, siguen fundidos y el
    // profesional lee dos veces lo mismo en la misma pantalla.
    expect(SECCION).toContain("narrative.parrafoProfesion");
    expect(SECCION).not.toContain("<p className=\"max-w-prose text-sm leading-relaxed text-foreground\">{narrative.parrafo}</p>");
  });

  it("el hueco del resumen del profesional se explica, no queda mudo", () => {
    // Un bloque vacio se lee como "no hay nada que decir del paciente". Tiene que decir por que.
    expect(SECCION).toContain("La encuesta no tiene datos legibles para redactar este resumen.");
  });
});

describe("las cuatro profesiones tienen su párrafo", () => {
  const READER = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");

  it("el reader cablea las cuatro, no solo la del nutricionista", () => {
    // Era el estado anterior: solo el nutricionista, y las otras tres veian "su resumen todavia no se ha
    // portado". La frase era honesta pero hacia parecer trabajo de Gildardo lo que era trabajo NUESTRO:
    // sus tres funciones llevaban meses en el archivo.
    for (const p of ["nutricionista", "medico", "entrenador", "psicologo"]) {
      expect(READER, `falta cablear ${p}`).toContain(`"${p}"`);
    }
  });

  it("y las cuatro se computan sobre el MISMO enc, construido una sola vez", () => {
    // Dos constructores del enc serían dos fuentes del mismo dato sin nada que las compare, que es como
    // se cuelan las divergencias silenciosas. Y cuesta una consulta, no dos.
    expect((READER.match(/from\("survey_answers"\)/g) ?? []).length).toBe(1);
    expect(READER).toContain("async function buildEnc(");
  });
});
