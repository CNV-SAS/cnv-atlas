"use client";

import { useActionState } from "react";

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
  nombre: string;
  motivo: string;
  pedidoEn: string;
  pedidoPor: string | null;
};

/** La peticion MAS lo que deja de contar si se aprueba. La forma se declara aqui, no se importa del
 *  writer: ese es `server-only` y traerse su tipo desde un componente cliente es la arista que CLAUDE.md
 *  nombra (un `import type` tsc lo borra sin reportar). */
export type PeticionConConsecuenciasEnPantalla = PeticionEnPantalla & {
  diagnosticadas: number;
  informesEnviados: number;
  enLaCohorte: number;
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
 * Un administrador resuelve: dos botones, Aprobar y Rechazar.
 *
 * ═══ EL DOCUMENTO TECLEADO SALIO EL 2026-11-05 (Santiago) ═══
 *
 * *"Fuera la cedula tecleada: era para un acto irreversible, y este se deshace. La bandeja queda con dos
 * botones: Aprobar y Rechazar."*
 *
 * La pieza venia de v12 (*"no basta un «Aceptar»: hay que escribir el numero de documento"*) y su
 * argumento tenia un supuesto que en Atlas es falso: aqui eliminar no borra nada y `restituirAlPaciente`
 * lo deshace. El porque entero esta en el writer, que es donde vivia la comprobacion.
 *
 * LO QUE SE VA CON EL CAMPO: el estado por peticion, el boton apagado y su linea de explicacion. Con dos
 * botones simetricos no hay boton apagado que explicar, que es la forma mas simple de cumplir el hazard 8.
 */
/**
 * LO QUE DEJA DE CONTAR, EN UNA LINEA  ·  Santiago, 2026-11-08
 *
 * *"Que quien aprueba vea cuantos diagnosticos sellados, informes enviados y consultas en la cohorte de
 * investigacion tiene ese paciente."*
 *
 * Y la razon de fondo: aprobar no borra nada, pero esas consultas salen de las pantallas y de la cohorte,
 * o sea que el "n" de un articulo cambia por un acto administrativo. Sin esta linea, quien aprueba lo
 * decide sin verlo, y despues no hay forma de saber que se movio ni cuando.
 *
 * SIN CIFRAS NO SE CALLA: "ninguna consulta diagnosticada" es un dato (es el caso facil, y el que casi
 * siempre explica la peticion), y un hueco se leeria como que no se pudo averiguar.
 */
function LoQueDejaDeContar({ p }: { p: PeticionConConsecuenciasEnPantalla }) {
  const nada = p.diagnosticadas === 0 && p.informesEnviados === 0 && p.enLaCohorte === 0;
  if (nada) {
    return (
      <span className="text-xs text-muted-foreground">
        No tiene consultas diagnosticadas, ni informes enviados, ni consultas en la cohorte de
        investigación.
      </span>
    );
  }
  const partes = [
    `${p.diagnosticadas} ${p.diagnosticadas === 1 ? "consulta diagnosticada" : "consultas diagnosticadas"}`,
    `${p.informesEnviados} ${p.informesEnviados === 1 ? "informe enviado" : "informes enviados"}`,
    `${p.enLaCohorte} en la cohorte de investigación`,
  ];
  return (
    <span className="text-xs text-clinical-warning">
      Si lo apruebas: {partes.join(" · ")}. Nada de eso se borra (la historia clínica se conserva 15
      años), pero sale de las pantallas y de la cohorte hasta que se restituya.
    </span>
  );
}

export function ResolverEliminaciones({
  peticiones,
}: {
  peticiones: PeticionConConsecuenciasEnPantalla[];
}) {
  const [state, action, pending] = useActionState(resolverEliminacionDelPacienteAction, INICIAL);
  useFormToastAndRefresh(state);

  if (peticiones.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay peticiones esperando.</p>;
  }

  return (
    <ul className="flex flex-col gap-4 text-sm">
      {peticiones.map((p) => (
        <li key={p.patientId} className="flex flex-col gap-2 border-b pb-4">
          <span className="font-medium text-foreground">{p.nombre}</span>
          {/* EL MOTIVO COMPLETO: es lo unico con lo que se puede decidir, y por eso la base lo exige. */}
          <span className="text-muted-foreground">
            &ldquo;{p.motivo}&rdquo; · lo pidió {p.pedidoPor ?? "alguien"} el {enBogota(p.pedidoEn)}
          </span>
          <LoQueDejaDeContar p={p} />
          <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="patientId" value={p.patientId} />
            {/* DOS BOTONES CON `key` DISTINTA (hazard 1) y su dato en `name`/`value`, que SOLO viaja
                porque `enviarSinReset` pasa el submitter (hazard 5). */}
            {/* APROBAR NO ES `destructive`: lo que hace es sacar el perfil de las pantallas, y la historia
                clinica se conserva por ley. El rojo diria que algo se pierde. Es el mismo criterio con el
                que el boton de reemplazar la medicion dejo de ser rojo el mismo dia. */}
            <Button key="aprobar" type="submit" name="confirmar" value="true" disabled={pending}>
              Aprobar
            </Button>
            <Button
              key="rechazar"
              type="submit"
              name="confirmar"
              value="false"
              variant="outline"
              disabled={pending}
            >
              Rechazar
            </Button>
            {/* QUE HACE CADA UNO, en una linea: "Aprobar" y "Rechazar" solos no dicen sobre que. */}
            <span className="text-xs text-muted-foreground">
              Aprobar lo saca de todas las pantallas; su historia clínica se conserva y se puede
              restituir. Rechazar deja todo como está.
            </span>
          </form>
        </li>
      ))}
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
