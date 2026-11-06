import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseBisXlsx } from "@/modules/bis/services/xlsx-parser";

// ═══ UN RECHAZO QUE NO DICE EL SIGUIENTE PASO DEJA AL PROFESIONAL PROBANDO ARCHIVOS ═══
//
// MEDIDO EN LA NUBE EL 2026-11-06, sobre los 82 intentos fallidos de importar que hay registrados: 61 son
// el archivo equivocado o incompleto. Y de las causas distintas, solo DOS nombraban el export correcto (la
// de "Exportar datos del paciente" y la de los rangos). Las demas decian lo que estaba mal y nada mas:
//
//   · "El archivo no se pudo leer como un XLSX válido."      → ¿y entonces que subo?
//   · "El archivo no contiene filas de datos."               → ¿el archivo esta mal o no hay medicion?
//   · "El archivo no tiene fila de encabezados."             → esto no lo puede ni ver quien no lo abrio
//
// El caso que lo prueba: el export de "datos del paciente" se intento OCHO veces, hasta el 30 de octubre,
// y su mensaje SI dice que hacer; las ocho acabaron con medicion. Los otros no.
//
// LO QUE ESTE CANDADO VIGILA, y por que sobre el mensaje y no sobre el codigo: que todo rechazo del parser
// nombre el programa y la accion. Un mensaje puede reescribirse sin tocar ninguna rama, y ahi es donde se
// pierde: alguien acorta la frase y vuelve el diagnostico sin salida.

const HUELLA = ["Measurement date", "Z50 Ohm", "Resistencia a 50khz Ohm"];

async function libroCon(hojas: { nombre: string; filas: (string | number)[][] }[]) {
  const wb = new ExcelJS.Workbook();
  for (const h of hojas) {
    const ws = wb.addWorksheet(h.nombre);
    for (const f of h.filas) ws.addRow(f);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Los cuatro rechazos del parser, cada uno con el archivo que lo provoca. */
const RECHAZOS: { caso: string; archivo: () => Promise<Buffer> }[] = [
  {
    caso: "no es un XLSX (un CSV renombrado, o abierto y guardado de nuevo)",
    archivo: async () => Buffer.from("Measurement date,Z50 Ohm\n13-07-2026,501\n", "utf8"),
  },
  {
    caso: "es un XLSX, pero ninguna hoja trae mediciones",
    archivo: () => libroCon([{ nombre: "Hoja1", filas: [["a", "b"], [1, 2]] }]),
  },
  {
    caso: "la hoja de medidas no trae encabezados",
    archivo: () =>
      libroCon([
        { nombre: "Measures", filas: [[], ["13-07-2026 21:11", 501, 497.578]] },
      ]),
  },
  {
    caso: "la hoja de medidas trae encabezados y ninguna medicion (export vacio)",
    archivo: () => libroCon([{ nombre: "Measures", filas: [HUELLA] }]),
  },
];

describe("todo rechazo del parser dice QUE archivo hace falta y COMO se saca", () => {
  it("son los cuatro rechazos, ni uno menos", () => {
    // Sin esto, si un caso dejara de provocar su rechazo la lista quedaria corta y el barrido pasaria
    // verde sobre menos de lo que dice cubrir.
    expect(RECHAZOS).toHaveLength(4);
  });

  for (const { caso, archivo } of RECHAZOS) {
    it(`${caso}: se rechaza, y el mensaje nombra el Biody Manager y la accion`, async () => {
      const r = await parseBisXlsx(await archivo());
      expect(r.ok).toBe(false);
      if (r.ok) return;
      const m = r.error.message;
      expect(m, `el mensaje no nombra el programa: "${m}"`).toContain("Biody Manager");
      expect(m, `el mensaje no nombra la accion: "${m}"`).toContain("Exportar medidas");
      // Y no habla de nombres de hoja, que es lo que el profesional no puede ver sin abrir el archivo.
      expect(m, `el mensaje le pide saber como se llama una hoja: "${m}"`).not.toContain("Measures");
    });
  }

  it("el export de datos del paciente sigue nombrandose, que es el caso que ya funcionaba", async () => {
    // Las ocho veces que paso, las ocho acabaron con medicion. Es la prueba de que el mensaje importa.
    const r = await parseBisXlsx(
      await libroCon([
        { nombre: "Patients", filas: [["#", "Nombre", "Altura"], [1, "Fixture", 177]] },
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain("datos del paciente");
      expect(r.error.message).toContain("Exportar medidas");
    }
  });

  it("y un archivo bueno sigue pasando: el candado no endurecio el parser", async () => {
    const r = await parseBisXlsx(
      await libroCon([
        { nombre: "Measures", filas: [HUELLA, ["13-07-2026 21:11", 501, 497.578]] },
      ]),
    );
    expect(r.ok).toBe(true);
  });
});
