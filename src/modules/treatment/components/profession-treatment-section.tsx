import type { ReactNode } from "react";

import type { RutaContent } from "@/clinical-engine/rutas-content";

import type { ActorProfession } from "../data/actor-profession-reader";
import { getCelularBadgesForEvaluation } from "../data/celular-badges-reader";
import { getMedicoEjercicioForEvaluation } from "../data/medico-ejercicio-treatment-reader";
import { getPsicoTreatmentForEvaluation } from "../data/psico-treatment-reader";
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

// Lista simple con titulo, a nivel de modulo (no dentro de un componente): render de enfoque/temas/
// remision del tamizaje psicologico. null si no hay items.
function PsicoList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="ml-4 list-disc text-sm text-foreground">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

// Linea de alcance por especialidad (ajuste 1): no prometer de mas ni de menos. Nombra lo unico que el
// profesional SI puede escribir hoy (una nota de criterio en el diagnostico) y lo que NO existe aun.
const SCOPE_MEDICO =
  "Esta vista es de consulta. Hoy puedes registrar tu criterio clínico como nota en la pestaña " +
  "Diagnóstico; los exámenes que ordenes y tu conducta clínica se registran por fuera de Atlas. El " +
  "modelo SÍ tiene contenido de medicina para este paciente (metas, monitoreo, interacciones " +
  "fármaco-nutriente); su visualización aquí está en construcción.";
const SCOPE_EJERCICIO =
  "Esta vista es de consulta. Hoy puedes registrar tu criterio clínico como nota en la pestaña " +
  "Diagnóstico; la prescripción de ejercicio que indiques se registra por fuera de Atlas. El modelo " +
  "SÍ tiene contenido de ejercicio para este paciente (tamizaje ACSM, FITT, énfasis); su " +
  "visualización aquí está en construcción.";

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-prose text-sm text-muted-foreground">{children}</p>
    </section>
  );
}

