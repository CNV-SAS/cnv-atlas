"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { registerCashSaleFormAction } from "../actions";
import type { CashSaleFormState } from "../validations";
import type { CheckoutNutraceutical, CheckoutPatient } from "./create-checkout-form";

const initial: CashSaleFormState = { error: null, success: null };

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

// Registra una venta en EFECTIVO (paciente + producto + cantidad), que nace ya pagada. El precio lo pone
// CNV (se sella en el servidor desde el catalogo); el dinero es de CNV, el integrante lo custodia. Inputs
// CONTROLADOS (React 19 resetea con prop `action`). idempotencyKey por intento: un doble-clic no cobra dos
// veces; se regenera tras cada venta exitosa para que la siguiente sea un cobro nuevo.
export function RegisterCashSaleForm({
  patients,
  nutraceuticals,
}: {
  patients: CheckoutPatient[];
  nutraceuticals: CheckoutNutraceutical[];
}) {
  const [state, action, pending] = useActionState(registerCashSaleFormAction, initial);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [nutraceuticalId, setNutraceuticalId] = useState(nutraceuticals[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  // Clave de idempotencia de ESTE intento (en un ref, no en estado: no se renderiza, se lee al enviar).
  // Un doble-clic manda la MISMA clave (el writer deduplica); tras una venta exitosa se regenera para que
  // el siguiente cobro sea nuevo. Mutar el ref en el efecto es valido (no es setState).
  const keyRef = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : "");

  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.success) {
      toast.success(state.success);
      keyRef.current = crypto.randomUUID(); // venta concretada: clave nueva para el proximo cobro
    }
  }, [state]);

  // Envio por onSubmit + startTransition (no prop `action`): inyecta la clave del intento y evita el
  // auto-reset de React 19. Los inputs son controlados igual.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("idempotencyKey", keyRef.current);
    startTransition(() => action(fd));
  };

  // Preview del total (precio del catalogo x cantidad), para ver el monto antes de cobrar.
  const total = useMemo(() => {
    const n = nutraceuticals.find((x) => x.id === nutraceuticalId);
    const q = Number(quantity);
    if (!n || !Number.isFinite(q) || q <= 0) return null;
    return n.unitPrice * q;
  }, [nutraceuticals, nutraceuticalId, quantity]);

  if (patients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes pacientes registrados para registrar una venta.
      </p>
    );
  }
  if (nutraceuticals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay nutraceuticos con precio configurado. Asigna un precio en el catalogo antes de vender.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="cash-patientId" className="text-xs">
            Paciente
          </Label>
          <select
            id="cash-patientId"
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
          <Label htmlFor="cash-nutraceuticalId" className="text-xs">
            Nutraceutico
          </Label>
          <select
            id="cash-nutraceuticalId"
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
          <Label htmlFor="cash-quantity" className="text-xs">
            Cantidad
          </Label>
          <Input
            id="cash-quantity"
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
          {pending ? "Registrando..." : "Registrar venta en efectivo"}
        </Button>
      </form>

      {total != null ? (
        <p className="text-sm text-muted-foreground">
          Total a cobrar: <span className="font-medium text-foreground">{total.toLocaleString("es-CO")} COP</span>{" "}
          (IVA incluido). Este dinero es de CNV; lo custodias hasta consignar.
        </p>
      ) : null}
    </div>
  );
}
