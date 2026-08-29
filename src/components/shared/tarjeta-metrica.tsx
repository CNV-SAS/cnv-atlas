import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// TARJETA DE METRICA: la cifra de cabecera de una pantalla.
//
// POR QUE EXISTE. La pantalla de pacientes era plana porque solo tenia una tabla: se entra, se busca, se
// sale, y nunca dice nada de conjunto. Estas tarjetas dan el estado del roster de un vistazo.
//
// LA REGLA QUE LAS GOBIERNA, y es lo que separa una cifra util de una decorativa: UNA METRICA TIENE QUE
// DECIR QUE HACER. "Total de evaluaciones" es un numero que sube y no pide nada; "sin evaluaciones" o
// "sin autorizacion vigente" nombran una lista de personas a las que hay que hacerles algo. Por eso las
// accionables llevan `acento` y pueden enlazar: la cifra es la entrada al trabajo, no un adorno.
//
// Y UNA QUE NO LLEVA: cualquier metrica que necesite un UMBRAL CLINICO (por ejemplo "sin consulta en 90
// dias") no se pone aqui con un numero inventado. La cadencia de control sale de la ruta del paciente y
// el criterio de inactividad esta preguntado a Gildardo; hasta que responda, esa tarjeta no existe.

export function TarjetaMetrica({
  rotulo,
  valor,
  detalle,
  icono: Icono,
  acento = false,
}: {
  rotulo: string;
  valor: number | string;
  /** Una linea que dice QUE significa, o que hacer con ella. */
  detalle?: ReactNode;
  /** Icono de lucide. Le da a la tarjeta un ancla visual: hoy son texto suelto y se leen todas igual. */
  icono?: LucideIcon;
  /**
   * Destaca la cifra porque pide accion. Se apaga sola cuando el valor es 0: una tarjeta encendida
   * anunciando "0 pendientes" entrena a ignorar el color, que es como se pierde una señal.
   */
  acento?: boolean;
}) {
  const encendida = acento && valor !== 0 && valor !== "0";
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-2xl border p-4 shadow-sm",
        encendida ? "border-attention/40 bg-attention-bg" : "border-border bg-card",
      ].join(" ")}
    >
      {Icono ? (
        // EL COLOR DEL ICONO NO SALE DE LA CAPA CLINICA, y no es un detalle: estas son tarjetas de
        // CONTEO, no de veredicto. Un icono en verde-optimo o rojo-critico sobre un numero de pacientes
        // le pondria al conteo un significado clinico que no tiene. Van con el azul de marca (neutro
        // aqui, porque no hay ninguna accion azul dentro de la tarjeta) y, cuando piden trabajo, con
        // `attention`, que es el eje operativo y existe justamente separado del clinico.
        <span
          aria-hidden
          className={[
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            encendida ? "bg-attention/15 text-attention" : "bg-primary/10 text-primary",
          ].join(" ")}
        >
          <Icono className="size-4.5" />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </span>
        <span
          className={[
            "text-2xl font-bold leading-tight tabular-nums",
            encendida ? "text-attention" : "text-foreground",
          ].join(" ")}
        >
          {valor}
        </span>
        {detalle ? <span className="text-xs text-muted-foreground">{detalle}</span> : null}
      </div>
    </div>
  );
}
