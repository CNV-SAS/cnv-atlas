import type { ReactNode } from "react";

import { TituloSeccion } from "./titulo-pantalla";

// PANEL: una seccion de pantalla sobre superficie blanca, para el contenido que NO es clinico.
//
// POR QUE HACE FALTA, y por que no vale `bloque.tsx`. Al invertir la disposicion (contenido sobre gris) el
// contenido suelto dejo de leerse: el gris solo funciona como CALLE entre bloques, y sin bloques es
// penumbra. `bloque.tsx` ya resuelve eso, pero reparte decision/derivado/registro, que son categorias de
// contenido CLINICO; un historial de movimientos de inventario o los datos tributarios no son ninguna de
// las tres, y forzarlos ahi obligaria a estirar los nombres, que es el error que su propia documentacion
// avisa.
//
// Asi que la division es: `bloque` para lo clinico (donde el NIVEL dice que es), `Panel` para el resto
// (donde solo hace falta una superficie). Las dos se ven igual por fuera a proposito: el profesional no
// tiene que aprender dos vocabularios visuales, la diferencia es de quien decide el estilo.
export function Panel({
  titulo,
  acciones,
  children,
  className,
}: {
  /** Titulo de la seccion. Si se omite, el panel es solo superficie. */
  titulo?: string;
  /** Acciones de la seccion, a la derecha del titulo. */
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {titulo ? <TituloSeccion acciones={acciones}>{titulo}</TituloSeccion> : null}
      {children}
    </section>
  );
}
