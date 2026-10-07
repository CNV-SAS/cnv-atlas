import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BIODY_COLUMNS, ENGINE_REQUIRED } from "@/clinical-engine";
import { MEASURED_HIPS_HEADER, MEASURED_WAIST_HEADER } from "@/modules/bis/services/header-map";
import {
  MEASUREMENT_DATE_HEADER,
  parseBiodyDate,
  PHYSIOLOGICAL_RANGES,
  validateBisMeasurement,
} from "@/modules/bis/validations/import-schema";
import type { CellValue, ParsedSheet } from "@/modules/bis/types";

// Construye una hoja parseada de una sola fila a partir de pares [header, value].
function sheet(cells: [string, CellValue][], rows = 1): ParsedSheet {
  const headers = cells.map((c) => c[0]);
  const dataRows = Array.from({ length: rows }, (_, k) => ({
    rowNumber: k + 2,
    cells: cells.map(([header, value]) => ({ header, value })),
  }));
  return { sheetName: "Measures", headers, dataRows };
}

// Valores plausibles en rango para los obligatorios del motor (por clave de BIODY_COLUMNS).
const ENGINE_VALUES: Record<string, number> = {
  peso: 70,
  talla: 170,
  Re: 500,
  Ri: 1400,
  Rinf: 370,
  C: 2,
  FM: 20,
  FFM: 50, // el noveno obligatorio: estaba ausente aqui igual que en la lista, hasta el 2026-09-23
  FFMI: 21,
};

// Base valida: fecha + PII (que se excluye) + los OBLIGATORIOS (motor + cintura/cadera) + relleno
// para superar MIN_VARIABLE_COLUMNS. Se generan desde las fuentes canonicas para no desincronizar.
function validCells(): [string, CellValue][] {
  const base: [string, CellValue][] = [
    [MEASUREMENT_DATE_HEADER, "12-04-2026 19:18"],
    ["Paciente ", "PACIENTE SINTETICO"],
    ["Fecha de nacimiento ", "01-01-1990 00:00"],
    ["Ángulo de fase a 50 kHz °", 6.2],
  ];
  for (const key of ENGINE_REQUIRED) base.push([BIODY_COLUMNS[key].header, ENGINE_VALUES[key]]);
  base.push([MEASURED_WAIST_HEADER, 90]); // cintura medida
  base.push([MEASURED_HIPS_HEADER, 100]); // cadera medida
  for (let i = 0; i < 6; i++) base.push([`Var ${i} u`, 10 + i]);
  return base;
}

describe("parseBiodyDate", () => {
  it("parsea DD-MM-YYYY HH:MM en UTC", () => {
    const d = parseBiodyDate("12-04-2026 19:18");
    expect(d?.toISOString()).toBe("2026-04-12T19:18:00.000Z");
  });

  it("parsea DD-MM-YYYY sin hora", () => {
    expect(parseBiodyDate("01-01-1990")?.toISOString()).toBe("1990-01-01T00:00:00.000Z");
  });

  it("rechaza fechas incoherentes y basura", () => {
    expect(parseBiodyDate("31-02-2026 00:00")).toBeNull(); // 31 de febrero no existe
    expect(parseBiodyDate("no es fecha")).toBeNull();
  });
});

