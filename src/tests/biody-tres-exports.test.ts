import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseBisXlsx } from "@/modules/bis/services/xlsx-parser";

// ═══ LAS TRES FORMAS EN QUE EXPORTA EL BIODY MANAGER (Santiago, 2026-09-25) ═══
//
// Al ir a exportar un paciente, el Biody ofrece "medidas" y "datos del paciente", y la gente usa las tres
// combinaciones. Atlas solo aceptaba una. Lo que traen, verificado sobre los tres archivos reales que Santiago
// dejo en docs/entregas/exports:
//
//   1 · solo medidas          -> una hoja `Measures`, 117 columnas.
//   2 · solo datos            -> una hoja `Patients`, 28 columnas, NINGUNA medicion. No sirve, y no es cosa
//                                nuestra: el archivo no trae los datos. Lo que se arregla es el MENSAJE.
//   3 · las dos               -> `Patients` + una hoja con las MISMAS 117 columnas, LLAMADA CON EL NOMBRE DEL
//                                PACIENTE. Siempre fue utilizable y la rechazabamos por el nombre de la hoja.
//
// ── POR QUE ESTE CANDADO FABRICA LOS ARCHIVOS EN VEZ DE USAR LOS REALES ──
//
// Porque los reales traen nombre, correo y mediciones de una persona, asi que NO van al repositorio (estan en
// .gitignore). Aqui se reproduce la FORMA de cada uno, que es lo que decide si el archivo se acepta; que los
// tres reales se comportan como dice este test se comprobo una vez a mano contra ellos.

const HUELLA = ["Measurement date", "Z50 Ohm", "Resistencia a 50khz Ohm"];

/** Columnas de la hoja de pacientes (las del archivo real, recortadas): ninguna es una medicion. */
const COLUMNAS_DE_PACIENTES = ["#", "Fecha de nacimiento", "Género", "Nombre", "Apellido", "Email", "Altura"];

async function libroCon(hojas: { nombre: string; encabezados: string[]; fila: (string | number)[] }[]) {
  const wb = new ExcelJS.Workbook();
  for (const h of hojas) {
    const ws = wb.addWorksheet(h.nombre);
    ws.addRow(h.encabezados);
    ws.addRow(h.fila);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const hojaDeMedidas = (nombre: string) => ({
  nombre,
  // Se incluyen los encabezados con el espacio sobrante que trae el export real ("Paciente "), porque es como
  // llegan y porque la eleccion de hoja tiene que sobrevivirlo.
  encabezados: ["# ", "Paciente ", ...HUELLA, "Peso kg", "Altura cm"],
  fila: [5022982, "Fixture Paciente", "13-07-2026 21:11", 501, 497.578, 80.4, 177],
});

const hojaDePacientes = {
  nombre: "Patients",
  encabezados: COLUMNAS_DE_PACIENTES,
  fila: [4060767, "29-08-1996 00:00", "Male", "Fixture", "Paciente", "fixture@cnv", 177],
};

describe("los tres exports del Biody Manager", () => {
  it("1 · solo medidas: se acepta por el nombre de la hoja", async () => {
    const r = await parseBisXlsx(await libroCon([hojaDeMedidas("Measures")]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sheetName).toBe("Measures");
  });

  it("3 · las dos juntas: se acepta aunque la hoja se llame con el NOMBRE DEL PACIENTE", async () => {
    // Es el caso que rechazabamos por el nombre. Buscar por nombre no tiene arreglo posible aqui: el nombre es
    // el del paciente y cambia en cada archivo.
    const r = await parseBisXlsx(
      await libroCon([hojaDePacientes, hojaDeMedidas("Nicolas Granada Ramirez")]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sheetName).toBe("Nicolas Granada Ramirez");
  });

  it("y el orden de las hojas no importa", async () => {
    const r = await parseBisXlsx(await libroCon([hojaDeMedidas("Paciente Fixture"), hojaDePacientes]));
    expect(r.ok).toBe(true);
  });

  it("2 · solo datos del paciente: se rechaza, y el mensaje dice QUE archivo es y CUAL hace falta", async () => {
    const r = await parseBisXlsx(await libroCon([hojaDePacientes]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Antes decia 'no contiene la hoja "Measures"', que le pide al profesional saber como se llaman las hojas
      // de un archivo que no abrio: con esa frase no hay nada que pueda hacer.
      expect(r.error.message).toContain("datos del paciente");
      expect(r.error.message).toContain("medidas");
      expect(r.error.message).not.toContain("Measures");
    }
  });

  it("un XLSX sin nada de esto tambien se rechaza, sin hablar de hojas", async () => {
    const r = await parseBisXlsx(
      await libroCon([{ nombre: "Hoja1", encabezados: ["a", "b"], fila: [1, 2] }]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("bioimpedancia");
  });

  it("la huella NO es la lista de columnas requeridas del motor, y eso es deliberado", async () => {
    // Una hoja con la huella pero sin todas las columnas del motor SE ACEPTA aqui: si el motor pide una columna
    // mas, eso no debe cambiar que archivos se reconocen, solo si la medicion esta completa. Lo segundo lo juzga
    // la validacion despues, con su propio mensaje, que es el que sabe nombrar la columna que falta.
    const r = await parseBisXlsx(
      await libroCon([{ nombre: "X", encabezados: HUELLA, fila: ["13-07-2026 21:11", 501, 497.578] }]),
    );
    expect(r.ok).toBe(true);
  });
});
