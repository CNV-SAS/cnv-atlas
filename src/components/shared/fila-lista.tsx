import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
// columnas UNA vez y publica las pistas de grid en variables CSS que HEREDAN a todas las filas; la
// cabecera y cada `<li>` las leen de ahi. En ancho, el contenedor de valores pasa a `display: contents`, con
// lo que sus celdas se vuelven items del grid de la fila. `display: contents` no genera caja pero SI
// conserva la herencia, asi que el tamano y el color del texto de los valores siguen aplicando.
//
// SIGUE SIENDO `<ul>`, NO `<table>`, aunque en ancho parezca tabla. Una tabla real no vuelve a dos lineas
// sin romper su semantica, y la fila entera clicable es limpia en una lista e incomoda en un `<tr>`. La
// cabecera de columnas va `aria-hidden`: en ancho orienta la vista, y en lectura no hace falta porque cada
// valor se anuncia detras del nombre del paciente (y el que no se explica solo lleva su rotulo delante).
//
// ═══ LA FILA NO ES UN SOLO DESTINO, Y EL ENLACE ESTIRADO SE RETIRO (2026-09-10) ═══
//
// LO QUE HABIA: el titulo era un `<Link>` con `after:absolute after:inset-0`, un pseudo-elemento que
// cubre la fila entera para que cualquier punto lleve a un sitio. Es un patron bueno cuando la fila TIENE
// un destino, y esta dejo de tenerlo: el nombre ahora despliega, y al panel se va por su boton.
//
// Y ADEMAS COBRABA UN PRECIO QUE NO SE VEIA hasta que Santiago lo reporto: el pseudo que cubre la fila
// pertenece al enlace del titulo, asi que el cursor de mano salia en TODA la fila y el `:hover` se lo
// llevaba siempre el titulo, nunca la celda por la que se estaba pasando. Ningun subrayado de celda podia
// encenderse. Una pieza que se pone encima de las demas les quita el paso del raton, no solo el clic.
//
// LO QUE QUEDA: cada mando es un elemento REAL (boton o enlace), ninguno tapa a otro, y cada celda con
// destino recibe su propio hover. Los mandos siguen llevando `relative z-10` porque el panel desplegado y
// los fondos de la fila se pintan detras.

/**
 * UNA CELDA CON DESTINO PROPIO.
 *
 * ═══ POR QUE ALGUNAS CELDAS LLEVAN A OTRO SITIO QUE LA FILA (Santiago, 2026-09-10) ═══
 *
 * La fila entera lleva a un sitio (en pacientes, al panel) y hay celdas cuyo dato ES otra cosa: el
 * pendiente vive en UNA evaluacion concreta, la ultima evaluacion ES una evaluacion. Mandarlas al panel
 * obliga a dar dos saltos para llegar a lo que la celda ya estaba nombrando.
 *
 * ── Y POR QUE NO TODAS ──────────────────────────────────────────────────────────────────────────────
 *
 * Porque cada destino es una PARADA DE TECLADO mas, y veinte filas multiplican. Las celdas que llevan al
 * MISMO sitio que la fila NO llevan enlace propio: ya son pulsables, porque el enlace del titulo esta
 * estirado sobre la fila entera. Se gana el clic sin pagar la parada.
 */
export type CeldaConDestino = {
  texto: string;
  /** A donde lleva. Con `alPulsar` en su lugar, la celda es un boton (p. ej. desplegar). */
  href?: string;
  alPulsar?: () => void;
  /** Lo que se anuncia, si el texto solo no basta ("3" no dice que hace). */
  etiqueta?: string;
};

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
  /**
   * DESDE QUE ANCHO ESTA COLUMNA TIENE SITIO (Santiago, 2026-09-10: "al cambiar el tamaño de la ventana
   * todo se amontona y se pierde informacion").
   *
   * EL DEFECTO ERA DE FONDO Y NO DE AJUSTE: las pistas de esta lista son anchos FIJOS en rem, y un grid
   * cuyas pistas fijas suman mas que su contenedor NO las encoge, las DESBORDA. Entre 768 px (donde
   * entra la disposicion de columnas) y el ancho que la suma pide, las celdas de la derecha se salian de
   * la tarjeta. No se "amontonaba": se perdia, que es peor, porque nada indica que falte algo.
   *
   * ASI QUE LAS COLUMNAS ENTRAN POR ESCALONES. Sin `desde`, la columna esta desde que hay columnas
   * (768 px) y no se va nunca: es lo que NO puede faltar. Con `desde`, la columna espera a que haya
   * ancho de verdad.
   *
   * Y NADA SE PIERDE AL OCULTARLA: por debajo de 768 px todas las celdas vuelven a la linea concatenada,
   * que las muestra todas. El hueco es solo el tramo intermedio, y ahi la informacion sigue estando a un
   * clic (la fila lleva al panel del paciente, que la tiene entera).
   */
  desde?: "lg" | "xl";
};

