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
  // ═══ LA PAGINA QUEDO DE UN DESPLIEGUE ANTERIOR ═══
  //
  // Llama una Server Action que el servidor nuevo ya no tiene (se redesplego con la pagina abierta). No es un
  // fallo del sistema: se resuelve recargando.
  //
  // ── Y AQUI HABIA UNA AFIRMACION FALSA, VERIFICADA EL 2026-10-07 ────────────────────────────────────
  //
  // Este comentario decia: "el mensaje de este error es de cliente (no lo redacta Next en produccion), asi
  // que se puede detectar". NO ES CIERTO para este caso, y se comprobo en el codigo de Next 16:
  //
  //   1. El servidor lanza un Error PELADO (`Failed to find Server Action...`) dentro del handler de la
  //      accion, asi que en produccion Next responde 500 y NO manda el mensaje en el cuerpo.
  //   2. El cliente solo usa el texto del servidor si la respuesta es `content-type: text/plain`
  //      (`server-action-reducer.js`: `res.status >= 400 && contentType === 'text/plain'`). Si no, lanza el
  //      generico "An unexpected response was received from the server."
  //
  // O SEA QUE EN PRODUCCION ESTA DETECCION NO SE CUMPLE NUNCA, y la rama que se escribio justo para este caso
  // era codigo muerto. Lo encontro un warning en los logs de Vercel ("Failed to find Server Action... older or
  // newer deployment") al lado del 500 que se le fue a una paciente respondiendo la encuesta en su celular.
  //
  // SE CONSERVA porque en desarrollo y en los caminos donde Next SI manda `text/plain` sigue acertando, y
  // cuando acierta el mensaje es mejor. Lo que cambia es que ya no se confia en ella: la rama generica de
  // abajo ofrece RECARGAR, que es lo que de verdad resuelve este caso.
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
          {/* ═══ RECARGAR VA PRIMERO, Y NO ES PREFERENCIA (2026-10-07) ═══

              `reset()` vuelve a rendir ESTA MISMA pagina, que es la del despliegue viejo. Si el error fue un
              desfase de despliegue (la causa confirmada del 500 que se le fue a una paciente en la encuesta),
              reintentar pide otra vez la accion que ya no existe y FALLA IGUAL. El paciente se queda pulsando
              un boton que no puede funcionar.

              Recargar trae el despliegue nuevo y lo resuelve. Y en un fallo pasajero tambien sirve, asi que es
              la salida correcta en los dos casos, no solo en uno.

              EL TEXTO NO AFIRMA LA CAUSA, porque en produccion no se puede distinguir (ver arriba): dice que
              recargar suele resolverlo, que es verdad, y no "Atlas se actualizo", que seria adivinar. */}
          <p className="max-w-prose text-muted-foreground">
            Ya registramos el problema. Recarga la página para seguir: casi siempre lo resuelve. Lo que ya
            habías guardado está a salvo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Recargar la página</Button>
            <Button variant="ghost" onClick={reset}>
              Reintentar sin recargar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
