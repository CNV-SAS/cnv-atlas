import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

// LISTA DE FILAS de Atlas: el patron para las listas que se BUSCAN (BRAND.md, "si busca, densidad; si
// compara, columnas"). Portado del formato de la lista de pacientes de Gildardo.
//
// UN SOLO DOM, UN SOLO CONTENIDO, DOS DISPOSICIONES. En estrecho, la fila de dos lineas: titulo arriba y
// los datos secundarios concatenados con un punto medio debajo, que mete cuatro datos en el ancho de uno y
// cabe en un telefono SIN desplazamiento lateral. En ancho, las mismas celdas repartidas en columnas,
// porque la fila de dos lineas en 1900 pixeles deja media pantalla vacia y se lee como lista de correo.
//
// POR QUE ASI Y NO DE LAS OTRAS DOS FORMAS POSIBLES. Renderizar las dos disposiciones y ocultar una con CSS
// DUPLICA el contenido en el DOM, y un lector de pantalla anuncia cada fila dos veces. Elegir la
// disposicion en JavaScript segun el ancho rompe la hidratacion (el servidor no sabe el ancho) y la primera
// pintura sale con la disposicion equivocada. Un solo DOM repartido por CSS no tiene ninguno de los dos.
//
// Y LA DISTINCION QUE LO HACE SEGURO: lo que descartamos en la matriz de frecuencia eran DOS CONTENIDOS
// distintos segun el ancho (ahi si se puede enviar una cosa y mostrar otra). Esto es UN contenido repartido.
// Lo fija `fila-lista.test.tsx`: cada campo aparece exactamente una vez en la fila.
//
// COMO SE REPARTE, sin contexto de React (asi esto sigue siendo server-safe). `ListaFilas` declara las
// columnas UNA vez y publica la pista de grid en la variable CSS `--cols`, que HEREDA a todas las filas; la
// cabecera y cada `<li>` la leen de ahi. En ancho, el contenedor de valores pasa a `display: contents`, con
// lo que sus celdas se vuelven items del grid de la fila. `display: contents` no genera caja pero SI
// conserva la herencia, asi que el tamano y el color del texto de los valores siguen aplicando.
//
// SIGUE SIENDO `<ul>`, NO `<table>`, aunque en ancho parezca tabla. Una tabla real no vuelve a dos lineas
// sin romper su semantica, y la fila entera clicable es limpia en una lista e incomoda en un `<tr>`. La
// cabecera de columnas va `aria-hidden`: en ancho orienta la vista, y en lectura no hace falta porque cada
// valor se anuncia detras del nombre del paciente (y el que no se explica solo lleva su rotulo delante).
//
// ACCESIBILIDAD DE LA FILA CLICABLE. No es un `div` con onClick: es un `<Link>` REAL sobre el titulo,
// estirado a toda la fila con `after:absolute after:inset-0`. Asi la fila entera es el area de clic, en el
// orden de tabulacion hay UN solo enlace, el lector anuncia el nombre como texto del enlace, y funciona con
// teclado sin handlers propios. Cualquier control dentro de la fila va con `relative z-10` para quedar POR
// ENCIMA del estirado.

export type ColumnaLista = {
  /** Cabecera de la columna en la disposicion de columnas. */
  rotulo: string;
  /** Pista de grid para esta columna: "7rem", "minmax(0,1fr)". */
  ancho: string;
  /** Digitos que deben alinear entre filas (fechas, conteos, edades). */
  numerico?: boolean;
  /**
   * En estrecho no hay cabecera. Si el valor no se explica solo ("12 ago"), antepone el rotulo; si ya
   * carga su unidad ("3 evaluaciones", "45 anos", "CC 1.020..."), no hace falta y solo gastaria ancho.
   */
  rotularEnEstrecho?: boolean;
};

export function ListaFilas({
  columnas,
  conAcciones = false,
  encabezado,
  pie,
  vacia,
  children,
}: {
  /** Las columnas de los VALORES. La del titulo la antepone esta funcion, y ocupa el espacio sobrante. */
  columnas: readonly ColumnaLista[];
  /** Reserva la ultima pista para los controles de fila. */
  conAcciones?: boolean;
  /**
   * Controles de la lista (un buscador, filtros), DENTRO de la misma tarjeta. Van juntos a proposito: el
   * buscador y la lista son UNA cosa (un roster que se busca) y separarlos en dos bloques blancos
   * partiria en dos lo que se usa como un solo gesto, escribir y mirar el resultado.
   */
  encabezado?: ReactNode;
  /** Pie de la tarjeta: el conteo, la paginacion. */
  pie?: ReactNode;
  /** Que mostrar cuando no hay filas. Va DENTRO de la tarjeta, con el encabezado todavia visible. */
  vacia?: ReactNode;
  children: ReactNode;
}) {
  const pistas = [
    "minmax(0,1fr)",
    ...columnas.map((c) => c.ancho),
    ...(conAcciones ? ["auto"] : []),
  ];
  // `--cols` hereda a la cabecera y a cada fila: una sola definicion de las columnas para toda la lista.
  const vars = { "--cols": pistas.join(" ") } as CSSProperties;

  return (
    // SUPERFICIE BLANCA sobre el gris de la pagina, no un recuadro con borde sobre blanco. Es lo que
    // faltaba tras invertir la disposicion (hallazgo de Santiago, 2026-08-28): pusimos el fondo gris pero
    // dejamos el contenido suelto encima, asi que la pagina se veia apagada en vez de organizada. El gris
    // no es un fondo: es la CALLE entre bloques, y sin bloques no hay calle, solo penumbra.
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" style={vars}>
      {encabezado ? <div className="border-b border-border p-4">{encabezado}</div> : null}
      {vacia ? (
        vacia
      ) : (
        <>
          <div
            aria-hidden
            className="hidden border-b border-border bg-muted px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:items-center md:gap-3"
            style={{ gridTemplateColumns: "var(--cols)" }}
          >
            <span>Paciente</span>
            {columnas.map((c) => (
              <span key={c.rotulo}>{c.rotulo}</span>
            ))}
            {conAcciones ? <span /> : null}
          </div>
          <ul className="flex flex-col">{children}</ul>
        </>
      )}
      {pie ? (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{pie}</div>
      ) : null}
    </div>
  );
}