async function Panel({
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
  // Badges de salud celular (Nivel III): se leen server-side de los crudos BIS (misma fuente que la
  // composicion de Diagnostico) y se pasan al panel client. null si no hay medicion BIS.
  const celular = await getCelularBadgesForEvaluation(evaluationId);
  return <TreatmentPanel evaluationId={evaluationId} protocol={protocol} celular={celular} />;
}

// Panel de tratamiento psicologico: corre el motor congelado (solo encuesta) y muestra su salida,
// PROFESIONAL-FACING (nada al paciente). Solo lectura; no prescribe ni sella.
async function PsicoPanel({ evaluationId }: { evaluationId: string }) {
  const p = await getPsicoTreatmentForEvaluation(evaluationId);
  if (!p) {
    return (
      <Notice title="Consulta de Psicología">
        El tamizaje psicológico aparece cuando el paciente completó la encuesta. Puedes consultar el
        análisis en la pestaña Diagnóstico, y las rutas y remisiones aquí mismo.
      </Notice>
    );
  }
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-6">
      <h3 className="text-base font-semibold text-foreground">Consulta de Psicología</h3>
      {p.salvaguarda ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {p.salvaguarda}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tamizaje</h4>
        <ul className="ml-4 list-disc text-sm text-foreground">
          {p.tamizaje.map((t, i) => (
            <li key={i}>
              <span className="font-medium">{t.inst}: </span>
              <span className="text-muted-foreground">{t.res}</span>
            </li>
          ))}
        </ul>
      </div>
      <PsicoList title="Enfoque" items={p.enfoque} />
      <PsicoList title="Temas a trabajar" items={p.temas} />
      <PsicoList title="Remisión" items={p.remision} />
      <p className="text-xs text-muted-foreground">
        Tamizaje del modelo, para tu criterio. No constituye diagnóstico y no se muestra al paciente.
      </p>
    </section>
  );
}

// Aviso de "no se pudo evaluar" (misma distincion que las badges): cuando el diagnostico se emitio
// antes de sellar ASMI, el criterio de sarcopenia por masa apendicular no se evaluo. Dice el PORQUE.
function AsmiCaveat() {
  return (
    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      La evaluación de sarcopenia por masa muscular apendicular no está disponible: este diagnóstico se
      emitió antes de que ese dato se registrara. El resto del protocolo se calcula con normalidad.
    </p>
  );
}

// Salida de un motor de tratamiento (medico/ejercicio): titulo + aviso de ASMI (si falta) + listas.
function MotorSection({
  title,
  asmiAvailable,
  lists,
  children,
}: {
  title: string;
  asmiAvailable: boolean;
  lists: [string, string[]][];
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {asmiAvailable ? null : <AsmiCaveat />}
      {children}
      {lists.map(([t, items]) => (
        <PsicoList key={t} title={t} items={items} />
      ))}
      <p className="text-xs text-muted-foreground">
        Protocolo del modelo, para tu criterio. No constituye diagnóstico y no se muestra al paciente.
      </p>
    </section>
  );
}

async function MedicoSection({
  evaluationId,
  abordaje,
  rutas,
  protocol,
}: {
  evaluationId: string;
  abordaje: string | null;
  rutas: RutaContent[];
  protocol: TreatmentProtocol | null;
}) {
  const t = await getMedicoEjercicioForEvaluation(evaluationId);
  return (
    <div className="flex flex-col gap-4">
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
      {t ? (
        <MotorSection
          title="Protocolo médico del modelo"
          asmiAvailable={t.asmiAvailable}
          lists={[
            ["Metas", t.medico.metas],
            ["Monitoreo", t.medico.monitoreo],
            ["Remisión", t.medico.remision],
            ["Interacciones fármaco-nutriente", t.medico.medNotas],
          ]}
        />
      ) : null}
    </div>
  );
}

async function EjercicioSection({
  evaluationId,
  abordaje,
  rutas,
}: {
  evaluationId: string;
  abordaje: string | null;
  rutas: RutaContent[];
}) {
  const t = await getMedicoEjercicioForEvaluation(evaluationId);
  return (
    <div className="flex flex-col gap-4">
      <ConsultationSection
        title="Consulta de Ejercicio"
        scope={SCOPE_EJERCICIO}
        abordaje={abordaje}
        rutaBlocksTitle="Indicaciones de ejercicio por ruta activa"
        rutaBlocks={professionRutaBlocks("ejercicio", rutas)}
      />
      {t ? (
        <MotorSection
          title="Prescripción de ejercicio del modelo"
          asmiAvailable={t.asmiAvailable}
          lists={[["Énfasis", t.ejercicio.enfasis]]}
        >
          <p className="text-sm text-foreground">{t.ejercicio.clearance}</p>
          <p className="text-sm text-muted-foreground">
            Factor de actividad recomendado: <span className="font-medium text-foreground">{t.ejercicio.faRec}</span>.
            FITT: {t.ejercicio.fitt.frecuencia}, {t.ejercicio.fitt.intensidad}, {t.ejercicio.fitt.tiempo},{" "}
            {t.ejercicio.fitt.tipo}.
          </p>
        </MotorSection>
      ) : null}
    </div>
  );
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
    return <MedicoSection evaluationId={evaluationId} abordaje={abordaje} rutas={rutas} protocol={protocol} />;
  }

  // Deportologo: consulta + prescripcion del motor de ejercicio (D-008). Sin examenes ni suplementacion
  // (son contenido medico).
  if (actor.isProfessional && actor.profession === "deportologo") {
    return <EjercicioSection evaluationId={evaluationId} abordaje={abordaje} rutas={rutas} />;
  }

  // Psicologo: motor de tratamiento portado (D-008) y cableado display-only (no usa bis, no sella nada).
  if (actor.isProfessional && actor.profession === "psicologo") {
    return <PsicoPanel evaluationId={evaluationId} />;
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