describe("validateBisMeasurement", () => {
  it("extrae fecha y valores numericos, excluyendo PII", () => {
    const res = validateBisMeasurement(sheet(validCells()));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.measurementDate.toISOString()).toBe("2026-04-12T19:18:00.000Z");
    const names = res.value.values.map((v) => v.variableName);
    expect(names).toContain("Peso kg");
    expect(names).not.toContain("Paciente");
    expect(names).not.toContain("Fecha de nacimiento");
    expect(names).not.toContain(MEASUREMENT_DATE_HEADER);
  });

  it("omite celdas vacias y valores no numericos en columnas-variable", () => {
    const cells = validCells();
    cells.push(["Var texto u", "N/A"]); // no numerico: se omite
    cells.push(["Var vacia u", null]); // vacia: se omite
    const res = validateBisMeasurement(sheet(cells));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const names = res.value.values.map((v) => v.variableName);
    expect(names).not.toContain("Var texto u");
    expect(names).not.toContain("Var vacia u");
  });

  it("rechaza con detalle por variable cuando un valor sale del rango fisiologico", () => {
    // Peso imposible (9999 kg): fuera del rango curado [1, 500].
    const bad = validCells().map((c) =>
      c[0] === "Peso kg" ? (["Peso kg", 9999] as [string, CellValue]) : c,
    );
    const res = validateBisMeasurement(sheet(bad));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("validation");
    expect(res.error.fields?.["Peso kg"]).toBeDefined();
  });

  it("rechaza valores no finitos o absurdos via el limite global", () => {
    const bad = validCells().map((c) =>
      c[0] === "Var 0 u" ? (["Var 0 u", 5_000_000] as [string, CellValue]) : c,
    );
    const res = validateBisMeasurement(sheet(bad));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.fields?.["Var 0 u"]).toBeDefined();
  });

  it("exige la columna de fecha de medicion", () => {
    const noDate = validCells().filter((c) => c[0] !== MEASUREMENT_DATE_HEADER);
    const res = validateBisMeasurement(sheet(noDate));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain(MEASUREMENT_DATE_HEADER);
  });

  it("rechaza una fecha de medicion invalida", () => {
    const bad = validCells().map((c) =>
      c[0] === MEASUREMENT_DATE_HEADER ? ([MEASUREMENT_DATE_HEADER, "basura"] as [string, CellValue]) : c,
    );
    const res = validateBisMeasurement(sheet(bad));
    expect(res.ok).toBe(false);
  });

  // ── AQUI ESTABA "rechaza si no hay exactamente una fila de medicion", y SE INVIRTIO (2026-10-06) ──
  //
  // Afirmaba que un archivo de dos filas se rechazaba. Era correcto cuando el validador solo entendia una
  // medicion por archivo, y era justo lo que le hacia perder el tiempo al Integrante: el export de "paciente
  // + mediciones" trae UNA FILA POR MEDICION, asi que varias filas es lo NORMAL.
  //
  // El caso contrario vive abajo, en "un archivo con varias mediciones". No se borra sin dejar dicho que la
  // regla se dio vuelta a proposito: un candado que desaparece se lee como una regla que se dejo de cuidar.
  it("un archivo de dos filas del MISMO paciente ya no se rechaza", () => {
    const res = validateBisMeasurement(sheet(validCells(), 2));
    expect(res.ok, res.ok ? "" : res.error.message).toBe(true);
  });

  it("rechaza un archivo con muy pocas columnas de variables", () => {
    const few: [string, CellValue][] = [
      [MEASUREMENT_DATE_HEADER, "12-04-2026 19:18"],
      ["Peso kg", 70],
    ];
    const res = validateBisMeasurement(sheet(few));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain("pocas columnas");
  });

  it("los rangos curados son un subconjunto documentado (provisional)", () => {
    expect(Object.keys(PHYSIOLOGICAL_RANGES).length).toBeGreaterThan(0);
    expect(PHYSIOLOGICAL_RANGES["Peso kg"]).toEqual({ min: 1, max: 500 });
  });

  // Sub-bloque B: obligatorios (motor + cintura/cadera de negocio).
  it("bloquea el import si falta la cintura (circunferencia medida, decision de negocio)", () => {
    const noCintura = validCells().filter((c) => c[0] !== MEASURED_WAIST_HEADER);
    const res = validateBisMeasurement(sheet(noCintura));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("validation");
    expect(res.error.fields?.cintura).toBeDefined();
    expect(res.error.message).toContain("Biody Manager");
  });

  it("bloquea el import si falta la cadera (circunferencia medida, decision de negocio)", () => {
    const noCadera = validCells().filter((c) => c[0] !== MEASURED_HIPS_HEADER);
    const res = validateBisMeasurement(sheet(noCadera));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.fields?.cadera).toBeDefined();
  });

  it("bloquea el import si falta un dato del motor (corromperia el diagnostico, no es display)", () => {
    const noRe = validCells().filter((c) => c[0] !== BIODY_COLUMNS.Re.header);
    const res = validateBisMeasurement(sheet(noRe));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.fields?.Re).toBeDefined();
  });

  it("acepta cuando estan todos los obligatorios", () => {
    expect(validateBisMeasurement(sheet(validCells())).ok).toBe(true);
  });

  // Validacion de rango antropometrica (2026-08-04, tras los exports ZM3): atrapar errores de
  // digitacion sin rechazar pacientes reales.
  it("rechaza una cadera fuera de rango (1139 = 113,9 con el decimal perdido)", () => {
    const bad = validCells().map((c) =>
      c[0] === MEASURED_HIPS_HEADER ? ([MEASURED_HIPS_HEADER, 1139] as [string, CellValue]) : c,
    );
    const res = validateBisMeasurement(sheet(bad));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.fields?.["Hips Size cm"]).toContain("1139");
  });

  it("acepta una circunferencia grande pero REAL (una cintura de 160 cm existe)", () => {
    const big = validCells().map((c) =>
      c[0] === MEASURED_WAIST_HEADER ? ([MEASURED_WAIST_HEADER, 160] as [string, CellValue]) : c,
    );
    expect(validateBisMeasurement(sheet(big)).ok).toBe(true);
  });

  it("rechaza un ratio en 0 con mensaje propio (campo exportado vacio, no una medida)", () => {
    const cells = validCells();
    cells.push(["Ratio Cintura/Altura valor", 0]);
    const res = validateBisMeasurement(sheet(cells));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.fields?.["Ratio Cintura/Altura valor"]).toContain("ratio");
  });

  it("distingue una MEDIDA en 0 de un RATIO en 0 (mensajes distintos)", () => {
    // Una cintura en 0 cae por RANGO [30,250], con el mensaje de rango, no el de ratio.
    const bad = validCells().map((c) =>
      c[0] === MEASURED_WAIST_HEADER ? ([MEASURED_WAIST_HEADER, 0] as [string, CellValue]) : c,
    );
    const res = validateBisMeasurement(sheet(bad));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.fields?.["Waist Size cm"]).toContain("rango");
  });
});

