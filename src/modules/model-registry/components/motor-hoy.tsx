import { TituloSeccion } from "@/components/shared/titulo-pantalla";

import { modificacionesVigentes, motorVigente } from "../motor-vigente";

// ═══ CON QUE SE ESTA DIAGNOSTICANDO HOY ═══
//
// LA RAZON (Santiago, 2026-09-10): "hoy nadie puede responder desde Atlas con que version del motor se
// esta diagnosticando. Eso ya nos costo rondas de averiguarlo por consulta."
//
// VA ARRIBA DEL TODO en esta pantalla porque es lo unico de aqui que se consulta SIN tener una tarea
// delante: las otras secciones son trabajo (importar, generar), esta es una respuesta.
//
// NO LLEVA COLOR CLINICO. El verde, el ambar y el rojo codifican severidad del PACIENTE; una version de
// motor no tiene severidad. La unica marca de atencion es la de calibracion provisional, y va en el tono
// de atencion de la interfaz, no en el del semaforo.

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </dt>
      <dd className="font-mono text-lg font-medium tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}

export function MotorHoy() {
  const motor = motorVigente();
  const modificaciones = modificacionesVigentes();

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <TituloSeccion>El motor, hoy</TituloSeccion>
        <p className="text-muted-foreground">
          Con qué versión se está diagnosticando en este momento. Cada diagnóstico guarda la suya, así que
          uno emitido antes de un cambio conserva la versión con la que se calculó.
        </p>
      </header>

      <div className="border border-border bg-card p-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato rotulo="Modelo ANI-BIS-E" valor={motor.engineVersion} />
          <Dato rotulo="Protocolo de tratamiento" valor={motor.protocolVersion} />
        </dl>

        {motor.queEs ? (
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">{motor.queEs}</p>
        ) : null}

        {motor.calibracionProvisional ? (
          // LA CALIBRACION PROVISIONAL YA SE MARCA DENTRO DE UN DIAGNOSTICO, pero solo ahi: para saber si
          // la EB-BIS que se esta emitiendo hoy sale de una calibracion definitiva habia que abrir un
          // paciente. Es informacion del MOTOR, no de un paciente.
          <p className="mt-3 border border-[var(--attention)]/40 bg-[var(--attention-bg)]/40 px-3 py-2 text-sm text-foreground">
            <span className="font-medium">La EB-BIS corre con una calibración provisional</span> (
            {motor.calibracion}). Se recalibra cuando haya población suficiente, y ese día los
            diagnósticos nuevos se sellan con la calibración nueva; los ya emitidos conservan esta.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Modificaciones autorizadas sobre la ciencia congelada
        </h3>
        {/* ES LO QUE DISTINGUE "el motor de Gildardo" de "el motor de Gildardo mas lo que el autorizo por
            escrito". La version sola no cuenta esa parte, y hasta hoy solo vivia en un manifiesto de
            codigo. Cada una lleva su fecha y su instruccion: quien pregunte por que Atlas hace algo que su
            archivo no hace, encuentra aqui la instruccion que lo autorizo. */}
        <p className="text-sm text-muted-foreground">
          El archivo original nunca se edita. Lo que corre es el original más estas modificaciones, cada
          una autorizada por instrucción escrita de Dirección Científica.
        </p>
        <ul className="flex flex-col border border-border bg-card">
          {modificaciones.map((m) => (
            <li
              key={m.caId}
              className="flex flex-col gap-1 border-b border-border/60 px-4 py-3 last:border-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-mono text-sm font-medium text-foreground">{m.caId}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{m.fecha}</span>
                <span className="text-xs text-muted-foreground">Decisión {m.decision}</span>
                {m.trozos > 1 ? (
                  // POR QUE SE DICE EL NUMERO DE TROZOS: una instruccion suya puede pedir el mismo cambio
                  // en quince sitios del motor (el caso del dominio sin dato). Sin esta nota, la lista
                  // parece una sola linea de codigo y el alcance real queda escondido.
                  <span className="text-xs text-muted-foreground">
                    {m.trozos} puntos del motor
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-foreground">{m.instruccion}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
