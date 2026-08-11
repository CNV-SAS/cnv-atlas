"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { verifyTaxStatusAction } from "../actions";
import type { PendingTaxVerification, TaxVerificationFormState } from "../validations";

const initial: TaxVerificationFormState = { error: null, success: false };

// Cuanto lleva el integrante esperando la verificacion (subio su parte -> ahora). Un RUT sin verificar
// significa que no puede cobrar, y eso es culpa de CNV; mismo criterio que las remesas sin confirmar.
function ageLabel(submittedAt: string, nowMs: number): string {
  const days = Math.max(0, Math.floor((nowMs - new Date(submittedAt).getTime()) / 86_400_000));
  if (days < 1) return "subió hoy";
  return `esperando hace ${days} día${days === 1 ? "" : "s"}`;
}

function YesNo({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex gap-3">
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" name={name} value="true" required className="accent-primary" /> Sí
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" name={name} value="false" required className="accent-primary" /> No
        </label>
      </div>
    </div>
  );
}

// Una fila de verificacion: el PDF del RUT al LADO del formulario (para no perder contexto abriendo otra
// pestana). El verificador lee el documento y llena los campos certificados + la fecha DEL RUT.
export function TaxVerificationRow({ item, nowMs }: { item: PendingTaxVerification; nowMs: number }) {
  const [state, action, pending] = useActionState(verifyTaxStatusAction, initial);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Verificado. El integrante entra en la próxima liquidación.");
  }, [state]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => action(new FormData(e.currentTarget)));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{item.fullName}</span>
          <span className="text-xs text-muted-foreground">
            {item.personType === "juridica" ? "Persona jurídica" : "Persona natural"} · {item.idType}{" "}
            {item.idNumber}
            {item.idDv ? `-${item.idDv}` : ""}
          </span>
        </div>
        <span className="text-xs font-medium text-amber-600">{ageLabel(item.submittedAt, nowMs)}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* El RUT, al lado. El route handler valida acceso y sirve el PDF firmado. */}
        <object
          data={`/rut/${item.professionalId}`}
          type="application/pdf"
          className="h-80 w-full rounded-md border border-border bg-muted/30"
          aria-label={`RUT de ${item.fullName}`}
        >
          <a href={`/rut/${item.professionalId}`} target="_blank" rel="noreferrer" className="text-primary underline">
            Abrir el RUT
          </a>
        </object>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="professionalId" value={item.professionalId} />
          <div className="flex flex-col gap-1">
            <Label htmlFor={`doc-${item.professionalId}`} className="text-xs">
              Fecha del RUT (la que trae el documento, no la de hoy)
            </Label>
            <Input id={`doc-${item.professionalId}`} name="documentDate" type="date" required className="h-9 w-48" />
            <span className="text-xs text-muted-foreground">
              Si tiene más de un año, pide uno actualizado (no lo verifiques).
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Léelo del RUT:</p>
            <YesNo name="isIncomeDeclarant" label="¿Declarante de renta?" />
            <YesNo name="isVatResponsible" label="¿Responsable de IVA?" />
            <YesNo name="mustInvoice" label="¿Obligado a facturar?" />
          </div>
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Verificando..." : "Marcar verificado"}
          </Button>
        </form>
      </div>
    </div>
  );
}
