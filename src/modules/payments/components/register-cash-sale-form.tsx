"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { registerCashSaleFormAction } from "../actions";
import type { CashSaleFormState } from "../validations";
import type { CheckoutNutraceutical, CheckoutPatient } from "./create-checkout-form";

const initial: CashSaleFormState = { error: null, success: null, duplicateWarning: null };

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

// Registra una venta en EFECTIVO (paciente + producto + cantidad), que nace ya pagada. El precio lo pone
// CNV (se sella en el servidor desde el catalogo); el dinero es de CNV, el integrante lo custodia.
// DOS capas contra el cobro duplicado: (1) idempotencyKey por intento (en un ref) para el doble-clic
// simultaneo, se regenera solo al concretar una venta; (2) el AVISO de venta identica reciente (server,
// findRecentCashSaleDuplicate), que atrapa el re-registro secuencial, avisa y deja "Registrar de todos
// modos". La misma clave se usa en el aviso y en la confirmacion, asi confirmar crea una sola venta.
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
    else if (state.duplicateWarning) toast.warning(state.duplicateWarning); // NO regenera la clave: no hubo venta
    else if (state.success) {
      toast.success(state.success);
      keyRef.current = crypto.randomUUID(); // venta concretada: clave nueva para el proximo cobro
    }
  }, [state]);

  // Envio por transicion (no prop `action`): arma el FormData desde el estado controlado, inyecta la clave
  // del intento y (para "registrar de todos modos") el flag de confirmacion del duplicado. La MISMA clave
  // se usa en el aviso y en la confirmacion, asi confirmar crea UNA sola venta.
  const submit = (confirmDuplicate: boolean) => {
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("nutraceuticalId", nutraceuticalId);
    fd.set("quantity", quantity);
    fd.set("idempotencyKey", keyRef.current);
    if (confirmDuplicate) fd.set("confirmDuplicate", "true");
    startTransition(() => action(fd));
  };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(false);
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

        {state.duplicateWarning ? (
          <div className="flex w-full flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
            <p className="text-attention">{state.duplicateWarning}</p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => submit(true)}
              className="self-start"
            >
              Registrar de todos modos
            </Button>
          </div>
        ) : null}
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
