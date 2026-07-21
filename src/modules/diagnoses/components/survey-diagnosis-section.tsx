import { DetailsSection } from "./details-section";

// Diagnostico de encuesta (D1-D8): estructura fiel al HTML (ATLAS_v7.html, titulos de las secciones
// D1..D8 ~L965..L1600) como colapsables (D1 abierta, D2-D8 cerradas). Cada seccion queda como
// placeholder "Disponible proximamente" hasta que Gildardo entregue el analisis de la encuesta
// (patron alimentario, percepcion, etc.), que es logica de render NO autoritativa del prototipo
// (ver docs/FROZEN_EXPORTS_REQUEST.md). La estructura queda lista para solo llenar el contenido
// despues, sin reimplementar esa logica.

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

export function SurveyDiagnosisSection() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Diagnóstico de encuesta</h2>
        <p className="text-sm text-muted-foreground">
          Análisis por dominio de la encuesta (D1-D8). El contenido se habilita cuando Gildardo
          entregue el modelo de la encuesta.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {SECTIONS.map((title, i) => (
          <DetailsSection key={title} title={title} defaultOpen={i === 0}>
            <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
              Disponible próximamente.
            </p>
          </DetailsSection>
        ))}
      </div>
    </section>
  );
}
