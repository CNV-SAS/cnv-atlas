// GENERA UN ARCHIVO DE EXPORTACION SINTETICO, con el formato real del exportador, para el smoke de la
// importacion (sesion 5). Ningun dato de paciente real entra aqui.
//
// Uso:  node scripts/exportador-html/ejemplo-sintetico.mjs [ruta de salida]
//       (por defecto, docs/distribucion/exportador-html/ejemplo-sintetico.json)
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const exportador = createRequire(import.meta.url)("./exportador.js");

// LOS NUEVE INSUMOS DEL MOTOR, NI UNO MENOS (2026-09-23). Faltaba FFM, y el smoke de Santiago lo destapo:
// sin el, la importacion pasaba (su puerta miraba una lista a la que le faltaba justo ese) y el diagnostico
// reventaba despues. Un archivo de prueba incompleto no prueba el camino feliz, prueba otro camino.
const bis = {
  Re: 627.3, Ri: 1306.4, Rinf: 423.8, C: 2.96, Fo: 27.84,
  FM: 18.04, FFM: 62.36, FFMI: 19.9, peso: 80.4, tallaCm: 177,
};


// EL PATRON ALIMENTARIO, EN LA FORMA DEL HTML: el INDICE de la opcion (0-4), no su texto. Es lo que el HTML
// guarda de verdad (v9 L1725) y lo que el importador tiene que traducir. Sin esto, el archivo de prueba no
// ejercitaba el patron en absoluto y el defecto que salio en produccion el 2026-09-23 no lo habria visto
// nadie en el smoke.
const patron = {};
for (let i = 1; i <= 15; i++) patron[`d1_${i}_i`] = i % 5; // 0..4, variado
patron.d1f_sal_i = 1;     // "Rara vez"
patron.d1f_des_i = 0;     // "Si, todos los dias"
patron.d1f_noche_i = 2;   // "Entre 8 y 9 pm"

const consulta = (extra) => ({
  profesional: "Profesional Sintético",
  tipoProfesionalConsulta: "Nutricionista",
  pais: "Colombia",
  ciudad: "Medellín",
  motivo: ["Control de peso / composición corporal"],
  // EN LA FORMA DEL HTML, NO EN LA DE ATLAS (2026-09-23). Decia "CC" y "M", que es lo que Atlas GUARDA, no
  // lo que el HTML MANDA: el HTML escribe la etiqueta completa y la palabra (v9 L1288 y L7305). Con el
  // fixture escrito en la forma de destino, cualquier candado pasaba en verde sobre el defecto, y fue lo que
  // dejo pasar que ningun paciente importado real tuviera sexo.
  tipoDoc: "Cédula de ciudadanía",
  sexo: "Masculino",
  fechaNac: "1990-05-01",
  email: "sintetico@example.com",
  telefono: "3000000000",
  educacion: "Universitario",
  ocupacion: "Docente",
  estadoCivil: "Soltero/a",
  estrato: "3",
  consentimientoAceptado: true,
  fechaConsentimiento: "13 de agosto de 2026",
  d3_27: "Muy mala",
  d3_26: "Menos de 5h",
  d2_21: ["Ninguno"],
  // Las dos medidas del profesional que el HTML guarda por consulta y que desde el 2026-09-24 se importan.
  fuerzaPrensil: 34.5,
  pesoMeta: 75,
  ...patron,
  ...extra,
});

// Tres casos: dos consultas con la cintura solo en lo guardado a mano; una sin firma; y un informe enviado.
const navegador = [
  [
    "atlas:SINT-001",
    JSON.stringify([
      consulta({ nombre: "Sintético Uno", firmaNombre: "Sintético Uno", fechaConsulta: "2026-08-13", ...bis, cintura: null, cadera: 106 }),
      consulta({ nombre: "Sintético Uno", firmaNombre: "Sintético Uno", fechaConsulta: "2026-09-04", ...bis, cintura: null, cadera: 106 }),
    ]),
  ],
  ["atlas:antro:SINT-001", JSON.stringify({ peso: 80.4, tallaCm: 177, cintura: 84, cadera: 106 })],
  ["atlas_bis_SINT-001", JSON.stringify({ ...bis, cintura: null, cadera: 106 })],
  [
    "atlas:SINT-002",
    JSON.stringify([
      {
        fecha: "2026-09-04",
        nombre: "Sintético Dos",
        documento: "SINT-002",
        informePaciente: { fechaConsulta: "2026-09-04", fechaEnvio: "2026-09-05", resumen: "Informe del HTML (no se importa)." },
      },
      consulta({ nombre: "Sintético Dos", firmaNombre: "", consentimientoAceptado: false, fechaConsulta: "2026-09-04", ...bis, cintura: 84, cadera: 106 }),
    ]),
  ],
  ["atlas:SINT-003", JSON.stringify([consulta({ nombre: "Sintético Tres", firmaNombre: "Sintético Tres", fechaConsulta: "2026-07-08" })])],
  ["atlas:sesion:profesional", JSON.stringify({ nombre: "Profesional Sintético", tipo: "nutricionista" })],
];

const ahora = new Date().toISOString();
const exportacion = exportador.construirExportacion(navegador, ["SINT-001", "SINT-002", "SINT-003"], ahora, ahora);
const salida = process.argv[2] ?? "docs/distribucion/exportador-html/ejemplo-sintetico.json";
writeFileSync(salida, JSON.stringify(exportacion, null, 1));
console.log(`Archivo sintético: ${salida}`);
