import type { ReactNode } from "react";

import type { RutaContent } from "@/clinical-engine/rutas-content";

import type { ActorProfession } from "../data/actor-profession-reader";
import type { TreatmentProtocol } from "../data/treatment-reader";
import { professionRutaBlocks } from "../services/consultation-content";
import { ConsultationSection } from "./consultation-section";
import { TreatmentPanel } from "./treatment-panel";

// B1 (T2b): area de tratamiento POR PROFESION. La parte comun (estado del paciente + rutas de atencion
// + remisiones) va aparte, arriba, siempre visible (la ensambla la pagina); aqui va SOLO la seccion de
// la especialidad. NO hay barra de subpestanas a proposito: cada profesional ve UNA sola seccion (la
// suya). Este switch por profesion ES la estructura extensible: sumar una especialidad es agregar una
// rama.
//
// Nutricionista: workspace de prescripcion editable (TreatmentPanel). Medico y deportologo: panel de
// CONSULTA de solo lectura (ConsultationSection): su motor de prescripcion no existe en Atlas todavia
// y las escrituras de prescripcion son de nutricionista (guard require-profession). Psicologo: aviso
// honesto (su contenido llega despues). Cada panel de consulta dice su alcance en tamano de cuerpo:
// que SI puede hacer hoy (registrar criterio en Diagnostico) y que NO (prescribir aqui).

const PROFESSION_LABEL: Record<string, string> = {
  medico: "Medicina",
  psicologo: "Psicología",
  deportologo: "Deportología",
  nutricionista: "Nutrición",
};

// Linea de alcance por especialidad (ajuste 1): no prometer de mas ni de menos. Nombra lo unico que el
// profesional SI puede escribir hoy (una nota de criterio en el diagnostico) y lo que NO existe aun.
const SCOPE_MEDICO =
  "Esta vista es de consulta. Hoy puedes registrar tu criterio clínico como nota en la pestaña " +
  "Diagnóstico; los exámenes que ordenes y tu conducta clínica se registran por fuera de Atlas. El " +
  "módulo de prescripción médica (ordenar exámenes con registro y documentar la intervención) llega " +
  "en una entrega posterior.";
const SCOPE_EJERCICIO =
  "Esta vista es de consulta. Hoy puedes registrar tu criterio clínico como nota en la pestaña " +
  "Diagnóstico; la prescripción de ejercicio que indiques se registra por fuera de Atlas. El módulo " +
  "de prescripción de ejercicio llega en una entrega posterior.";

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
  abordaje,
  rutas,
}: {
  evaluationId: string;
  actor: ActorProfession;
  protocol: TreatmentProtocol | null;
  // Abordaje del rol del actor (efrProf), computado en la pagina; null si el snapshot es incompatible.
  abordaje: string | null;
  rutas: RutaContent[];
}) {
  // Medico: panel de consulta con abordaje + indicaciones medicas de las rutas + examenes/suplementacion
  // (del protocolo sellado; si aun no hay protocolo, se dice). El contenido medico de las rutas trae que
  // hacer, no solo "a quien remitir", por eso se trae al panel (ajuste 3).
  if (actor.isProfessional && actor.profession === "medico") {
    return (
      <ConsultationSection
        title="Consulta de Medicina"
        scope={SCOPE_MEDICO}
        abordaje={abordaje}
        rutaBlocksTitle="Indicaciones médicas por ruta activa"
        rutaBlocks={professionRutaBlocks("medico", rutas)}
        examenes={protocol?.protocolSuggested?.examenes ?? []}
        suplementacion={protocol?.protocolSuggested?.suplementacion ?? []}
        protocolPending={!protocol?.protocolSuggested}
      />
    );
  }

  // Deportologo: panel de consulta con abordaje + indicaciones de ejercicio de las rutas. Sin examenes
  // ni suplementacion (son contenido medico).
  if (actor.isProfessional && actor.profession === "deportologo") {
    return (
      <ConsultationSection
        title="Consulta de Ejercicio"
        scope={SCOPE_EJERCICIO}
        abordaje={abordaje}
        rutaBlocksTitle="Indicaciones de ejercicio por ruta activa"
        rutaBlocks={professionRutaBlocks("ejercicio", rutas)}
      />
    );
  }

  // Psicologo: contenido aun no disponible. Mensaje HONESTO (puede consultar el analisis + rutas/
  // remisiones; su protocolo llega despues), no "en construccion" a secas.
  if (actor.isProfessional && actor.profession === "psicologo") {
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

  // Nutricionista (workspace de prescripcion editable) y actor SIN perfil profesional (admin): el
  // acceso de admin al tratamiento es gobernanza aparte (BACKLOG); aqui se conserva como estaba.
  return <Panel evaluationId={evaluationId} protocol={protocol} />;
}
