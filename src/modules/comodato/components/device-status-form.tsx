"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { updateDeviceStatusFormAction } from "../actions";
import type { DeviceStatus } from "../types";
import type { ComodatoFormState } from "../validations";
import { selectClass } from "./field-styles";
import { DEVICE_STATUS_LABELS, DEVICE_STATUS_OPTIONS } from "./status-meta";

const initial: ComodatoFormState = { error: null, success: null };

// Cambio de estado del equipo, inline. Independiente del contrato (no se acopla).
export function DeviceStatusForm({
  deviceId,
  currentStatus,
}: {
  deviceId: string;
  currentStatus: DeviceStatus;
}) {
  const [state, action, pending] = useActionState(updateDeviceStatusFormAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="deviceId" value={deviceId} />
      <select
        name="status"
        defaultValue={currentStatus}
        aria-label="Estado del equipo"
        className={`${selectClass} h-8`}
      >
        {DEVICE_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {DEVICE_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "Cambiar estado"}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-clinical-optimal">{state.success}</span> : null}
    </form>
  );
}
