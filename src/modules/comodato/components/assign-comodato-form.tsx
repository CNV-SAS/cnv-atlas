"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { assignComodatoFormAction } from "../actions";
import type { AssignableProfessional, Device } from "../types";
import type { ComodatoFormState } from "../validations";
import { selectClass } from "./field-styles";
import { useComodatoToast } from "./use-comodato-toast";

const initial: ComodatoFormState = { error: null, success: null, warning: null };

export function AssignComodatoForm({
  devices,
  professionals,
}: {
  devices: Device[];
  professionals: AssignableProfessional[];
}) {
  const [state, action, pending] = useActionState(assignComodatoFormAction, initial);
  useComodatoToast(state);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deviceId">Equipo</Label>
          <select id="deviceId" name="deviceId" required defaultValue="" className={selectClass}>
            <option value="" disabled>
              Selecciona un equipo
            </option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.asset_code} ({d.model})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="professionalId">Profesional</Label>
          <select
            id="professionalId"
            name="professionalId"
            required
            defaultValue=""
            className={selectClass}
          >
            <option value="" disabled>
              Selecciona un profesional
            </option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} ({p.email})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Inicio</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expectedEndDate">Fin previsto</Label>
          <Input id="expectedEndDate" name="expectedEndDate" type="date" required />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={pending || devices.length === 0 || professionals.length === 0}>
          {pending ? "Asignando..." : "Asignar comodato"}
        </Button>
      </div>
    </form>
  );
}