export function FilaLista({
  href,
  titulo,
  columnas,
  valores,
  chip,
  acciones,
}: {
  /** Destino de la fila entera. */
  href: string;
  /** Lo que identifica la fila. Es el texto del enlace. */
  titulo: string;
  /** Las MISMAS columnas que recibio `ListaFilas`, para saber como se pinta cada valor. */
  columnas: readonly ColumnaLista[];
  /** Un valor por columna, en el mismo orden. `null` deja la celda vacia y se omite en estrecho. */
  valores: readonly (string | null)[];
  /** Distintivo EXCEPCIONAL, junto al titulo. Se omite en el caso normal (BRAND). */
  chip?: ReactNode;
  /** Controles propios de la fila. Van con `relative z-10` para quedar sobre el enlace estirado. */
  acciones?: ReactNode;
}) {
  // Un valor por columna: si esto se desalinea, las celdas quedan bajo la cabecera equivocada y NO se nota
  // (los valores se leen igual, solo que rotulados mal). Por eso falla ruidoso en vez de degradar.
  if (valores.length !== columnas.length) {
    throw new Error(
      `FilaLista: ${valores.length} valores para ${columnas.length} columnas; deben ir alineados por indice.`,
    );
  }
  // UN VALOR AUSENTE OCUPA SU CELDA EN COLUMNAS, aunque se omita en la linea concatenada. Es un DEFECTO
  // CORREGIDO (visto en la captura de Santiago del 2026-08-28): la primera version filtraba los nulos
  // antes de pintar, asi que en la disposicion de columnas los valores siguientes SE CORRIAN una celda a
  // la izquierda. Un paciente sin ultima consulta mostraba su numero de evaluaciones bajo "Última" y su
  // edad bajo "Evaluaciones". No era un fallo visible: los valores se leen bien, solo que rotulados mal,
  // que es exactamente el modo de fallo que el `throw` de arriba intenta evitar.
  //
  // Asi que la celda SIEMPRE se pinta y se oculta solo en estrecho (`hidden md:block`), donde no hay
  // cabecera que rotule y una celda vacia no dice nada.
  const primeroConDato = valores.findIndex((v) => v !== null);

  return (
    <li
      className="relative flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border/60 px-3 py-2.5 last:border-0 hover:bg-muted/40 focus-within:bg-muted/40 md:grid md:flex-nowrap md:gap-y-0"
      style={{ gridTemplateColumns: "var(--cols)" }}
    >
      <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">
        {/* EL TITULO SI TRUNCA: es el ancla visual de la fila. Los valores no (ver abajo). */}
        <Link
          href={href}
          className="truncate font-medium text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {titulo}
        </Link>
        {chip}
      </div>

      {/* EN ANCHO ESTE CONTENEDOR DESAPARECE (`md:contents`) y sus celdas pasan a ser items del grid de la
          fila. En estrecho es la segunda linea: los valores concatenados, que ENVUELVEN. Lo corregimos asi
          tras el smoke del 2026-08-28: con truncado, en un telefono la linea se cortaba en "Ultima..." y se
          perdia la fecha de ultima consulta, el dato MAS util para barrer la lista. El ritmo vertical
          uniforme ayuda a recorrer, pero vale MENOS que el dato: una fila desigual se lee, un dato ausente
          no esta. Se omite lo que no hay en vez de escribir "-": un guion ocupa lo mismo y no dice nada. */}
      <div className="flex w-full flex-wrap items-center gap-x-2 text-xs text-muted-foreground md:contents">
        {valores.map((v, i) => (
          <span
            key={columnas[i].rotulo}
            className={[
              // La celda vacia existe en columnas (para no correr las de al lado) y desaparece en la
              // linea concatenada (donde un hueco no dice nada).
              v === null ? "hidden md:block" : "",
              columnas[i].numerico ? "tabular-nums" : "",
              "md:truncate",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {/* EL SEPARADOR ES UN NODO, no un `before:content-[...]` de Tailwind: un valor arbitrario que el
                compilador no reconozca no da error, simplemente no emite la regla, y el separador
                desapareceria EN SILENCIO en la disposicion de dos lineas. Va DENTRO de la celda para no
                volverse un item mas del grid en ancho, y `aria-hidden` porque no se lee. */}
            {/* El separador se cuenta contra el primer valor CON DATO, no contra el indice: si la primera
                columna viene vacia, la linea concatenada abriria con un separador huerfano. */}
            {v !== null && i > primeroConDato ? (
              <span aria-hidden className="mr-2 text-border md:hidden">
                ·
              </span>
            ) : null}
            {/* El rotulo solo en estrecho: en ancho lo da la cabecera, y repetirlo seria decir lo mismo dos
                veces en la misma pantalla. No es contenido duplicado: aparece en UNA de las dos. */}
            {v !== null && columnas[i].rotularEnEstrecho ? (
              <span className="md:hidden">{columnas[i].rotulo}: </span>
            ) : null}
            {v}
          </span>
        ))}
      </div>

      {acciones ? <div className="relative z-10 flex shrink-0 gap-2">{acciones}</div> : null}
    </li>
  );
}