// ═══ VARIAS MEDICIONES EN UN ARCHIVO (2026-10-06) ═══
//
// El export de "paciente + mediciones" del Biody Manager trae UNA FILA POR MEDICION. Antes el validador
// rechazaba el archivo entero y el Integrante tenia que borrar filas a mano. Ahora toma la mas reciente.
//
// LO QUE ESTE BLOQUE GUARDA NO ES LA COMODIDAD, ES EL PORTON: que un archivo con DOS PACIENTES se rechace.
// Sin el, "la medicion mas reciente" puede ser la de otra persona, y de esa medicion sale un diagnostico.

/** Una hoja con varias filas, cada una con sus propios valores de fecha y paciente. */
function hojaDeVarias(filas: { fecha: string; paciente?: string; peso?: number }[]): ParsedSheet {
  const base = validCells();
  const headers = base.map((c) => c[0]);
  const dataRows = filas.map((f, k) => ({
    rowNumber: k + 2,
    cells: base.map(([header, value]) => {
      if (header === MEASUREMENT_DATE_HEADER) return { header, value: f.fecha as CellValue };
      if (header.trim() === "Paciente") return { header, value: (f.paciente ?? "PACIENTE SINTETICO") as CellValue };
      if (f.peso != null && header === BIODY_COLUMNS.peso.header) return { header, value: f.peso as CellValue };
      return { header, value };
    }),
  }));
  return { sheetName: "Measures", headers, dataRows };
}

