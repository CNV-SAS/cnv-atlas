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
// 3. EL SITIO DE LAS ACCIONES. Hoy cada pantalla las pone donde puede. Van a la derecha del titulo, y
//    `flex-wrap` para que en un telefono caigan debajo en vez de aplastar el titulo.

export function TituloPantalla({
  titulo,
  descripcion,
  acciones,
  volver,
}: {
  titulo: string;
  /** Una linea sobre que hace la pantalla. Se acota sola: no hace falta pensarlo en cada pagina. */
  descripcion?: ReactNode;
  /** Acciones de la pantalla entera (no de una fila). A la derecha en ancho, debajo en estrecho. */
  acciones?: ReactNode;
  /** Enlace de vuelta, cuando la pantalla es hija de otra. Va ENCIMA del titulo, no al lado. */
  volver?: ReactNode;
}) {
  return (
    // BANDA EN INK, no en el azul de marca. El azul de la primera prueba saturaba porque ya lo llevan el
    // item activo de la barra y los botones: tres cosas azules y solo una hace algo. El ink es el SEGUNDO
    // ancla de marca de Atlas (BRAND: "azul = accion, ink = estructura"), asi que da presencia sin gastar
    // el unico color que significa "esto es clicable". Blanco sobre ink: 18,08:1.
    //
    // EL DEGRADADO ES MINIMO y va hacia un ink AZULADO (#1c2333), no hacia otro tono: da profundidad con
    // luminosidad, que es lo mismo que defendimos en la barra navy. Si se quiere plano, se quita una clase.
    <header className="flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-[#15161a] to-[#1c2333] px-6 py-5 text-white">
      {volver}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-titulo font-bold tracking-tight">{titulo}</h1>
          {descripcion ? <p className="max-w-2xl text-sm text-white/70">{descripcion}</p> : null}
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
