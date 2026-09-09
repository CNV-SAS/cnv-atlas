import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

import {
  lineaDeReemplazo,
  observacionesVigentes,
} from "@/modules/reports/data/observaciones-vigentes";

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
const PAGE = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");

// EL DEFECTO QUE ESTOS CASOS CIERRAN (smoke de Santiago, 2026-09-08): la vigente se tomaba por POSICION
// (`lista[lista.length - 1]`), y el reader trae las notas con `ascending: false`. La ultima posicion era
// la MAS ANTIGUA: al agregar una observacion nueva salia numerada la primera y se marcaba vigente la
// vieja. La pantalla y el documento hacian lo mismo, asi que coincidian... en el error.
//
// ANCLAR EN UNA POSICION ES LO QUE FALLA, no el orden del reader: una posicion se desincroniza en cuanto
// alguien toca un `order by` en otro archivo, y nada da error. Estos casos prueban el COMPORTAMIENTO con
// las dos ordenaciones, que es lo unico que no se puede satisfacer volviendo a la posicion.
describe("la vigente es la MAS RECIENTE, venga la lista como venga", () => {
  const nota = (id: string, creadaEn: string, profesion: string | null = "medico") => ({
    id,
    note: `nota ${id}`,
    fecha: creadaEn.slice(0, 10),
    creadaEn,
    profesion,
  });
  const vieja = nota("vieja", "2026-09-01T10:00:00.000Z");
  const media = nota("media", "2026-09-03T10:00:00.000Z");
  const nueva = nota("nueva", "2026-09-05T10:00:00.000Z");

  it("con la lista MAS RECIENTE PRIMERO, que es como la trae el reader", () => {
    const [v] = observacionesVigentes([nueva, media, vieja]);
    expect(v.id, "eligió la más antigua: es el defecto que cerró esto").toBe("nueva");
    expect(v.reemplaza).toBe(2);
    expect(v.desde).toBe("2026-09-01");
  });

  it("y con la lista MAS ANTIGUA PRIMERO da lo mismo", () => {
    const [v] = observacionesVigentes([vieja, media, nueva]);
    expect(v.id).toBe("nueva");
    expect(v.reemplaza).toBe(2);
  });

  it("y en orden arbitrario también", () => {
    // El control de que no se acertó por casualidad con dos ordenaciones simétricas.
    const [v] = observacionesVigentes([media, nueva, vieja]);
    expect(v.id).toBe("nueva");
  });

  it("las anteriores salen de la MAS ANTIGUA a la MAS RECIENTE, no como llegaron", () => {
    const [v] = observacionesVigentes([nueva, media, vieja]);
    expect(v.anteriores.map((a) => a.id)).toEqual(["vieja", "media"]);
  });

  it("cada PROFESION tiene su vigente, y una no tapa a la otra", () => {
    // Su §8: la última nota del médico no deja de valer porque la nutricionista escriba después.
    const nutri = nota("nutri", "2026-09-09T10:00:00.000Z", "nutricionista");
    const r = observacionesVigentes([nutri, nueva, vieja]);
    expect(r).toHaveLength(2);
    expect(r.find((x) => x.profesion === "medico")?.id).toBe("nueva");
    expect(r.find((x) => x.profesion === "nutricionista")?.id).toBe("nutri");
  });

  it("con una sola no hay rastro que dejar", () => {
    const [v] = observacionesVigentes([nueva]);
    expect(v.reemplaza).toBe(0);
    expect(lineaDeReemplazo(v)).toBeNull();
  });

  it("y NINGUNA pantalla vuelve a reducir por su cuenta", () => {
    // Las dos superficies del documento Y la de Seguimiento usan el MISMO módulo. Que cada una tuviera su
    // reducción es exactamente cómo nació el defecto: coincidían en el error.
    for (const [nombre, src] of [["HC", HC], ["PDF", PDF], ["Seguimiento", OBS]] as const) {
      expect(src, `${nombre} dejó de usar la reducción compartida`).toContain("observacionesVigentes(");
      expect(
        sinComentarios(src),
        `${nombre} volvió a elegir la vigente por posición`,
      ).not.toContain("[lista.length - 1]");
    }
  });
});

describe("en pantalla manda la ULTIMA y las anteriores se pliegan", () => {
  it("hay una vigente rotulada, no una lista donde haya que deducirla", () => {
    // YA NO SE AFIRMA SOBRE LA IMPLEMENTACION (antes fijaba `lista[lista.length - 1]`), y por eso este
    // candado no atrapo el defecto: fijaba EXACTAMENTE la linea que estaba mal. Lo que se prueba ahora es
    // el COMPORTAMIENTO, arriba, con la lista en tres ordenaciones. Aqui solo queda el rotulo.
    expect(OBS).toContain("Observación vigente");
    expect(OBS).toContain("vigentes.map(");
  });

  it("las anteriores se PLIEGAN, no desaparecen", () => {
    // Quien escribio una tiene que poder releerla: es registro clinico, no un borrador.
    expect(OBS).toContain("<details");
    expect(OBS).toMatch(/observaci[oó]n(es)? anterior(es)?/i);
  });

  it("la pantalla rotula la profesión de cada vigente", () => {
    // Que la vigente sea POR PROFESION ya se prueba arriba, sobre el reductor y con datos. Aqui queda lo
    // que es de la pantalla: que se vea de QUIEN es cada una, porque sin el rótulo "vigente" no dice de
    // quién.
    expect(OBS).toContain("PROFESION_NOTA[vigente.profesion]");
    expect(OBS).toContain("Sin profesión registrada");
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
