"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ProfesionalDestino } from "@/modules/professionals/data/profesionales-para-reasignar";

import {
  confirmarPacienteRealAction,
  desmarcarPacienteDePruebaAction,
  marcarPacienteDePruebaAction,
  reasignarPacienteAction,
  type MarcaDePruebaState,
} from "../actions";
import { ROTULO_DE_PRUEBA } from "../de-prueba";

// ═══ MARCAR UN PACIENTE DE PRUEBA DESDE ADMIN (Santiago, 2026-10-01) ═══
//
// POR QUÉ AQUÍ: esta es la pantalla donde admin mira la operación de un integrante, así que es donde se ve
// qué pacientes son de verdad y cuáles se crearon para probar. El camino de "el profesional propone y admin
// confirma" sirve para el paciente que alguien reconoce; no sirve para limpiar los quince de una cuenta de
// demostración, porque ese profesional no va a proponer nada.
//
// Y LO QUE OCURRE AL MARCAR NO ES COSMÉTICO: desde hoy saca también SU DINERO de las cifras (sus ventas, sus
// comisiones, lo que se deshizo, los insights). Por eso pide motivo, queda quién lo marcó, y se puede quitar.
// Un paciente real marcado por error desaparecería de las cifras, y eso tiene que ser reversible.

export type PacienteDelIntegrante = {
  id: string;
  nombre: string;
  documento: string;
  /** Lo que las cifras excluyen: marcado a mano O derivado de su profesional. */
  esDePrueba: boolean;
  /** Si la decision la tomo una persona. Un derivado no se desmarca: se confirma como real. */
  marcadoAMano: boolean;
  confirmadoReal: boolean;
  motivo: string | null;
};

const inicial: MarcaDePruebaState = { error: null, success: null, warning: null };

function Marcar({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(marcarPacienteDePruebaAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      {/* EL MOTIVO ES OBLIGATORIO Y VA AQUÍ, no en un diálogo: seis meses después alguien va a preguntar por
          qué esa venta no cuenta, y "porque alguien lo marcó" no es una respuesta. */}
      <Input
        name="motivo"
        required
        minLength={5}
        maxLength={200}
        placeholder="Por qué es de prueba"
        className="h-8 w-56 text-xs"
        disabled={pending}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Marcando..." : "Marcar de prueba"}
      </Button>
    </form>
  );
}

function Desmarcar({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(desmarcarPacienteDePruebaAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="patientId" value={patientId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Quitando..." : "Quitar la marca"}
      </Button>
    </form>
  );
}

// ═══ EL BOTÓN QUE FALTABA, Y SIN ÉL LA EXCEPCIÓN ERA TEÓRICA (Santiago, 2026-10-01) ═══
//
// A un paciente DERIVADO no se le puede "quitar la marca": nadie se la puso. Lo que se puede decir es que es
// real a pesar de su profesional, y eso es una columna que existía desde la 0202 sin ninguna pantalla que
// pudiera escribirla. Un mecanismo sin superficie que lo alcance hace creer que una regla se puede aplicar
// cuando no.
function ConfirmarReal({ patientId, confirmado }: { patientId: string; confirmado: boolean }) {
  const [state, action, pending] = useActionState(confirmarPacienteRealAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="confirmar" value={confirmado ? "false" : "true"} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending
          ? "Guardando..."
          : confirmado
            ? "Quitar la confirmación"
            : "Es real aunque su profesional sea de prueba"}
      </Button>
    </form>
  );
}

// ═══ REASIGNAR A OTRO PROFESIONAL (Santiago, 2026-10-24) ═══
//
// POR QUE AQUI: esta es la pantalla donde admin mira la operacion de un integrante, asi que es donde se
// decide que pasa con sus pacientes cuando se va o cuando otra persona cubrio sus citas. La regla dura 14
// dice "offboarding = desactivar y reasignar", y la segunda mitad no tenia ninguna superficie.
//
// EL MOTIVO VA EN LA PROPIA FILA, no en un dialogo: dentro de un ano alguien va a preguntar por que esta
// historia clinica cambio de manos, y "porque alguien lo movio" no es una respuesta.
//
// Y SE DICE QUE LA FIRMA NO SE MUEVE, antes de pulsar. Lo que cambia es quien atiende y quien ve la ficha;
// quien firmo un diagnostico se queda, porque es un hecho que ocurrio.
function Reasignar({
  patientId,
  destinos,
}: {
  patientId: string;
  destinos: ProfesionalDestino[];
}) {
  const [state, action, pending] = useActionState(reasignarPacienteAction, inicial);
  useFormToastAndRefresh(state);
  if (destinos.length === 0) return null;
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <select
        name="haciaProfesionalId"
        required
        defaultValue=""
        disabled={pending}
        aria-label="Profesional que lo va a atender"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <option value="">Reasignar a...</option>
        {destinos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre}
            {d.profesion ? ` · ${d.profesion}` : ""}
          </option>
        ))}
      </select>
      <Input
        name="motivo"
        required
        minLength={5}
        maxLength={200}
        placeholder="Por qué se reasigna"
        className="h-8 w-56 text-xs"
        disabled={pending}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Moviendo..." : "Reasignar"}
      </Button>
    </form>
  );
}

