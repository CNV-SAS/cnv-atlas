"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { LEGAL_REP_RELATIONSHIPS } from "@/modules/consent/validations";

import { guardarRepresentanteLegalAction } from "../actions";
import type { RepresentanteLegalState } from "../types";

const VACIO: RepresentanteLegalState = { error: null, success: null, warning: null };

const TIPOS = [
  { valor: "CC", rotulo: "Cédula de ciudadanía" },
  { valor: "CE", rotulo: "Cédula de extranjería" },
  { valor: "PA", rotulo: "Pasaporte" },
] as const;

const campo =
  "w-full rounded-md border border-input bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

// ═══ EL REPRESENTANTE LEGAL DE UN PACIENTE MENOR ═══
//
// Contabilidad, C1: la factura de un menor va a nombre de su representante legal, que es quien compra y
// quien paga, con su documento y su correo. Nunca los datos del menor en un documento tributario.
//
// SOLO SE RENDERIZA SI EL PACIENTE ES MENOR. No es una decision de este componente: quien lo monta es la
// ficha, que ya sabe la edad. Un bloque de representante en la ficha de un adulto invita a llenarlo.
//
// SE ABRE, NO ESTA ABIERTO, igual que la correccion del contacto: la ficha es para LEER, y unos campos
// editables permanentes invitan a teclear encima de un dato bueno. Pero cuando FALTA algo se abre solo,
// porque entonces no hay dato bueno que proteger y lo que hay es una venta que no se puede facturar.
//
// ── EL HAZARD 6 ──────────────────────────────────────────────────────────────────────────────────
//
// Los tres campos obligatorios llevan `required` SIN CONDICION aqui, y eso es correcto: este formulario
// solo existe para menores y no tiene ninguna salida alternativa al lado (no hay casilla de "no tiene
// representante"). El hazard 6 muerde cuando un `required` incondicional tapa una salida que esta a su
// lado; aqui no hay ninguna. El correo, que si es opcional, va sin `required`.
//
// Y el envio va por `enviarSinReset` (onSubmit + startTransition) y NO por la prop `action`: la prop
// resetea los campos tras la accion, y un error borraria lo que se acaba de escribir (hazard 2).
export function RepresentanteLegal({
  patientId,
  hayAutorizacion,
  nombre,
  tipoDocumento,
  documento,
  parentesco,
  correo,
}: {
  patientId: string;
  /** Si existe una autorizacion de representante legal vigente. Sin ella no hay donde guardar. */
  hayAutorizacion: boolean;
  nombre: string | null;
  tipoDocumento: string | null;
  documento: string | null;
  parentesco: string | null;
  correo: string | null;
}) {
  // LO QUE IMPIDE FACTURAR son estos tres. El correo no: la factura se emite igual.
  const incompleto = !nombre?.trim() || !documento?.trim() || !tipoDocumento?.trim();
  const [abierto, setAbierto] = useState(incompleto && hayAutorizacion);
  const [state, formAction, pending] = useActionState(guardarRepresentanteLegalAction, VACIO);
  useFormToastAndRefresh(state);

  // Al guardar se cierra, igual que al cancelar: la pagina se refresca y el formulario abierto taparia
  // justo lo que acaba de cambiar. Se ajusta durante el render, no en un efecto (regla de lint).
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (state.success) setAbierto(false);
  }

  if (!hayAutorizacion) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-attention bg-attention-bg p-3">
        <p className="max-w-prose text-sm text-foreground">
          <strong>Este paciente es menor de edad y no tiene representante legal registrado.</strong>
        </p>
        <p className="max-w-prose text-xs text-muted-foreground">
          Sus compras se registran con normalidad, pero <strong>no se pueden facturar</strong>: la factura
          tiene que ir a nombre de quien compra y paga, nunca con los datos del menor. Hay que firmar el
          consentimiento con su representante legal.
        </p>
      </div>
    );
  }

  if (!abierto) {
    return (
      <div className="flex flex-col items-start gap-1">
        <p className="text-sm text-foreground">
          <strong>Representante legal:</strong> {nombre}
          {tipoDocumento && documento ? ` · ${tipoDocumento} ${documento}` : ""}
          {parentesco ? ` · ${parentesco}` : ""}
        </p>
        {correo ? <p className="text-xs text-muted-foreground">{correo}</p> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
          Corregir el representante legal
        </Button>
        <p className="text-xs text-muted-foreground">
          Es a nombre de quien sale la factura de las compras de este paciente.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviarSinReset(formAction)}
      className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <p className="max-w-prose text-xs text-muted-foreground">
        La factura de las compras de un paciente menor sale a nombre de su representante legal, con su
        documento y su correo. <strong>Mientras falte alguno de los tres primeros, las ventas quedan
        pendientes de facturar</strong>, y salen solas al completarlos.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={`rep-nombre-${patientId}`} className="text-xs text-muted-foreground">
          Nombre completo
        </label>
        <input
          id={`rep-nombre-${patientId}`}
          name="nombre"
          required
          maxLength={120}
          defaultValue={nombre ?? ""}
          className={campo}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex w-40 flex-col gap-1">
          <label htmlFor={`rep-tipo-${patientId}`} className="text-xs text-muted-foreground">
            Tipo de documento
          </label>
          <select
            id={`rep-tipo-${patientId}`}
            name="tipoDocumento"
            required
            defaultValue={tipoDocumento ?? ""}
            className={campo}
          >
            <option value="">Elige...</option>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`rep-doc-${patientId}`} className="text-xs text-muted-foreground">
            Número de documento
          </label>
          <input
            id={`rep-doc-${patientId}`}
            name="documento"
            required
            maxLength={60}
            defaultValue={documento ?? ""}
            className={campo}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`rep-parentesco-${patientId}`} className="text-xs text-muted-foreground">
          Parentesco
        </label>
        <select
          id={`rep-parentesco-${patientId}`}
          name="parentesco"
          required
          defaultValue={parentesco ?? ""}
          className={campo}
        >
          <option value="">Elige...</option>
          {LEGAL_REP_RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`rep-correo-${patientId}`} className="text-xs text-muted-foreground">
          Correo del representante (opcional)
        </label>
        <input
          id={`rep-correo-${patientId}`}
          name="correo"
          type="email"
          maxLength={160}
          defaultValue={correo ?? ""}
          placeholder="correo@ejemplo.com"
          className={campo}
        />
        <p className="text-xs text-muted-foreground">
          Es a donde llega la factura. Sin él se emite igual.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
