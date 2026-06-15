"use client";

// Captura errores de render no controlados de toda la app y los reporta a
// Sentry (ya con scrubbing de PHI en beforeSend). El detalle del error no se
// muestra al usuario.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <h2>Algo salio mal. Intenta de nuevo en un momento.</h2>
      </body>
    </html>
  );
}
