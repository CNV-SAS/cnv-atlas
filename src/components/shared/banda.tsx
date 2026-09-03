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
        "relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-[#143a9e] via-primary to-[#4a86ff] text-white",
        compacta ? "px-5 py-4" : "px-6 py-6",
      ].join(" ")}
    >
      {/* CIRCULOS DE BAJISIMO CONTRASTE: dan profundidad sin dibujar nada que compita con el texto.
          `aria-hidden` y `pointer-events-none` porque no son contenido ni son clicables. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 -z-10 size-64 rounded-full bg-white/[0.07]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-32 -z-10 size-40 rounded-full bg-white/[0.05]"
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
