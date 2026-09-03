import Link from "next/link";
import { Panel } from "@/components/shared/panel";
import { Banda } from "@/components/shared/banda";
import { PillEstado } from "@/components/shared/pill-estado";
import { tabla, td, tdApagado, tdFuerte, tdNum, th, theadTr, thNum, tr } from "@/components/shared/tabla";
import { VolverA } from "@/components/shared/volver-a";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { AbandonEvaluation } from "@/modules/evaluations/components/abandon-evaluation";
import { FollowupLinkEmitter } from "@/modules/evaluations/components/followup-link-emitter";
import {
  canAbandonEvaluation,
  canEmitFollowupLink,
} from "@/modules/evaluations/policies/can-manage-evaluations";
import { PanelAutorizaciones } from "@/modules/consent/components/panel-autorizaciones";
import { getPatientConsents } from "@/modules/consent/data/consent-reader";
import { canRevokeConsent } from "@/modules/consent/policies/can-revoke-consent";
import { getPatientDetail } from "@/modules/patients/data/patient-detail-reader";
import { edadEnAnios, fechaCorta } from "@/modules/patients/format";
import {
  estadoEvaluacionLabel,
  estadoPacienteLabel,
  sexoLabel,
} from "@/modules/patients/labels";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";
import { PatientReferralsSection } from "@/modules/referrals/components/patient-referrals-section";
import { canRegisterReferral } from "@/modules/referrals/policies/can-register-referral";

export const metadata = { title: "Historia del paciente - Atlas" };

const TIPO_LABEL: Record<string, string> = {
  inicial: "Inicial",
  seguimiento: "Seguimiento",
};