describe("un archivo con varias mediciones", () => {
  it("ya no se rechaza por traer mas de una fila", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([{ fecha: "01-03-2026 10:00" }, { fecha: "12-04-2026 19:18" }]),
    );
    expect(r.ok, r.ok ? "" : r.error.message).toBe(true);
  });

  // LA MAS RECIENTE, y se comprueba por el VALOR que trae esa fila, no solo por la fecha: asi el caso falla
  // si alguien ordenara bien y leyera la fila equivocada.
  it("toma la mas reciente, y lee SUS valores", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([
        { fecha: "01-03-2026 10:00", peso: 60 },
        { fecha: "12-04-2026 19:18", peso: 72 },
        { fecha: "15-01-2026 08:00", peso: 55 },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.measurementDate.toISOString().slice(0, 10)).toBe("2026-04-12");
    expect(r.value.values.find((v) => v.variableName === "Peso kg")?.value).toBe(72);
  });

  it("dice cuantas traia y cuales fechas, para poder decirlo en pantalla", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([{ fecha: "01-03-2026 10:00" }, { fecha: "12-04-2026 19:18" }]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.filasEnElArchivo).toBe(2);
    // De la mas reciente a la mas vieja: es el orden en que la pantalla las ofrece.
    expect(r.value.fechasDisponibles).toEqual(["2026-04-12", "2026-03-01"]);
  });

  // ── EL CASO RETROACTIVO: la mas reciente NO siempre es la que corresponde ──
  //
  // En una evaluacion de una consulta vieja (los pacientes importados del HTML), la medicion que va es la de
  // ESA fecha. Sin poder elegir, ese import queda con la medicion equivocada y re-importar el mismo archivo
  // volveria a tomar la misma fila.
  it("se puede pedir otra medicion por su fecha", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([
        { fecha: "01-03-2026 10:00", peso: 60 },
        { fecha: "12-04-2026 19:18", peso: 72 },
      ]),
      "2026-03-01",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.measurementDate.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(r.value.values.find((v) => v.variableName === "Peso kg")?.value).toBe(60);
  });

  it("y pedir una fecha que no esta se rechaza diciendo cuales hay", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([{ fecha: "01-03-2026 10:00" }, { fecha: "12-04-2026 19:18" }]),
      "2026-07-09",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toMatch(/2026-04-12/);
    expect(r.error.message).toMatch(/2026-03-01/);
  });
});

describe("EL PORTON: un archivo con mediciones de VARIOS pacientes se rechaza", () => {
  // ES LA COMPROBACION CUYO FALLO SERIA CLINICO Y NO DE CARGA: la medicion de un paciente entrando en la
  // evaluacion de otro, en silencio, y un diagnostico emitido sobre ella.
  it("no importa ninguna cuando hay dos personas en el archivo", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([
        { fecha: "01-03-2026 10:00", paciente: "PACIENTE UNO" },
        { fecha: "12-04-2026 19:18", paciente: "PACIENTE DOS" },
      ]),
    );
    expect(r.ok, "un archivo de dos pacientes NO puede importarse").toBe(false);
  });

  it("y el mensaje dice cuantas personas son, sin nombrar a ninguna", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([
        { fecha: "01-03-2026 10:00", paciente: "PACIENTE UNO" },
        { fecha: "12-04-2026 19:18", paciente: "PACIENTE DOS" },
      ]),
    );
    if (r.ok) throw new Error("tenia que rechazarlo");
    expect(r.error.message).toMatch(/2 pacientes distintos/);
    // NUNCA PII EN EL MENSAJE: el detalle de un rechazo va a `bis_import_logs`, que no lleva PII.
    expect(r.error.message).not.toMatch(/PACIENTE UNO|PACIENTE DOS/);
  });

  // NI SIQUIERA PEDIR UNA FECHA SALTA EL PORTON: elegir no vuelve seguro un archivo de dos personas, porque
  // la fecha no dice de quien es la fila.
  it("pedir una fecha concreta no lo salta", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([
        { fecha: "01-03-2026 10:00", paciente: "PACIENTE UNO" },
        { fecha: "12-04-2026 19:18", paciente: "PACIENTE DOS" },
      ]),
      "2026-03-01",
    );
    expect(r.ok).toBe(false);
  });

  // EL MISMO PACIENTE ESCRITO DISTINTO NO ES DOS PERSONAS: mayusculas y espacios sobrantes son del export,
  // no del dato. Si contaran como personas distintas, el porton rechazaria archivos buenos, que es el otro
  // modo de hacer dano (el Integrante pierde la medicion sin entender por que).
  it("el mismo nombre con otras mayusculas o espacios no cuenta como dos", () => {
    const r = validateBisMeasurement(
      hojaDeVarias([
        { fecha: "01-03-2026 10:00", paciente: "Paciente Sintetico" },
        { fecha: "12-04-2026 19:18", paciente: "  PACIENTE SINTETICO  " },
      ]),
    );
    expect(r.ok, r.ok ? "" : r.error.message).toBe(true);
  });
});

