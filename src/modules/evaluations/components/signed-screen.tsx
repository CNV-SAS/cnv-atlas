"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Pantalla intermedia entre firmar (fase 1) y responder (fase 2). Confirma que quedo firmado, entrega el
// enlace para retomar la encuesta mas tarde (por si cierra el navegador) y ofrece empezar ya. El enlace
// tambien llega por correo con la copia del consentimiento; aqui se muestra para copiarlo en el momento.
//
// El enlace se construye en cliente (window.location.origin): este componente solo se monta tras una
// interaccion (firmar), nunca en SSR. Se muestra SELECCIONABLE (input readonly) ademas de copiable,
// porque el boton de copiar se porta distinto en navegadores moviles, donde la mayoria llena esto.

export type SignedScreenProps = {
  resumeToken: string;
  onStart: () => void;
};

export function SignedScreen({ resumeToken, onStart }: SignedScreenProps) {
  // Origin del navegador para armar el enlace absoluto. Init perezoso (no en un efecto): este componente
  // solo se monta tras firmar (interaccion en cliente), nunca en SSR, asi que window esta disponible.
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resumeUrl = origin ? `${origin}/encuesta/reanudar/${resumeToken}` : "";

  const copy = async () => {
    if (!resumeUrl) return;
    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopied(true);
    } catch {
      // Fallback para navegadores sin Clipboard API o sin permiso: selecciona el texto y copia.
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
        try {
          document.execCommand("copy");
          setCopied(true);
        } catch {
          // Sin copia automatica: el input queda seleccionado para copiar a mano.
        }
      }
    }
  };

  // "Copiado" transitorio: vuelve a "Copiar" a los 2.5 s para no dejar un estado enganoso permanente.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Consentimiento firmado</h2>
        <p className="text-sm text-muted-foreground">
          Quedó firmado. Ahora sigue la encuesta: puedes pausar y volver cuando quieras con el enlace de
          abajo, que también te enviamos por correo con la copia de tu consentimiento.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="resume-url">
          Tu enlace para retomar la encuesta
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="resume-url"
            ref={inputRef}
            readOnly
            value={resumeUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 flex-1 font-mono text-xs"
          />
          <Button type="button" variant="outline" onClick={copy} disabled={!resumeUrl} className="shrink-0">
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Guarda este enlace. Solo funciona hasta que termines la encuesta.
        </p>
      </div>

      <Button type="button" onClick={onStart} className="self-start">
        Empezar la encuesta
      </Button>
    </div>
  );
}
