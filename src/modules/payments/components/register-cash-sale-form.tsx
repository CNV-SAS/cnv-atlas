"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
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
  // VARIAS LINEAS, como el checkout (2026-09-12). Tenia el mismo estrangulamiento: un selector y un campo
  // de cantidad, mientras la tabla, el writer, el servicio y el esquema admitian cincuenta. Y en efectivo
  // pesa mas: la venta nace PAGADA, asi que dos registros son dos cobros y revertir uno es una nota
  // credito, no un clic.
  const [lineas, setLineas] = useState<{ nutraceuticalId: string; quantity: string }[]>([
    { nutraceuticalId: nutraceuticals[0]?.id ?? "", quantity: "1" },
  ]);
  const cambiar = (i: number, campo: Partial<{ nutraceuticalId: string; quantity: string }>) =>
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...campo } : l)));
  const anadir = () =>
    setLineas((prev) => [...prev, { nutraceuticalId: nutraceuticals[0]?.id ?? "", quantity: "1" }]);
  const quitar = (i: number) => setLineas((prev) => prev.filter((_, j) => j !== i));
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
    fd.set("lineas", JSON.stringify(lineas));
    fd.set("idempotencyKey", keyRef.current);
    if (confirmDuplicate) fd.set("confirmDuplicate", "true");
    ejecutarAccion(action, fd);
  };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(false);
  };

  // Preview del total (precio del catalogo x cantidad), para ver el monto antes de cobrar.
  const total = useMemo(() => {
    return lineas.reduce((suma, l) => {
      const n = nutraceuticals.find((x) => x.id === l.nutraceuticalId);
      const q = Number(l.quantity);
      return suma + (n && Number.isFinite(q) && q > 0 ? n.unitPrice * q : 0);
    }, 0);
  }, [nutraceuticals, lineas]);

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

        <div className="flex w-full flex-col gap-2">
          <Label className="text-xs">Productos</Label>
          {lineas.map((l, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <select
                aria-label={`Nutracéutico ${i + 1}`}
                required
                value={l.nutraceuticalId}
                onChange={(e) => cambiar(i, { nutraceuticalId: e.target.value })}
                className={`${selectClass} min-w-[16rem] flex-1`}
              >
                {nutraceuticals.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.unitPrice.toLocaleString("es-CO")} COP)
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Cantidad ${i + 1}`}
                type="number"
                min={1}
                step={1}
                value={l.quantity}
                onChange={(e) => cambiar(i, { quantity: e.target.value })}
                required
                className="h-9 w-24"
              />
              {lineas.length > 1 && (
                <Button type="button" variant="outline" onClick={() => quitar(i)}>
                  Quitar
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" onClick={anadir} className="self-start">
            Añadir producto
          </Button>
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
