"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  desmarcarPacienteDePruebaAction,
  marcarPacienteDePruebaAction,
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
  esDePrueba: boolean;
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

export function PacientesDelIntegrante({ pacientes }: { pacientes: PacienteDelIntegrante[] }) {
  if (pacientes.length === 0) {
    return <p className="text-sm text-muted-foreground">No tiene pacientes asignados.</p>;
  }
  const dePrueba = pacientes.filter((p) => p.esDePrueba).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose text-xs text-muted-foreground">
        Marcar un paciente lo saca de <strong className="text-foreground">todas las cifras</strong>: sus
        ventas, su comisión, lo que se deshizo, los insights y la facturación. Sigue visible aquí y en la
        lista de su profesional, con su rótulo, porque esconderlo es como alguien lo confunde con uno real.
        {dePrueba > 0 ? ` Hoy ${dePrueba} de ${pacientes.length} están marcados.` : ""}
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {pacientes.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <span className="min-w-0">
              {p.nombre} <span className="text-muted-foreground">· {p.documento}</span>
              {p.esDePrueba ? (
                <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {ROTULO_DE_PRUEBA}
                  {p.motivo ? `: ${p.motivo}` : ""}
                </span>
              ) : null}
            </span>
            {p.esDePrueba ? <Desmarcar patientId={p.id} /> : <Marcar patientId={p.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
