import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BIODY_COLUMNS } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import {
  huellaDeLaMedicion,
  valorParaBuscarCandidatos,
  VARIABLES_DE_LA_HUELLA,
} from "@/modules/bis/services/huella-de-la-medicion";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO: LA MISMA TOMA NO PUEDE ENTRAR DOS VECES ═══
//
// ── LO QUE PASO, MEDIDO EN PRODUCCION EL 2026-10-24 ──────────────────────────────────────────────
//
// 11 grupos de mediciones con los crudos IDENTICOS hasta el ultimo decimal, 5 de ellos repartidos entre
// pacientes DISTINTOS (uno con TRES evaluaciones). Es un dato de salud de una persona en la historia clinica
// de otra, y de ahi salio el diagnostico que esa otra persona recibio. Gildardo encontro 10 (sus errores 1 y
// 2 de la especificacion v7); el barrido por huella encontro 11.
//
// Dos mecanismos: el lote del HTML volvio a importar tomas que ya existian nativamente (13 de las 23
// evaluaciones implicadas llevan su lote), y nada impedia importar el mismo archivo dos veces ni al paciente
// equivocado (un grupo se creo en OCHO SEGUNDOS: no es un lote, es la pantalla usada dos veces).
//
// ── QUE DEFIENDE ESTE ARCHIVO, Y POR QUE ESTATICO ────────────────────────────────────────────────
//
//   1. QUE LA HUELLA NO SE DESACOPLE DEL EQUIPO: sus cuatro variables salen de BIODY_COLUMNS, no de una
//      lista copiada a mano que se queda vieja cuando un encabezado cambia.
//   2. QUE TODO CAMINO QUE CREE UNA MEDICION PASE POR EL FRENO. La regla vive en varios sitios (el XLSX y
//      el lote del HTML), y un freno aplicado en uno solo deja la puerta abierta en el otro, que es
//      exactamente por donde entraron 13 de las 23.
//   3. QUE EL FRENO VAYA ANTES DEL BORRADO de la medicion anterior: frenar despues significa haber
//      destruido un registro clinico para luego revertirlo.
//   4. QUE EL MENSAJE NO NOMBRE AL OTRO PACIENTE: quien importa puede no tener acceso a esa historia, y
//      avisarle de un error no justifica filtrarle PII de un tercero.
//
// El comportamiento (que frena de verdad, con las dos variantes del mensaje, y que la excepcion de la cadena
// de correccion pasa) se corrio contra la base local llamando al writer de verdad.

const WRITER_XLSX = "src/modules/bis/data/bis-writer.ts";
const WRITER_LOTE = "src/modules/importacion-html/data/importar-lote-writer.ts";
const SERVICIO = "src/modules/bis/services/bis-import.ts";
const LECTOR = "src/modules/bis/data/medicion-duplicada-reader.ts";
const PANTALLA_LOTE = "src/modules/importacion-html/components/revision-importacion.tsx";

/**
 * EL UNICO CAMINO QUE CREA UNA MEDICION SIN PASAR POR EL FRENO, con su razon.
 *
 * El flujo de correccion COPIA la medicion de la evaluacion que corrige: la toma fisica ocurrio una vez y
 * pertenece a las dos versiones del registro. Es la excepcion legitima que Santiago nombro ("si hay una
 * excepcion legitima, la copia del flujo de correccion, que sea la unica"), y el lector la reconoce por
 * `clinical_corrections` cuando el choque aparece por el otro lado.
 */
const SIN_FRENO_A_PROPOSITO = ["src/modules/corrections/services/correct-evaluation.ts"];

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

const CRUDOS = [
  { variableName: VARIABLES_DE_LA_HUELLA[0], value: 674.8 },
  { variableName: VARIABLES_DE_LA_HUELLA[1], value: 1471.9 },
  { variableName: VARIABLES_DE_LA_HUELLA[2], value: 462.681 },
  { variableName: VARIABLES_DE_LA_HUELLA[3], value: 2.04 },
  { variableName: "Peso kg", value: 67.5 },
];

describe("la huella de la medicion", () => {
  it("sus cuatro variables salen de BIODY_COLUMNS, no de una copia a mano", () => {
    expect(VARIABLES_DE_LA_HUELLA).toEqual([
      normalizeHeader(BIODY_COLUMNS.Re.header),
      normalizeHeader(BIODY_COLUMNS.Ri.header),
      normalizeHeader(BIODY_COLUMNS.Rinf.header),
      normalizeHeader(BIODY_COLUMNS.C.header),
    ]);
    // Y SON LAS CUATRO RESISTENCIAS REQUERIDAS: si manana alguna deja de ser insumo del motor, esto lo dice.
    for (const campo of ["Re", "Ri", "Rinf", "C"] as const) {
      expect(BIODY_COLUMNS[campo].required, `${campo} tiene que seguir siendo requerida`).toBe(true);
    }
  });

  it("dos tomas con los mismos crudos dan la MISMA huella", () => {
    const a = huellaDeLaMedicion(CRUDOS);
    const b = huellaDeLaMedicion([...CRUDOS].reverse());
    expect(a).not.toBeNull();
    expect(b, "el orden de las filas no cambia la toma").toBe(a);
  });

  it("compara numeros, no cadenas: 2.04 y '2.040' son el mismo valor", () => {
    // La base devuelve `numeric` como cadena, asi que comparar texto dejaria pasar el duplicado por un
    // cero de mas. Es el defecto que ya aparecio una vez con los encabezados recortados.
    const comoVienenDeLaBase = CRUDOS.map((v) => ({
      variableName: v.variableName,
      value: v.value === 2.04 ? "2.040" : String(v.value),
    }));
    expect(huellaDeLaMedicion(comoVienenDeLaBase)).toBe(huellaDeLaMedicion(CRUDOS));
  });

  it("un solo valor distinto ya es otra toma", () => {
    const otra = CRUDOS.map((v, i) => (i === 0 ? { ...v, value: 674.9 } : v));
    expect(huellaDeLaMedicion(otra)).not.toBe(huellaDeLaMedicion(CRUDOS));
  });

  it("si falta una de las cuatro devuelve null, y null NO significa 'no hay duplicado'", () => {
    // Frenar por no poder comparar seria frenar lo que no se sabe. Una medicion sin esas cuatro lecturas
    // ya la rechaza el motor por otro lado (INSUMOS_MOTOR_AUSENTES).
    expect(huellaDeLaMedicion(CRUDOS.slice(1))).toBeNull();
    expect(huellaDeLaMedicion([])).toBeNull();
    expect(
      huellaDeLaMedicion(CRUDOS.map((v, i) => (i === 3 ? { ...v, value: "no es un numero" } : v))),
      "un valor ilegible es tan incomparable como uno ausente",
    ).toBeNull();
  });

  it("el valor para buscar candidatos es el de la primera variable de la huella", () => {
    expect(valorParaBuscarCandidatos(CRUDOS)).toBe(674.8);
    expect(valorParaBuscarCandidatos(CRUDOS.slice(1))).toBeNull();
  });
});

