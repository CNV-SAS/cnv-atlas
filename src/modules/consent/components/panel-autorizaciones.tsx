"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { revokeConsentAction } from "../actions";
import type { AutorizacionPaciente } from "../data/consent-reader";
import { formatDate } from "@/lib/format/date";
import { Panel } from "@/components/shared/panel";
import { CANALES_REVOCACION, CONSENT_TYPE_LABELS } from "../labels";

// PANEL DE AUTORIZACIONES de la ficha del paciente: que autorizo, cuando, y la via para registrar una
// revocacion (`CONSENT_ATLAS.md` seccion 10, `DATA_GOVERNANCE.md` (c)).
//
// EL FORMULARIO VA CON onSubmit + startTransition, NO con `<form action={fn}>`: la prop `action` de
// React 19 RESETEA los inputs no controlados tras la accion, asi que un error borraria el motivo que el
// profesional acaba de escribir (CLAUDE.md, hazards de formulario).
//
// POR FINALIDAD, NO UN INTERRUPTOR: casillas por autorizacion. Un boton de "revocar todo" convertiria en
// una sola decision lo que la ley y el documento firmado tratan como decisiones separadas.
//
// LO QUE DICE ANTES DE CONFIRMAR no es cortesia: la revocacion opera HACIA ADELANTE y no borra la historia
// clinica, y el profesional tiene que saberlo ANTES de registrarla, no despues. Si creyera que borra el
// historial, o no la registraria (dejando al paciente sin su derecho) o la registraria esperando algo que
// no va a pasar.

export function PanelAutorizaciones({
  patientId,
  autorizaciones,
  puedeRevocar,
}: {
  patientId: string;
  autorizaciones: AutorizacionPaciente[];
  puedeRevocar: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [canal, setCanal] = useState<string>(CANALES_REVOCACION[0].valor);

  const vigentes = autorizaciones.filter((a) => a.vigente);
  const faltanNecesarias = autorizaciones.some((a) => a.necesaria && !a.vigente);

  function alternar(tipo: string) {
    setSeleccion((s) => (s.includes(tipo) ? s.filter((t) => t !== tipo) : [...s, tipo]));
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const r = await revokeConsentAction({ patientId, types: seleccion, motivo, canal });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      // EL AVISO HABLA DEL RESULTADO, no del intento: dice cuantas se revocaron de verdad.
      const n = r.revocados.length;
      toast.success(
        n === 1
          ? "Autorización revocada. Queda registrada con tu nombre y el motivo."
          : `${n} autorizaciones revocadas. Quedan registradas con tu nombre y el motivo.`,
      );
      setAbierto(false);
      setSeleccion([]);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <Panel titulo="Autorizaciones">

      {autorizaciones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Este paciente todavía no tiene autorizaciones registradas.
        </div>
      ) : (
        <ul className="flex flex-col rounded-xl border border-border">
          {autorizaciones.map((a) => (
            <li
              key={a.tipo}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 last:border-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-foreground">
                  {CONSENT_TYPE_LABELS[a.tipo]}
                  {a.necesaria ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (necesaria para evaluar)
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {a.vigente
                    ? // "VIGENTE DESDE" Y "FIRMADO EL" ERAN EL MISMO DATO (`signed_at`) con dos rotulos, en
                      // esta ficha y en la tarjeta de la evaluacion. Ademas "vigente desde" insinuaba una
                      // ventana de validez que no existe: una autorizacion no caduca, se revoca. Ahora el
                      // ESTADO y la FECHA se dicen por separado, y la fecha se llama por lo que es.
                      `Vigente${a.firmadaEl ? ` · firmada el ${formatDate(a.firmadaEl)}` : ""}${a.version ? ` · versión ${a.version}` : ""}`
                    : `Revocada${a.revocadaEl ? ` el ${formatDate(a.revocadaEl)}` : ""}`}
                </span>
              </div>
              {!a.vigente ? (
                <span className="shrink-0 rounded-full border border-clinical-warning/40 bg-clinical-warning-bg px-2 py-0.5 text-xs font-medium text-clinical-warning">
                  Revocada
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {faltanNecesarias ? (
        <p className="rounded-xl border border-clinical-warning/40 bg-clinical-warning-bg px-4 py-3 text-sm text-foreground">
          Le falta alguna autorización necesaria vigente, así que no se le pueden crear evaluaciones
          nuevas. Las evaluaciones ya registradas se conservan y siguen consultables. Para volver a
          evaluarlo, el paciente debe firmar de nuevo.
        </p>
      ) : null}

      {puedeRevocar && vigentes.length > 0 ? (
        abierto ? (
          <form onSubmit={enviar} className="flex flex-col gap-4 rounded-xl border border-border p-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                ¿Qué autorizaciones revoca el paciente?
              </span>
              {vigentes.map((a) => (
                <label key={a.tipo} className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={seleccion.includes(a.tipo)}
                    onChange={() => alternar(a.tipo)}
                    className="mt-1"
                  />
                  <span>
                    {CONSENT_TYPE_LABELS[a.tipo]}
                    {a.necesaria ? (
                      <span className="text-muted-foreground">
                        {" "}
                        (revocarla bloquea evaluaciones nuevas)
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="canal-revocacion" className="text-sm font-medium text-foreground">
                Cómo lo solicitó
              </label>
              <select
                id="canal-revocacion"
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:max-w-sm"
              >
                {CANALES_REVOCACION.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="motivo-revocacion" className="text-sm font-medium text-foreground">
                Motivo
              </label>
              <textarea
                id="motivo-revocacion"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Qué pidió el paciente y en qué términos."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <span className="text-xs text-muted-foreground">
                Queda en el registro de auditoría junto a tu nombre. No se puede editar después.
              </span>
            </div>

            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              La revocación opera hacia adelante: bloquea evaluaciones nuevas y{" "}
              <strong className="font-semibold text-foreground">no borra la historia clínica</strong>,
              que se conserva por obligación legal y sigue consultable aquí. No se puede deshacer: para
              volver a autorizar, el paciente firma de nuevo.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pendiente || seleccion.length === 0 || motivo.trim().length < 10}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {pendiente ? "Registrando..." : "Registrar revocación"}
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                disabled={pendiente}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="self-start rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
            >
              Registrar una revocación
            </button>
            <p className="text-xs text-muted-foreground">
              El paciente puede revocar sus autorizaciones en cualquier momento, ante ti o escribiendo a
              protecciondatos@cnvsystem.com.
            </p>
          </div>
        )
      ) : null}
    </Panel>
  );
}
