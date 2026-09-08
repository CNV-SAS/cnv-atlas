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
const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");

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

describe("en el DOCUMENTO sale solo la vigente, con su línea de rastro", () => {
  // CAMBIO DE DECISION (Santiago, 2026-09-08), y el candado la sigue con su razon: yo habia puesto TODAS
  // porque un documento probatorio que enseña solo la version corregida esconde que hubo correccion.
  // Santiago prefirio la vigente, con el historico en Seguimiento, y NO descarto el argumento: lo
  // resolvio con una LINEA. Se ajusta lo que se afirma porque cambio la decision, no porque estorbara.
  it("las dos superficies usan LA MISMA reducción, no una cada una", () => {
    // Es lo unico que impide que el mismo acto clinico se lea distinto segun por donde se mire.
    expect(HC).toContain("observacionesVigentes(");
    expect(PDF).toContain("observacionesVigentes(");
    expect(HC).toContain("lineaDeReemplazo(");
    expect(PDF).toContain("lineaDeReemplazo(");
  });

  it("y la línea dice CUANTAS, DESDE CUANDO y DONDE están", () => {
    // Sin las tres cosas el rastro no sirve: "hubo mas" sin decir cuantas ni donde deja al lector sabiendo
    // que le falta algo y sin poder ir a buscarlo.
    const M = readFileSync("src/modules/reports/data/observaciones-vigentes.ts", "utf8");
    expect(M).toContain("Esta observación reemplaza a");
    expect(M).toContain("desde el");
    expect(M).toContain("registradas en el seguimiento");
    expect(M, "y que el original no se borra, que es lo que sostiene el rastro").toContain(
      "no se borran",
    );
  });

  it("la línea NO aparece cuando no hay anteriores", () => {
    // Con una sola observacion no hay nada que rastrear, y la frase seria ruido en un documento clinico.
    const M = readFileSync("src/modules/reports/data/observaciones-vigentes.ts", "utf8");
    expect(M).toContain("if (o.reemplaza === 0) return null;");
  });

  it("la vigente es POR PROFESION también en el documento", () => {
    // Su §8: la vigente del medico no la reemplaza la nutricionista. Reducir sobre la lista entera taparia
    // la de un rol con la del otro.
    const M = readFileSync("src/modules/reports/data/observaciones-vigentes.ts", "utf8");
    expect(M).toContain("o.profesion ?? \"sin-profesion\"");
  });

  it("y la PROFESION llega también a la pantalla del documento, no solo al PDF", () => {
    // Estaba en el PDF y faltaba en la pantalla: una divergencia entre dos superficies del mismo
    // documento que se veia sola en cuanto la vigente paso a ser por profesion.
    expect(HC).toContain("profesion: string | null");
    expect(PAGE).toContain("profesion: n.profession ? PROFESION_NOTA[n.profession] : null");
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
