"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// ═══ UNA PANTALLA QUE FALLA NO TUMBA LA APP (segundo smoke, 2026-10-12) ═══
//
// EL INCIDENTE: /mi-inventario cayó con "Failed to connect to database: timeout" (el pooler ocupado un
// instante). Lo atrapaba `src/app/error.tsx`, que es correcto pero es una pantalla COMPLETA con el logo: el
// profesional pierde la barra lateral y la app entera parece caída, cuando lo que falló fue una lectura.
//
// Este límite vive DENTRO del layout de la app, así que la navegación se queda en pie y se puede ir a otra
// pantalla sin recargar. El de la raíz sigue existiendo para lo que pase FUERA de este layout (el login, la
// encuesta del paciente) y para un fallo del layout mismo.
//
// ── RECARGAR VA PRIMERO, por la misma razón que en la raíz ──
//
// `reset()` vuelve a rendir esta misma página del despliegue que ya está cargado; si el error fue un desfase
// de despliegue, falla igual. Recargar resuelve los dos casos, así que es la salida principal y "reintentar"
// la secundaria.
//
// EL TEXTO NO AFIRMA LA CAUSA, que en producción no se puede distinguir desde aquí. Dice qué hacer y dice lo
// único que el profesional necesita saber de verdad: que nada se perdió, porque esto son lecturas.
export default function ErrorDeLaApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El mensaje NO se construye con PHI: el scrub de Sentry redacta por clave, no el texto libre de una
    // excepción (SECURITY.md).
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Esta pantalla no cargó
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">No se pudo mostrar</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Ya registramos el problema. Recarga para volver a intentarlo: casi siempre lo resuelve. No se perdió
        nada, y el resto de Atlas sigue funcionando: puedes ir a otra pantalla desde el menú.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => window.location.reload()}>Recargar la página</Button>
        <Button variant="ghost" onClick={reset}>
          Reintentar sin recargar
        </Button>
      </div>
    </div>
  );
}
