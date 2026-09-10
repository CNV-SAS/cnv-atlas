// DECORACION DE TABLA, en un solo sitio. Son CLASES, no componentes, y eso es deliberado.
//
// POR QUE CLASES Y NO UN <Tabla>. Las tablas de Atlas no se parecen en estructura: la de intercambio
// agrupa por grupo con filas de encabezado intercaladas y una celda plegable al final; la de evaluaciones
// del paciente es plana; las de operacion llevan acciones por fila. Un componente que abarcara las tres
// terminaria con una prop por diferencia, que es como se llega a un componente que nadie entiende. Lo que
// SI comparten es el aspecto, y eso es lo que se unifica aqui: cada tabla conserva su estructura y adopta
// la decoracion cambiando clases. El riesgo de aplicarlo es cero.
//
// ── DE DONDE SALE (referencia aprobada por Santiago, 2026-09-03) ────────────────────────────────────
//
// Encabezado con fondo mas claro, rotulos con mas peso, negrita SELECTIVA en la columna que importa, y
// chips de color donde digan algo. Y lo que la referencia NO hace, que es la mitad del efecto:
//
//   · CERO rayas cebra. La cebra existia para seguir la fila en tablas sin bordes; con filas altas y una
//     linea fina basta, y el rayado le mete ruido a una tabla de cifras.
//   · CERO bordes verticales. Las columnas se separan por alineacion y espacio, no por lineas.
//   · Numericas a la DERECHA y con `tabular-nums`, siempre. Es lo que deja comparar de un vistazo entre
//     filas, que es para lo que existe una tabla (BRAND: "si compara, columnas").
//
// ── LA NEGRITA SELECTIVA ES INFORMACION, NO ENFASIS ─────────────────────────────────────────────────
//
// `tdFuerte` va en la columna que el profesional viene a leer, UNA por tabla. Si se pone en tres, deja de
// distinguir y la tabla vuelve a ser plana. Cual es esa columna lo decide cada pantalla.

/** La tabla. `border-collapse` para que las lineas finas no se dupliquen entre celdas. */
export const tabla = "w-full border-collapse text-sm";

// ═══ DOS ENCABEZADOS, DOS TRATAMIENTOS (Santiago, 2026-09-10) ═══
//
// EL DEFECTO QUE LO TRAJO: en la tabla de composicion, la cabecera de columnas iba en gris y la franja de
// nivel en azul, una pegada a la otra. Textual suyo: "chocan en diseño". Y el arreglo no era armonizar los
// dos colores, era que no hubiera DOS RELLENOS seguidos.
//
// LA REGLA QUE SALE DE AHI, y vale para toda tabla de Atlas:
//
//   · SI EL ENCABEZADO LLEVA NOMBRES DE COLUMNA (Variable, Valor, Referencia...) va SIN FONDO y en
//     NEGRITA. No necesita superficie: lo que lo distingue del dato es que nombra, y la negrita basta.
//   · SI DEBAJO VA OTRO ENCABEZADO que agrupa filas (los niveles de Wang, los grupos de la lista de
//     intercambio), ESE lleva la superficie: un tinte muy leve del azul de marca.
//   · Y SI LA TABLA NO TIENE NOMBRES DE COLUMNA y arranca directamente en un rotulo de grupo, ese rotulo
//     usa el tratamiento de grupo, que es el que sale del segundo punto.
//
// El azul es capa de INTERFAZ y no insinua severidad: la reserva del verde/ambar/rojo para los veredictos
// clinicos (BRAND.md) queda intacta.

/** La fila del encabezado de columnas: sin fondo, solo su linea debajo. */
export const theadTr = "border-b border-border text-left";

/** Celda de encabezado de columna. En NEGRITA y un punto mas grande: es lo que la separa del dato. */
export const th = "px-3 py-2 text-[0.8125rem] font-bold uppercase tracking-wide text-muted-foreground";

/** Encabezado de una columna numerica: mismo estilo, alineado con su columna. */
export const thNum = `${th} text-right`;

/** Fila de cuerpo. La linea va DEBAJO y la ultima no la lleva: una tabla no se cierra con un borde suelto. */
export const tr = "border-b border-border/60 last:border-0";

export const td = "px-3 py-2.5 align-top text-foreground";
export const tdNum = `${td} text-right tabular-nums`;

/** La columna que el profesional viene a leer. UNA por tabla (ver arriba). */
export const tdFuerte = `${td} font-semibold`;
export const tdFuerteNum = `${tdNum} font-semibold`;

/** Dato secundario dentro del cuerpo: se ve, pero no compite con la columna que importa. */
export const tdApagado = `${td} text-muted-foreground`;
export const tdApagadoNum = `${tdNum} text-muted-foreground`;

/**
 * Fila de agrupacion (un grupo que encabeza a sus filas). Ni encabezado ni dato: separa.
 *
 * ES LA QUE LLEVA SUPERFICIE, y por eso la cabecera de columnas no la lleva. Un tinte muy leve del azul de
 * marca: se ve que empieza otra cosa sin que la fila compita con los veredictos de la ultima columna, que
 * es lo unico que en una tabla clinica debe reclamar la mirada.
 */
export const trGrupo = "border-y border-primary/20 bg-primary/5";
export const tdGrupo =
  "px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
