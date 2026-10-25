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
// 15 grupos con los cuatro crudos del equipo IDENTICOS hasta el ultimo decimal. Quitando los pacientes de
// prueba y la copia legitima del flujo de correccion quedan 10 grupos REALES: 4 entre pacientes DISTINTOS y
// 6 dentro del mismo paciente, 20 evaluaciones, todas de una profesional. Es exactamente la lista que
// Gildardo reporto (sus errores 1 y 2 de la especificacion v7). Es un dato de salud de una persona en la
// historia clinica de otra, y de ahi salio el diagnostico que esa otra persona recibio.
//
// UN MECANISMO: el mismo archivo importado dos veces, o al paciente equivocado, desde la pantalla de
// importar. Dos grupos se crearon con dos y cuatro minutos de diferencia. El lote del HTML no fue (solo 2 de
// las 406 mediciones llevan un lote), pero por ahi tambien se puede, asi que el freno va en los dos.
//
// ── QUE DEFIENDE ESTE ARCHIVO, Y POR QUE ESTATICO ────────────────────────────────────────────────
//
//   1. QUE LA HUELLA NO SE DESACOPLE DEL EQUIPO: sus cuatro variables salen de BIODY_COLUMNS, no de una
//      lista copiada a mano que se queda vieja cuando un encabezado cambia.
//   2. QUE TODO CAMINO QUE CREE UNA MEDICION PASE POR EL FRENO. La regla vive en varios sitios (el XLSX y
//      el lote del HTML), y un freno aplicado en uno solo deja la puerta abierta en el otro.
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
      "crean una medicion sin preguntar si esos mismos crudos ya estan en la base",
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LA VISTA DE INVESTIGACION USA LOS MISMOS CUATRO NOMBRES (0230, Gildardo 2026-10-25)
//
// *"Las evaluaciones con huella repetida salen de evaluaciones_para_investigacion hasta que se corrijan,
// CON LA MISMA FUNCION DE LA HUELLA."*
//
// Una vista no puede llamar a una funcion de TypeScript, asi que lo unico que se repite son los cuatro
// NOMBRES de variable. El formato NO se repite (la vista compara arreglos numericos, no la cadena
// `a|b|c|d`), que es donde cabria divergir por un cero de mas.
//
// Esto es lo que impide que los nombres se separen: si `BIODY_COLUMNS` o `normalizeHeader` cambian, la
// vista seguiria filtrando por los nombres viejos, no encontraria ninguna huella y DEJARIA DE EXCLUIR,
// en silencio y con las cifras intactas. Mismo patron que el candado del CHECK de la 0227 contra
// `NIVELES_DE_ANONIMIZACION`.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("la vista de investigacion y la huella no se separan", () => {
  const MIGRACION_0230 = "drizzle/0230_la_huella_repetida_sale_de_investigacion.sql";

  it("los cuatro nombres de la vista son EXACTAMENTE los de VARIABLES_DE_LA_HUELLA", () => {
    const sql = readFileSync(MIGRACION_0230, "utf8");
    const bloque = /r\."variable_name" IN \(([\s\S]*?)\)/.exec(sql);
    expect(bloque, "no encontre la lista de variables de la 0230").not.toBeNull();
    const enLaVista = [...bloque![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(
      enLaVista.sort(),
      "si divergen, la vista no encuentra ninguna huella y deja de excluir SIN cambiar ninguna cifra",
    ).toEqual([...VARIABLES_DE_LA_HUELLA].sort());
  });

  it("la vista compara NUMERICO, no texto", () => {
    // 2.04 y 2.040 son el mismo valor y distinta cadena. La funcion de TS pasa a numero antes de comparar;
    // la vista lo consigue con `::numeric` y la igualdad de arreglos de Postgres. Comparar `::text` habria
    // dejado pasar el duplicado por un cero de mas, que es justo lo que la huella existe para atrapar.
    const sql = readFileSync(MIGRACION_0230, "utf8");
    expect(/r\."value"::numeric/.test(sql)).toBe(true);
    expect(/array_agg\(d\."valor" ORDER BY d\."variable_name"\)/.test(sql)).toBe(true);
  });

  it("la exclusion compara solo entre VIGENTES, que es lo que hace innecesarias las dos excepciones", () => {
    // Al corregir, la version vieja queda `superseded_at` y sale del universo; la medicion marcada como de
    // otro paciente se queda colgada de ella. Las dos excepciones del freno se cumplen sin nombrarlas.
    const sql = readFileSync(MIGRACION_0230, "utf8");
    expect(/e\."superseded_at" IS NULL/.test(sql)).toBe(true);
    expect(/e\."retirada_at" IS NULL/.test(sql)).toBe(true);
    expect(
      /count\(\*\) OVER \(PARTITION BY h\."huella"\)/.test(sql),
      "la ventana corre despues del WHERE: la particion ya solo tiene vigentes",
    ).toBe(true);
    expect(
      /count\(\*\) OVER \(PARTITION BY h\."huella", e\."id"\)/.test(sql),
      "y se compara contra la particion por evaluacion, porque la vista da una fila por medicion",
    ).toBe(true);
  });

  it("la exclusion se DICE en la pantalla, no es un filtro invisible", () => {
    // Una cohorte que baja de 316 a 303 sin que nada lo explique es como se pierde la confianza en la
    // cifra. Es la regla que la propia 0224 escribio: lo que queda fuera se dice.
    const pantalla = readFileSync("src/app/(app)/obbia/page.tsx", "utf8");
    expect(/fueraPorHuellaRepetida/.test(pantalla)).toBe(true);
    expect(/por calidad de\s+dato|por calidad de dato/.test(pantalla)).toBe(true);
  });
});
