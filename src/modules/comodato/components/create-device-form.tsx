"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createDeviceFormAction } from "../actions";
import type { ComodatoFormState } from "../validations";
import { useComodatoToast } from "./use-comodato-toast";

const initial: ComodatoFormState = { error: null, success: null, warning: null };

function Field({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} />
    </div>
  );
}

export function CreateDeviceForm() {
  const [state, action, pending] = useActionState(createDeviceFormAction, initial);
  useComodatoToast(state);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="assetCode" label="Codigo de activo" required placeholder="CNV-BIS-0001" />
        <Field name="manufacturerSerial" label="Serial de fabrica" required />
        <Field name="systemEmail" label="Correo de sistema" type="email" required />
        <Field name="model" label="Modelo" required placeholder="Biody B.I.S ZM" />
        <Field name="brand" label="Marca" />
        <Field name="supplier" label="Proveedor" />
        <Field name="purchaseDate" label="Fecha de compra" type="date" />
        <Field name="lastCalibrationDate" label="Ultima calibracion" type="date" />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear equipo"}
        </Button>
      </div>
    </form>
  );
}
