"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { updateDeviceStatusFormAction } from "../actions";
import type { DeviceStatus } from "../types";
import type { ComodatoFormState } from "../validations";
import { selectClass } from "./field-styles";
import { DEVICE_STATUS_LABELS, DEVICE_STATUS_OPTIONS } from "./status-meta";
import { useComodatoToast } from "./use-comodato-toast";

const initial: ComodatoFormState = { error: null, success: null, warning: null };

// Cambio de estado del equipo, inline. Independiente del contrato (no se acopla).
export function DeviceStatusForm({
  deviceId,
  currentStatus,
}: {
  deviceId: string;
  currentStatus: DeviceStatus;
}) {
  const [state, action, pending] = useActionState(updateDeviceStatusFormAction, initial);
  useComodatoToast(state);

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
    </form>
  );
}
