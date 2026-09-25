"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { PESTANAS, parsePestana } from "../pestanas";

// Shell de pestañas del perfil. El contenido de cada una se computa en el SERVIDOR y llega como prop
// (ReactNode): asi cambiar de pestaña no refetchea y no se pierde la RLS del servidor.
//
// LA PESTAÑA ACTIVA VIVE EN LA URL (?pestana=...), NO en useState, y es la leccion que ya nos costo un bug en
// las etapas de la evaluacion: con estado local, recargar o compartir un enlace SIEMPRE abre en la primera,
// sin importar donde estaba la persona. Al conmutar se COPIAN los demas parametros y solo se fija el propio.
//
// SON ENLACES Y NO BOTONES: una pestaña es una direccion. Asi se puede abrir en otra ventana, compartir y
// volver con el boton de atras, que es lo que la gente espera de algo que cambia lo que se ve.
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

  const hrefDe = (id: string) => {
    const siguiente = new URLSearchParams(params.toString());
    siguiente.set("pestana", id);
    return `${pathname}?${siguiente.toString()}`;
  };

  const contenido = { datos, tributaria, bancaria, adjuntos };

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Secciones del perfil" className="flex flex-wrap gap-1 border-b border-border">
        {PESTANAS.map((p) => {
          const esActiva = p.id === activa;
          return (
            <Link
              key={p.id}
              href={hrefDe(p.id)}
              scroll={false}
              aria-current={esActiva ? "page" : undefined}
              className={
                esActiva
                  ? "-mb-px border-b-2 border-primary px-3 py-2 text-sm font-medium text-foreground"
                  : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {p.titulo}
            </Link>
          );
        })}
      </nav>
      <div>{contenido[activa]}</div>
    </div>
  );
}
