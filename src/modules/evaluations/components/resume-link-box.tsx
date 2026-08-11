"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { buildResumeUrl } from "../resume-url";

// Caja del enlace de reanudacion: lo muestra SELECCIONABLE (input readonly) y COPIABLE (clipboard con
// fallback). Vive dentro de la fase 2 de la encuesta (se quito la pantalla intermedia "firmado": el
// enlace ya llega por correo, la pantalla era una parada de mas). El mismo enlace del correo (mismo
// helper buildResumeUrl, dominio canonico).
//
// COLAPSADA por defecto: la mayoria no la usa (cierran y vuelven por el correo), y ocupaba lugar arriba
// de TODAS las secciones. Un boton discreto ("Pausar y continuar despues") deja claro que hay una via de
// vuelta sin tener que abrirlo; al expandir aparece el enlace copiable. El aviso de que se guarda el
// avance sigue visible en el indicador de guardado (abajo), que es lo que tranquiliza.

export type ResumeLinkBoxProps = {
  resumeToken: string;
};

export function ResumeLinkBox({ resumeToken }: ResumeLinkBoxProps) {
  // Init perezoso (no en efecto): este arbol solo se monta en cliente (tras firmar o al reanudar).
  const [resumeUrl] = useState(() =>
    buildResumeUrl(resumeToken, typeof window !== "undefined" ? window.location.origin : null),
  );
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  if (!resumeUrl) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-fit text-sm font-medium text-primary underline underline-offset-2"
      >
        {open ? "Ocultar" : "Pausar y continuar después"}
      </button>

      {open ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            Si necesitas parar, cierra sin problema: guardamos tu avance y puedes volver cuando quieras con
            este enlace, que tambien te enviamos por correo.
          </p>
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
        </div>
      ) : null}
    </div>
  );
}
