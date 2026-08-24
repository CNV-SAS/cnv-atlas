// Encabezado numerado de las tres secciones de la subpestaña de Rutas (porte del v8, cotejo 2026-08-24).
// Su archivo las rotula "SECCION 1 - RUTAS DE ATENCION ACTIVADAS" y separa con una linea; se lee mejor
// que una pila de bloques sin titulo. Se porta la numeracion y el separador, no el guion largo (regla de
// estilo del proyecto: nunca em-dash en texto nuestro).
//
// Modulo NEUTRO: presentacional puro, lo renderiza la page server.

export function SeccionRuta({ n, titulo }: { n: number; titulo: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border pb-2">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sección {n}</span>
      <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
    </div>
  );
}
