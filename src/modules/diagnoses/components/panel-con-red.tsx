"use client";

import * as Sentry from "@sentry/nextjs";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

// ═══ UNA ETAPA QUE SE CAE NO SE LLEVA LA CONSULTA ENTERA (2026-10-07) ═══
//
// ── EL CASO QUE LO MOTIVA ──────────────────────────────────────────────────────────────────────────
//
// En producción, el 7 de octubre a las 14:54 UTC, un profesional pasó de Diagnóstico a Antrop. & BIS y
// React lanzó "Rendered more hooks than during the previous render." El `error.tsx` de la raíz lo atrapó,
// así que **toda la pantalla** se reemplazó por "Algo salió mal": el profesional perdió la consulta que
// estaba atendiendo, con el paciente delante.
//
// ── Y LO SEGUNDO, QUE ES LO QUE DESTRABA EL DIAGNOSTICO ────────────────────────────────────────────
//
// El `error.tsx` de Next recibe `{ error, reset }` y NADA MAS: no recibe el `errorInfo` de React, que es
// donde viaja el COMPONENT STACK. Así que por ese camino el evento de Sentry nunca iba a decir qué
// componente se rompió, **ni esperando a que volviera a pasar**. Un error de hooks sin el nombre del
// componente es un error que no se puede arreglar: dice que el conteo cambió, no dónde.
//
// Una frontera de clase SI recibe el `errorInfo`, y la de Sentry lo adjunta al evento. Por eso esto no es
// solo una red de seguridad: es el instrumento que falta.
//
// ── POR QUE POR PANEL Y NO ALREDEDOR DE TODO ───────────────────────────────────────────────────────
//
// Porque el fallo es de UNA etapa y las otras están sanas (siguen montadas, con su borrador dentro). Una
// frontera alrededor del conjunto se llevaría las seis, que es casi lo mismo que tener solo la de la raíz.
// Así la barra de pestañas sobrevive y el profesional se mueve a otra etapa y sigue trabajando.
//
// NO TAPA NADA: el evento se reporta igual (y mejor que antes, con el componente), y el panel dice en
// pantalla que falló en vez de quedarse en blanco. Lo que cambia es el alcance del daño, no si se sabe.
// ── EL FALLBACK VA FUERA, Y NO ES COSMETICA (2026-10-10) ──────────────────────────────────────────
//
// `Sentry.ErrorBoundary` rinde el fallback con `React.createElement(fallback, ...)`, o sea que lo trata
// como un COMPONENTE y su identidad es el TIPO. Escrito como una flecha dentro de `PanelConRed`, ese tipo
// era uno nuevo en cada render del padre, asi que React desmontaba y volvia a montar el aviso (y su
// subarbol) cada vez, en lugar de re-rendirlo.
//
// POR QUE SE TOCA AHORA: porque este es el camino donde Santiago detono "Rendered more hooks than during
// the previous render" el 2026-10-10, pulsando justo este boton. NO se afirma que fuera la causa (ese
// error apunta a un `useMemo` y llego por `window.onerror`, sin component stack), pero un tipo de
// componente que cambia en cada render es una fuente REAL de remontajes en el sitio exacto donde el arbol
// cambia de forma, y una pieza que se puede dejar quieta por diez lineas no deberia seguir moviendose
// mientras se busca un bug de identidad de hooks.
// ═══ EL CODIGO EN PANTALLA, Y POR QUE HACE FALTA (Santiago, 2026-11-03) ═══
//
// EL CASO: una integrante ve este aviso en Antrop. & BIS, admin entra a la MISMA consulta y la ve bien, y
// Sentry no tiene ni un evento. Con eso no se puede diagnosticar nada: no hay forma de unir lo que ella ve
// con ningun registro nuestro.
//
// DOS COSAS LO CAUSABAN. La primera, que el evento no llegaba (ver `tunel-de-errores`). La segunda es esta:
// en produccion, un error del SERVIDOR llega al navegador SIN MENSAJE, reducido a un `digest`, que es la
// clave con la que se encuentra en el registro del servidor. Este aviso lo tiraba.
//
// ASI QUE SE MUESTRA. Una captura de pantalla pasa a ser suficiente para encontrar el error, y eso cambia
// el diagnostico de "esperar a que vuelva a pasar con alguien delante" a "mirarlo". No es un detalle
// tecnico de mas: es un codigo corto, rotulado como lo que es, para pasarlo por WhatsApp.
//
// Y LA FRASE DEJA DE PROMETER LO QUE NO PUEDE: decia "ya registramos el problema" SIEMPRE, incluso cuando
// el envio se perdia. Ahora el aviso pide el codigo, que es una accion que el profesional si puede hacer.
//
// ═══ Y LA SALIDA QUE FALTABA: RECARGAR (2026-11-04) ═══
//
// Este aviso ofrecia UNA salida, "Volver a intentarlo", que es `resetError()`: vuelve a rendir el mismo
// subarbol DEL DESPLIEGUE QUE YA ESTA CARGADO. Para un fallo pasajero sirve. Para un DESFASE DE DESPLIEGUE
// no puede servir: si la pestaña quedo abierta desde antes de un despliegue, el trozo de JavaScript de ese
// panel ya no existe en el servidor, y reintentar falla exactamente igual, las veces que se pulse.
//
// ESA LECCION YA ESTABA ESCRITA EN ESTA CASA, en `app/(app)/error.tsx`: *"reset() vuelve a rendir esta
// misma pagina del despliegue que ya esta cargado; si el error fue un desfase de despliegue, falla igual.
// Recargar resuelve los dos casos, asi que es la salida principal"*. El limite de la raiz la aprendio y
// este no: la misma regla viviendo en dos sitios, aplicada en uno.
//
// Y CUADRA CON EL CASO QUE NO SE PUDO REPRODUCIR (la integrante del 3 de noviembre): una pestaña vieja
// explica las tres cosas raras a la vez, que ella no pudiera ver el panel, que un admin entrando de nuevo
// a la MISMA consulta lo viera bien, y que las demas pestañas le siguieran funcionando (las ya cargadas).
// **No se afirma que fuera eso**: se afirma que si lo es, hoy no tenia salida, y ahora la tiene.
//
// POR ESO EL DESFASE SE NOMBRA. Cuando el error es de esa familia (un trozo que no se pudo cargar), el
// aviso lo dice con palabras y recargar es lo unico que se ofrece: un "volver a intentarlo" que no puede
// funcionar es peor que no ofrecerlo, porque manda a pulsar el boton equivocado.
/**
 * ¿El fallo es de la familia del DESFASE DE DESPLIEGUE? Son los errores de carga de un trozo de
 * JavaScript: la pestaña quedo abierta desde antes de un despliegue y el archivo que pide ya no esta.
 * Los navegadores no lo dicen igual, asi que se mira el nombre y el mensaje, no uno de los dos.
 */
