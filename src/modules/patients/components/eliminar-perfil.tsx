"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  pedirEliminacionDelPacienteAction,
  resolverEliminacionDelPacienteAction,
  restituirAlPacienteAction,
  type EliminacionState,
} from "../actions";

const INICIAL: EliminacionState = { error: null, success: null, warning: null };

// ═══ ELIMINAR EL PERFIL DE UN PACIENTE: LAS TRES SUPERFICIES (v12 §1.2, 0233) ═══
//
// LA PALABRA ES LA SUYA Y LA EXPLICACION VA PEGADA. "Eliminar" en cualquier otro sistema significa que la
// fila desaparece, y aqui no: la historia clinica se conserva por ley. Asi que ninguna de estas pantallas
// dice "eliminar" sin decir en la misma frase que la historia se queda y que se puede restituir. Prometer
// un borrado que no ocurre es peor que no ofrecerlo.
//
// Y LAS DOS REGLAS DE LA CASA que estos formularios tienen que respetar (las mismas que la bandeja de la
// 0180): `onSubmit={enviarSinReset(accion)}` y NUNCA la prop `action` (que resetea los campos y borraria
// el motivo escrito si la accion devuelve error), y el refresco lo hace la pantalla con
// `useFormToastAndRefresh`, nunca ademas la accion con `revalidatePath`.

export type PeticionEnPantalla = {
  patientId: string;
  documento: string;
  nombre: string;
  motivo: string;
  pedidoEn: string;
  pedidoPor: string | null;
};

const enBogota = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota" });

/** El profesional pide, con motivo. Vive en la ficha del paciente. */
export function PedirEliminacionDelPerfil({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(pedirEliminacionDelPacienteAction, INICIAL);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`motivo-eliminar-${patientId}`} className="text-xs">
          Por qué hay que eliminar este perfil
        </Label>
        <Input
          id={`motivo-eliminar-${patientId}`}
          name="motivo"
          placeholder="Por ejemplo: se creó dos veces por un error al escribir el documento"
          className="h-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Un administrador lo revisa. Eliminar el perfil lo saca de todas las pantallas; su historia clínica se
        conserva, porque la ley obliga a guardarla 15 años, y se puede restituir.
      </p>
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Pedir que se elimine"}
      </Button>
    </form>
  );
}

/**
 * Un administrador resuelve. Ejecutar pide ESCRIBIR EL DOCUMENTO del paciente (v12: *"no basta un «Aceptar»"*).
 *
 * EL CAMPO DEL DOCUMENTO VIVE EN EL ESTADO DE ESTA PANTALLA y el boton de ejecutar se queda apagado
 * mientras no se haya escrito nada. No es la validacion de verdad (esa compara contra la base, dentro de
 * la transaccion): es para que no se pueda pulsar el boton peligroso sin haber escrito, que es justo lo
 * que el "Aceptar" no distinguia. Un boton apagado DICE POR QUE lo esta en el texto de al lado, porque un
 * boton muerto sin explicacion es peor que un error claro.
 *
 * Y EL DOCUMENTO NO SE MUESTRA EN ESTA FILA. Es la unica decision de diseno que puede sorprender, y es
 * deliberada: si el numero estuviera al lado del campo, escribirlo seria copiarlo, y el paso dejaria de
 * comprobar nada. Quien ejecuta tiene la ficha del paciente a un clic.
 */
export function ResolverEliminaciones({ peticiones }: { peticiones: PeticionEnPantalla[] }) {
  const [state, action, pending] = useActionState(resolverEliminacionDelPacienteAction, INICIAL);
  useFormToastAndRefresh(state);
  // UNO POR PETICION: con un solo campo compartido, escribir el documento de una fila dejaria el de la
  // otra a medio llenar y se podria ejecutar la equivocada.
  const [documentos, setDocumentos] = useState<Record<string, string>>({});

  if (peticiones.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay peticiones esperando.</p>;
  }

  return (
    <ul className="flex flex-col gap-4 text-sm">
      {peticiones.map((p) => {
        const escrito = (documentos[p.patientId] ?? "").trim();
        return (
          <li key={p.patientId} className="flex flex-col gap-2 border-b pb-4">
            <span className="font-medium text-foreground">{p.nombre}</span>
            {/* EL MOTIVO COMPLETO: es lo unico con lo que se puede decidir, y por eso la base lo exige. */}
            <span className="text-muted-foreground">
              &ldquo;{p.motivo}&rdquo; · lo pidió {p.pedidoPor ?? "alguien"} el {enBogota(p.pedidoEn)}
            </span>
            <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2">
              <input type="hidden" name="patientId" value={p.patientId} />
              <div className="flex flex-col gap-1">
                <Label htmlFor={`doc-${p.patientId}`} className="text-xs">
                  Escribe el documento del paciente para eliminarlo
                </Label>
                <Input
                  id={`doc-${p.patientId}`}
                  name="documento"
                  value={documentos[p.patientId] ?? ""}
                  onChange={(e) =>
                    setDocumentos((d) => ({ ...d, [p.patientId]: e.target.value }))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-9 max-w-56"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* DOS BOTONES CON `key` DISTINTA (hazard 1) y su dato en `name`/`value`, que SOLO viaja
                    porque `enviarSinReset` pasa el submitter (hazard 5). */}
                <Button
                  key="eliminar"
                  type="submit"
                  name="confirmar"
                  value="true"
                  variant="destructive"
                  disabled={pending || escrito === ""}
                >
                  Eliminar el perfil
                </Button>
                <Button
                  key="negar"
                  type="submit"
                  name="confirmar"
                  value="false"
                  variant="ghost"
                  disabled={pending}
                >
                  No eliminarlo
                </Button>
                {escrito === "" ? (
                  <span className="text-xs text-muted-foreground">
                    Escribe el documento para poder eliminar. Negarlo no lo pide.
                  </span>
                ) : null}
              </div>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

/** Restituir al eliminado por error. Mismo permiso que ejecutar, por simetria. */
export function PacientesEliminados({
  eliminados,
}: {
  eliminados: (PeticionEnPantalla & { eliminadoEn: string; eliminadoPor: string | null })[];
}) {
  const [state, action, pending] = useActionState(restituirAlPacienteAction, INICIAL);
  useFormToastAndRefresh(state);

  if (eliminados.length === 0) {
    return <p className="text-sm text-muted-foreground">Ningún perfil eliminado.</p>;
  }

  return (
    <ul className="flex flex-col gap-4 text-sm">
      {eliminados.map((p) => (
        <li key={p.patientId} className="flex flex-col gap-2 border-b pb-4">
          <span className="font-medium text-foreground">{p.nombre}</span>
          <span className="text-muted-foreground">
            &ldquo;{p.motivo}&rdquo; · lo pidió {p.pedidoPor ?? "alguien"}; lo eliminó{" "}
            {p.eliminadoPor ?? "alguien"} el {enBogota(p.eliminadoEn)}
          </span>
          <form onSubmit={enviarSinReset(action)}>
            <input type="hidden" name="patientId" value={p.patientId} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Restituyendo..." : "Restituirlo"}
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
