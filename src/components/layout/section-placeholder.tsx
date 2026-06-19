// Placeholder de seccion: deja la ruta navegable y con marca mientras su modulo
// no existe. Cada bloque posterior reemplaza la pagina que lo usa.
export function SectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
      <p className="max-w-prose text-muted-foreground">{description}</p>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        En construccion
      </p>
    </div>
  );
}
