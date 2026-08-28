import Link from "next/link";
import { TituloPantalla, TituloSeccion } from "@/components/shared/titulo-pantalla";
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
  const datos: { label: string; value: string }[] = [
    { label: "Documento", value: `${paciente.documentType} ${paciente.documentNumber}`.trim() },
    { label: "Edad", value: anos === null ? "-" : `${anos} años` },
    { label: "Sexo", value: sexoLabel(paciente.sex) },
    {
      label: "Ubicación",
      value: [paciente.city, paciente.country].filter(Boolean).join(", ") || "-",
    },
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
    <div className="flex flex-col gap-8">
      <TituloPantalla
        volver={<VolverA href="/pacientes">Volver a pacientes</VolverA>}
        titulo={nombre}
        descripcion="Historia clínica del paciente."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {datos.map((d) => (
          <div key={d.label} className="flex flex-col gap-1 rounded-xl border border-border p-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</span>
            <span className="text-sm font-medium text-foreground">{d.value}</span>
          </div>
        ))}
      </section>

      {puedeEmitirSeguimiento ? (
        <section className="flex flex-col gap-3">
          <TituloSeccion>Seguimiento</TituloSeccion>
          <p className="text-sm text-muted-foreground">
            Emite un enlace para que el paciente responda una encuesta de seguimiento. Su identidad ya está
            registrada.
          </p>
          <FollowupLinkEmitter patientId={patientId} />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <TituloSeccion>Evaluaciones</TituloSeccion>
        {paciente.evaluations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Este paciente todavía no tiene evaluaciones.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Motivo</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 text-right font-semibold">Resultados</th>
                </tr>
              </thead>
              <tbody>
                {paciente.evaluations.map((e) => (
                  <tr key={e.evaluationId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {TIPO_LABEL[e.type] ?? e.type}
                      {e.superseded ? (
                        <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          reemplazada
                        </span>
                      ) : null}
                    </td>
                    {/* Fecha de MEDICION (cronologia clinica), no la de creacion del registro. */}
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {fechaCorta(e.measurementDate ?? e.createdAt)}
                    </td>
                    {/* Motivo de consulta (caracterizacion del encuentro, multi); "-" si no se dio. */}
                    <td className="px-3 py-2 text-muted-foreground">
                      {e.reasonForVisit.length ? e.reasonForVisit.join(", ") : "-"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {estadoEvaluacionLabel(e.status)}
                    </td>
                    <td className="px-3 py-2 text-right">
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
      </section>

      <PanelAutorizaciones
        patientId={patientId}
        autorizaciones={autorizaciones}
        puedeRevocar={canRevokeConsent(user)}
      />

      <PatientReferralsSection patientId={patientId} canMarkReturn={canRegisterReferral(user)} />
    </div>
  );
}