function esDesfaseDeDespliegue(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const texto = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i.test(
    texto,
  );
}

function AvisoDePanelCaido({ error, resetError }: { error: unknown; resetError: () => void }) {
  const digest =
    error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;
  const desfase = esDesfaseDeDespliegue(error);
  return (
    <div className="rounded-xl border border-clinical-warning bg-clinical-warning-bg p-6">
      <p className="text-sm font-semibold text-clinical-warning">Esta pestaña no se pudo mostrar</p>
      <p className="mt-1 max-w-prose text-sm text-foreground">
        {desfase ? (
          <>
            Esta pestaña se quedó con una <strong>versión anterior de Atlas</strong>. Recarga la página y
            vuelve a entrar: <strong>no se perdió nada de lo guardado</strong>.
          </>
        ) : (
          <>
            Las demás pestañas siguen funcionando y{" "}
            <strong>no se perdió nada de lo guardado</strong>. Si recargar no lo resuelve, avísanos.
          </>
        )}
      </p>
      {digest ? (
        <p className="mt-2 max-w-prose text-sm text-foreground">
          Si vuelve a pasar, pásale este código a soporte:{" "}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs font-semibold">
            {digest}
          </code>
        </p>
      ) : null}
      {/* RECARGAR VA PRIMERO, igual que en el limite de la raiz: resuelve los dos casos (el fallo pasajero
          y el desfase de despliegue), y reintentar solo resuelve uno. Con el desfase, "volver a intentarlo"
          NO SE OFRECE: no puede funcionar, y un boton que no puede funcionar manda a pulsarlo otra vez. */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => window.location.reload()}>
          Recargar la página
        </Button>
        {desfase ? null : (
          <Button size="sm" variant="ghost" onClick={() => resetError()}>
            Volver a intentarlo
          </Button>
        )}
      </div>
    </div>
  );
}

export function PanelConRed({ etapa, children }: { etapa: string; children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      // El nombre de la etapa viaja al evento: sin él, los seis paneles se agrupan en el mismo issue.
      //
      // Y EL `digest` TAMBIEN, como etiqueta: es lo UNICO que une lo que el profesional ve en pantalla con
      // el evento del servidor. Sin él, aunque los dos lleguen a Sentry, son dos registros sueltos y hay
      // que adivinar cuál va con cuál.
      beforeCapture={(scope, error) => {
        scope.setTag("etapa", etapa);
        const digest =
          error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
            ? error.digest
            : null;
        if (digest) scope.setTag("digest", digest);
        // Y SI ES UN DESFASE DE DESPLIEGUE, etiquetado: son fallos de otra naturaleza (no hay nada roto en
        // el codigo) y mezclados con los demas vuelven ilegible el issue.
        if (esDesfaseDeDespliegue(error)) scope.setTag("desfase_de_despliegue", "si");
      }}
      fallback={AvisoDePanelCaido}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