/**
 * ANCHO FIJO PARA LA PISTA DE ACCIONES, Y ESTA ERA LA CAUSA DEL DESALINEADO (Santiago, 2026-09-10,
 * captura `corregir-encabezados-tabla-pacientes`).
 *
 * Iba en `auto`, y `auto` se resuelve POR GRID contra el contenido de ESE grid. La cabecera y cada fila
 * son grids SEPARADOS que solo comparten la cadena de pistas, asi que su pista `auto` media cosas
 * distintas: en la cabecera, el ancho del texto "ACCIONES"; en la fila, dos botones de 36 px con su
 * separacion. Veintitantos pixeles de diferencia, que el `1fr` del titulo absorbia, corriendo TODAS las
 * columnas de la fila respecto de sus encabezados.
 *
 * SE VEIA COMO UN PROBLEMA DE LAS COLUMNAS DE LA DERECHA y era del reparto entero. Y no se nota entre
 * filas (todas se desplazan igual), solo contra la cabecera, que es como lo vio Santiago.
 *
 * LA REGLA: ninguna pista de esta lista puede ser `auto`. Dos grids solo quedan alineados si TODAS sus
 * pistas se resuelven igual, y `auto` depende del contenido. 5,5rem son 88 px: dos botones de 36 y su
 * separacion de 8 caben con margen.
 */
const ANCHO_ACCIONES = "5.5rem";

/** Pistas visibles en cada escalon. La del titulo la antepone `ListaFilas`. */
function pistas(
  columnas: readonly ColumnaLista[],
  hasta: "md" | "lg" | "xl",
  conAcciones: boolean,
  anchoTitulo: string,
) {
  const cabe = (c: ColumnaLista) =>
    c.desde == null || c.desde === hasta || (hasta === "xl" && c.desde === "lg");
  return [
    anchoTitulo,
    ...columnas.filter(cabe).map((c) => c.ancho),
    ...(conAcciones ? [ANCHO_ACCIONES] : []),
  ].join(" ");
}

/** Clases de visibilidad de una celda segun su escalon. Ver `desde`. */
function visibilidadCelda(desde: ColumnaLista["desde"], vacia: boolean) {
  if (vacia) {
    // La celda vacia no existe en la linea concatenada (un hueco no dice nada) y si en columnas.
    return desde == null ? "hidden md:block" : desde === "lg" ? "hidden lg:block" : "hidden xl:block";
  }
  // Con dato: visible en la linea concatenada SIEMPRE, y en columnas solo desde su escalon.
  return desde == null ? "" : desde === "lg" ? "md:hidden lg:block" : "md:hidden xl:block";
}

function visibilidadCabecera(desde: ColumnaLista["desde"]) {
  return desde == null ? "" : desde === "lg" ? "hidden lg:block" : "hidden xl:block";
}

