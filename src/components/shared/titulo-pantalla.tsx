import type { ReactNode } from "react";

// CABECERA DE PANTALLA. Un componente y no una convencion escrita, porque la convencion escrita ya fallo:
// las 28 pantallas copiaban el mismo bloque a mano y ya habian divergido en tamaño, peso y separacion.
//
// TRES COSAS QUE RESUELVE, y ninguna es cosmetica:
//
// 1. LA ESCALA. `text-3xl font-extrabold` (30px/800) es de pagina de marketing. En una herramienta de
//    trabajo grita y, sobre todo, roba altura: esos pixeles son tabla que no se ve. Baja a `text-titulo`
//    (24px/700), que sigue mandando en la pantalla sin competir con el contenido.
//
// 2. EL ANCHO DE LECTURA, que es lo que este componente existe para arreglar. Al subir el techo de la
//    pagina a 1600px, una descripcion suelta pasa a ocupar 1600px de linea y el ojo pierde el renglon al
//    volver. La descripcion se acota AQUI, con `max-w-2xl`, porque el ancho de lectura es propiedad del
//    TEXTO y no de la pagina: acotar la pagina entera para proteger un parrafo estropea las tablas.
//
// 3. EL SITIO DE LAS ACCIONES. Van a la derecha del titulo, y `flex-wrap` para que en un telefono caigan
//    debajo en vez de aplastar el titulo.
//
// ── SIN SUPERFICIE (2026-09-03), Y ESTO REEMPLAZA A LA BANDA OSCURA ──────────────────────────────────
//
// Hasta hoy la cabecera era una banda en ink con degradado. Se retira y el titulo pasa a ir DIRECTO sobre
// el gris de la pagina, con tres piezas: un ANTETITULO corto en el azul de marca, el titulo, y la
// descripcion. No hay dos cabeceras conviviendo: se cambia este componente, asi que las 28 pantallas
// cambian con el y ninguna se queda con la vieja.
//
// POR QUE. La banda oscura resolvia "dar presencia", pero lo hacia gastando una superficie ELEVADA en algo
// que no es contenido. En una pantalla clinica las superficies significan (los tres niveles de `bloque`:
// decision, derivado, registro), y una cabecera no es ninguno de los tres: es el rotulo de la pagina. Al
// quitarle la superficie, el primer bloque blanco que ve el profesional vuelve a ser el primer bloque de
// CONTENIDO, que es lo que la jerarquia deberia decir.
//
// Y el degradado no desaparece del sistema: se reserva para una BANDA de pantalla clave, que se decide una
// por una, en vez de repetirse en las 28 por defecto.
//
// EL CRITERIO DE LA DESCRIPCION NO CAMBIA (BRAND): dice lo que la pantalla NO muestra, casi siempre una
// garantia o una consecuencia. No enumera las secciones que el usuario tiene delante.

export function TituloPantalla({
  titulo,
  antetitulo,
  descripcion,
  acciones,
  volver,
}: {
  titulo: string;
  /**
   * Antetitulo corto en el azul de marca, ENCIMA del titulo. Dice a que ZONA pertenece la pantalla
   * ("Seguimiento", "Inventario"), no lo que hace: eso ya lo dice el titulo. Opcional a proposito: una
   * pantalla que no pertenece a ninguna zona no lleva uno inventado.
   */
  antetitulo?: string;
  /** Una linea sobre lo que la pantalla NO muestra. Se acota sola: no hace falta pensarlo en cada pagina. */
  descripcion?: ReactNode;
  /** Acciones de la pantalla entera (no de una fila). A la derecha en ancho, debajo en estrecho. */
  acciones?: ReactNode;
  /** Enlace de vuelta, cuando la pantalla es hija de otra. Va ENCIMA del antetitulo, no al lado. */
  volver?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2 pt-1">
      {volver}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          {antetitulo ? (
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {antetitulo}
            </span>
          ) : null}
          <h1 className="text-titulo font-bold tracking-tight text-foreground">{titulo}</h1>
          {descripcion ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        {acciones ? <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div> : null}
      </div>
    </header>
  );
}

// TITULO DE SECCION dentro de una pantalla. Antes era `text-2xl font-bold` (24px), el MISMO tamaño al que
// baja el titulo de pantalla: dos niveles de jerarquia con el mismo peso visual no son dos niveles. Baja a
// `text-seccion` (18px/600), que se lee como subordinado sin dejar de separar bloques.
export function TituloSeccion({
  children,
  acciones,
}: {
  children: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="text-seccion font-semibold tracking-tight text-foreground">{children}</h2>
      {acciones ? <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div> : null}
    </div>
  );
}
