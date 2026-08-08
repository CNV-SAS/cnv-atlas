"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createReferralFormAction } from "../actions";
import type { ReferralFormState, ReferralTargetValue } from "../validations";

const initial: ReferralFormState = { error: null, success: null };

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const TARGET_OPTIONS: { value: ReferralTargetValue; label: string }[] = [
  { value: "medico", label: "Médico" },
  { value: "psicologo", label: "Psicólogo/a" },
  { value: "deportologo", label: "Deportólogo/a" },
  { value: "nutricionista", label: "Nutricionista" },
  { value: "otro", label: "Otro (especifica)" },
];

// Registrar una remisión (D-009). Colapsado hasta que el profesional lo abre. Cuando viene de una ruta del
// modelo, destino y motivo llegan PRELLENADOS, pero se ven como PROPUESTA (aviso + editables): prellenar
// está bien, dar por registrado lo que el modelo sugiere no. `fromRoute` distingue el prefill del manual.
export function RegisterReferralForm({
  treatmentId,
  today,
  prefillTarget,
  prefillReason,
  fromRoute = false,
}: {
  treatmentId: string;
  today: string;
  prefillTarget?: ReferralTargetValue;
  prefillReason?: string;
  fromRoute?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ReferralTargetValue>(prefillTarget ?? "medico");
  const [state, action, pending] = useActionState(createReferralFormAction, initial);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.success) {
      toast.success(state.success);
      // Cerrar el form al registrar con exito (evita un re-submit del prefill). Es una sincronizacion
      // de una sola vez con el resultado de la accion, uso legitimo del effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="self-start">
        Registrar remisión
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
      {fromRoute ? (
        <p className="text-xs text-muted-foreground">
          Destino y motivo vienen de la ruta del modelo como propuesta. Confírmalos o cámbialos: registrar es
          una decisión tuya, no algo que el modelo dé por hecho.
        </p>
      ) : null}
      <input type="hidden" name="treatmentId" value={treatmentId} />

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`to-${treatmentId}`} className="text-xs">
            Destino
          </Label>
          <select
            id={`to-${treatmentId}`}
            name="referredTo"
            value={target}
            onChange={(e) => setTarget(e.target.value as ReferralTargetValue)}
            className={selectClass}
          >
            {TARGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {target === "otro" ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`other-${treatmentId}`} className="text-xs">
              ¿A quién? (endocrino, psiquiatría...)
            </Label>
            <Input id={`other-${treatmentId}`} name="referredToOther" type="text" required className="h-9 w-56" />
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <Label htmlFor={`at-${treatmentId}`} className="text-xs">
            Fecha
          </Label>
          <Input id={`at-${treatmentId}`} name="referredAt" type="date" defaultValue={today} required className="h-9 w-40" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`reason-${treatmentId}`} className="text-xs">
          Motivo
        </Label>
        <textarea
          id={`reason-${treatmentId}`}
          name="reason"
          required
          defaultValue={prefillReason ?? ""}
          rows={2}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Registrando..." : "Registrar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
