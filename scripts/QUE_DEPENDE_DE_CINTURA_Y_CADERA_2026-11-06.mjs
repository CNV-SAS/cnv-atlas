// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE CAMPOS DEL BIODY DEPENDEN DE CINTURA Y CADERA  ·  SOLO LECTURA  ·  2026-11-06
//
// POR QUE: Maria Teresa tecleo 1020 en la cadera, el freno de rango acerto, y no hubo forma de corregirlo
// sin repetir la toma. La pregunta de si Atlas puede dejar corregir ese dato la decide Gildardo, y para
// que la decida hace falta saber QUE depende de esas dos medidas: si el equipo calcula algo con ellas, un
// arreglo solo en Atlas dejaria a Atlas y al Biody Manager diciendo cosas distintas.
//
// NO IMPRIME NI UN VALOR DE LA PACIENTE: solo los NOMBRES de las columnas del archivo y si Atlas las usa.
// El unico numero que sale es el de la cadera equivocada, que ya esta en el reporte de Santiago.
//
// COMO SE CORRE:
//   node scripts/QUE_DEPENDE_DE_CINTURA_Y_CADERA_2026-11-06.mjs "<ruta del xlsx>"
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import ExcelJS from "exceljs";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Falta la ruta del xlsx.");
  process.exit(1);
}

const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(ruta);

console.log(`\nHojas: ${libro.worksheets.map((h) => h.name).join(", ")}`);

const hoja = libro.worksheets.find((h) => /measure/i.test(h.name)) ?? libro.worksheets[0];
console.log(`Hoja leida: ${hoja.name} · ${hoja.rowCount} filas`);

const encabezados = [];
hoja.getRow(1).eachCell({ includeEmpty: false }, (celda, col) => {
  encabezados.push({ col, nombre: String(celda.value ?? "").trim() });
});
console.log(`\nColumnas del archivo: ${encabezados.length}`);

// LAS QUE HABLAN DE CINTURA O CADERA, por su nombre.
const DE_CINTURA_O_CADERA = /waist|hip|cintura|cadera|whr|w\/h|ratio/i;
const senaladas = encabezados.filter((e) => DE_CINTURA_O_CADERA.test(e.nombre));
console.log(`\n── COLUMNAS QUE NOMBRAN CINTURA, CADERA O SU INDICE ──`);
for (const e of senaladas) {
  // Si la fila 2 trae valor, se dice SOLO si esta o no, nunca el numero (salvo la cadera del caso).
  const v = hoja.getRow(2).getCell(e.col).value;
  const esLaCadera = /hip/i.test(e.nombre) && Number(v) === 1020;
  console.log(`  "${e.nombre}" -> ${v == null || v === "" ? "vacía" : esLaCadera ? "1020 (el tecleo del caso)" : "con valor"}`);
}

// Y LAS QUE PODRIAN DERIVARSE: un indice que se mueva si cambia una de las dos.
console.log(`\n── TODAS LAS COLUMNAS, PARA VER SI ALGUNA ES DERIVADA ──`);
console.log(encabezados.map((e) => e.nombre).join(" | "));
