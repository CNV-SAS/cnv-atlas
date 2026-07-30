import type { ReactNode } from "react";

import type { ActorProfession } from "../data/actor-profession-reader";
import type { TreatmentProtocol } from "../data/treatment-reader";
import { TreatmentPanel } from "./treatment-panel";

// B1 (T2b): area de tratamiento POR PROFESION. La parte comun (rutas de atencion + remisiones) va
// aparte, arriba, siempre visible (la ensambla la pagina); aqui va SOLO la seccion de la
// especialidad. NO hay barra de subpestanas a proposito: hoy solo existe el contenido de
// nutricionista y cada profesional ve UNA sola seccion (la suya), asi que una barra con un unico
// destino se veria rota, no incompleta. La barra se justifica cuando existan varios contenidos Y
// alguien que pueda ver mas de uno (p. ej. admin en solo-lectura); ninguna se cumple hoy. Este
// switch por profesion ES la estructura extensible: sumar la seccion medica/psico/ejercicio cuando
// lleguen sus motores es agregar una rama, sin rehacer nada ni tocar la pagina.

const PROFESSION_LABEL: Record<string, string> = {
  medico: "Medicina",
  psicologo: "Psicología",
  deportologo: "Deportología",
  nutricionista: "Nutrición",
};

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-prose text-sm text-muted-foreground">{children}</p>
    </section>
  );
}

function Panel({
  evaluationId,
  protocol,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol | null;
}) {
  if (!protocol) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium text-foreground">Tratamiento</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          El protocolo aparece cuando el diagnóstico está generado.
        </p>
      </div>
    );
  }
  return <TreatmentPanel evaluationId={evaluationId} protocol={protocol} />;
}

export function ProfessionTreatmentSection({
  evaluationId,
  actor,
  protocol,
}: {
  evaluationId: string;
  actor: ActorProfession;
  protocol: TreatmentProtocol | null;
}) {
  // Profesional con especialidad cuyo contenido aun no existe en Atlas: mensaje HONESTO (puede
  // consultar el analisis + rutas/remisiones; su protocolo llega despues), no "en construccion" a
  // secas (eso le diria que Atlas no le sirve, sin decirle que si le sirve para lo que ya existe).
  if (
    actor.isProfessional &&
    (actor.profession === "medico" ||
      actor.profession === "psicologo" ||
      actor.profession === "deportologo")
  ) {
    const label = PROFESSION_LABEL[actor.profession];
    return (
      <Notice title={`Protocolo de ${label}`}>
        El protocolo de {label.toLowerCase()} todavía no está disponible en Atlas. Puedes consultar el
        análisis del paciente en la pestaña Diagnóstico, y las rutas de atención y las remisiones aquí
        mismo. El protocolo de tu especialidad llega en una próxima entrega.
      </Notice>
    );
  }

  // Profesional sin profesion configurada (estado de DEFECTO, no un modo soportado; ver BACKLOG,
  // captura de profesion al invitar). No trabaja el tratamiento hasta que el admin la configure; es
  // lo mismo que impone el guard de accion (require-profession), dicho en pantalla.
  if (actor.isProfessional && !actor.profession) {
    return (
      <Notice title="Profesión no configurada">
        Tu profesión no está configurada en tu perfil, por eso no puedes trabajar el protocolo de
        tratamiento. Contacta al administrador para que la configure. Mientras tanto, puedes consultar
        el análisis del paciente en la pestaña Diagnóstico, y las rutas de atención y las remisiones
        aquí mismo.
      </Notice>
    );
  }

  // Nutricionista (unico contenido que existe hoy) y actor SIN perfil profesional (admin): el acceso
  // de admin al tratamiento es gobernanza aparte (BACKLOG); aqui se conserva como estaba, ni se
  // amplia ni se recorta.
  return <Panel evaluationId={evaluationId} protocol={protocol} />;
}