export function PacientesDelIntegrante({
  pacientes,
  destinos = [],
}: {
  pacientes: PacienteDelIntegrante[];
  /** Vacio = quien mira no puede reasignar, o no hay otro profesional activo. */
  destinos?: ProfesionalDestino[];
}) {
  if (pacientes.length === 0) {
    return <p className="text-sm text-muted-foreground">No tiene pacientes asignados.</p>;
  }
  const dePrueba = pacientes.filter((p) => p.esDePrueba).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose text-xs text-muted-foreground">
        Un paciente de prueba sale de <strong className="text-foreground">todas las cifras</strong>: sus
        ventas, su comisión, lo que se deshizo, los insights y la facturación. Sigue visible aquí y en la
        lista de su profesional, con su rótulo, porque esconderlo es como alguien lo confunde con uno real.{" "}
        <strong className="text-foreground">
          Si el profesional es de prueba, sus pacientes lo son sin que nadie los marque
        </strong>{" "}
        (migración 0202), y para el caso raro está la salida: decir que uno SÍ es real.
        {dePrueba > 0 ? ` Hoy ${dePrueba} de ${pacientes.length} no cuentan.` : ""}
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {pacientes.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <span className="min-w-0">
              {p.nombre} <span className="text-muted-foreground">· {p.documento}</span>
              {/* ═══ EL RÓTULO DISTINGUE DERIVADO DE MARCADO, y la distinción no es cosmética ═══

                  De ella depende qué botón tiene sentido: un derivado no se desmarca (nadie lo marcó), se
                  confirma como real. Decir solo "de prueba" en los dos casos dejaba al que mira sin saber
                  por qué un paciente que nadie tocó no cuenta en las cifras. */}
              {p.esDePrueba ? (
                <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {p.marcadoAMano
                    ? `${ROTULO_DE_PRUEBA}${p.motivo ? `: ${p.motivo}` : ""}`
                    : "De prueba porque su profesional lo es"}
                </span>
              ) : p.confirmadoReal ? (
                <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Confirmado real, aunque su profesional sea de prueba
                </span>
              ) : null}
            </span>
            {/* LAS DOS ACCIONES CONVIVEN EN LA FILA: la marca de prueba decide si el paciente cuenta en las
                cifras, y la reasignacion decide quien lo atiende. Son preguntas distintas sobre el mismo
                paciente, asi que no se excluyen (a diferencia de marcar y desmarcar, que si). */}
            <span className="flex flex-wrap items-center gap-3">
              {p.marcadoAMano ? (
                <Desmarcar patientId={p.id} />
              ) : p.esDePrueba || p.confirmadoReal ? (
                <ConfirmarReal patientId={p.id} confirmado={p.confirmadoReal} />
              ) : (
                <Marcar patientId={p.id} />
              )}
              <Reasignar patientId={p.id} destinos={destinos} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
