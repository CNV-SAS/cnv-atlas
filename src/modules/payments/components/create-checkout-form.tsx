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
  // ═══ VARIAS LINEAS, QUE ES EL CASO MAS COMUN EN UNA CONSULTA (2026-09-12) ═══
  //
  // Hasta hoy este formulario tenia UN selector y UN campo de cantidad, asi que anadir un segundo producto
  // generaba OTRO checkout con OTRO enlace, y el paciente recibia dos links para una sola compra.
  //
  // Y EL ESTRANGULAMIENTO ESTABA SOLO AQUI: la tabla `transaction_items` es una fila por linea, el writer
  // las inserta todas, el servicio itera, y el esquema de validacion admite hasta CINCUENTA. Lo unico que
  // mandaba una sola linea era esta pantalla y la accion que leia dos campos sueltos.
  const [lineas, setLineas] = useState<{ nutraceuticalId: string; quantity: string }[]>([
    { nutraceuticalId: nutraceuticals[0]?.id ?? "", quantity: "1" },
  ]);
  const cambiar = (i: number, campo: Partial<{ nutraceuticalId: string; quantity: string }>) =>
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...campo } : l)));
  const anadir = () =>
    setLineas((prev) => [...prev, { nutraceuticalId: nutraceuticals[0]?.id ?? "", quantity: "1" }]);
  const quitar = (i: number) => setLineas((prev) => prev.filter((_, j) => j !== i));
  // El total es INFORMATIVO y se calcula con el precio del catalogo que ya tiene la pantalla. El que
  // cobra es el que SELLA el servidor desde el catalogo: si alguien toca el DOM, cambia este numero y no
  // lo que se cobra.
  const total = lineas.reduce((suma, l) => {
    const n = nutraceuticals.find((x) => x.id === l.nutraceuticalId);
    return suma + (n ? n.unitPrice * (Number(l.quantity) || 0) : 0);
  }, 0);
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

        <div className="flex w-full flex-col gap-2">
          <Label className="text-xs">Productos</Label>
          {/* LAS LINEAS VIAJAN COMO JSON EN UN CAMPO OCULTO, igual que el conteo de inventario
              (`mi-conteo-form`). Es el patron que ya existe en el proyecto para una lista de longitud
              variable dentro de un formulario, y repetirlo evita inventar un segundo. */}
          <input type="hidden" name="lineas" value={JSON.stringify(lineas)} />

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
              {/* La ultima linea NO se puede quitar: una venta sin lineas no es una venta, y dejar el
                  formulario vacio obliga a recargar para volver a empezar. */}
              {lineas.length > 1 && (
                <Button type="button" variant="outline" onClick={() => quitar(i)}>
                  Quitar
                </Button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={anadir} className="self-start">
              Añadir producto
            </Button>
            {total > 0 && (
              <p className="text-sm text-muted-foreground">
                Total: <strong className="text-foreground">{total.toLocaleString("es-CO")} COP</strong>
              </p>
            )}
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear checkout"}
        </Button>

        {state.duplicateWarning ? (
          <div className="flex w-full flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
            <p className="text-attention">{state.duplicateWarning}</p>
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
