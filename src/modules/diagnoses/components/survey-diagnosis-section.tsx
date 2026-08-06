import type { PatronGrupoView, PatronResolution } from "@/clinical-engine";

import { DetailsSection } from "./details-section";

// Diagnostico de encuesta (D1-D8). D1 (Patron alimentario, C9) porta la pantalla del v8: tarjetas de
// categoria + grilla de los 15 grupos. D2-D8 siguen placeholder hasta que Gildardo entregue su analisis
// (logica de render NO autoritativa aun; ver docs/FROZEN_EXPORTS_REQUEST.md).
//
// DIVERGENCIA DE CONTENEDOR (deliberada, ver DIVERGENCIAS.md): el v8 navega D1-D8 con sub-pestanas; aca
// se mantienen COLAPSABLES (decision de UI previa, no se rehace la navegacion). La organizacion INTERNA
// del patron es fiel al v8.
//
// NO se muestra el puntaje ni el nivel: el v8 no los muestra, y ademas hoy el score alimenta el indice
// contextual, que esta APAGADO (C1). Cuando C1 se active y el score empiece a mover la edad bioelectrica,
// se revisa con Gildardo si debe verse. Ver DIVERGENCIAS.md.

// Titulos VERBATIM del HTML (separador "·", no em-dash).
const SECTIONS = [
  "D1 · Patrón Usual de Consumo",
  "D2 · Percepción Corporal",
  "D3 · Hábitos",
  "D4 · Conductas Alimentarias",
  "D5 · Epigenético / LE8",
  "D6 · Alergias y Salud Digestiva",
  "D7 · Hidratación",
  "D8 · Contexto Social",
];

// Etiquetas ABREVIADAS de frecuencia para la pildora (verbatim del v8 L13728; NO el texto de encuesta).
const FREQ_LABELS = ["Nunca", "1–2d/sem", "3–4d/sem", "5–6d/sem", "Todos"];

// Tarjetas de categoria PORTADAS VERBATIM del v8 (L13829-13831), INCLUIDA la inconsistencia: "Moderados"
// promedia [8,9,10] y NO incluye el grupo 15 (carnes rojas), que SI aparece en la grilla. Se porta tal
// cual (su codigo especifica; la discrepancia se registra, no se resuelve en silencio). Pregunta abierta
// a Gildardo en GILDARDO_QUERIES.md.
const CAT_CARDS = [
  { cat: "protector", label: "✅ Protectores", color: "#059669", grupos: [1, 2, 3, 4, 5, 6, 7] },
  { cat: "neutro", label: "⚖️ Moderados", color: "#1d4ed8", grupos: [8, 9, 10] },
  { cat: "riesgo", label: "⚠️ De riesgo", color: "#dc2626", grupos: [11, 12, 13, 14] },
] as const;

// Estado de una tarjeta de categoria a partir del promedio de sus grupos (v8 L13836-13837, verbatim).
function catEstado(avg: number | null, isRiesgo: boolean): { label: string; color: string } {
  if (avg === null) return { label: "Sin datos", color: "#94a3b8" };
  const label = isRiesgo
    ? avg <= 1 ? "Adecuado" : avg <= 2 ? "Moderado" : "Elevado"
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
        const est = catEstado(avg, c.cat === "riesgo");
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

// Grilla de los 15 grupos con su frecuencia (v8 L13847-13859, verbatim en logica de color).
function GrupoGrid({ grupos }: { grupos: PatronGrupoView[] }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {grupos.map((g) => {
        const isR = g.cat === "riesgo";
        const v = g.ordinal;
        const ok = v !== null && (isR ? v <= 1 : v >= 3);
        const al = v !== null && (isR ? v >= 3 : v <= 1);
        const col = v === null ? "#94a3b8" : ok ? "#059669" : al ? "#dc2626" : "#d97706";
        return (
          <div key={g.n} className="flex items-center justify-between rounded-lg border px-2 py-1" style={{ borderColor: col + "22", background: col + "0d" }}>
            <span className="text-xs text-foreground">{g.label}</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: col, background: col + "1f" }}>
              {v !== null ? FREQ_LABELS[v] : "—"}
            </span>
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

export function SurveyDiagnosisSection({ patron }: { patron: PatronResolution }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Diagnóstico de encuesta</h2>
        <p className="text-sm text-muted-foreground">
          Análisis por dominio de la encuesta (D1-D8). El patrón alimentario (D1) ya está; el resto se
          habilita cuando Gildardo entregue su análisis.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {SECTIONS.map((title, i) => (
          <DetailsSection key={title} title={title} defaultOpen={i === 0}>
            {i === 0 ? (
              <PatronD1 patron={patron} />
            ) : (
              <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
                Disponible próximamente.
              </p>
            )}
          </DetailsSection>
        ))}
      </div>
    </section>
  );
}
