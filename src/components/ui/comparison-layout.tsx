import { type ReactNode } from "react";

// Primitivo de COMPARACION lado a lado, reusable. Nace en Diagnostico (estado del paciente | estado
// explorado) y esta diseñado para reusarse en SEGUIMIENTO (evaluacion previa | evaluacion actual).
//
// Contrato (care Santiago 2026-08-18):
//  - `primary` esta SIEMPRE presente y en la posicion 1. Nunca se desmonta ni cambia de lugar cuando
//    aparece o desaparece `secondary`: al cerrar la comparacion, el panel principal queda donde estaba.
//  - `secondary` es opcional: cuando hay algo que comparar, aparece AL LADO en pantallas anchas y DEBAJO
//    en angostas (dos paneles al lado no caben en movil; Diagnostico ya es densa). Se apila con `primary`
//    arriba.
//
// Reuso en Seguimiento (pendiente): alli AMBOS paneles se pasan siempre (previa | actual). El reader de
// Seguimiento (comparison-reader) hoy devuelve solo el numero de estado y el riesgo previos, NO las bandas
// ni los dominios del radar de la evaluacion previa; para montar la comparacion VISUAL alli habria que
// extenderlo para exponer `efrPhenotype.bands` y `dfi.domains` de la previa. Ver BACKLOG.
export function ComparisonLayout({
  primary,
  secondary = null,
}: {
  primary: ReactNode;
  secondary?: ReactNode | null;
}) {
  if (!secondary) return <div className="min-w-0">{primary}</div>;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div className="min-w-0">{primary}</div>
      <div className="min-w-0">{secondary}</div>
    </div>
  );
}
