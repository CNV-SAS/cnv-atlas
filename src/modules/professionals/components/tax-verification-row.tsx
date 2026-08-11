"use client";

import { ExternalLink, FileText } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { rejectTaxRutAction, verifyTaxStatusAction } from "../actions";
import { rutNeedsRenewal } from "../tax-rules";
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

// Una fila de verificacion: el verificador lee el RUT y llena los campos certificados + la fecha DEL RUT,
// o lo RECHAZA con motivo. El RUT NO se embebe: la CSP endurecida lo impide a proposito (object-src 'none'
// bloquea <object>/<embed>, y X-Frame-Options DENY + frame-ancestors 'none' bloquean un <iframe> del propio
// PDF, aun del mismo origen). Embeber exigiria relajar esas cabeceras para toda la app; para un documento
// de identidad tributaria (PHI-adyacente) no compensa. Se abre en pestana nueva, gateado por sesion.
export function TaxVerificationRow({ item, nowMs }: { item: PendingTaxVerification; nowMs: number }) {
  const [state, action, pending] = useActionState(verifyTaxStatusAction, initial);
  const [rejState, rejAction, rejPending] = useActionState(rejectTaxRutAction, initial);
  const [documentDate, setDocumentDate] = useState("");
  const [reason, setReason] = useState("");

  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Verificado. El integrante entra en la próxima liquidación.");
  }, [state]);

  const lastRej = useRef(rejState);
  useEffect(() => {
    if (rejState === lastRej.current) return;
    lastRej.current = rejState;
    if (rejState.error) toast.error(rejState.error);
    else if (rejState.success) toast.success("Rechazado. Le avisamos al integrante para que suba uno nuevo.");
  }, [rejState]);

  // El verificador escribe la fecha del RUT; si tiene mas de un año, NO se verifica (protege a CNV). En vez
  // de dejarlo chocar contra el bloqueo del server, se lo advertimos aqui y le prellenamos el motivo del
  // rechazo, para que lo devuelva pidiendo uno actualizado.
  const stale = documentDate !== "" && rutNeedsRenewal(documentDate, new Date(nowMs));

  const handleVerify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => action(new FormData(e.currentTarget)));
  };

  const handleReject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => rejAction(new FormData(e.currentTarget)));
  };

  const suggestStaleReason = () => {
    setReason(`El RUT tiene fecha ${documentDate}, con más de un año de expedido. Descarga uno actualizado del portal de la DIAN y súbelo.`);
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

      {/* El RUT se abre en pestana nueva (la CSP no permite embeberlo; ver el comentario de arriba). */}
      <a
        href={`/rut/${item.professionalId}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60"
      >
        <span className="flex items-center gap-2 text-foreground">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          Abrir el RUT de {item.fullName} (PDF)
        </span>
        <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
      </a>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form onSubmit={handleVerify} className="flex flex-col gap-3">
          <input type="hidden" name="professionalId" value={item.professionalId} />
          <div className="flex flex-col gap-1">
            <Label htmlFor={`doc-${item.professionalId}`} className="text-xs">
              Fecha del RUT (la que trae el documento, no la de hoy)
            </Label>
            <Input
              id={`doc-${item.professionalId}`}
              name="documentDate"
              type="date"
              required
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="h-9 w-48"
            />
            <span className="text-xs text-muted-foreground">
              Si tiene más de un año, no lo verifiques: recházalo pidiendo uno actualizado.
            </span>
          </div>

          {stale ? (
            <div className="flex flex-col gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
              <p className="text-xs text-foreground">
                Este RUT tiene más de un año. No debes verificarlo: la clasificación pudo cambiar. Recházalo
                para pedirle uno actualizado.
              </p>
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={suggestStaleReason}>
                Preparar rechazo por RUT vencido
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Léelo del RUT:</p>
              <YesNo name="isIncomeDeclarant" label="¿Declarante de renta?" />
              <YesNo name="isVatResponsible" label="¿Responsable de IVA?" />
              <YesNo name="mustInvoice" label="¿Obligado a facturar?" />
              <Button type="submit" disabled={pending} className="mt-1 self-start">
                {pending ? "Verificando..." : "Marcar verificado"}
              </Button>
            </div>
          )}
        </form>

        {/* Rechazo: motivo OBLIGATORIO. El integrante lo ve en su banner y por correo, y sube uno nuevo. */}
        <form onSubmit={handleReject} className="flex flex-col gap-2 rounded-md border border-destructive/30 p-3">
          <input type="hidden" name="professionalId" value={item.professionalId} />
          <Label htmlFor={`rej-${item.professionalId}`} className="text-xs">
            Rechazar el RUT (dile qué corregir)
          </Label>
          <Textarea
            id={`rej-${item.professionalId}`}
            name="reason"
            required
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: el PDF está ilegible, o no es el RUT, o la fecha no se ve."
            className="min-h-20 text-sm"
          />
          <Button type="submit" variant="destructive" disabled={rejPending} className="self-start">
            {rejPending ? "Rechazando..." : "Rechazar y pedir otro"}
          </Button>
        </form>
      </div>
    </div>
  );
}
