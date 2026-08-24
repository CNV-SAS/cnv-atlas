// ETAPA "Reporte / HC" (quinta etapa, 2026-08-24). Pieza 1: la etapa existe, con su acceso y su
// navegacion. Su contenido llega en las piezas siguientes y NO se adelanta aqui: mover el reporte reabre
// una decision anterior (se quedo en Tratamiento porque no habia pestaña destino) y va con su propio diff.
//
// El texto dice QUE va a vivir aqui, no "en construccion" a secas. Un placeholder que solo dice que falta
// algo hace que el profesional abra la pestaña una vez y no vuelva; uno que dice que esperar le permite
// entender la estructura de la consulta antes de que este completa.
//
// Modulo NEUTRO: presentacional puro, lo renderiza la page server.
export function EtapaReporte() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-8">
      <p className="text-sm font-medium text-foreground">Reporte / Historia clínica</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Aquí va a vivir lo que se le entrega al paciente y el cierre de la consulta: el reporte con su
        aprobación y envío, la historia clínica de la consulta, y el registro de lo que quedó pendiente al
        cerrarla.
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Por ahora el reporte sigue en la pestaña de Tratamiento; se mueve aquí en el siguiente paso.
      </p>
    </div>
  );
}
