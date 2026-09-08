import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LAS OBSERVACIONES · VIGENTE EN PANTALLA, TODAS EN EL DOCUMENTO (2026-09-08).
//
// EL PROBLEMA QUE RESUELVE. Santiago pidio que una observacion nueva "reemplace" a la anterior, para que
// el profesional pueda corregirse. Pero `treatment_notes` es APPEND-ONLY POR DECISION DE GILDARDO (§8 del
// 2026-08-30), asi que pisar o borrar iria contra eso.
//
// LA SALIDA ES LA MISMA QUE YA USO EL CRITERIO (cotejo 2026-09-06, punto 13a): la ultima se marca como
// VIGENTE y las anteriores quedan PLEGADAS, no borradas. Lo que se decide es cual MANDA, no cual existe.
//
// Y LA MITAD QUE NO ES OBVIA: en el DOCUMENTO salen TODAS.
//
//   · La historia clinica es probatoria, y el append-only existe justamente para que no se pierda lo
//     escrito. Enseñar solo la ultima deshace esa garantia donde mas importa: una auditoria que pregunte
//     "que dijo el profesional" veria la version corregida sin rastro de que hubo correccion.
//   · Y se MARCA la vigente, para que el lector no la deduzca del orden: sin la marca, dos parrafos
//     parecidos se leen como dos observaciones distintas y no como una y su correccion.
//
// Es la distincion entre PANTALLA y DOCUMENTO: la pantalla ayuda a quien escribe, el documento registra
// lo que paso. Va como pregunta a Gildardo, porque el contenido del documento es suyo.

const OBS = readFileSync("src/modules/followups/components/observaciones-consulta.tsx", "utf8");
const HC = readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8");
const PDF = readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8");
const WRITER = readFileSync("src/modules/treatment/data/treatment-writer.ts", "utf8");

describe("en pantalla manda la ULTIMA y las anteriores se pliegan", () => {
  it("hay una vigente rotulada, no una lista donde haya que deducirla", () => {
    expect(OBS).toContain("Observación vigente");
    expect(OBS).toContain("lista[lista.length - 1]");
    expect(OBS).toContain("lista.slice(0, -1)");
  });

  it("las anteriores se PLIEGAN, no desaparecen", () => {
    // Quien escribio una tiene que poder releerla: es registro clinico, no un borrador.
    expect(OBS).toContain("<details");
    expect(OBS).toMatch(/observaci[oó]n(es)? anterior(es)?/i);
  });

  it("y la vigente es POR PROFESION, que es la otra mitad de su §8", () => {
    // "Cada rol escribe lo suyo y no se pisan": la ultima nota del medico no deja de valer porque la
    // nutricionista escriba despues. Si la vigente se calculara sobre la lista entera, la de un rol
    // taparia la del otro.
    const i = OBS.indexOf("porProfesion.entries()");
    const j = OBS.indexOf("lista[lista.length - 1]");
    expect(i, "desapareció la agrupación por profesión").toBeGreaterThan(-1);
    expect(j, "la vigente se calcula fuera del grupo de profesión").toBeGreaterThan(i);
  });

  it("y NADA de esto toca el registro: sigue siendo append-only", () => {
    // La mitad que hace legitimo el "reemplazo": es de PRESENTACION. Si aquí apareciera un update o un
    // delete, estaríamos yendo contra su §8 con la excusa de una mejora de interfaz.
    const limpio = sinComentarios(WRITER);
    const bloque = limpio.slice(
      limpio.indexOf("export async function addTreatmentNote"),
      limpio.indexOf("export async function addTreatmentNote") + 700,
    );
    expect(bloque).toContain("insert(treatmentNotes)");
    expect(bloque, "un update aquí convertiría el 'vigente' en un pisado").not.toContain(
      "update(treatmentNotes)",
    );
    expect(sinComentarios(OBS), "la pantalla no puede borrar notas").not.toContain("delete");
  });
});

describe("en el documento salen TODAS, con la vigente marcada", () => {
  it("la historia clínica no filtra: mapea la lista entera", () => {
    // Si algún día esto se convirtiera en "solo la última", el documento escondería la corrección.
    expect(HC).toContain("observaciones.map");
    expect(HC, "el documento no puede quedarse con una sola").not.toContain(
      "observaciones[observaciones.length - 1]]",
    );
    expect(HC).toContain("· vigente");
  });

  it("y el PDF dice lo mismo que la pantalla del documento", () => {
    // Dos superficies del MISMO documento: si una marca la vigente y la otra no, el mismo acto clínico
    // se lee distinto según por dónde se mire. Ya nos pasó con los dos canales del plan.
    expect(PDF).toContain("hc.observaciones.map");
    expect(PDF).toContain("· vigente");
  });

  it("la marca solo aparece cuando hay MAS DE UNA", () => {
    // Con una sola observación, "vigente" no distingue nada y solo añade ruido a un documento clínico.
    expect(HC).toContain("observaciones.length > 1");
    expect(PDF).toContain("hc.observaciones.length > 1");
  });
});

describe("el campo se vacía al guardar, sin reabrir el hazard del auto-reset", () => {
  it("se vacía por KEY derivada de lo que el servidor guardó, no por form.reset()", () => {
    // Dejar el texto invita a pulsar dos veces, y siendo append-only la segunda pulsación DUPLICA una
    // nota que no se puede borrar. Se vacía cuando la nota EXISTE (cambia `notas.length`), no cuando la
    // acción vuelve: si el servidor rechaza, lo escrito se queda.
    expect(OBS).toContain("key={`nota-${notas.length}`}");
    // SOBRE EL CODIGO SIN COMENTARIOS, porque la explicacion de ARRIBA menciona `form.reset()` para decir
    // que NO se usa: un candado sobre el texto crudo se pondria rojo por su propia documentacion. Es la
    // tercera vez esta semana que me pasa, y por eso existe el helper.
    expect(sinComentarios(OBS), "un reset explícito sí reabriría el hazard").not.toContain(".reset()");
  });

  it("y el formulario sigue sin usar la prop `action`", () => {
    // Hazard 2 de CLAUDE.md: la prop `action` programa un reset nativo del formulario ENTERO tras la
    // acción. Lo puso rojo su candado el mismo día que escribí este componente.
    expect(OBS).toContain("onSubmit={enviarSinReset(action)}");
    expect(OBS).not.toMatch(/<form\s+action=/);
  });
});
