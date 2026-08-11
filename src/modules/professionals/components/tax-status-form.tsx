"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveTaxStatusAction } from "../actions";
import type { TaxStatusFields, TaxStatusFormState } from "../validations";

const initial: TaxStatusFormState = { error: null, success: false };

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

// Radio si/no (valores "true"/"false"). current null => ninguno marcado (obliga a responder). required en
// ambos para que el navegador exija una respuesta (no se envia un "no" silencioso).
function YesNo({ name, label, current }: { name: string; label: string; current: boolean | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name={name} value="true" defaultChecked={current === true} required className="accent-primary" />
          Sí
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name={name} value="false" defaultChecked={current === false} required className="accent-primary" />
          No
        </label>
      </div>
    </div>
  );
}

// Formulario del estado tributario del integrante. Solo captura los DATOS (las tarifas de retencion las
// fija la contadora, no se calculan aqui). onSubmit + startTransition (no prop `action`) para no resetear
// lo que el integrante llena si hay un error.
export function TaxStatusForm({ current }: { current: TaxStatusFields }) {
  const [state, action, pending] = useActionState(saveTaxStatusAction, initial);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Datos guardados. Gracias.");
  }, [state]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => action(new FormData(e.currentTarget)));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="personType" className="text-xs">
            Tipo de persona
          </Label>
          <select
            id="personType"
            name="personType"
            required
            defaultValue={current.personType ?? ""}
            className={selectClass}
          >
            <option value="" disabled>
              Selecciona
            </option>
            <option value="natural">Persona natural</option>
            <option value="juridica">Persona jurídica</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="idNumber" className="text-xs">
            NIT o cédula (para facturación)
          </Label>
          <Input
            id="idNumber"
            name="idNumber"
            required
            defaultValue={current.idNumber ?? ""}
            className="h-9"
          />
        </div>

        <YesNo name="hasRut" label="¿Tienes RUT?" current={current.hasRut} />
        <YesNo name="isIncomeDeclarant" label="¿Eres declarante de renta?" current={current.isIncomeDeclarant} />
        <YesNo name="isVatResponsible" label="¿Eres responsable de IVA?" current={current.isVatResponsible} />
        <YesNo name="mustInvoice" label="¿Estás obligado a facturar?" current={current.mustInvoice} />
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Guardar mis datos"}
      </Button>
    </form>
  );
}
