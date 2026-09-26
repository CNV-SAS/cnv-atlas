"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  desmarcarPacienteDePruebaAction,
  proponerPacienteDePruebaAction,
  resolverPropuestaDePruebaAction,
  type MarcaDePruebaState,
} from "../actions";

const initial: MarcaDePruebaState = { error: null, success: null, warning: null };

// ═══ LA BANDEJA DE PROPUESTAS Y EL FORMULARIO DE PROPONER (0180, 2026-09-25) ═══
//
// DOS REGLAS DE LA CASA QUE ESCRIBI MAL LA PRIMERA VEZ, y que sus candados me dijeron:
//
//   · `onSubmit={enviarSinReset(accion)}`, NUNCA la prop `action`. La prop resetea los inputs no controlados
//     tras la accion, asi que un error borraria el motivo que la persona acababa de escribir.
//   · Y EL REFRESCO LO HACE LA PANTALLA con `useFormToastAndRefresh`, no la accion con `revalidatePath`. Uno
//     de los dos, nunca los dos: con ambos, el formulario se desmonta antes de que se vea el aviso.

export type PropuestaEnPantalla = {
  patientId: string;
  documento: string;
  nombre: string;
  motivo: string;
  propuestoEn: string;
  propuestoPor: string | null;
};

/** El profesional propone, con motivo. Vive en la ficha del paciente. */
export function ProponerDePrueba({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(proponerPacienteDePruebaAction, initial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`motivo-prueba-${patientId}`} className="text-xs">
          Por qué es de prueba
        </Label>
        <Input
          id={`motivo-prueba-${patientId}`}
          name="motivo"
          placeholder="Por ejemplo: es mi propia cuenta, la usé para probar el flujo"
          className="h-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Un administrador lo confirma. Marcarlo lo saca de las cifras y de la facturación, pero sigue aquí para
        poder trabajar con él.
      </p>
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Proponerlo como de prueba"}
      </Button>
    </form>
  );
}

/** Admin resuelve. Las dos salidas son explicitas: confirmar saca de las cifras, rechazar deja todo igual. */
export function ResolverPropuestas({ propuestas }: { propuestas: PropuestaEnPantalla[] }) {
  const [state, action, pending] = useActionState(resolverPropuestaDePruebaAction, initial);
  useFormToastAndRefresh(state);

  if (propuestas.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay propuestas esperando.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3 text-sm">
        {propuestas.map((p) => (
          <li key={p.patientId} className="flex flex-col gap-2 border-b pb-3">
            <span>
              {p.nombre} <span className="text-muted-foreground">· {p.documento}</span>
            </span>
            {/* EL MOTIVO SE MUESTRA COMPLETO: es lo unico con lo que admin puede decidir, y por eso la base lo
                exige. Sin el, confirmar seria adivinar. */}
            <span className="text-muted-foreground">
              &ldquo;{p.motivo}&rdquo; · lo propuso {p.propuestoPor ?? "alguien"} el{" "}
              {new Date(p.propuestoEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
            </span>
            <form onSubmit={enviarSinReset(action)} className="flex flex-wrap gap-2">
              <input type="hidden" name="patientId" value={p.patientId} />
              {/* DOS BOTONES CON `key` DISTINTA y su dato en `name`/`value`. Las dos cosas son hazards
                  documentados: la `key` distinta evita que React reutilice el nodo, y el `name`/`value` del
                  boton SOLO viaja porque `enviarSinReset` pasa el submitter (con `new FormData(form)` a secas
                  se perderia en silencio y el servidor no sabria si se confirmo o se rechazo). */}
              <Button key="confirmar" type="submit" name="confirmar" value="true" disabled={pending}>
                Marcarlo de prueba
              </Button>
              <Button key="rechazar" type="submit" name="confirmar" value="false" variant="ghost" disabled={pending}>
                No es de prueba
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Desmarcar, para el paciente real que se marco por error. Solo admin. */
export function DesmarcarDePrueba({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(desmarcarPacienteDePruebaAction, initial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? "Quitando..." : "No es de prueba: que vuelva a contar"}
      </Button>
    </form>
  );
}