export function ListaFilas({
  columnas,
  conAcciones = false,
  anchoTitulo = "minmax(0,1fr)",
  encabezado,
  pie,
  vacia,
  children,
}: {
  /** Las columnas de los VALORES. La del titulo la antepone esta funcion, y ocupa el espacio sobrante. */
  columnas: readonly ColumnaLista[];
  /**
   * Reserva la ultima pista para los controles de fila.
   *
   * ═══ OBLIGATORIO SI ALGUNA FILA PASA `acciones`, Y ESTE FUE EL DEFECTO (Santiago, 2026-09-10) ═══
   *
   * Los botones caian a UNA SEGUNDA FILA debajo del nombre. La causa no era el ancho (se fijo la columna
   * en 6rem y no cambio nada, porque el ancho nunca fue el problema): la lista declaraba "Acciones" como
   * una COLUMNA MAS, con su celda vacia en cada fila, y ademas pintaba el contenedor de botones como
   * hermano. Asi que habia 7 pistas y 8 items de grid, y el octavo (los botones) caia a una fila
   * IMPLICITA, que empieza en la columna 1: justo debajo del nombre.
   *
   * LA REGLA QUE SALE DE AHI: los botones NO son una columna de datos, son la pista reservada. O se
   * declara `conAcciones` y no existe una columna "Acciones", o al reves. Las dos cosas a la vez son
   * siempre un item de mas. Lo fija `fila-lista.test.tsx`.
   */
  conAcciones?: boolean;
  /**
   * PISTA DE LA COLUMNA DEL TITULO. Por defecto se lleva todo el sobrante, que es lo razonable en una
   * lista de dos o tres columnas y deja de serlo en cuanto hay cinco: con `1fr` el nombre se llevaba la
   * mitad de la pantalla y el resto se apretaba (Santiago, 2026-09-10: "el nombre ocupa mucho espacio y
   * el resto muy poco"). Una lista con varias columnas pasa un `fr` acotado y reparte el sobrante con
   * otra columna que sepa usarlo.
   */
  anchoTitulo?: string;
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
  if (conAcciones && columnas.some((c) => c.rotulo === "Acciones")) {
    throw new Error(
      "ListaFilas: `conAcciones` YA reserva la pista de los botones; una columna \"Acciones\" ademas de eso deja un item de grid de mas y los botones caen a una segunda fila.",
    );
  }
  // TRES JUEGOS DE PISTAS, uno por escalon. La hoja global (`globals.css`, regla `.lista-filas`) elige
  // cual vale en cada ancho y lo publica en `--cols`, que es lo que heredan la cabecera y cada fila.
  // Se hace ahi y no con variantes de Tailwind porque el valor lleva espacios: un valor arbitrario que el
  // compilador no parsea NO da error, simplemente no emite la regla, y el fallo seria mudo.
  const vars = {
    "--cols-md": pistas(columnas, "md", conAcciones, anchoTitulo),
    "--cols-lg": pistas(columnas, "lg", conAcciones, anchoTitulo),
    "--cols-xl": pistas(columnas, "xl", conAcciones, anchoTitulo),
  } as CSSProperties;

  return (
    // SUPERFICIE BLANCA sobre el gris de la pagina, no un recuadro con borde sobre blanco. Es lo que
    // faltaba tras invertir la disposicion (hallazgo de Santiago, 2026-08-28): pusimos el fondo gris pero
    // dejamos el contenido suelto encima, asi que la pagina se veia apagada en vez de organizada. El gris
    // no es un fondo: es la CALLE entre bloques, y sin bloques no hay calle, solo penumbra.
    //
    // ESQUINAS CUADRADAS (Santiago, 2026-09-10). Iba en `rounded-2xl overflow-hidden`, y como la franja
    // de cabecera es el PRIMER hijo, el recorte le curvaba las dos esquinas de arriba: la misma franja
    // que en `shared/tabla.tsx` es recta aqui salia redondeada, y las dos se ven en la misma pantalla.
    // Manda la tabla, que es donde vive la regla de las franjas de nivel.
    <div className="lista-filas border border-border bg-card shadow-sm" style={vars}>
      {encabezado ? <div className="border-b border-border p-4">{encabezado}</div> : null}
      {vacia ? (
        vacia
      ) : (
        <>
          <div
            aria-hidden
            // ═══ LA MISMA REGLA QUE LAS FRANJAS DE NIVEL DE WANG (Santiago, 2026-09-10) ═══
            //
            // Esta cabecera iba en `bg-muted`, el gris que se retiro de las tablas de composicion por lo
            // mismo que alli: un relleno gris sobre superficie clara no separa, pesa. Adopta el
            // tratamiento que quedo en `components/shared/tabla.tsx` para los encabezados de grupo: un
            // tinte muy leve del azul de marca con el rotulo en gris de texto.
            //
            // Y ES COHERENTE CON SU PAPEL: esta fila AGRUPA a las de abajo, igual que "Nivel III" agrupa
            // a sus indices. No es un encabezado de columnas suelto sobre datos, es la cabeza de la lista.
            // SOLO EL BORDE DE ABAJO RESALTA (Santiago, 2026-09-10). Llevaba `border-y`, asi que la
            // franja pintaba tambien una linea azul ARRIBA, pegada al borde de la tarjeta: dos lineas de
            // colores distintos a un pixel una de otra, que es lo que se veia raro. Arriba no hace falta
            // ninguna: el borde de la tarjeta ya cierra por ese lado, y asi los tres lados de fuera son
            // el mismo color y el unico que separa es el de abajo, que es lo que la franja tiene que
            // hacer (separar la cabeza de las filas).
            className="hidden border-b border-primary/20 bg-primary/5 px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground md:grid md:items-center md:gap-3"
            style={{ gridTemplateColumns: "var(--cols)" }}
          >
            <span>Paciente</span>
            {columnas.map((c) => (
              <span key={c.rotulo} className={visibilidadCabecera(c.desde)}>
                {c.rotulo}
              </span>
            ))}
            {conAcciones ? <span>Acciones</span> : null}
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
  subtitulo,
  columnas,
  valores,
  chip,
  acciones,
  alDesplegar,
  desplegado = false,
  panel,
}: {
  /**
   * Destino de la fila entera. Opcional desde el 2026-09-10: una fila puede DESPLEGAR en vez de navegar
   * (ver `alDesplegar`).
   */
  href?: string;
  /** Lo que identifica la fila. Es el texto del enlace. */
  titulo: string;
  /**
   * SEGUNDA LINEA BAJO EL NOMBRE (Santiago, 2026-09-10, eligiendo la opcion B del artefacto).
   *
   * QUE GANA: el nombre deja de pesar lo mismo que una fecha. Una lista que se recorre se recorre por el
   * nombre, y hasta aqui el nombre competia de igual a igual con cinco cifras.
   *
   * Y QUE RESUELVE ADEMAS: los datos que bajan aqui (documento, edad) eran DOS COLUMNAS, y esas dos
   * columnas eran ~15rem de pistas fijas. Recuperarlas es lo que le deja sitio a los botones sin
   * desbordar en pantallas medianas.
   *
   * VA EN LETRA PEQUENA a proposito (su cuidado textual): si se pone al tamano del cuerpo, la fila
   * engorda y la lista deja de caber, que es justo lo contrario de lo que se busca.
   */
  subtitulo?: ReactNode;
  /** Las MISMAS columnas que recibio `ListaFilas`, para saber como se pinta cada valor. */
  columnas: readonly ColumnaLista[];
  /**
   * Un valor por columna, en el mismo orden. `null` deja la celda vacia y se omite en estrecho.
   * Una celda puede llevar a SU propio destino: ver `CeldaConDestino`.
   */
  valores: readonly (string | CeldaConDestino | null)[];
  /** Distintivo EXCEPCIONAL, junto al titulo. Se omite en el caso normal (BRAND). */
  chip?: ReactNode;
  /** Controles propios de la fila. Exigen `conAcciones` en `ListaFilas` (ver alli el porque). */
  acciones?: ReactNode;
  /**
   * DESPLEGAR ES UN MANDO PROPIO, no lo que hace la fila (Santiago, 2026-09-10, segunda vuelta).
   *
   * LA PRIMERA VERSION hacia que la fila ENTERA desplegara, y su reporte fue el que la condena: sin cursor
   * ni marca, una fila que despliega no se distingue de una que no hace nada, y eso se descubre pulsando.
   * Ahora la fila lleva a su sitio (que es lo que una fila de lista hace) y desplegar tiene su chevron.
   */
  alDesplegar?: () => void;
  /** Si su panel esta abierto. Gobierna `aria-expanded` y el giro del chevron. */
  desplegado?: boolean;
  /** Lo que se pinta DEBAJO de la fila cuando esta desplegada. */
  panel?: ReactNode;
}) {
  if (href == null && alDesplegar == null) {
    throw new Error("FilaLista: la fila necesita `href` (a donde lleva) o `alDesplegar`.");
  }
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
  const primeroConDato = valores.findIndex((v) => v !== null);

  const CLASES_TITULO =
    "truncate text-left font-medium text-foreground underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  // ═══ EL SUBRAYADO: SE RETIRA EL MECANISMO DEL QUE DEPENDIA (Santiago, 2026-09-10, cuarta vuelta) ═══
  //
  // VAN TRES INTENTOS Y DOS DIAGNOSTICOS MIOS EQUIVOCADOS, asi que este no es un tercero: es quitar de en
  // medio todo lo que podia fallar.
  //
  // LO QUE SI QUEDO VERIFICADO, contra el CSS compilado que se sirve y contra el DOM renderizado:
  //   · las reglas existen (`.hover:underline:hover` y `.group-hover/celda:underline` estan las dos
  //     en el chunk de CSS del build);
  //   · el marcado es el correcto (`group/celda` en la celda, el enlace dentro).
  // O sea que no faltaba ni la clase ni la regla. Lo que no pude verificar es lo unico que quedaba, el
  // HIT-TESTING en un navegador real, porque en este entorno no hay ninguno.
  //
  // ASI QUE SE DEJA DE DEPENDER DE EL. La version anterior necesitaba que se cumplieran TRES cosas a la
  // vez: que la clase de grupo estuviera, que el enlace fuera DESCENDIENTE del grupo, y que el raton
  // alcanzara una caja INLINE dentro de una celda con `overflow:hidden`. Ahora el enlace ES la celda:
  // ocupa su ancho entero (`md:block md:w-full`) y lleva su propio `hover:underline`. Una sola condicion,
  // y de las que no dependen de que haya o no algo encima de una caja pequeña.
  //
  // Y DE PASO ARREGLA LO OTRO: el area pulsable pasa de ser el texto a ser la celda, que es lo que hace
  // falta para que "si responde al paso, tiene que decir que responde" se pueda cumplir de verdad.
  //
  // ── UN AVISO QUE SALIO DE VERIFICAR ESTO, y que conviene tener presente ─────────────────────────────
  //
  // TAILWIND ESCANEA EL TEXTO DEL ARCHIVO, COMENTARIOS INCLUIDOS. Tras retirar `group-hover/celda` del
  // JSX, su regla SEGUIA en el CSS compilado, generada por los comentarios de aqui arriba que la nombran.
  // Es inofensivo (ningun elemento lleva ya `group/celda`), pero tiene una consecuencia que si importa:
  // **"la clase esta en el CSS" no prueba que algun elemento la use**, asi que no sirve como verificacion
  // de que una pieza esta cableada. Al reves si vale: si NO esta, no puede funcionar.
  //
  // Las clases de las que depende esta version se comprobaron una a una contra el CSS del build
  // (`md:block`, `md:w-full`, `md:truncate`, `hover:underline`): un valor que el compilador no parsea no
  // da error, simplemente no emite la regla.
  // ── Y LO QUE CAMBIA EN LA CUARTA VUELTA, con el dato que dio Santiago ───────────────────────────────
  //
  // SU OBSERVACION, que es la que faltaba: en estas celdas el CURSOR SI se activa en toda la celda y el
  // texto NO se subraya; en la del nombre pasa justo al reves (el cursor solo sobre el texto, y el texto
  // se subraya). O sea que el elemento SI esta recibiendo el raton (el cursor lo demuestra: `cursor-pointer`
  // es de ese mismo elemento) y aun asi el subrayado no se pinta.
  //
  // ESO DESCARTA que algo lo cubra, que era mi hipotesis anterior, y deja una sola familia de causas: el
  // subrayado se pinta y no se VE. Aqui habia dos cosas que podian recortarlo, las dos duplicadas sin
  // necesidad:
  //   · `md:truncate` estaba en la celda Y en el enlace. `truncate` trae `overflow:hidden`, asi que el
  //     enlace recortaba su propio contenido sin que nadie se lo pidiera: la celda ya truncaba.
  //   · `underline-offset-4` empuja la linea 4 px hacia abajo. En una caja cuyo alto es exactamente el de
  //     la linea de texto, 4 px la sacan del borde inferior, y `overflow:hidden` se la come. El nombre no
  //     lo sufre porque su caja es mas alta (es un item de flex con dos lineas al lado).
  //
  // SE RETIRAN LOS DOS. No es una hipotesis mas: la duplicacion del truncado sobra por si sola (un
  // concepto, un dueño), y el desplazamiento se alinea con el que usa el resto de Atlas.
  const CLASES_DESTINO =
    "relative z-10 cursor-pointer rounded text-left underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:block md:w-full";

  return (
    <>
      <li
        className="relative flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border/60 px-3 py-2.5 last:border-0 hover:bg-muted/40 focus-within:bg-muted/40 md:grid md:flex-nowrap md:gap-y-0"
        style={{ gridTemplateColumns: "var(--cols)" }}
      >
        {/* ═══ LA CELDA DEL PACIENTE ES UN SOLO MANDO (Santiago, 2026-09-10, tercera vuelta) ═══

            "Mejor que el item de la columna paciente tambien me despliegue el listado de evaluaciones.
            Que solo sea el boton panel del paciente el que me lleva al panel. Lo hago pensando en
            optimizar la fluidez del profesional."

            Y la razon aguanta: lo frecuente es MIRAR las ultimas evaluaciones, y eso se hacia con un
            chevron de 24 px mientras el area grande (el nombre) se iba a otra pantalla. El gesto barato
            servia al caso raro.

            ASI QUE EL CHEVRON Y EL NOMBRE SON EL MISMO BOTON, no dos mandos pegados. Dos controles que
            hacen lo mismo uno al lado del otro son dos paradas de teclado para una accion, y obligan a
            mirar cual es cual. Uno solo, y el chevron queda como lo que siempre fue: el dibujo que avisa
            de que esto se abre. */}
        <div className="flex w-full min-w-0 items-center md:w-auto">
          {alDesplegar ? (
            <button
              type="button"
              onClick={alDesplegar}
              aria-expanded={desplegado}
              className="group/paciente -ml-1 flex min-w-0 cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight
                aria-hidden
                className={`size-4 shrink-0 text-muted-foreground transition-transform ${desplegado ? "rotate-90" : ""}`}
              />
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  {/* EL TITULO SI TRUNCA: es el ancla visual de la fila. Los valores no (ver abajo). */}
                  <span className={`${CLASES_TITULO} group-hover/paciente:underline`}>{titulo}</span>
                  {chip}
                </span>
                {subtitulo ? (
                  <span className="truncate text-xs text-muted-foreground">{subtitulo}</span>
                ) : null}
              </span>
            </button>
          ) : (
            <div className="flex min-w-0 flex-col">
              <div className="flex min-w-0 items-center gap-2">
                {href != null ? (
                  <Link href={href} className={`${CLASES_TITULO} hover:underline`}>
                    {titulo}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-foreground">{titulo}</span>
                )}
                {chip}
              </div>
              {subtitulo ? (
                <span className="truncate text-xs text-muted-foreground">{subtitulo}</span>
              ) : null}
            </div>
          )}
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
                visibilidadCelda(columnas[i].desde, v === null),
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
              {typeof v === "object" && v !== null ? (
                // RELATIVE Z-10: la celda con destino propio tiene que quedar POR ENCIMA del enlace estirado
                // del titulo, que cubre la fila entera. Sin esto se pulsaria el de abajo y el destino propio
                // no serviria de nada.
                v.href != null ? (
                  <Link href={v.href} aria-label={v.etiqueta} className={CLASES_DESTINO}>
                    {v.texto}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={v.alPulsar}
                    aria-label={v.etiqueta}
                    className={`${CLASES_DESTINO} cursor-pointer`}
                  >
                    {v.texto}
                  </button>
                )
              ) : (
                v
              )}
            </span>
          ))}
        </div>

        {acciones ? <div className="relative z-10 flex shrink-0 gap-2">{acciones}</div> : null}
      </li>
      {/* EL PANEL VA FUERA DEL <li> DE LA FILA, como hermano: dentro seria una celda mas del grid de
          columnas y ademas quedaria bajo el area pulsable estirada, asi que sus enlaces no se podrian
          pulsar. */}
      {desplegado && panel ? (
        <li className="border-b border-border/60 bg-muted/30 px-3 py-2 last:border-0">{panel}</li>
      ) : null}
    </>
  );
}
