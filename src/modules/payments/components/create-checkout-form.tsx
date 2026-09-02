"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createCheckoutFormAction } from "../actions";
import type { PaymentFormState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initial: PaymentFormState = {
  error: null,
  success: null,
  checkoutUrl: null,
  duplicateWarning: null,
};

// Mismo estilo que los <select> nativos del resto de formularios (alineado al Input).
const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

export type CheckoutPatient = { id: string; label: string };
export type CheckoutNutraceutical = { id: string; name: string; unitPrice: number };

// Crea un checkout de una linea (paciente + nutraceutico + cantidad). Al exito
// muestra el link de pago que el profesional comparte con el paciente.
export function CreateCheckoutForm({
  patients,
  nutraceuticals,
}: {
  patients: CheckoutPatient[];
  nutraceuticals: CheckoutNutraceutical[];
}) {
  const [state, action, pending] = useActionState(createCheckoutFormAction, initial);
  // Inputs CONTROLADOS a proposito: React 19 resetea el form tras cada submit (lo del prop `action`), y
  // el flujo de confirmacion del duplicado es de dos pasos (avisar -> "Generar de todos modos"). Sin
  // control, el segundo submit mandaria los valores por defecto, no los que el profesional eligio.
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [nutraceuticalId, setNutraceuticalId] = useState(nutraceuticals[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.duplicateWarning) toast.warning(state.duplicateWarning);
    else if (state.success) toast.success(state.success);
  }, [state]);

  if (patients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes pacientes registrados para crear un checkout.
      </p>
    );
  }
  if (nutraceuticals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay nutraceuticos con precio configurado. Asigna un precio en el catalogo
        antes de crear un checkout.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="patientId" className="text-xs">
            Paciente
          </Label>
          <select
            id="patientId"
            name="patientId"
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className={selectClass}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="nutraceuticalId" className="text-xs">
            Nutraceutico
          </Label>
          <select
            id="nutraceuticalId"
            name="nutraceuticalId"
            required
            value={nutraceuticalId}
            onChange={(e) => setNutraceuticalId(e.target.value)}
            className={selectClass}
          >
            {nutraceuticals.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.unitPrice.toLocaleString("es-CO")} COP)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="quantity" className="text-xs">
            Cantidad
          </Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className="h-9 w-24"
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear checkout"}
        </Button>

        {state.duplicateWarning ? (
          <div className="flex w-full flex-col gap-2 rounded-lg bg-clinical-warning-bg p-3 text-sm">
            <p className="text-clinical-warning">{state.duplicateWarning}</p>
            <Button
              type="submit"
              name="confirmDuplicate"
              value="true"
              variant="outline"
              disabled={pending}
              className="self-start"
            >
              Generar de todos modos
            </Button>
          </div>
        ) : null}
      </form>

      {state.checkoutUrl ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <span className="font-medium text-foreground">Link de pago (vale 24 horas)</span>
          <a
            href={state.checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary underline"
          >
            {state.checkoutUrl}
          </a>
        </div>
      ) : null}
    </div>
  );
}
