"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { agregarRolFormAction, quitarRolFormAction } from "../admin-actions";
import type { AdminFormState } from "../admin-validations";

// ═══ LOS ROLES DE UN INTEGRANTE QUE YA EXISTE (Santiago, 2026-10-24) ═══
//
// POR QUÉ AQUÍ: esta es la pantalla donde admin mira a una persona, así que es donde se decide qué puede
// ver. `user_roles` es N:N desde el principio, pero solo se escribía al crear la cuenta y con un rol: el
// modelo admitía dos y el sistema no tenía forma de dar el segundo.
//
// Y EL ROL ES DEL USUARIO, no del perfil profesional. Son dos identificadores distintos y confundirlos
// escribiría la fila con la llave equivocada, así que el que viaja es `usuarioId`.

const inicial: AdminFormState = { error: null, success: null };

/** Los roles que tiene sentido añadir desde aquí, con lo que cada uno abre. */
const ROLES: { nombre: string; rotulo: string; queAbre: string }[] = [
  { nombre: "obbia", rotulo: "Investigación", queAbre: "el panel de investigación (cifras agregadas, sin datos del paciente)" },
  { nombre: "direccion", rotulo: "Dirección", queAbre: "las cifras de la organización" },
  { nombre: "soporte", rotulo: "Soporte", queAbre: "las herramientas de soporte" },
  { nombre: "admin", rotulo: "Admin", queAbre: "todo, incluidas las historias clínicas de todos" },
];

const ROTULO: Record<string, string> = {
  professional: "Profesional",
  obbia: "Investigación",
  direccion: "Dirección",
  soporte: "Soporte",
  admin: "Admin",
};

function Agregar({ usuarioId, rol, rotulo }: { usuarioId: string; rol: string; rotulo: string }) {
  const [state, action, pending] = useActionState(agregarRolFormAction, inicial);
  useFormToastAndRefresh({ ...state, warning: null });
  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="userId" value={usuarioId} />
      {/* EL ROL VA EN UN CAMPO OCULTO, NO EN EL `value` DEL BOTÓN: con un envío propio el `name`/`value`
          del botón no viaja (hazard 5), y el servidor recibiría un rol vacío. */}
      <input type="hidden" name="rol" value={rol} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Asignando..." : `Dar ${rotulo}`}
      </Button>
    </form>
  );
}

function Quitar({ usuarioId, rol, rotulo }: { usuarioId: string; rol: string; rotulo: string }) {
  const [state, action, pending] = useActionState(quitarRolFormAction, inicial);
  useFormToastAndRefresh({ ...state, warning: null });
  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="userId" value={usuarioId} />
      <input type="hidden" name="rol" value={rol} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Quitando..." : `Quitar ${rotulo}`}
      </Button>
    </form>
  );
}

export function RolesDelIntegrante({
  usuarioId,
  nombre,
  roles,
}: {
  usuarioId: string;
  nombre: string;
  roles: string[];
}) {
  const faltantes = ROLES.filter((r) => !roles.includes(r.nombre));

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">Lo que puede ver</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Una persona puede tener <strong className="text-foreground">más de un rol</strong>, y los dos
          valen a la vez: quien es profesional y de investigación sigue viendo a sus pacientes como
          profesional, y el panel de investigación no le abre ninguna historia clínica que no sea suya.
          Cada cambio queda registrado con quién lo hizo, y tiene efecto cuando {nombre.split(" ")[0]}{" "}
          vuelva a entrar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {roles.length === 0 ? (
          <span className="text-sm text-muted-foreground">No tiene ningún rol.</span>
        ) : (
          roles.map((r) => (
            <span
              key={r}
              className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {ROTULO[r] ?? r}
              {/* EL ÚLTIMO ROL NO SE PUEDE QUITAR, y el servidor lo frena con su razón. Aquí no se
                  esconde el botón: esconderlo dejaría sin explicar por qué no se puede, que es lo que
                  alguien necesita saber (para dar de baja a una persona se desactiva la cuenta). */}
            </span>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {faltantes.map((r) => (
          <Agregar key={r.nombre} usuarioId={usuarioId} rol={r.nombre} rotulo={r.rotulo} />
        ))}
        {roles
          .filter((r) => r !== "professional")
          .map((r) => (
            <Quitar key={r} usuarioId={usuarioId} rol={r} rotulo={ROTULO[r] ?? r} />
          ))}
      </div>

      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {faltantes.map((r) => (
          <li key={r.nombre}>
            <strong className="text-foreground">{r.rotulo}</strong> abre {r.queAbre}.
          </li>
        ))}
      </ul>
    </section>
  );
}
