// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CUANTOS PACIENTES IMPORTADOS DEL HTML TIENEN LA ENCUESTA INCOMPLETA
//
// SOLO LECTURA. No escribe nada. Responde la pregunta de Santiago del 2026-10-02: la consulta SQL de
// `QUE_LES_FALTA_A_LOS_IMPORTADOS.sql` no mira la encuesta, y la puerta del import SI la exige, asi que
// el cuadro quedaba incompleto justo donde podia estar el atasco.
//
// ── POR QUE UN SCRIPT Y NO MAS SQL ──
//
// Porque "respondida" NO es "hay una fila". El predicado real (`isAnswered`) distingue ausente de vacio,
// trata "[]" como sin responder, "0" como respuesta valida, y marca como INCOMPLETA una pregunta que
// eligio "Otra" sin escribir el texto, en sus cuatro flexiones. Reescribir eso en SQL es crear una
// SEGUNDA definicion de completitud, y la diferencia entre las dos se veria como un paciente que la
// pantalla deja pasar y el conteo no, o al reves. Asi que este script IMPORTA la funcion de la
// aplicacion: el numero sale del mismo codigo que decide en la pantalla.
//
// COMO SE CORRE. Va con `tsx` porque importa un modulo TypeScript de la aplicacion:
//
//   Contra la NUBE (PowerShell, igual que db:probar:cloud):
//     $env:DATABASE_URL="<cadena de la nube>"; pnpm tsx scripts/encuesta-de-los-importados.mjs
//
//   Contra la base LOCAL:
//     node --env-file=.env.local --experimental-strip-types scripts/encuesta-de-los-importados.mjs
//
// NO IMPRIME NINGUN DATO DE PACIENTE: solo conteos y, como mucho, el id de la evaluacion para poder
// buscarla. Ni nombres, ni documentos, ni respuestas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import postgres from "postgres";

import { computeSurveyGaps } from "../src/modules/clinical-pipeline/services/survey-completeness.ts";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

// Una fila por (evaluacion importada, pregunta de SU version de encuesta), con la respuesta si existe.
// LEFT JOIN a proposito: una pregunta SIN fila de respuesta es una pregunta sin responder, y es
// justamente el caso que un conteo ingenuo de filas no ve. Mismo armado que `pipeline-reader`.
const filas = await sql`
  select e.id as evaluacion,
         q.section,
         q.order_index,
         a.answer_value
    from evaluations e
    join survey_responses r on r.evaluation_id = e.id
    join survey_questions q on q.survey_version_id = r.survey_version_id
    left join survey_answers a on a.question_id = q.id and a.response_id = r.id
   where e.import_batch_id is not null`;

// Las importadas que NI SIQUIERA tienen encuesta: no aparecen arriba (el join las descarta) y son un
// caso distinto, no "incompleta" sino "sin ninguna".
const [sinEncuesta] = await sql`
  select count(*)::int as n
    from evaluations e
   where e.import_batch_id is not null
     and not exists (select 1 from survey_responses r where r.evaluation_id = e.id)`;

const porEvaluacion = new Map();
for (const f of filas) {
  if (!porEvaluacion.has(f.evaluacion)) porEvaluacion.set(f.evaluacion, []);
  porEvaluacion.get(f.evaluacion).push({
    section: f.section,
    orderIndex: Number(f.order_index),
    answerValue: f.answer_value,
  });
}

let completas = 0;
const incompletas = [];
const porDominio = new Map();
for (const [evaluacion, preguntas] of porEvaluacion) {
  const huecos = computeSurveyGaps(preguntas);
  if (huecos.length === 0) {
    completas++;
    continue;
  }
  const faltan = huecos.reduce((s, g) => s + g.missing, 0);
  incompletas.push({ evaluacion, faltan, de: preguntas.length });
  for (const g of huecos) porDominio.set(g.section, (porDominio.get(g.section) ?? 0) + g.missing);
}

console.log("EVALUACIONES IMPORTADAS DEL HTML");
console.log("  con encuesta COMPLETA  :", completas);
console.log("  con encuesta INCOMPLETA:", incompletas.length);
console.log("  SIN ninguna encuesta   :", sinEncuesta.n);
console.log("  (total mirado          :", porEvaluacion.size + sinEncuesta.n, ")");

if (incompletas.length > 0) {
  const faltas = incompletas.map((i) => i.faltan).sort((a, b) => a - b);
  const mediana = faltas[Math.floor(faltas.length / 2)];
  console.log("\nCUANTAS RESPUESTAS LES FALTAN");
  console.log("  la que menos:", faltas[0], "| mediana:", mediana, "| la que mas:", faltas[faltas.length - 1]);
  console.log("\nPOR DOMINIO (suma de respuestas que faltan en todas):");
  for (const [dominio, n] of [...porDominio.entries()].sort((a, b) => b[1] - a[1])) {
    console.log("  " + String(dominio).padEnd(32), n);
  }
  console.log("\nLAS DIEZ MAS CERCA DE ESTAR COMPLETAS (son las que menos trabajo cuestan):");
  for (const i of [...incompletas].sort((a, b) => a.faltan - b.faltan).slice(0, 10)) {
    console.log(`  ${i.evaluacion}  faltan ${i.faltan} de ${i.de}`);
  }
}

await sql.end();
