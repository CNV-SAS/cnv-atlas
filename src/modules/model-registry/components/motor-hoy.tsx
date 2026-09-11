import { Cpu, FileText, GitBranch, Stethoscope } from "lucide-react";

import { formatDateOnly } from "@/lib/format/date";

import type { MotorVigente } from "../motor-vigente";

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
// NO REPITE EL AVISO DE CALIBRACION PROVISIONAL: ya sale en la tabla de composicion, junto a la EB y al
// IAE, que es donde el profesional lo necesita. Y alli esta MEJOR puesto, porque lo lee del campo SELLADO
// de ese diagnostico; aqui salia de una constante, o sea la calibracion de HOY, que para un diagnostico
// de agosto podria ser otra. Ver la nota en `motor-vigente.ts`.
//
// ── LAS TESELAS, de la referencia de Contratik (opcion A del artefacto) ─────────────────────────────
//
// CADA VERSION LLEVA SU ICONO en un cuadrado redondeado de azul de marca, que es lo que da la
// profundidad que faltaba. UN SOLO color, no uno por tarjeta: aqui no hay dato de paciente, asi que el
// azul puede pesar, pero el verde, el ambar y el rojo siguen reservados al semaforo clinico. Que se
// reserven tambien donde no hay paciente es justo lo que los mantiene vivos donde si lo hay.
//
// ── LOS DOS RECIBEN LA VISTA YA RESUELTA, no la leen ────────────────────────────────────────────────
//
// El sello del hero y las tarjetas salen de la MISMA lectura. Si cada uno llamara al lector, serian dos
// consultas por carga para pintar el mismo dato, y ademas dos oportunidades de que digan cosas distintas.
// La pagina lee una vez y reparte.

const ICONO = { Motor: Cpu, Modelo: FileText, Reglas: GitBranch, Protocolo: Stethoscope } as const;

export function MotorHoy({ motor }: { motor: MotorVigente }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {motor.versiones.map((v) => {
          const Icono = ICONO[v.nombre as keyof typeof ICONO] ?? Cpu;
          return (
            <div
              key={v.nombre}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <span className="mb-1 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icono className="size-[1.05rem]" aria-hidden />
              </span>
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {v.nombre}
              </span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {v.valor}
              </span>
              {/* QUE GOBIERNA CADA UNA. Sin esto, cuatro numeros iguales se leen como cuatro copias del
                  mismo dato y la primera pregunta es por que se repiten. */}
              <span className="text-xs text-muted-foreground">{v.gobierna}</span>
            </div>
          );
        })}
      </div>

      {motor.sinRegistro ? (
        // NO SE RELLENA CON UN "1.0.0" DE CORTESIA: si el registro del modelo no esta sembrado, el
        // diagnostico tampoco puede sellarse, y una pantalla que muestre un numero plausible haria creer
        // lo contrario.
        <p className="rounded-lg border border-[var(--attention)]/40 bg-[var(--attention-bg)]/40 px-3 py-2 text-sm text-foreground">
          El registro del modelo no está sembrado en esta base. Hasta que lo esté, no se pueden sellar
          diagnósticos.
        </p>
      ) : null}
    </section>
  );
}

/**
 * LA LINEA DE ESTADO DEL HERO: que version corre y desde cuando.
 *
 * VA DENTRO DEL BLOQUE AZUL porque contesta lo PRIMERO que se pregunta al abrir esta pantalla ("¿esto
 * esta al dia?"). Tenerla ahi ahorra leer cuatro numeros para deducirlo.
 */
export function SelloDelModelo({ motor }: { motor: MotorVigente }) {
  if (!motor.queEs) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-primary-foreground/75">
      <span className="size-1.5 shrink-0 rounded-full bg-primary-foreground/70" aria-hidden />
      {motor.queEs}
      {motor.desde ? <span>· vigente desde el {formatDateOnly(motor.desde)}</span> : null}
    </span>
  );
}
