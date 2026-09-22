import type { PatronGrupoView, PatronResolution } from "@/clinical-engine";
import { COLOR_DE_NIVEL, nivelDeRespuesta, type ValorEncuesta } from "@/clinical-engine/encuesta-colores";
import { DOMINIOS_ENCUESTA } from "@/clinical-engine/dominios-encuesta";
import type { EvaluationCharacterization, SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";
import { SurveyAnswerReadonly } from "@/modules/evaluations/components/survey-widgets";

import { DetailsSection } from "./details-section";

// Diagnostico de encuesta (D1-D8). D1 (Patron alimentario, C9) porta la pantalla del v8: tarjetas de
// categoria + grilla de los 15 grupos. D2-D8 son un READ-OUT por dominio (pregunta -> respuesta), fiel al
// v8 (su subpestana "Diagnostico Encuesta" muestra `enc[k]` por pregunta, NO un analisis computado): se
// portan reusando `SurveyAnswerReadonly` (el mismo componente que la pestana Evaluacion) para que el dato
// se vea IGUAL en las dos pantallas y no diverjan. (Antes decia "hasta que Gildardo entregue su analisis":
// era un pendiente mal registrado; no habia nada que esperar, era trabajo nuestro sin hacer.)
//
// DIVERGENCIA DE CONTENEDOR (deliberada, ver DIVERGENCIAS.md): el v8 navega D1-D8 con sub-pestanas; aca
// se mantienen COLAPSABLES (decision de UI previa, no se rehace la navegacion). La organizacion INTERNA
// del patron es fiel al v8.
//
// NO se muestra el puntaje ni el nivel: el v8 no los muestra, y ademas hoy el score alimenta el indice
// contextual, que esta APAGADO (C1). Cuando C1 se active y el score empiece a mover la edad bioelectrica,
// se revisa con Gildardo si debe verse. Ver DIVERGENCIAS.md.

// Titulos VERBATIM del read-out D1-D8 del HTML al dia (gildardo-2026-08-13/ATLAS_v8.html, separador
// "·", no em-dash). Portados TODOS (no solo D2) para que el rotulo de dominio sea el suyo: D4 y D6
// cambian de sentido, no solo de forma (D4 "Conductas Alimentarias" -> "Patrón Horario Alimentario";
// D6 pierde "Alergias" del rotulo aunque el dominio aun trae esas preguntas, congeladas: reconcilia
// cuando entre su encuesta final). Es contenido suyo (instruccion de Santiago 2026-08-13).
// Los titulos viven en el motor desde el 2026-09-21: los leen tambien la IA y el SOAP.
const SECTIONS = DOMINIOS_ENCUESTA;

// Etiquetas ABREVIADAS de frecuencia para la pildora (verbatim del v8 L13728; NO el texto de encuesta).
const FREQ_LABELS = ["Nunca", "1–2d/sem", "3–4d/sem", "5–6d/sem", "Todos"];

// Tarjetas de categoria PORTADAS VERBATIM del HTML al dia (gildardo-2026-08-13, L13886-13899). Incluye la
// correccion del 12-ago que antes no habiamos portado: (1) el grupo 15 (carnes rojas) va en "Moderados"
// ([8,9,10,15]); (2) los Moderados tienen su PROPIA logica de color, NO la de protectores: en ellos mas
// frecuencia NO es mejor (se moderan), asi que el optimo esta en el medio y la frecuencia alta deja de
// pintarse en verde. (Antes tratabamos Moderados como protectores: por eso pintaba rojo donde el HTML
// verde, y "Moderados: Bajo" donde el HTML "Adecuado".)
const CAT_CARDS = [
  { cat: "protector", label: "✅ Protectores", color: "#059669", grupos: [1, 2, 3, 4, 5, 6, 7] },
  { cat: "neutro", label: "⚖️ Moderados", color: "#1d4ed8", grupos: [8, 9, 10, 15] },
  { cat: "riesgo", label: "⚠️ De riesgo", color: "#dc2626", grupos: [11, 12, 13, 14] },
] as const;

// Estado de una tarjeta de categoria a partir del promedio de sus grupos (13-ago L13895-13899, verbatim).
// Tres logicas: riesgo (menos es mejor), moderados/neutro (el medio es lo optimo), protectores (mas es mejor).
function catEstado(
  avg: number | null,
  cat: "protector" | "neutro" | "riesgo",
): { label: string; color: string } {
  if (avg === null) return { label: "Sin datos", color: "#94a3b8" };
  const isR = cat === "riesgo";
  const isMod = cat === "neutro";
  const label = isR
    ? avg <= 1 ? "Adecuado" : avg <= 2 ? "Moderado" : "Elevado"
    : isMod
      ? avg <= 2 ? "Adecuado" : avg <= 3 ? "Moderado" : "Elevado"
      : avg >= 3 ? "Adecuado" : avg >= 2 ? "Moderado" : "Bajo";
  const color = label === "Adecuado" ? "#059669" : label === "Moderado" ? "#d97706" : "#dc2626";
  return { label, color };
}

function CategoryCards({ grupos }: { grupos: PatronGrupoView[] }) {
  const byN = new Map(grupos.map((g) => [g.n, g.ordinal]));
  return (
    <div className="grid grid-cols-3 gap-2">
      {CAT_CARDS.map((c) => {
        const vals = c.grupos.map((n) => byN.get(n) ?? null).filter((v): v is number => v !== null);
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        const est = catEstado(avg, c.cat);
        return (
          <div key={c.cat} className="rounded-xl border p-3" style={{ borderColor: c.color + "33" }}>
            <div className="text-[11px] font-extrabold" style={{ color: c.color }}>{c.label}</div>
            <div className="my-1 text-base font-black" style={{ color: est.color }}>{est.label}</div>
            <div className="h-1 overflow-hidden rounded bg-muted">
              <div className="h-full rounded" style={{ width: avg !== null ? `${Math.round((avg / 4) * 100)}%` : "0%", background: est.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══ UNA SOLA PASTILLA PARA D1 Y PARA D2-D8 (Santiago, 2026-09-21) ═══
//
// Los HEX ya eran los mismos (los de su archivo: #059669, #d97706, #dc2626), pero la forma no: D1 iba en
// 10 px con fondo al 12% y sin borde, y D2-D8 en 11 px con fondo al 9% y borde. Visto de pie, el verde
// de una pestaña y el de la otra no parecian el mismo verde, y un semaforo con dos verdes en la misma
// pantalla se lee como dos significados. La forma es la de D1, que es la que el enseña.
// EL TAMAÑO NO ES EL MISMO EN D1 Y EN D2-D8, y es a proposito (Santiago, 2026-09-21): D1 es una grilla de
// quince grupos con su propia organizacion, y D2-D8 es pregunta contra respuesta. En D2-D8
// la pregunta va en 14 px y la pastilla en 12 px, que en NEGRITA se lee del mismo peso (Santiago: a 14 px la
// pastilla pesaba mas que la pregunta). Es la proporcion que ya funcionaba en D1. Lo que NO cambia es la
// forma (fondo al 12%, sin borde) ni el color; la de respuesta es algo menos redonda porque puede partirse en
// dos lineas, y una pildora de dos lineas se ve rota.
function PastillaDeColor({
  color,
  children,
  tamano = "grilla",
}: {
  color: string;
  children: React.ReactNode;
  /** "grilla" = D1 (12 px); "respuesta" = D2-D8, del tamaño de la pregunta (14 px). */
  tamano?: "grilla" | "respuesta";
}) {
  return (
    <span
      className={`inline-block font-bold ${tamano === "respuesta" ? "rounded-xl px-2.5 py-0.5 text-xs leading-snug" : "rounded-full px-2 py-0.5 text-xs"}`}
      style={{ color, background: `${color}1f` }}
    >
      {children}
    </span>
  );
}

// Grilla de los 15 grupos con su frecuencia (v8 L13847-13859, verbatim en logica de color).
function GrupoGrid({ grupos }: { grupos: PatronGrupoView[] }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {grupos.map((g) => {
        const isR = g.cat === "riesgo";
        const isMod = g.cat === "neutro";
        const v = g.ordinal;
        // Tres logicas de color (13-ago L13907-13909): riesgo (poco=verde), moderados (medio=verde,
        // mucho=rojo), protectores (mucho=verde). Antes moderados usaba la de protectores (pintaba mal).
        const ok = v !== null && (isR ? v <= 1 : isMod ? v <= 2 : v >= 3);
        const al = v !== null && (isR ? v >= 3 : isMod ? v >= 4 : v <= 1);
        const col = v === null ? "#94a3b8" : ok ? "#059669" : al ? "#dc2626" : "#d97706";
        return (
          <div key={g.n} className="flex items-center justify-between rounded-lg border px-2 py-1" style={{ borderColor: col + "22", background: col + "0d" }}>
            <span className="text-sm text-foreground">{g.label}</span>
            <PastillaDeColor color={col}>{v !== null ? FREQ_LABELS[v] : "-"}</PastillaDeColor>
          </div>
        );
      })}
    </div>
  );
}

function PatronD1({ patron }: { patron: PatronResolution }) {
  if (patron.status === "no_capturado") {
    return (
      <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
        Esta evaluación es anterior a la captura del patrón alimentario.
      </p>
    );
  }
  if (patron.status === "sin_respuestas") {
    return (
      <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
        El paciente no respondió el patrón alimentario en esta evaluación.
      </p>
    );
  }
  if (patron.status === "ilegible") {
    // DEFECTO del sistema, ya reportado (Sentry). El aviso dice las DOS cosas: problema tecnico ya
    // reportado, y lectura incompleta que NO debe usarse para decidir (evita que el profesional
    // sume los grupos por su cuenta). Se muestra la grilla de lo que si se leyo, sin tarjetas de
    // categoria ni puntaje (serian agregados sobre datos incompletos).
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Hubo un problema técnico al leer parte de esta encuesta; ya quedó reportado y no requiere
          acción tuya. La lectura del patrón está incompleta y no debe usarse para tomar decisiones.
        </div>
        <GrupoGrid grupos={patron.grupos} />
      </div>
    );
  }
  // ok
  return (
    <div className="flex flex-col gap-4">
      <CategoryCards grupos={patron.grupos} />
      <GrupoGrid grupos={patron.grupos} />
    </div>
  );
}

// Read-out de un dominio (D2-D8): pregunta -> respuesta. Reusa SurveyAnswerReadonly en variante "plain"
// (solo lo elegido, en texto), como el read-out del v8: fila con la pregunta a la izquierda y la
// respuesta a la derecha, limpio. La INTERPRETACION del dato (opcion elegida + texto libre de "Otra")
// es la MISMA que la pestana Evaluacion; solo cambia la forma (ahi chips con todas las opciones, aca
// texto). A diferencia de Evaluacion (donde el profesional REVISA y ver las no marcadas ayuda), aqui
// solo LEE lo que el paciente dijo: se muestran SOLO las preguntas respondidas. Sin ninguna (dominio
// ausente o todo sin responder, solo alcanzable en un diagnostico viejo pre-gate): dice "sin
// respuestas", no queda en blanco.
// ═══ D2-D8 EN COLORES (porte del ATLAS_v9, 2026-09-21) ═══
//
// Cada respuesta va dentro de una pastilla del color de su nivel, igual que las de D1. El nivel lo decide
// su clasificador portado (`clinical-engine/encuesta-colores`), no esta pantalla. Y el GRIS no es
// "normal": es que Atlas registra el dato y no emite juicio sobre el (su guia, verbatim en el modulo).
// La pastilla es `PastillaDeColor`, la misma de D1.

/** Las respuestas de TODA la encuesta por `field_key`: la actividad fisica se juzga con dos preguntas. */
function respuestasPorCampo(domains: SurveyDomain[] | null | undefined): Record<string, ValorEncuesta> {
  const out: Record<string, ValorEncuesta> = {};
  for (const d of domains ?? []) {
    for (const q of d.questions) {
      if (!q.fieldKey || q.answerValue == null) continue;
      out[q.fieldKey] = q.questionType === "opcion_multiple" ? leerMultiple(q.answerValue) : q.answerValue;
    }
  }
  return out;
}

function leerMultiple(valor: string): string[] {
  try {
    const v: unknown = JSON.parse(valor);
    return Array.isArray(v) ? v.map(String) : [valor];
  } catch {
    return [valor];
  }
}

function DomainReadout({
  domain,
  encuesta,
}: {
  domain: SurveyDomain | undefined;
  encuesta: Record<string, ValorEncuesta>;
}) {
  const answered = domain?.questions.filter((q) => q.answerValue != null && q.answerValue !== "") ?? [];
  if (!answered.length) {
    return (
      <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
        El paciente no respondió este dominio en esta evaluación.
      </p>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {answered.map((q) => (
        // EN ANGOSTO SE APILAN (Santiago, 2026-09-21): pregunta arriba y respuesta debajo. Lado a lado, una
        // respuesta larga (varias opciones, o "No hago ejercicio · 0 minutos a la semana") empujaba la pregunta
        // hasta dejarla en una columna de dos palabras. En ancho vuelven a ir enfrentadas.
        <div
          key={q.questionId}
          className="flex flex-col gap-1 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        >
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums">{q.number}.</span> {q.questionText}
          </p>
          <div className="sm:max-w-[50%] sm:shrink-0 sm:text-right">
            <PastillaDeColor
              tamano="respuesta"
              color={
                COLOR_DE_NIVEL[
                  q.fieldKey ? nivelDeRespuesta(q.fieldKey, encuesta[q.fieldKey], encuesta) : "informativo"
                ]
              }
            >
              <SurveyAnswerReadonly
                questionType={q.questionType}
                answerValue={q.answerValue}
                options={q.options}
                variant="plain"
                colorHeredado
              />
            </PastillaDeColor>
          </div>
        </div>
      ))}
    </div>
  );
}

// Caracterizacion sociodemografica del ENCUENTRO (versionada por evaluacion, ver DB), que el v8 muestra al
// final de D8. Se lee de las columnas de la evaluacion, no de las respuestas de encuesta.
const CHAR_FIELDS: { key: keyof EvaluationCharacterization; label: string }[] = [
  { key: "ethnicity", label: "Etnia" },
  { key: "ancestry", label: "Ascendencia" },
  { key: "educationLevel", label: "Educación" },
  { key: "socioeconomicStratum", label: "Estrato socioeconómico" },
  { key: "maritalStatus", label: "Estado civil" },
  { key: "occupation", label: "Ocupación" },
];

function CharacterizationBlock({
  characterization,
  profileHasData = false,
}: {
  characterization?: EvaluationCharacterization | null;
  // ¿El perfil del paciente tiene sociodemograficos? Distingue "no respondio" de "eval anterior al registro
  // por evaluacion" cuando las columnas de la evaluacion estan vacias. NO se copian los valores del perfil
  // (serian un historico falso: pudieron cambiar); solo se dice que estan alli.
  profileHasData?: boolean;
}) {
  const rows = characterization ? CHAR_FIELDS.filter((f) => characterization[f.key]) : [];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">Contexto sociodemográfico</p>
      {rows.length ? (
        <div className="flex flex-col divide-y divide-border">
          {rows.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-4 py-2">
              <p className="text-sm text-muted-foreground">{f.label}</p>
              <span className="shrink-0 text-right text-sm font-semibold text-foreground">
                {characterization![f.key]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
          {profileHasData
            ? // El dato existe en el perfil: esta evaluacion es anterior al registro por evaluacion (o no lo
              // guardo por separado). NO afirmar "no se capturo" (se leeria como que el paciente no respondio).
              "Esta evaluación es anterior al registro del contexto por evaluación. Los datos del paciente están en su perfil; no se muestran aquí porque pueden haber cambiado desde esta evaluación."
            : // Perfil tambien vacio: el paciente no lo registro.
              "El paciente no registró su contexto sociodemográfico en esta evaluación."}
        </p>
      )}
    </div>
  );
}

export function SurveyDiagnosisSection({
  patron,
  surveyDomains,
  characterization,
  profileHasCharacterization = false,
}: {
  patron: PatronResolution;
  // Respuestas por dominio (D1-D8) para el read-out de D2-D8. Llegan del reader ya agrupadas y en orden
  // (d1..d8), asi que el indice i corresponde a la seccion i. null en snapshots sin encuesta.
  surveyDomains?: SurveyDomain[] | null;
  // Caracterizacion sociodemografica DE ESTA evaluacion (columnas de la evaluacion), para el bloque de D8.
  characterization?: EvaluationCharacterization | null;
  // ¿El perfil del paciente tiene sociodemograficos? Para el mensaje honesto cuando la evaluacion no los trae.
  profileHasCharacterization?: boolean;
}) {
  const encuesta = respuestasPorCampo(surveyDomains);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Diagnóstico de encuesta</h2>
        <p className="text-sm text-muted-foreground">
          Lectura por dominio de la encuesta (D1-D8). El patrón alimentario (D1) con sus tarjetas de
          categoría; el resto, las respuestas del paciente por dominio.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {SECTIONS.map((title, i) => (
          <DetailsSection key={title} title={title} defaultOpen={i === 0}>
            {i === 0 ? (
              <PatronD1 patron={patron} />
            ) : i === 7 ? (
              // D8 lleva ademas el contexto sociodemografico del encuentro (verbatim del v8: al final de D8).
              <div className="flex flex-col gap-4">
                <DomainReadout domain={surveyDomains?.[i]} encuesta={encuesta} />
                <CharacterizationBlock
                  characterization={characterization}
                  profileHasData={profileHasCharacterization}
                />
              </div>
            ) : (
              <DomainReadout domain={surveyDomains?.[i]} encuesta={encuesta} />
            )}
          </DetailsSection>
        ))}
      </div>
    </section>
  );
}
