import { TituloPantalla } from "@/components/shared/titulo-pantalla";

// Placeholder de seccion: deja la ruta navegable y con marca mientras su modulo
// no existe. Cada bloque posterior reemplaza la pagina que lo usa.
//
// USA EL MISMO BLOQUE DE TITULO que las pantallas hechas, para que una seccion en construccion no parezca
// ademas una pantalla de otra epoca. El aviso de "en construccion" va DEBAJO del bloque y no dentro: lo que
// esta en obra es el contenido, no la cabecera.
export function SectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      <TituloPantalla titulo={title} descripcion={description} />
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        En construccion
      </p>
    </div>
  );
}
