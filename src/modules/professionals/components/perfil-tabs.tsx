"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { PESTANAS, parsePestana } from "../pestanas";

// Shell de pestañas del perfil. El contenido de las CUATRO se computa en el SERVIDOR y llega como prop
// (ReactNode): asi cambiar de pestaña no pide nada y no se pierde la RLS del servidor.
//
// ── POR QUE `replaceState` Y NO UN `<Link>` (corregido el 2026-09-25) ──
//
// La primera version usaba `<Link href="?pestana=...">` con este argumento: "una pestaña es una direccion, asi
// se puede abrir en otra ventana". SONABA BIEN Y ESTABA MAL, y Santiago lo vio enseguida: cambiar de pestaña
// tardaba 1 a 2 segundos, y el flujo clinico, que es mucho mas pesado, es instantaneo.
//
// LA RAZON ES QUE UN `<Link>` NAVEGA: vuelve al servidor y REHACE LA PAGINA ENTERA, o sea las cinco lecturas
// (perfil, tributaria, modalidad, adjuntos y el retro-relleno del RUT)... PARA VOLVER A MANDAR EL MISMO
// CONTENIDO, porque los cuatro paneles ya habian llegado en la primera carga. El viaje no traia nada nuevo.
//
// `window.history.replaceState` cambia la URL SIN navegar, y desde Next 14.1 el App Router lo integra: el
// `useSearchParams` de este componente se re-rinde con el valor nuevo. Es exactamente el mecanismo que ya usa
// `EvaluationTabs`, y su comentario lo dice con las mismas palabras: "el contenido ya llego del servidor, asi
// que conmutar es instantaneo (sin refetch)".
//
// LO QUE SE PIERDE es abrir una pestaña con el clic del medio. Lo que se gana es que abrirla sea instantaneo.
// La direccion sigue viva: la URL se actualiza, asi que recargar, compartir y volver con el boton de atras
// llegan a la pestaña correcta, que era la mitad que de verdad importaba del argumento original.
export function PerfilTabs({
  datos,
  tributaria,
  bancaria,
  adjuntos,
}: {
  datos: ReactNode;
  tributaria: ReactNode;
  bancaria: ReactNode;
  adjuntos: ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activa = parsePestana(params.get("pestana"));

  function conmutar(id: string) {
    // Copia los demas parametros y fija solo el propio, para que ninguno pise al otro.
    const siguiente = new URLSearchParams(params.toString());
    siguiente.set("pestana", id);
    window.history.replaceState(null, "", `${pathname}?${siguiente.toString()}`);
  }

  const contenido: Record<string, ReactNode> = { datos, tributaria, bancaria, adjuntos };

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Secciones del perfil"
        className="flex flex-wrap gap-1 overflow-x-auto border-b border-border"
      >
        {PESTANAS.map((p) => {
          const esActiva = p.id === activa;
          return (
            <button
              key={p.id}
              id={`tab-perfil-${p.id}`}
              role="tab"
              type="button"
              aria-selected={esActiva}
              aria-controls={`panel-perfil-${p.id}`}
              onClick={() => conmutar(p.id)}
              className={
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (esActiva
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {p.titulo}
            </button>
          );
        })}
      </div>

      {/* LAS CUATRO SE MONTAN Y SE OCULTAN CON `hidden`, no se desmontan. Aqui importa por lo mismo que en el
          flujo clinico: son formularios, y desmontar el de la pestaña anterior borraria lo que el integrante
          acababa de escribir si se va un momento a mirar otra cosa. */}
      {PESTANAS.map((p) => (
        <div
          key={p.id}
          role="tabpanel"
          id={`panel-perfil-${p.id}`}
          aria-labelledby={`tab-perfil-${p.id}`}
          hidden={p.id !== activa}
        >
          {contenido[p.id]}
        </div>
      ))}
    </div>
  );
}
