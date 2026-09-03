import type { ReactNode } from "react";

// BANDA CON DEGRADADO: la cabecera de las pantallas CLAVE, y solo de esas.
//
// ── DONDE VA, DECIDIDO UNA POR UNA (2026-09-03) ──────────────────────────────────────────────────────
//
// El encabezado por defecto de Atlas NO lleva banda: es el trio antetitulo + titulo + bajada sobre el gris
// (`titulo-pantalla.tsx`). Esta banda es la excepcion, y la excepcion se gana pantalla por pantalla:
//
//   · Tablero          — SI. Es lo primero que se ve al entrar y tiene algo que decir (el saludo, y mas
//                        adelante lo que hay pendiente hoy).
//   · Detalle paciente — SI. Ahi la cabecera tiene que cargar IDENTIDAD: de quien es esta pantalla. Los
//                        datos de cabecera caben dentro en vez de robarle una tarjeta al contenido.
//   · Una evaluacion   — SI, pero `compacta`. Misma razon (dice de quien es lo que estas mirando) con el
//                        peso invertido: debajo hay mil lineas de trabajo clinico, asi que ubica y se
//                        quita de en medio.
//   · Listas y el resto — NO. La banda diria "Pacientes" y la navegacion ya lo dice; un degradado a todo
//                        ancho para repetir una palabra es como el recurso deja de significar. Y si va en
//                        las 28 pantallas deja de ser una banda de pantalla clave: es el fondo de la app.
//
// ── LA REGLA QUE LA ACOTA, Y NO ES DE ESTILO ────────────────────────────────────────────────────────
//
// **El degradado vive en la capa de INTERFAZ. Nunca detras de una cifra del modelo ni de un veredicto.**
// En la capa clinica el color SIGNIFICA severidad (`--clinical-*` sale de los clasificadores de Gildardo:
// el naranja de Moderado es el hex exacto de su `_DFI_SEVC`). Un fondo azul debajo de un resultado le
// añade un tono que el modelo no dijo, y el profesional no puede saber que ese tono es nuestro.
//
// En la practica: la banda puede llevar identidad, fechas, conteos operativos y acciones. NO puede llevar
// una clasificacion, una severidad, un indice ni la edad bioelectrica.
//
// ── Y EL DEGRADADO ES DEL AZUL DE MARCA, no de un azul nuevo ────────────────────────────────────────
//
// Va de un azul hondo al `#205dfd` de `--primary` y termina mas claro. Es el mismo color que ya significa
// "accion" en los botones, usado aqui como SUPERFICIE y no como señal: por eso dentro de la banda los
// botones se invierten (blanco solido y hueco), en vez de ser otro azul sobre azul.

export function Banda({
  antetitulo,
  titulo,
  bajada,
  datos,
  acciones,
  volver,
  compacta = false,
}: {
  /** Pastilla corta arriba del titulo. Dice QUE ES esto ("Paciente", una fecha), no lo que hace. */
  antetitulo?: string;
  titulo: string;
  /** Una linea. Mismo criterio que la bajada del encabezado normal: lo que la pantalla NO muestra. */
  bajada?: ReactNode;
  /**
   * Datos de cabecera, en pares rotulo/valor. Es lo que justifica la banda en el detalle: caben aqui en
   * vez de gastar una tarjeta. NINGUNO puede ser clinico (ver la regla arriba).
   */
  datos?: { rotulo: string; valor: ReactNode }[];
  acciones?: ReactNode;
  /** Enlace de vuelta. Va encima de todo, y hereda el color: sobre la banda queda blanco. */
  volver?: ReactNode;
  /**
   * Banda MAS ANGOSTA, para pantallas donde el contenido es lo que pesa y la cabecera solo UBICA.
   * El caso es la pantalla de una evaluacion: debajo hay mil lineas de trabajo clinico, asi que la
   * cabecera tiene que decir de quien es y quitarse de en medio. En el detalle del paciente es al reves
   * (la ficha ES la cabecera), y ahi va la normal.
   */
  compacta?: boolean;
}) {
  return (
    <header
      className={[
        // HORIZONTAL (`to-r`), no diagonal (2026-09-03, Santiago). En una banda ancha y baja la
        // diagonal recorre poco antes de salirse por arriba, asi que el degradado se ve solo en las
        // esquinas; en horizontal cruza el ancho entero, que es la dimension que la banda tiene.
        "relative isolate overflow-hidden rounded-2xl bg-gradient-to-r from-[#143a9e] via-primary to-[#4a86ff] text-white",
        compacta ? "px-5 py-4" : "px-6 py-6",
      ].join(" ")}
    >
{/* TRAMA DE PUNTOS (2026-09-03, elegida por Santiago entre cuatro). Sustituye a dos circulos.
          POR QUE ESTA Y NO UN ICONO DEL DOMINIO, que era la pregunta: una reticula lee a INSTRUMENTO DE
          MEDICION, que es lo que Atlas es, y sigue sin representar ningun objeto. Un icono reconocible
          detras del nombre de un paciente se lee como adorno, y ademas cualquiera DICE algo: un corazon es
          cardiologia, una hoja es dieta vegetal. Lo que diga va a chocar con algun paciente.
          (La otra candidata era un trazo de señal, que es lo que de verdad mide la bioimpedancia, pero se
          confunde con un electrocardiograma y no hacemos cardiologia.)

          LA MASCARA ES LO QUE LA HACE USABLE: la trama se desvanece hacia la izquierda, asi que nunca le
          pasa por detras al texto, que empieza ahi. Sin ella, los puntos cruzarian el nombre.
          `aria-hidden` y `pointer-events-none` porque no es contenido ni es clicable. */}
      <span
        aria-hidden
        className="trama-medicion pointer-events-none absolute inset-0 -z-10"
      />
      <div className="flex flex-col gap-2">
        {volver}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            {antetitulo ? (
              <span className="w-fit rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em]">
                {antetitulo}
              </span>
            ) : null}
            <h1
              className={[
                "font-bold tracking-tight",
                compacta ? "text-seccion" : "text-titulo",
              ].join(" ")}
            >
              {titulo}
            </h1>
            {bajada ? <p className="max-w-2xl text-sm text-white/80">{bajada}</p> : null}
          </div>
          {acciones ? <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div> : null}
        </div>
        {datos && datos.length > 0 ? (
          <dl
            className={["flex flex-wrap gap-y-2", compacta ? "mt-0.5 gap-x-6" : "mt-1 gap-x-8"].join(" ")}
          >
            {datos.map((d) => (
              <div key={d.rotulo} className="flex flex-col">
                <dt className="text-xs uppercase tracking-[0.1em] text-white/65">{d.rotulo}</dt>
                {/* `tabular-nums` porque casi todos son cifras o fechas: sin ellas los digitos bailan
                    al cambiar de paciente y la cabecera se lee inestable. */}
                <dd className="text-sm font-semibold tabular-nums">{d.valor}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  );
}
