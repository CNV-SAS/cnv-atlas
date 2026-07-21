"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { generateBaseSurveyQrAction, getOrCreateBaseSurveyLinkAction } from "../actions";

// Card "Link de consultorio": el link base (inicial reusable) del profesional y su QR, para
// imprimir y pegar en la sala. El token es opaco (atribucion por servidor); el link es ESTABLE
// (get-or-create), no se regenera en cada clic. Las actions no llevan FormData: se llaman por
// transicion (no `action` de form), para evitar el auto-reset de forms de React 19.
export function ConsultorioLink() {
  // El origen se lee en cliente (mismo patron que el link de seguimiento): el link se muestra
  // absoluto para copiar, aunque el server devuelva la ruta relativa.
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [linkPath, setLinkPath] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingLink, startLink] = useTransition();
  const [pendingQr, startQr] = useTransition();

  const fullLink = linkPath ? `${origin}${linkPath}` : null;

  function loadLink() {
    startLink(async () => {
      const r = await getOrCreateBaseSurveyLinkAction();
      setLinkError(r.error);
      setLinkPath(r.linkPath);
    });
  }

  function loadQr() {
    startQr(async () => {
      const r = await generateBaseSurveyQrAction();
      setQrError(r.error);
      setQr(r.qrDataUrl);
    });
  }

  async function copy() {
    if (!fullLink) return;
    await navigator.clipboard.writeText(fullLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link de consultorio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Tu link fijo de encuesta para el consultorio. Imprime el QR y pégalo en la sala: el
          paciente lo escanea, llena la encuesta, y la evaluación queda atribuida a ti
          automáticamente. Es estable (no cambia) y el código del enlace es opaco.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={loadLink} disabled={pendingLink}>
            <Link2 className="size-4" aria-hidden />
            {pendingLink ? "Cargando..." : "Ver/copiar enlace de consultorio"}
          </Button>
          <Button type="button" variant="outline" onClick={loadQr} disabled={pendingQr}>
            <QrCode className="size-4" aria-hidden />
            {pendingQr ? "Generando..." : "Generar QR"}
          </Button>
        </div>

        {linkError ? <p className="text-sm text-destructive">{linkError}</p> : null}
        {fullLink ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Enlace de consultorio (reusable)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all text-sm text-primary">{fullLink}</span>
              <Button type="button" size="sm" variant="ghost" onClick={copy}>
                {copied ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        ) : null}

        {qrError ? <p className="text-sm text-destructive">{qrError}</p> : null}
        {qr ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              QR del enlace (para imprimir)
            </span>
            {/* Data URL PII-free generado en servidor (solo la URL del token opaco). next/image no
                aporta sobre un data URL local; se usa img directo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="QR del link de consultorio"
              width={200}
              height={200}
              className="rounded bg-white p-2"
            />
            <a
              href={qr}
              download="qr-consultorio.png"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Descargar QR
            </a>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
