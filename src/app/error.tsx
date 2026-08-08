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
  // La pagina quedo de un despliegue anterior: llama una Server Action que ya no existe en el servidor
  // (se redesplego con la pagina abierta). NO es un error del sistema; se resuelve recargando. El
  // mensaje de este error es de cliente (no lo redacta Next en produccion), asi que se puede detectar.
  const isStaleDeployment =
    /server action/i.test(error.message) &&
    /not\s*found|older or newer deployment/i.test(error.message);

  useEffect(() => {
    // Un desfase de despliegue no es un fallo que valga la pena en Sentry (es esperado al redesplegar);
    // lo demas si se reporta. El mensaje NO debe construirse con PHI (el scrub redacta por clave, no el
    // texto libre de la excepcion, SECURITY.md).
    if (!isStaleDeployment) Sentry.captureException(error);
  }, [error, isStaleDeployment]);

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
      {isStaleDeployment ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Aplicación actualizada
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            Recarga la página
          </h1>
          <p className="max-w-prose text-muted-foreground">
            Atlas se actualizó mientras tenías esta página abierta. Recarga para seguir con la
            versión nueva. No se perdió nada.
          </p>
          <Button onClick={() => window.location.reload()}>Recargar</Button>
        </div>
      ) : (
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
          <Button onClick={reset}>Reintentar</Button>
        </div>
      )}
    </div>
  );
}