// Historia del paciente: identidad, contacto y linea de tiempo de sus evaluaciones.
// La policy gobierna el rol (regla 3); el alcance fino (que sea su paciente) lo impone la
// RLS en el reader: si no es suyo, getPatientDetail devuelve null -> 404.
export default async function HistoriaPacientePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const user = await requireUser();
  if (!canViewPatients(user)) redirect("/no-autorizado");

  const paciente = await getPatientDetail(patientId);
  if (!paciente) notFound();

  // Autorizaciones del paciente y la via para registrar una revocacion (CONSENT_ATLAS seccion 10). Se lee
  // DESPUES del 404: si el paciente no es suyo, no se consulta nada mas.
  const autorizaciones = await getPatientConsents(patientId);

  // Solo el profesional dueno puede cerrar un shell firmado sin responder (la RLS ya acota que sea suyo).
  const puedeCerrar = canAbandonEvaluation(user);
  // Emitir link de seguimiento: sitio FIJO en el perfil (antes vivia en la tarjeta de confirmar identidad,
  // que desaparece al confirmar; Santiago 2026-08-20 §5a). El action re-resuelve el profesional asignado.
  const puedeEmitirSeguimiento = canEmitFollowupLink(user);

  const anos = edadEnAnios(paciente.birthDate);
  const nombre = `${paciente.firstName} ${paciente.lastName}`.trim() || "Sin nombre";
  // LOS CUATRO DE IDENTIDAD SUBEN A LA BANDA (2026-09-03). Son los que dicen DE QUIEN es esta pantalla y
  // no cambian de una consulta a otra; en la banda estan donde el ojo ya esta y dejan de gastar cuatro
  // tarjetas. Ninguno es clinico, que es la condicion para que puedan ir sobre el degradado.
  const identidad: { rotulo: string; valor: string }[] = [
    { rotulo: "Documento", valor: `${paciente.documentType} ${paciente.documentNumber}`.trim() },
    { rotulo: "Edad", valor: anos === null ? "-" : `${anos} años` },
    { rotulo: "Sexo", valor: sexoLabel(paciente.sex) },
    {
      rotulo: "Ubicación",
      valor: [paciente.city, paciente.country].filter(Boolean).join(", ") || "-",
    },
  ];
  // El resto sigue en tarjetas: son datos de CONTACTO y de caracterizacion, que se consultan cuando hacen
  // falta y no identifican al paciente de un vistazo.
  const datos: { label: string; value: string }[] = [
    { label: "Correo", value: paciente.email ?? "-" },
    { label: "Teléfono", value: paciente.phone ?? "-" },
    { label: "Estado", value: estadoPacienteLabel(paciente.status) },
    // Caracterizacion sociodemografica (E1): opcional, "-" cuando el paciente no la dio.
    { label: "Nivel educativo", value: paciente.educationLevel ?? "-" },
    { label: "Ocupación", value: paciente.occupation ?? "-" },
    { label: "Estado civil", value: paciente.maritalStatus ?? "-" },
    { label: "Estrato", value: paciente.socioeconomicStratum ?? "-" },
    // Etnia / grupo poblacional (una sola pregunta, §3 del 2026-08-20 v2): solo si el paciente la informo
    // (requirio autorizacion de investigacion). "-" si no. La ascendencia se retiro (ya no se captura).
    { label: "Etnia / grupo poblacional", value: paciente.ethnicity ?? "-" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
      {/* BANDA, no encabezado plano: es una de las dos pantallas donde se gana el sitio, porque aqui la
          cabecera tiene que cargar IDENTIDAD (ver `banda.tsx`). */}
      <Banda
        volver={<VolverA href="/pacientes">Volver a pacientes</VolverA>}
        antetitulo="Paciente"
        titulo={nombre}
        bajada="Historia clínica del paciente."
        datos={identidad}
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {datos.map((d) => (
          <div key={d.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</span>
            <span className="text-sm font-medium text-foreground">{d.value}</span>
          </div>
        ))}
      </section>

      {puedeEmitirSeguimiento ? (
        <Panel titulo="Seguimiento">
          <p className="text-sm text-muted-foreground">
            Emite un enlace para que el paciente responda una encuesta de seguimiento. Su identidad ya está
            registrada.
          </p>
          <FollowupLinkEmitter patientId={patientId} />
        </Panel>
      ) : null}

      <Panel titulo="Evaluaciones">
        {paciente.evaluations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Este paciente todavía no tiene evaluaciones.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            {/* DECORACION COMPARTIDA (2026-09-03): las clases salen de `components/shared/tabla`. */}
            <table className={`${tabla} min-w-[560px] text-left`}>
              <thead>
                <tr className={theadTr}>
                  {/* LA FECHA VA PRIMERO, y no es cosmetico: esta tabla existe para leer la TRAYECTORIA
                      del paciente, y una trayectoria se recorre por fecha. El tipo (inicial o
                      seguimiento) califica cada hito, asi que va despues. */}
                  <th className={th}>Fecha</th>
                  <th className={th}>Tipo</th>
                  <th className={th}>Motivo</th>
                  <th className={th}>Estado</th>
                  <th className={thNum}>Resultados</th>
                </tr>
              </thead>
              <tbody>
                {paciente.evaluations.map((e) => (
                  <tr key={e.evaluationId} className={tr}>
                    {/* LA NEGRITA VA EN LA FECHA, y es la unica de la tabla: es por donde se recorre.
                        Fecha de MEDICION (cronologia clinica), no la de creacion del registro. */}
                    <td className={`${tdFuerte} whitespace-nowrap`}>
                      {fechaCorta(e.measurementDate ?? e.createdAt)}
                    </td>
                    <td className={td}>
                      {TIPO_LABEL[e.type] ?? e.type}
                      {/* CHIP SOLO SI ES EXCEPCIONAL: una evaluacion vigente no lleva distintivo; una
                          reemplazada si, porque cambia como se lee todo lo que hay en su fila. */}
                      {e.superseded ? (
                        <PillEstado tono="neutro" className="ml-2 font-normal">
                          reemplazada
                        </PillEstado>
                      ) : null}
                    </td>
                    {/* Motivo de consulta (caracterizacion del encuentro, multi); "-" si no se dio. */}
                    <td className={tdApagado}>
                      {e.reasonForVisit.length ? e.reasonForVisit.join(", ") : "-"}
                    </td>
                    <td className={tdApagado}>{estadoEvaluacionLabel(e.status)}</td>
                    <td className={tdNum}>
                      {/* Segun estado: firmada sin responder -> cerrar (si es su profesional); cerrada ->
                          rotulo sin accion; el resto -> ver resultados. Un shell no tiene resultados que ver. */}
                      {e.status === "awaiting_survey" ? (
                        puedeCerrar ? (
                          <AbandonEvaluation evaluationId={e.evaluationId} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Esperando la encuesta</span>
                        )
                      ) : e.status === "abandoned" ? (
                        <span className="text-xs text-muted-foreground">Cerrada</span>
                      ) : (
                        <Link
                          href={`/evaluaciones/${e.evaluationId}`}
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Ver resultados
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <PanelAutorizaciones
        patientId={patientId}
        autorizaciones={autorizaciones}
        puedeRevocar={canRevokeConsent(user)}
      />

      <PatientReferralsSection patientId={patientId} canMarkReturn={canRegisterReferral(user)} />
    </div>
  );
}
