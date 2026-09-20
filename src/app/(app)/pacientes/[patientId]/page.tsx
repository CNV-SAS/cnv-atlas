import { Panel } from "@/components/shared/panel";
import { Banda } from "@/components/shared/banda";
import { VolverA } from "@/components/shared/volver-a";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { ArchivarPaciente } from "@/modules/patients/components/archivar-paciente";
import { HistorialEvaluaciones } from "@/modules/patients/components/historial-evaluaciones";
import { canArchivePatient } from "@/modules/patients/policies/can-archive-patient";
import { canEditPatientContact } from "@/modules/patients/policies/can-edit-patient-contact";
import { EditarContacto } from "@/modules/patients/components/editar-contacto";
import { FollowupLinkEmitter } from "@/modules/evaluations/components/followup-link-emitter";
import {
  canAbandonEvaluation,
  canEmitFollowupLink,
} from "@/modules/evaluations/policies/can-manage-evaluations";
import { PanelAutorizaciones } from "@/modules/consent/components/panel-autorizaciones";
import { getPatientConsents } from "@/modules/consent/data/consent-reader";
import { canRevokeConsent } from "@/modules/consent/policies/can-revoke-consent";
import { getPatientDetail } from "@/modules/patients/data/patient-detail-reader";
import { formatDateOnlyShort } from "@/lib/format/date";
import { edadEnAnios } from "@/modules/patients/format";
import { estadoPacienteLabel, sexoLabel } from "@/modules/patients/labels";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";
import { PatientReferralsSection } from "@/modules/referrals/components/patient-referrals-section";
import { canRegisterReferral } from "@/modules/referrals/policies/can-register-referral";

export const metadata = { title: "Historia del paciente - Atlas" };


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
  const puedeArchivar = canArchivePatient(user);
  if (!canViewPatients(user)) redirect("/no-autorizado");

  const paciente = await getPatientDetail(patientId);
  if (!paciente) notFound();

  // Autorizaciones del paciente y la via para registrar una revocacion (CONSENT_ATLAS seccion 10). Se lee
  // DESPUES del 404: si el paciente no es suyo, no se consulta nada mas.
  const autorizaciones = await getPatientConsents(patientId);

  // Solo el profesional dueno puede cerrar un shell firmado sin responder (la RLS ya acota que sea suyo).
  const puedeCerrar = canAbandonEvaluation(user);
  const puedeEditarContacto = canEditPatientContact(user);
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
    // LA FECHA DE NACIMIENTO VA EN TARJETA, no en la banda (2026-09-19). En la banda esta la EDAD, que es
    // lo que se mira de un vistazo; la fecha exacta se CONSULTA (para cotejar identidad, o para entender
    // una edad que no cuadra), que es justo el criterio que separa las dos superficies.
    //
    // Y SE FORMATEA CON EL HELPER DE FECHA PURA: `birth_date` es una columna `date`, y pasarla por el
    // formateador con zona la retrocede un dia (alguien nacido el 1 saldria naciendo el 31 del mes anterior).
    { label: "Fecha de nacimiento", value: formatDateOnlyShort(paciente.birthDate) || "-" },
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
        volver={<VolverA padre="/pacientes" />}
        antetitulo="Paciente"
        titulo={nombre}
        bajada="Historia clínica del paciente."
        datos={identidad}
      />

      {/* ARCHIVAR / DESARCHIVAR (Santiago, 2026-09-10). Va AQUI y no en la fila de la lista: es una
          decision sobre ESTE paciente y se toma con su ficha delante, no de pasada al recorrer un roster.
          Y va DESPUES de la banda de identidad, para que quien lo pulse haya visto de quien es. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* CORREGIR EL CONTACTO va JUNTO A LAS TARJETAS que lo muestran, no en un menu: el dato que se
            corrige esta ahi mismo, y quien llega buscando por que no le llego un correo al paciente ya
            esta mirando esta zona. */}
        {puedeEditarContacto ? (
          <EditarContacto patientId={patientId} email={paciente.email} phone={paciente.phone} />
        ) : (
          <span />
        )}
        {puedeArchivar ? (
          <ArchivarPaciente patientId={patientId} archivado={paciente.status === "inactive"} />
        ) : null}
      </div>

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
        {/* LAS ABIERTAS SIEMPRE A LA VISTA Y LO DEMAS PLEGADO (observacion L, 2026-09-20). La tabla
            vivia aqui entera; se movio a su componente porque el interruptor necesita estado, y la
            clasificacion (que es historia y que es trabajo pendiente) vive aparte y es pura. */}
        <HistorialEvaluaciones evaluaciones={paciente.evaluations} puedeCerrar={puedeCerrar} />
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
