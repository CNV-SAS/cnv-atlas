// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SANTIAGO NECESITA PARA COORDINAR LAS CORRECCIONES CON ANGELA  ·  SOLO LECTURA  ·  2026-11-07
//
// ESTE SCRIPT NO CONTIENE NI UN DATO DE PACIENTE. Los saca de la nube y los escribe en
// `docs/entregas/dudas/`, que esta gitignoreado (`docs/entregas/dudas/**`, .gitignore L110) y no sale de
// CNV. El script si entra a git: es el procedimiento, no el dato.
//
// QUE ARMA:
//   1. A que paciente corresponde el grupo 14 (las consultas 2be9aa69 y b4a9ea2a), que es lo primero
//      que va en el mensaje: son las dos que pasan a banda acelerada con el motor de hoy.
//   2. Los pacientes sin fecha de nacimiento, con su documento y sus consultas.
//   3. El contexto de los demas grupos de medicion repetida, para la guia por tipo de caso.
//
// COMO SE CORRE (lee la nube, no escribe nada en ella):
//   node --env-file=.env.production.local scripts/PARA_COORDINAR_CON_ANGELA_2026-11-07.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "datos para coordinar con Angela (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

async function todas(tabla, columnas, afinar = (q) => q, orden = "id") {
  const salida = [];
  const paso = 1000;
  for (let desde = 0; ; desde += paso) {
    const { data, error } = await afinar(db.from(tabla).select(columnas))
      .order(orden, { ascending: true })
      .range(desde, desde + paso - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    salida.push(...(data ?? []));
    if ((data ?? []).length < paso) break;
  }
  return salida;
}

// ── Lo que hace falta de la base ───────────────────────────────────────────────────────────────────

const evaluaciones = await todas(
  "evaluations",
  "id, patient_id, professional_id, type, status, retirada_at, superseded_at, created_at",
);
const pacientes = await todas("patients", "id, document_type, document_number, cuenta_como_de_prueba, deleted_at");
const perfiles = await todas("patient_profiles", "patient_id, first_name, last_name, birth_date", (q) => q, "patient_id");
const mediciones = await todas("bis_measurements", "id, evaluation_id, measurement_date, created_at");
const diagnosticos = await todas("diagnoses", "id, evaluation_id, created_at", (q) => q, "id");
// EL NOMBRE DEL PROFESIONAL VA POR DOS SALTOS, no por uno: `evaluations.professional_id` apunta a
// `professional_profiles.id`, y el nombre vive en `profiles.full_name`. Buscarlo directo en `profiles`
// no da error: devuelve vacio, y la columna sale entera con "sin profesional", que es creible y falso.
const perfilesProfesionales = await todas("professional_profiles", "id, profile_id", (q) => q, "id");
const nombresDeProfiles = new Map(
  (await todas("profiles", "id, full_name", (q) => q, "id")).map((p) => [p.id, p.full_name]),
);
const profesionales = perfilesProfesionales.map((pp) => ({
  id: pp.id,
  full_name: nombresDeProfiles.get(pp.profile_id) ?? null,
}));

const porPaciente = new Map(pacientes.map((p) => [p.id, p]));
const porPerfil = new Map(perfiles.map((p) => [p.patient_id, p]));
const porProfesional = new Map(profesionales.map((p) => [p.id, p.full_name]));
const conDiagnostico = new Set(diagnosticos.map((d) => d.evaluation_id));
const medicionDe = new Map();
for (const m of mediciones) {
  const prev = medicionDe.get(m.evaluation_id);
  if (!prev || String(m.created_at) > String(prev.created_at)) medicionDe.set(m.evaluation_id, m);
}

const nombre = (patientId) => {
  const p = porPerfil.get(patientId);
  return p ? `${p.first_name} ${p.last_name}`.replace(/\s+/g, " ").trim() : "(sin perfil)";
};
const documento = (patientId) => {
  const p = porPaciente.get(patientId);
  return p ? `${p.document_type ?? ""} ${p.document_number ?? ""}`.trim() : "(sin ficha)";
};

// ── 1 · El grupo 14 ────────────────────────────────────────────────────────────────────────────────

const GRUPO_14 = ["2be9aa69", "b4a9ea2a"];
const delGrupo14 = evaluaciones.filter((e) => GRUPO_14.includes(String(e.id).slice(0, 8)));

// ── 2 · Los pacientes sin fecha de nacimiento ──────────────────────────────────────────────────────
//
// SOLO PACIENTES REALES Y VIVOS EN LA FICHA: los de prueba y los eliminados no son trabajo de nadie.

const sinFecha = perfiles
  .filter((p) => !p.birth_date)
  .map((p) => porPaciente.get(p.patient_id))
  .filter((p) => p && !p.deleted_at && !p.cuenta_como_de_prueba);

const consultasDe = (patientId) =>
  evaluaciones
    .filter((e) => e.patient_id === patientId && !e.retirada_at && !e.superseded_at)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

// ── 3 · El contexto de los grupos de medicion repetida ─────────────────────────────────────────────

const GRUPOS = {
  3: ["99f4be45"],
  4: ["f99bc9f3", "d8a9076a"],
  5: ["4118e694", "36aba016"],
  6: ["d6892f88", "7f31029c"],
  7: ["6b82f54e", "fb29a4e8"],
  9: ["0582ea65", "24bb7e23"],
  10: ["0300d807", "80d168dd"],
  11: ["15149709", "233f7a5d"],
  12: ["8ddc1244", "baf15441"],
  13: ["e3599e84", "0c6f8ad4"],
  14: ["2be9aa69", "b4a9ea2a"],
};

// ¿CUALES SIGUEN REPETIDAS HOY? La lista de grupos se levanto el 2026-10-24 y desde entonces el conjunto
// puede haberse movido solo: la vista excluye a los pacientes de prueba, asi que un grupo cuya gemela era
// de una cuenta de prueba deja de estar repetido sin que nadie haga nada. Preguntarselo a la vista en vez
// de dar la lista por buena es lo que evita mandarle a Angela trabajo que ya no existe.
const vigentes = await todas("evaluaciones_vigentes", "id, huella_repetida");
const repetidaHoy = new Map(vigentes.map((v) => [String(v.id).slice(0, 8), Boolean(v.huella_repetida)]));

const filaDeConsulta = (e) => {
  const m = medicionDe.get(e.id);
  const perfil = porPerfil.get(e.patient_id);
  return {
    corta: String(e.id).slice(0, 8),
    paciente: nombre(e.patient_id),
    documento: documento(e.patient_id),
    nacimiento: perfil?.birth_date ?? "(sin fecha)",
    tipo: e.type,
    estado: e.status,
    medicion: m?.measurement_date ? String(m.measurement_date).slice(0, 10) : "(sin medición)",
    diagnostico: conDiagnostico.has(e.id) ? "sellado" : "sin sellar",
    profesional: porProfesional.get(e.professional_id) ?? "(sin profesional)",
    dePrueba: Boolean(porPaciente.get(e.patient_id)?.cuenta_como_de_prueba),
  };
};

// ── El documento ───────────────────────────────────────────────────────────────────────────────────

const L = [];
L.push("# Las correcciones que hay que coordinar con Ángela");
L.push("");
L.push(
  "**Generado el 2026-11-07 contra producción.** Lleva nombre y documento: no entra a git ni sale de CNV.",
);
L.push("");
L.push(
  "La versión sin datos de paciente, con los identificadores de ocho caracteres, es " +
    "`docs/entregas/AVISOS_AMBAR_SIN_SALIDA_2026-11-07.md`.",
);
L.push("");
L.push("---");
L.push("");

// 1
L.push("## 1 · Lo primero del mensaje: el grupo 14");
L.push("");
if (delGrupo14.length === 0) {
  L.push("No se encontraron las consultas del grupo 14. Revisar los identificadores.");
} else {
  const p = delGrupo14[0];
  L.push(`**Paciente: ${nombre(p.patient_id)} · ${documento(p.patient_id)}**`);
  L.push("");
  L.push(
    "Las dos consultas comparten la misma toma física, y son las dos que **pasan a banda acelerada** " +
      "con el motor de hoy: el informe que la paciente tiene en la mano dice una cosa y el recálculo " +
      "diría otra. El freno no es la ciencia, es saber cuál de las dos tomas vale.",
  );
  L.push("");
  L.push("| consulta | tipo | estado | medición | diagnóstico |");
  L.push("|---|---|---|---|---|");
  for (const e of delGrupo14) {
    const f = filaDeConsulta(e);
    L.push(`| \`${f.corta}\` | ${f.tipo} | ${f.estado} | ${f.medicion} | ${f.diagnostico} |`);
  }
  L.push("");
}

// 2
L.push("---");
L.push("");
L.push(`## 2 · Los pacientes sin fecha de nacimiento (${sinFecha.length})`);
L.push("");
L.push(
  "Sin fecha de nacimiento el motor **no calcula la edad y se detiene en voz alta**: no hay diagnóstico. " +
    "La salida es registrarla en la ficha del paciente, y después la consulta sigue por el camino normal.",
);
L.push("");
L.push("| paciente | documento | profesional | consultas |");
L.push("|---|---|---|---|");
for (const p of sinFecha.sort((a, b) => nombre(a.id).localeCompare(nombre(b.id)))) {
  const cs = consultasDe(p.id);
  const detalle =
    cs.length === 0
      ? "(ninguna vigente)"
      : cs
          .map((e) => {
            const f = filaDeConsulta(e);
            return `${f.tipo} ${f.estado} (\`${f.corta}\`, ${f.medicion})`;
          })
          .join(" · ");
  const prof = cs.length > 0 ? (porProfesional.get(cs[0].professional_id) ?? "—") : "—";
  L.push(`| ${nombre(p.id)} | ${documento(p.id)} | ${prof} | ${detalle} |`);
}
L.push("");

// 3
L.push("---");
L.push("");
L.push("## 3 · Los grupos de medición repetida, con sus datos");
L.push("");
L.push(
  "El **grupo** es el conjunto de consultas que comparten la misma toma física: resolver una resuelve " +
    "a las dos. La guía por tipo de caso va en la sección 4.",
);
L.push("");
const resueltos = Object.entries(GRUPOS).filter(([, cs]) => cs.every((c) => repetidaHoy.get(c) !== true));
if (resueltos.length > 0) {
  L.push(
    `> **Ya no hay nada que hacer en ${resueltos.length === 1 ? "el grupo" : "los grupos"} ` +
      `${resueltos.map(([g]) => g).join(", ")}.** La vista ya no los marca como repetidos: su gemela era ` +
      "de una cuenta de prueba, y las de prueba no cuentan. Se dejan en la tabla con su marca para que " +
      "nadie los vuelva a abrir.",
  );
  L.push("");
}
L.push("| grupo | estado hoy | paciente | documento | nacimiento | consulta | tipo · estado | medición | diagnóstico |");
L.push("|---|---|---|---|---|---|---|---|---|");
for (const [g, cortas] of Object.entries(GRUPOS)) {
  const sigue = cortas.some((c) => repetidaHoy.get(c) === true);
  for (const corta of cortas) {
    const e = evaluaciones.find((x) => String(x.id).slice(0, 8) === corta);
    if (!e) {
      L.push(`| ${g} | — | (no encontrada) | | | \`${corta}\` | | | |`);
      continue;
    }
    const f = filaDeConsulta(e);
    L.push(
      `| ${g} | ${sigue ? "**abierta**" : "ya resuelta"} | ${f.paciente}${f.dePrueba ? " _(de prueba)_" : ""} | ` +
        `${f.documento} | ${f.nacimiento} | \`${f.corta}\` | ${f.tipo} · ${f.estado} | ${f.medicion} | ${f.diagnostico} |`,
    );
  }
}
L.push("");

// ── 4 · La guia por tipo de caso ───────────────────────────────────────────────────────────────────
//
// VA EN EL SCRIPT Y NO A MANO EN EL .md: el documento se regenera, y una guia escrita a mano en el
// archivo se perderia en la siguiente corrida sin que nadie lo note.

L.push("---");
L.push("");
L.push("## 4 · Guía de corrección, por tipo de caso");
L.push("");
L.push(
  "Cada caso dice **el botón exacto** y **quién lo hace**. Donde Atlas no tiene flujo, lo dice: eso no " +
    "se resuelve en pantalla y necesita una decisión antes de tocar nada.",
);
L.push("");

L.push("### 4.1 · Seguimiento con la medición de la inicial (grupos 4, 6, 9 y 14)");
L.push("");
L.push("Son del **mismo paciente**: la inicial y el seguimiento comparten una sola toma física.");
L.push("");
L.push("**Primero hay que saber cuál de los dos hechos ocurrió**, y eso solo lo sabe Ángela:");
L.push("");
L.push(
  "**(a) El control SÍ ocurrió y su toma nunca se subió** (quedó en el Biody Manager, o se volvió a " +
    "importar el archivo de la inicial). Entonces el seguimiento tiene un diagnóstico calculado sobre " +
    "el cuerpo de la consulta anterior.",
);
L.push("");
L.push("> **Lo hace Ángela**, en la consulta de **seguimiento**:");
L.push(">");
L.push("> 1. Pestaña **Antrop. & BIS** → bloque de reemplazar la medición → botón **“Repetir la toma (salió mal)”**.");
L.push(">    Pide un motivo de al menos 15 caracteres y una confirmación.");
L.push(">    La medición vieja **no se borra**: queda en la versión anterior, legible, con su diagnóstico firmado.");
L.push("> 2. La versión nueva nace **sin medición**, así que su pendiente dice “Montar BIS”.");
L.push(">    Ahí se sube el archivo correcto del control. El freno de medición duplicada **no estorba**:");
L.push(">    la versión nueva queda unida a la vieja y ese es el caso que el freno deja pasar.");
L.push("> 3. Las condiciones de la toma vuelven a quedar pendientes a propósito (eran las de otra toma).");
L.push(">    La encuesta, la fuerza prensil y el peso meta **viajan**: esos sí eran de este paciente.");
L.push("");
L.push(
  "**(b) El control NO ocurrió: la consulta de seguimiento se creó por error.** Aquí hay que separar " +
    "dos situaciones, y la segunda **no tiene flujo**:",
);
L.push("");
L.push("> · **Sin diagnóstico sellado:** lo hace Ángela (o Santiago como admin), desde la ficha del");
L.push(">   paciente, en el historial de consultas → icono **“Retirar esta consulta”** → motivo");
L.push(">   **“No ocurrió”** o **“Ocurrió, pero la medición no se subió”** + detalle. Es reversible.");
L.push(">");
L.push("> · **Con diagnóstico sellado: NO HAY FLUJO EN ATLAS, y es deliberado.** Retirar una consulta");
L.push(">   con diagnóstico escondería una salida clínica, así que el sistema lo rechaza en la acción y");
L.push(">   otra vez en un trigger de la base. **Las cuatro de estos grupos están selladas.** Si de verdad");
L.push(">   hay que deshacerlas, es una decisión de Santiago y Gildardo, y se hace con un script con su");
L.push(">   motivo y su rastro, no desde la pantalla.");
L.push("");

L.push("### 4.2 · La medición es de otro paciente (grupos 5, 7 y 13)");
L.push("");
L.push(
  "Son los de **riesgo real**: el diagnóstico de una de las dos consultas se calculó con la " +
    "bioimpedancia de otra persona. Esto **no se arregla recalculando**.",
);
L.push("");
L.push("> **Lo hace Ángela**, en la consulta que recibió el archivo equivocado:");
L.push(">");
L.push("> 1. Pestaña **Antrop. & BIS** → botón **“El archivo es de otra persona”**.");
L.push("> 2. La medición queda marcada como *no es de este paciente*. Esa marca es la que después deja");
L.push(">    al dueño de verdad **importar su propio archivo** pese al freno de duplicados.");
L.push("> 3. El diagnóstico firmado se queda en la versión anterior: quien firmó, firmó.");
L.push("");
L.push(
  "**Primero hay que decidir de quién es la toma.** Si no se sabe, el camino correcto es marcarla en " +
    "las dos y volver a medir: una toma que no se sabe de quién es no sirve para ninguno de los dos.",
);
L.push("");

L.push("### 4.3 · La misma persona, creada dos veces con documentos distintos (grupo 12)");
L.push("");
L.push("> **NO HAY FORMA DE UNIR DOS FICHAS EN ATLAS.** No existe ese flujo y no es un olvido: unir dos");
L.push("> historias clínicas mezcla dos consentimientos firmados por separado, y eso no se deshace.");
L.push("");
L.push("Lo que sí se puede hacer, en este orden:");
L.push("");
L.push("1. **Ángela decide cuál de las dos fichas es la buena** (la del documento correcto).");
L.push("2. **La ficha sobrante se archiva** (reversible de un clic, no afirma nada sobre la persona), o");
L.push("   se pide su eliminación: **la pide Ángela y la ejecuta Santiago como admin**. Son dos pasos a");
L.push("   propósito: quien se beneficia de la exclusión no la autoriza.");
L.push("3. **Las consultas de la ficha sobrante no se mueven a la otra**: no hay traspaso, y copiarlas a");
L.push("   mano sería inventar historia clínica. Quedan donde están, en la ficha archivada.");
L.push("");
L.push(
  "Si lo que hace falta de verdad es que las dos consultas vivan en una sola historia, eso es una " +
    "pieza nueva y hay que decidirla: hoy no existe.",
);
L.push("");

L.push("### 4.4 · Fecha de nacimiento que falta o que no cuadra");
L.push("");
L.push("**Si FALTA** (los 15 de la sección 2): sí hay flujo.");
L.push("");
L.push("> **Lo hace Ángela** (o Santiago como admin), en la **ficha del paciente** → bloque de la fecha");
L.push("> de nacimiento → registrarla. Después, el diagnóstico se genera por el camino normal y, si la");
L.push("> consulta ya tenía uno, aparece en la pantalla de recalibración para reemitir.");
L.push(">");
L.push("> **Ojo con lo que puede destapar:** si la persona era menor el día que firmó, al registrar la");
L.push("> fecha aparece como *pendiente de regularizar*. Eso no es un problema nuevo: es uno que estaba");
L.push("> invisible por falta del dato.");
L.push("");
L.push("**Si NO CUADRA** (grupos 10 y 11: la edad de la ficha no coincide con la del equipo):");
L.push("");
L.push("> **NO HAY FLUJO EN ATLAS.** El bloque de la fecha de nacimiento **sólo rellena un hueco y nunca");
L.push("> pisa un valor**, y está escrito así a propósito: la fecha de nacimiento decide la rama del");
L.push("> consentimiento (mayor o menor de edad), y pisarla podría convertir un consentimiento firmado");
L.push("> como adulto en uno que no autorizaba quien tenía que autorizarlo.");
L.push(">");
L.push("> Corregir una fecha ya registrada es otro acto, con su motivo y su rastro, y **todavía no está");
L.push("> construido**. Lo que hace falta de Ángela mientras tanto es **cuál es la fecha correcta** y de");
L.push("> dónde sale (documento de identidad, no memoria).");
L.push(">");
L.push("> Y antes de tocar nada: en estos dos grupos la diferencia es de **nueve años**, así que puede");
L.push("> que lo que esté mal no sea la ficha sino **la toma** (el Biody Manager calcula su edad del dato");
L.push("> que se le teclea). Si la fecha de la ficha es la buena, el caso es el 4.1 o el 4.2, no este.");
L.push("");

L.push("### 4.5 · El grupo 3 (gemela de un paciente de prueba)");
L.push("");
L.push(
  "**Ya está resuelto y no hay que hacer nada.** La consulta gemela es de una cuenta de prueba, y las " +
    "de prueba no entran en el conteo de mediciones repetidas. La vista ya no lo marca.",
);
L.push("");
L.push(
  "Si volviera a aparecer un caso así con la gemela **sin marcar** como de prueba: marcar al paciente " +
    "de prueba **lo hace Santiago como admin** desde la ficha, y con eso el grupo se cierra solo.",
);
L.push("");

L.push("---");
L.push("");
L.push("## 5 · Lo que hace falta preguntarle a Ángela, en una lista");
L.push("");
L.push("1. **Grupo 14** (sección 1): ¿el control ocurrió? Si ocurrió, ¿está la toma en el Biody Manager?");
L.push("2. **Grupos 4, 6 y 9**: lo mismo, uno por uno.");
L.push("3. **Grupos 5, 7 y 13**: ¿de cuál de los dos pacientes es la toma? Si no se sabe, se vuelve a medir.");
L.push("4. **Grupo 12**: ¿cuál de los dos documentos es el correcto?");
L.push("5. **Grupos 10 y 11**: ¿cuál es la fecha de nacimiento correcta, y de dónde sale?");
L.push("6. **Los 15 sin fecha de nacimiento** (sección 2): la fecha de cada uno.");
L.push("");

mkdirSync("docs/entregas/dudas", { recursive: true });
const destino = "docs/entregas/dudas/PARA_COORDINAR_CON_ANGELA_2026-11-07.md";
writeFileSync(destino, `${L.join("\n")}\n`, "utf8");

console.log(`\nEscrito: ${destino}`);
console.log(`  grupo 14: ${delGrupo14.length} consultas`);
console.log(`  sin fecha de nacimiento: ${sinFecha.length} pacientes reales`);
console.log(`  grupos de medicion repetida: ${Object.keys(GRUPOS).length}`);
console.log("\nNo se escribio nada en la nube.");
