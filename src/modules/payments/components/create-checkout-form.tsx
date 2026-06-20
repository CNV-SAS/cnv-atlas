"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createCheckoutFormAction } from "../actions";
import type { PaymentFormState } from "../validations";

const initial: PaymentFormState = { error: null, success: null, checkoutUrl: null };

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
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
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
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="patientId" className="text-xs">
            Paciente
          </Label>
          <select id="patientId" name="patientId" required className={selectClass}>
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
          <select id="nutraceuticalId" name="nutraceuticalId" required className={selectClass}>
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
            defaultValue={1}
            required
            className="h-9 w-24"
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear checkout"}
        </Button>
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
