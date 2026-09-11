import { TituloSeccion } from "@/components/shared/titulo-pantalla";
import { formatDateOnly } from "@/lib/format/date";

import { leerVersionDelModelo } from "../data/version-modelo-reader";
import { motorVigente } from "../motor-vigente";

// ═══ EL MOTOR, HOY ═══
//
// LA RAZON (Santiago, 2026-09-10): "hoy nadie puede responder desde Atlas con que version del motor se
// esta diagnosticando. Eso ya nos costo rondas de averiguarlo por consulta."
//
// LOS CUATRO NOMBRES SON LOS MISMOS QUE EL PIE DEL DIAGNOSTICO, y eso es el punto: hasta hoy esa traza
// decia "Motor · modelo · reglas" y esta pantalla decia otra cosa, asi que la misma version salia con dos
// nombres segun donde se leyera. Lo que gobierna cada una se explica AQUI, que es la pantalla de
// consulta; el pie del diagnostico solo traza.
//
// NO LLEVA COLOR CLINICO. El verde, el ambar y el rojo codifican severidad del PACIENTE; una version de
// motor no tiene severidad. La unica marca de atencion es la de calibracion provisional, y va en el tono
// de atencion de la interfaz, no en el del semaforo.

export async function MotorHoy() {
  const motor = motorVigente(await leerVersionDelModelo());

  return (
    <section className="flex flex-col gap-4">
      <TituloSeccion>El motor, hoy</TituloSeccion>

      <div className="border border-border bg-card">
        <dl className="grid gap-px bg-border sm:grid-cols-2">
          {motor.versiones.map((v) => (
            <div key={v.nombre} className="flex flex-col gap-1 bg-card p-4">
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {v.nombre}
              </dt>
              <dd className="font-mono text-lg font-medium tabular-nums text-foreground">{v.valor}</dd>
              {/* QUE GOBIERNA CADA UNA. Sin esto, cuatro numeros iguales se leen como cuatro copias del
                  mismo dato y la primera pregunta es por que se repiten. */}
              <p className="text-xs text-muted-foreground">{v.gobierna}</p>
            </div>
          ))}
        </dl>

        {motor.queEs ? (
          <p className="border-t border-border p-4 text-sm text-muted-foreground">
            {motor.queEs}{" "}
            {motor.desde ? (
              <span className="whitespace-nowrap">Vigente desde el {formatDateOnly(motor.desde)}.</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {motor.sinRegistro ? (
        // NO SE RELLENA CON UN "1.0.0" DE CORTESIA: si el registro del modelo no esta sembrado, el
        // diagnostico tampoco puede sellarse, y una pantalla que muestre un numero plausible haria creer
        // lo contrario.
        <p className="border border-[var(--attention)]/40 bg-[var(--attention-bg)]/40 px-3 py-2 text-sm text-foreground">
          El registro del modelo no está sembrado en esta base. Hasta que lo esté, no se pueden sellar
          diagnósticos.
        </p>
      ) : null}

      {motor.calibracionProvisional ? (
        // LA CALIBRACION PROVISIONAL YA SE MARCA DENTRO DE UN DIAGNOSTICO, pero solo ahi: para saber si
        // la EB-BIS que se esta emitiendo hoy sale de una calibracion definitiva habia que abrir un
        // paciente. Es informacion del MOTOR, no de un paciente.
        <p className="border border-[var(--attention)]/40 bg-[var(--attention-bg)]/40 px-3 py-2 text-sm text-foreground">
          <span className="font-medium">La EB-BIS corre con una calibración provisional.</span> Se
          recalibra cuando haya población suficiente; ese día los diagnósticos nuevos se sellan con la
          calibración nueva y los ya emitidos conservan esta.
        </p>
      ) : null}
    </section>
  );
}
