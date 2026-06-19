"use client";

// Error boundary de la app (App Router). Captura errores de render no
// controlados de cualquier ruta, los reporta a Sentry (con scrubbing de PHI en
// beforeSend) y muestra una salida con marca, sin exponer el detalle del error.
// El caso extremo (fallo del propio layout raiz) lo cubre global-error.tsx.
import * as Sentry from "@sentry/nextjs";
import Image from "next/image";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El mensaje del error NO debe construirse con PHI: el scrub redacta campos
    // estructurados por clave, no el texto libre de la excepcion (SECURITY.md).
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted p-6 text-center">
      <Image
        src="/brand/logo-horizontal.svg"
        alt="Atlas"
        width={160}
        height={32}
        priority
        unoptimized
        className="h-8 w-auto"
      />
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Error inesperado
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          Algo salio mal
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Ya registramos el problema. Intenta de nuevo en un momento; si persiste,
          contacta a soporte.
        </p>
      </div>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
