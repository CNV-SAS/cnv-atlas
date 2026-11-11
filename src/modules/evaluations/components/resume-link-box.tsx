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
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // POR QUE LA URL SE VUELVE A CALCULAR TRAS MONTAR  ·  Santiago, 2026-11-11
  //
  // SU REPORTE: *"al abrir la CNV-S no aparece el enlace para retomarla; la inicial si lo muestra"*.
  //
  // LA CAUSA, Y LA ASIMETRIA ES LA PRUEBA: esta caja se esconde sola cuando no puede construir una URL
  // absoluta (`if (!resumeUrl) return null`), y la construia UNA SOLA VEZ, en el init perezoso del
  // `useState`. El comentario que estaba aqui decia que este arbol *"solo se monta en cliente"*, y eso
  // es cierto en la INICIAL (la encuesta aparece despues de firmar, ya en el navegador) y FALSO en el
  // seguimiento: ahi el paciente entra por la pagina de reanudacion, que es un Server Component, asi
  // que el primer render ocurre en el SERVIDOR, donde `window` no existe. El valor se congela vacio y la
  // hidratacion no lo recalcula: la caja no vuelve a aparecer nunca.
  //
  // (Con `NEXT_PUBLIC_APP_URL` puesta en el build no haria falta el origen del navegador, porque ya
  // habria base. Que el defecto se vea en produccion dice que ahi no esta: queda avisado, porque es la
  // variable del dominio canonico y la usa todo enlace absoluto.)
  //
  // EL ARREGLO: la URL se completa AL ABRIR la caja, que es cuando hace falta y cuando el navegador
  // existe seguro. No en un efecto: un `setState` sincrono dentro de un efecto dispara renders en
  // cascada (lo prohibe el lint, y con razon). Y el boton ya no depende de la URL, solo del token: la
  // via de vuelta se ANUNCIA siempre, que es lo que el paciente necesita ver antes de empezar.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  const [resumeUrl, setResumeUrl] = useState(() =>
    buildResumeUrl(resumeToken, typeof window !== "undefined" ? window.location.origin : null),
  );
  const alternar = () => {
    // En el navegador `window.location.origin` existe siempre, asi que a partir de aqui la URL es buena
    // incluso si el primer render fue en el servidor y sin `NEXT_PUBLIC_APP_URL`.
    if (!resumeUrl) setResumeUrl(buildResumeUrl(resumeToken, window.location.origin));
    setOpen((v) => !v);
  };
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

  // YA NO SE ESCONDE POR NO TENER URL (2026-11-11). Era `if (!resumeUrl) return null`, y eso convertia un
  // dato que falta (el origen, en el render del servidor) en una via de vuelta que el paciente no ve.
  // La URL se completa al abrir; el boton se muestra siempre.

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={alternar}
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
