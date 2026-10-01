import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO PREVENTIVO: NADA DE PRUEBA SALE A INVESTIGACION ═══
//
// LA PREGUNTA DE SANTIAGO (2026-10-01): "¿habria forma de asegurarnos que las cifras de los profesionales
// con is_test no cuenten para nada al extraer informacion para investigaciones?".
//
// LO QUE ENCONTRE AL VERIFICARLO: hoy NO HAY EXTRACCION. `research_datasets` es una tabla de GOBIERNO (quien
// pidio que, con que nivel de anonimizacion y en que estado) y no contiene datos; el unico lector lista esas
// solicitudes. La generacion de datasets esta en el BACKLOG.
//
// ASI QUE HOY NADA SE CONTAMINA, Y ESE ES EXACTAMENTE EL PROBLEMA DE ESTE CANDADO: no hay nada que barrer, y
// un candado que pasa porque no hay codigo que mirar es el que se olvida el dia que el codigo aparece. Este
// existe para FALLAR ESE DIA, no hoy.
//
// ── POR QUE AQUI EL ORDEN IMPORTA MAS QUE EN UNA CIFRA ──
//
// Una cifra de tablero equivocada se corrige y nadie se enteró. Un dataset cientifico contaminado se
// PUBLICA: entra en un articulo, y lo que sale de ahi no se corrige con una migracion. Por eso el filtro no
// puede ser algo que se agregue "despues de la primera version".
//
// ── Y LA REGLA NO ES LA MISMA QUE LA DE LAS CIFRAS COMERCIALES ──
//
// La FECHA DE ARRANQUE (0198) no aplica a la ciencia: una evaluacion de antes del arranque es una evaluacion
// REAL de un paciente REAL, y el dato cientifico no caduca porque la operacion comercial empezara despues.
// Lo que separa el grano de la paja aqui es `is_test`, en sus TRES tablas, no la fecha.

/** Las tres marcas que un dataset cientifico tiene que respetar, y donde viven. */
const MARCAS = ["patients.is_test", "professional_profiles.is_test", "nutraceuticals.is_test"];

/**
 * Las tablas cuyo contenido es DATO CIENTIFICO: si un lector de investigacion las toca, tiene que filtrar.
 *
 * No incluye `research_datasets`, que es la tabla de gobierno: listar solicitudes no extrae nada.
 */
const TABLAS_CIENTIFICAS = /\b(evaluations|diagnoses|bis_measurements|treatments|reports|surveys?_responses)\b/;

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) out.push(...archivos(p));
    else if (/\.tsx?$/.test(d.name)) out.push(p);
  }
  return out;
}

describe("nada marcado como de prueba puede salir a investigacion", () => {
  // EL BARRIDO QUE ESPERA. Mira la carpeta de investigacion: el dia que alguien escriba ahi un lector que
  // toque datos clinicos, tiene que traer sus filtros o este caso lo nombra.
  it("ningun lector de investigacion extrae datos clinicos sin filtrar lo de prueba", () => {
    const culpables: string[] = [];
    for (const f of archivos("src/modules/obbia")) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      if (!TABLAS_CIENTIFICAS.test(src)) continue;
      // Le basta con nombrar `is_test` (en SQL o en un filtro de PostgREST): la forma exacta depende de la
      // consulta, y lo que se vigila es que la regla este APLICADA, no su sintaxis.
      if (/is_test/.test(src)) continue;
      culpables.push(f);
    }
    expect(
      culpables,
      "leen tablas clinicas para investigacion y no filtran lo marcado como de prueba. Un dataset contaminado se PUBLICA: no se corrige con una migracion. Hay que excluir paciente de prueba, profesional de demostracion y producto de prueba",
    ).toEqual([]);
  });

  // Y LAS TRES MARCAS TIENEN QUE SEGUIR EXISTIENDO. Si una desaparece del esquema, el filtro que la nombra
  // deja de hacer nada y el barrido de arriba seguiria pasando: comprobaria una regla sobre una columna que
  // ya no existe.
  it("las tres marcas siguen en el esquema", () => {
    const esquema = ["patients", "organizations", "nutraceuticals"]
      .map((f) => readFileSync(`src/db/schema/${f}.ts`, "utf8"))
      .join("\n");
    for (const marca of MARCAS) {
      const columna = marca.split(".")[1];
      expect(esquema, `${marca} ya no esta en el esquema`).toContain(`"${columna}"`);
    }
    // `professional_profiles.is_test` es la mas nueva (0199) y la que motivo la pregunta: se comprueba
    // nombrada, no solo por la columna suelta.
    expect(readFileSync("src/db/schema/organizations.ts", "utf8")).toContain('isTest: boolean("is_test")');
  });
});
