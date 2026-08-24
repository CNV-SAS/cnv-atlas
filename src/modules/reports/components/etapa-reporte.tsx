// ETAPA "Reporte / HC" (quinta etapa, 2026-08-24), estado VACIO.
//
// Se muestra cuando la evaluacion todavia no tiene reporte. Desde la pieza 2 el reporte YA vive en esta
// etapa; lo que queda por traer es la historia clinica de la consulta y el cierre.
//
// El texto dice QUE va a vivir aqui, no "en construccion" a secas: un placeholder que solo dice que falta
// algo hace que el profesional abra la pestaña una vez y no vuelva; uno que dice que esperar le permite
// entender la estructura de la consulta antes de que este completa.
//
// Modulo NEUTRO: presentacional puro, lo renderiza la page server.
export function EtapaReporte() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-8">
      <p className="text-sm font-medium text-foreground">Reporte / Historia clínica</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Aquí vive lo que se le entrega al paciente y el cierre de la consulta. Todavía no hay reporte para
        esta evaluación: se genera con el diagnóstico.
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Faltan por llegar la historia clínica de la consulta y el registro de lo que quedó pendiente al
        cerrarla.
      </p>
    </div>
  );
}
