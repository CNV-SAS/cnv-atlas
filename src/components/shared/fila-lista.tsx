import Link from "next/link";
import type { ReactNode } from "react";

// FILA DE LISTA de dos lineas: el patron de Atlas para las listas que se BUSCAN (ver BRAND.md, "si
// busca, densidad; si compara, columnas"). Portado del formato de la lista de pacientes de Gildardo.
//
// POR QUE DOS LINEAS Y NO UNA TABLA. La linea de metadatos concatenada mete cuatro datos en el ancho de
// uno, asi que cabe en un telefono SIN desplazamiento lateral. Una tabla con las mismas columnas obliga
// a `min-w-[640px]` y a desplazar. Con listas que se barren buscando, el ancho es el recurso escaso.
//
// SUBE A COMPARTIDO desde el primer uso a proposito: el formato de fila de lista PARECE decision de
// pantalla y no lo es (BRAND, "que se cierra por pantalla y que es global"). Si cada lista inventa su
// fila, divergen, que es lo que paso con los bloques antes de `bloque.tsx`.
//
// ACCESIBILIDAD DE LA FILA CLICABLE. No es un `div` con onClick: es un `<Link>` REAL sobre el titulo,
// estirado a toda la fila con `after:absolute after:inset-0`. Asi la fila entera es el area de clic,
// pero en el orden de tabulacion hay UN solo enlace, el lector de pantalla anuncia el nombre del
// paciente como texto del enlace, y funciona con teclado sin handlers propios. Cualquier control
// adicional dentro de la fila tiene que ir con `relative z-10` para quedar POR ENCIMA del estirado.

export function FilaLista({
  href,
  titulo,
  meta,
  chip,
  acciones,
}: {
  /** Destino de la fila entera. */
  href: string;
  /** Primera linea: lo que identifica la fila. Es el texto del enlace. */
  titulo: string;
  /**
   * Segunda linea: los datos secundarios, YA concatenados por quien llama (con " · ").
   * Se pasa armada y no como lista para que cada pantalla decida que va y en que orden.
   */
  meta: string;
  /** Distintivo EXCEPCIONAL, a la derecha del titulo. Se omite en el caso normal (BRAND). */
  chip?: ReactNode;
  /** Controles propios de la fila. Van con `relative z-10` para quedar sobre el enlace estirado. */
  acciones?: ReactNode;
}) {
  return (
    <li className="relative flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-0 hover:bg-muted/40 focus-within:bg-muted/40">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <Link
            href={href}
            className="truncate font-medium text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {titulo}
          </Link>
          {chip}
        </div>
        {/* `truncate`: la fila NUNCA crece de alto. En una lista que se barre, una fila que se parte en
            dos rompe el ritmo vertical, que es lo que permite recorrerla con la vista. */}
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
      </div>
      {acciones ? <div className="relative z-10 flex shrink-0 gap-2">{acciones}</div> : null}
    </li>
  );
}