// ═══ LOS MENSAJES DEL IMPORT NO PUEDEN SALIR CON HUECOS (2026-10-06) ═══
//
// EL DEFECTO QUE ESTO ATRAPA, y lo escribo porque fue mio: el toast salio asi en la pantalla de Santiago,
//
//   "Medición BIS importada ( variables). El archivo traía  mediciones y se importó la del , la más reciente."
//
// Las tres cifras habian DESAPARECIDO del codigo fuente. No fue un error de logica: edite ese archivo con un
// reemplazo de `perl`, y perl interpola `$` en la cadena de reemplazo, asi que se comio los `${...}` de las
// plantillas y dejo las frases con huecos. Compila, pasa el lint, y solo se ve en pantalla.
//
// POR QUE UN CANDADO Y NO SOLO LA LECCION: la leccion ("un control que edita codigo necesita respaldo
// verificado") ya estaba escrita y la volvi a pisar. Un candado no depende de que yo me acuerde.
//
// LO QUE MIRA: que cada plantilla de mensaje de este archivo que prometa una cifra la INTERPOLE de verdad.
describe("los mensajes del import llevan sus cifras", () => {
  const ACCIONES = readFileSync("src/modules/bis/actions.ts", "utf8");

  it("ninguna plantilla de mensaje quedo con un hueco donde iba una cifra", () => {
    // SE MIRA DENTRO DE LAS PLANTILLAS, no la linea entera: una linea indentada tiene espacios de sobra y
    // haria saltar el candado con cualquier cosa. Se extraen los literales entre acentos graves que hablan de
    // la medicion, que son los mensajes que le llegan al profesional.
    const plantillas = [...ACCIONES.matchAll(/`([^`]*Medici[oó]n[^`]*)`/g)].map((m) => m[1]);
    expect(plantillas.length, "desaparecieron los mensajes del import").toBeGreaterThan(0);

    // Las marcas de un `${...}` perdido: un parentesis que abre y sigue un espacio, una preposicion suelta
    // antes de una coma o un punto, o dos espacios seguidos dentro de la frase.
    const conHueco = plantillas.filter((p) => /\( | del [,.]| de [,.]| {2}/.test(p));
    expect(conHueco, "un mensaje quedo con un hueco donde iba una cifra (un ${...} perdido)").toEqual([]);
  });

  // Y LA OTRA MITAD: que la cifra que el mensaje nombra este de verdad interpolada. Un mensaje que dice
  // "variables" sin un `${` al lado es un mensaje que va a salir sin el numero.
  it("el mensaje que nombra las variables las interpola", () => {
    const linea = ACCIONES.split("\n").find((l) => /variables\)/.test(l));
    expect(linea, "desaparecio el mensaje que cuenta las variables").toBeTruthy();
    expect(linea, "nombra las variables pero no interpola ninguna cifra").toMatch(/\$\{/);
  });
});
