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
  acento = false,
}: {
  rotulo: string;
  valor: number | string;
  /** Una linea que dice QUE significa, o que hacer con ella. */
  detalle?: ReactNode;
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
        "flex flex-col gap-1 rounded-2xl border p-4 shadow-sm",
        encendida
          ? "border-clinical-warning/40 bg-clinical-warning-bg"
          : "border-border bg-card",
      ].join(" ")}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </span>
      <span
        className={[
          "text-2xl font-bold tabular-nums",
          encendida ? "text-clinical-warning" : "text-foreground",
        ].join(" ")}
      >
        {valor}
      </span>
      {detalle ? <span className="text-xs text-muted-foreground">{detalle}</span> : null}
    </div>
  );
}
