import { DetailsSection } from "./details-section";

// Diagnostico de encuesta (D1-D8, patron alimentario: Protectores / Moderados / De riesgo). Es
// contenido de otra naturaleza, mas denso, que se consulta pero no compite con el nucleo del
// diagnostico: por eso vive detras de un clic (colapsable, cerrado por defecto).
//
// ORIGEN VERIFICADO: el patron alimentario NO esta en el paquete clinico congelado ni se deriva
// fielmente de las respuestas crudas; se computa con logica de la capa de render del prototipo
// (categorizacion de alimentos + scoring por grupos). No se reimplementa esa logica (no es
// ciencia congelada). Queda como placeholder hasta que Gildardo la entregue (ver
// docs/FROZEN_EXPORTS_REQUEST.md). Cuando llegue, esta seccion la renderiza.
export function SurveyDiagnosisSection() {
  return (
    <DetailsSection title="Diagnostico de encuesta">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-foreground">
          Analisis del patron alimentario de la encuesta (D1-D8): alimentos protectores,
          moderados y de riesgo.
        </p>
        <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
          Disponible proximamente.
        </p>
      </div>
    </DetailsSection>
  );
}