describe("todo camino que crea una medicion pasa por el freno", () => {
  it("el barrido no deja ningun insert sin su comprobacion", () => {
    const culpables: string[] = [];
    const candidatos = [
      WRITER_XLSX,
      WRITER_LOTE,
      "src/modules/corrections/services/correct-evaluation.ts",
    ];
    for (const f of candidatos) {
      const src = leer(f);
      if (!/\.insert\(bisMeasurements\)/.test(src)) continue;
      if (SIN_FRENO_A_PROPOSITO.includes(f)) continue;
      if (!/buscarLaMismaMedicion\(/.test(src)) culpables.push(f);
    }
    expect(
      culpables,
      "crean una medicion sin preguntar si esos mismos crudos ya estan en la base. 13 de las 23 " +
        "evaluaciones con la medicion repetida entraron por el camino del lote, no por el del XLSX",
    ).toEqual([]);
  });

  it("en el XLSX el freno va ANTES de borrar la medicion anterior", () => {
    const src = leer(WRITER_XLSX);
    const iFreno = src.indexOf("buscarLaMismaMedicion(");
    const iBorrado = src.indexOf(".delete(bisMeasurements)");
    expect(iFreno).toBeGreaterThan(-1);
    expect(iBorrado).toBeGreaterThan(-1);
    expect(
      iFreno,
      "frenar despues del borrado significa haber destruido un registro clinico para luego revertirlo: " +
        "apoyarse en el seguro en vez de en la cerradura",
    ).toBeLessThan(iBorrado);
  });

  it("el XLSX lee el paciente de la evaluacion, no lo recibe de quien llama", () => {
    const src = leer(WRITER_XLSX);
    expect(
      /select\(\{ patientId: evaluations\.patientId \}\)/.test(src),
      "recibirlo permitiria decir un paciente y traer la evaluacion de otro, que es la clase de defecto " +
        "que este freno persigue",
    ).toBe(true);
  });

  it("el servicio traduce el choque a un conflicto, no a un error inesperado", () => {
    const src = leer(SERVICIO);
    expect(/MedicionDuplicadaError/.test(src)).toBe(true);
    expect(
      /appError\("conflict"/.test(src),
      "el archivo parseo y valido bien: no es un fallo de archivo, es un conflicto",
    ).toBe(true);
  });

  it("el lote NO rechaza el archivo entero: cuenta la medicion repetida y la pantalla lo dice", () => {
    // Mismo criterio que el sexo ausente y la encuesta vacia: la consulta es real y su historia vale.
    // Lo que no puede es entrar en silencio.
    const src = leer(WRITER_LOTE);
    expect(/medicionesRepetidas\.push\(/.test(src)).toBe(true);
    expect(
      /medicionesRepetidas/.test(leer(PANTALLA_LOTE)),
      "un conteo que no se muestra es el mismo defecto que no contarlo",
    ).toBe(true);
  });
});

describe("el mensaje del freno", () => {
  const src = readFileSync(LECTOR, "utf8");

  it("distingue el mismo paciente de otra historia clinica", () => {
    expect(/esDelMismoPaciente/.test(src)).toBe(true);
    expect(
      /historia clínica de OTRO paciente/.test(src),
      "el caso grave tiene que decirse: el archivo es de otra persona",
    ).toBe(true);
  });

  it("no hay ninguna columna de identidad en el lector", () => {
    // Nombre, documento o telefono del otro paciente no pueden salir de aqui: quien importa puede no tener
    // acceso a esa historia clinica.
    const codigo = sinComentarios(src);
    for (const pii of ["firstName", "lastName", "documentNumber", "patientProfiles", "patientContacts"]) {
      expect(codigo.includes(pii), `${pii} no puede aparecer en el mensaje de un choque`).toBe(false);
    }
  });

  it("prioriza el choque de OTRO paciente cuando hay varios", () => {
    const codigo = sinComentarios(src);
    expect(/deVerdad\.find\(\(\[, x\]\) => x\.patientId !== input\.patientId\)/.test(codigo)).toBe(true);
  });
});
