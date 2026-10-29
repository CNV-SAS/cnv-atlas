"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { avisoDeHuellaRepetida, type HuellaRepetida } from "@/modules/bis/huella-repetida";

import { medicionDeOtroPacienteAction, type MedicionDeOtroState } from "../actions";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// "ESTA MEDICION NO ES DE ESTE PACIENTE": EL CASO 6, CON SU PROPIA SUPERFICIE
//
// ═══ POR QUE AQUI Y NO EN LA PANTALLA DE CORREGIR ═══
//
// Porque este es el momento en que se descubre. El profesional esta leyendo el diagnostico, ve una masa
// grasa que no tiene nada que ver con la persona que tiene delante, y se da cuenta. Mandarlo a otra
// pantalla a buscar la salida es donde se abandona y se queda el dato mal.
//
// Y DELIBERADAMENTE APARTE DEL BOTON DE CORREGIR, aunque los dos versionen: corregir una respuesta es un
// trabajo normal del dia; decir que una medicion es de otra persona es un incidente de datos de salud.
// Mezclarlos en un mismo bloque invita a pulsar el equivocado.
//
// ═══ LO QUE LA PANTALLA TIENE QUE DECIR ANTES DE PULSAR ═══
//
// Las tres cosas que pasan, porque ninguna es evidente y las tres son irreversibles: la version actual
// queda reemplazada (con su diagnostico, legible, como registro de lo que se emitio), la nueva nace SIN
// medicion, y la medicion queda marcada para que el dueno de verdad pueda cargar su archivo. Lo ultimo es
// lo menos evidente y lo mas importante: sin la marca, el freno se le cerraria al paciente correcto.
//
// ═══ LOS HAZARDS QUE APLICAN ═══
//
//   · `enviarSinReset` y nunca la prop `action` (hazard 2): un error de validacion no puede borrar el
//     motivo que la persona acabo de escribir.
//   · La confirmacion es una CASILLA DENTRO del formulario, con `name`, asi que viaja. No va en el
//     `value` del boton (hazard 5: el `name`/`value` del boton de envio no viaja en `new FormData(form)`).
//   · El boton exige las dos cosas en su `disabled` Y LO DICE EN SU ROTULO (hazard 8): un boton muerto sin
//     explicacion se lee como pantalla rota.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const inicial: MedicionDeOtroState = { error: null, success: null, warning: null };

export function MedicionDeOtroPaciente({
  evaluationId,
  repetida = null,
}: {
  evaluationId: string;
  /**
   * EL AVISO DE QUE ESTA MEDICION ESTA EN OTRA CONSULTA, DENTRO DEL MISMO BLOQUE (Santiago, 2026-10-28).
   *
   * ERAN DOS BLOQUES y estaban separados por media pantalla: el aviso amarillo arriba y la salida casi al
   * final. *"¿No seria mejor unificar ambos bloques en uno solo amarillo de advertencia?"* Si: un aviso que
   * no lleva su salida al lado obliga a buscarla, y el que la busca y no la encuentra deja el dato mal.
   *
   * null = la medicion no esta repetida. El bloque sigue existiendo, discreto: el profesional puede
   * darse cuenta por otro camino (la edad del equipo que no cuadra, una masa grasa imposible), y la
   * salida tiene que estar igual.
   */
  repetida?: HuellaRepetida | null;
}) {
  const [state, action, pending] = useActionState(medicionDeOtroPacienteAction, inicial);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const motivoSuficiente = motivo.trim().length >= 15;

  if (!abierto) {
    // ═══ UN SOLO BLOQUE, Y SU TONO LO DECIDE EL HECHO ═══
    //
    // CON LA MEDICION REPETIDA va en amarillo y el aviso ENCABEZA: es lo que hay que leer primero, y la
    // salida queda debajo, en el mismo bloque. Sin repeticion queda discreto, porque entonces no hay nada
    // que avisar: solo la salida, por si el profesional se dio cuenta por otro camino.
    //
    // LAS DOS VIVEN ARRIBA DE Antrop. & BIS, no al final. El defecto que esto cierra es el de siempre con
    // esta pantalla: un control que esta y no se encuentra se reporta como que no esta.
    return (
      <section
        className={
          repetida
            ? "flex flex-col gap-2 rounded-xl border border-attention bg-attention-bg p-4"
            : "flex flex-col gap-2 rounded-xl border border-dashed border-clinical-warning/40 bg-muted/20 p-4"
        }
      >
        {repetida ? (
          <>
            <h3 className="flex items-start gap-2 text-sm font-semibold text-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
              {avisoDeHuellaRepetida(repetida)}
            </h3>
            <p className="max-w-prose text-sm text-muted-foreground">
              Las cuatro lecturas eléctricas del equipo son idénticas hasta el último decimal, así que es
              la misma toma física y no dos mediciones parecidas. Este aviso desaparece solo cuando la toma
              deje de estar en dos consultas.
            </p>
          </>
        ) : (
          <h3 className="text-sm font-semibold text-foreground">
            ¿La bioimpedancia de esta consulta es de otra persona?
          </h3>
        )}
        <p className="max-w-prose text-sm text-muted-foreground">
          Pasa cuando se importa el archivo equivocado. No es lo mismo que un dato mal digitado: el
          diagnóstico de esta consulta se calculó con la medición de otro paciente, así que no se corrige
          un valor, se retira la medición.
        </p>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
            La medición no es de este paciente
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-clinical-warning/40 bg-clinical-warning-bg p-4">
      <h3 className="text-sm font-semibold text-clinical-warning">
        La medición de esta consulta no es de este paciente
      </h3>
      <div className="max-w-prose text-sm text-foreground">
        <p className="mb-2">Al confirmar pasan tres cosas, y ninguna se deshace:</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Esta versión de la consulta queda <strong>reemplazada</strong>. Su diagnóstico no se borra:
            queda legible como el registro de lo que se emitió, con la firma de quien lo firmó.
          </li>
          <li>
            Nace una <strong>versión nueva sin medición</strong>, con la encuesta, la fuerza prensil y el
            peso meta de este paciente. Su pendiente dirá <strong>Montar BIS</strong>: ahí se carga el
            archivo que sí es suyo, y el diagnóstico se genera de nuevo.
          </li>
          <li>
            La medición queda marcada como de otra persona, y eso es lo que{" "}
            <strong>deja al paciente dueño cargar su propio archivo</strong>. Sin la marca, el sistema se
            lo rechazaría diciéndole que su medición es de otro.
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Las condiciones de la toma se conservan y vuelven a quedar pendientes de registro: describen un
          momento que no era este, así que hay que confirmarlas con la medición buena.
        </p>
      </div>
      <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            De quién era la medición y cómo se supo (queda en la historia clínica)
          </span>
          <textarea
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={500}
            disabled={pending}
            placeholder="Por ejemplo: el archivo importado era el de otro paciente atendido el mismo día; la edad del equipo no coincide con la de este paciente."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        {/* LA CASILLA VIAJA (tiene `name`) y es controlada, para poder exigirla tambien en el boton. */}
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="confirmar"
            value="si"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            disabled={pending}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            Confirmo que la medición de esta consulta no es de este paciente y que esta versión queda
            reemplazada.
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={pending || !motivoSuficiente || !confirmado}>
            {pending
              ? "Corrigiendo..."
              : !motivoSuficiente
                ? "Escribe el motivo para continuar"
                : !confirmado
                  ? "Marca la confirmación para continuar"
                  : "Retirar la medición y crear la versión nueva"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}
