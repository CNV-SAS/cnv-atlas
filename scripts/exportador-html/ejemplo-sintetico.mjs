// GENERA UN ARCHIVO DE EXPORTACION SINTETICO, con el formato real del exportador, para el smoke de la
// importacion (sesion 5). Ningun dato de paciente real entra aqui.
//
// Uso:  node scripts/exportador-html/ejemplo-sintetico.mjs [ruta de salida]
//       (por defecto, docs/distribucion/exportador-html/ejemplo-sintetico.json)
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const exportador = createRequire(import.meta.url)("./exportador.js");

const bis = { Re: 627.3, Ri: 1306.4, Rinf: 423.8, C: 2.96, Fo: 27.84, FM: 18.04, FFMI: 19.9, peso: 80.4, tallaCm: 177 };

const consulta = (extra) => ({
  profesional: "Profesional Sintético",
  tipoProfesionalConsulta: "Nutricionista",
  pais: "Colombia",
  ciudad: "Medellín",
  motivo: ["Control de peso / composición corporal"],
  tipoDoc: "CC",
  sexo: "M",
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
