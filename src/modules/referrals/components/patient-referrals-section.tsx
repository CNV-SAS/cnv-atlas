import { Panel } from "@/components/shared/panel";
import { formatDateShort } from "@/lib/format/date";

import { listPatientReferrals, type PatientReferral } from "../data/referrals-reader";
import type { ReferralTargetValue } from "../validations";
import { MarkReturnForm } from "./mark-return-form";

export const REFERRAL_TARGET_LABEL: Record<ReferralTargetValue, string> = {
  medico: "Médico",
  psicologo: "Psicólogo/a",
  deportologo: "Deportólogo/a",
  nutricionista: "Nutricionista",
  otro: "Otro",
};

function targetLabel(r: PatientReferral): string {
  return r.referredTo === "otro" ? (r.referredToOther ?? "Otro") : REFERRAL_TARGET_LABEL[r.referredTo];
}

// Cuánto lleva PENDIENTE (referredAt -> ahora). Una remisión de hace meses sin retorno dice algo. El
// max(0, ...) evita que una fecha por accidente igual o adelantada muestre un valor raro (las futuras ya
// se rechazan al registrar; esto es defensa por si un dato viejo la trae): nunca menos de "hoy".
function pendingLabel(referredAt: string, nowMs: number): string {
  const days = Math.max(0, Math.floor((nowMs - new Date(referredAt).getTime()) / 86_400_000));
  if (days < 1) return "hoy";
  if (days < 30) return `pendiente hace ${days} día${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  return `pendiente hace ${months} mes${months === 1 ? "" : "es"}`;
}

// De qué consulta salió la remisión (item de smoke): con varias consultas y remisiones, sin esto la lista
// no se lee. null si el embed no resolvió (dato viejo): se omite la línea en vez de mostrar vacío.
function sourceLabel(r: PatientReferral): string | null {
  if (!r.sourceEvaluationType || !r.sourceEvaluationDate) return null;
  const tipo = r.sourceEvaluationType === "inicial" ? "evaluación inicial" : "consulta de seguimiento";
  const fecha = formatDateShort(r.sourceEvaluationDate);
  return `De la ${tipo} del ${fecha}`;
}

// Remisiones del paciente (D-009). Distingue PENDIENTES (sin retorno, siguen abiertas) de CERRADAS (con
// retorno, historia): si se vieran iguales, el profesional no sabría a quién tiene pendiente de volver.
// El retorno lo puede marcar cualquier profesional asignado al paciente ahora (no solo el que remitió).
export async function PatientReferralsSection({
  patientId,
  canMarkReturn,
}: {
  patientId: string;
  canMarkReturn: boolean;
}) {
  const referrals = await listPatientReferrals(patientId);
  // Date.now es "impuro" para la regla de pureza, pero la página es DINÁMICA (RLS, sin cache): el tiempo
  // de request es el correcto. Se acota aquí; se pasa `today` a los forms para no repetirlo en el cliente.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const pendientes = referrals.filter((r) => r.returnedAt == null);
  const cerradas = referrals.filter((r) => r.returnedAt != null);

  return (
    <Panel>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Remisiones</h2>

      {referrals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Este paciente no tiene remisiones registradas.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {pendientes.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Pendientes de retorno
              </h3>
              {pendientes.map((r) => (
                <div key={r.id} className="flex flex-col gap-2 rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{targetLabel(r)}</span>
                    <span className="text-xs text-clinical-warning">{pendingLabel(r.referredAt, nowMs)}</span>
                  </div>
                  {sourceLabel(r) ? (
                    <span className="text-xs text-muted-foreground">{sourceLabel(r)}</span>
                  ) : null}
                  <p className="text-sm text-muted-foreground">{r.reason}</p>
                  {canMarkReturn ? (
                    <div className="pt-1">
                      <MarkReturnForm referralId={r.id} patientId={patientId} today={today} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {cerradas.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Cerradas (el paciente volvió)
              </h3>
              {cerradas.map((r) => (
                <div key={r.id} className="flex flex-col gap-1 rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{targetLabel(r)}</span>
                    <span className="text-xs text-muted-foreground">Volvió el {r.returnedAt}</span>
                  </div>
                  {sourceLabel(r) ? (
                    <span className="text-xs text-muted-foreground">{sourceLabel(r)}</span>
                  ) : null}
                  <p className="text-sm text-muted-foreground">{r.reason}</p>
                  {r.returnNotes ? (
                    <p className="text-xs text-muted-foreground">Nota: {r.returnNotes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
