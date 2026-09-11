import Link from "next/link";

import type { NavGrupoVisible } from "@/components/layout/nav-config";
import { TituloSeccion } from "@/components/shared/titulo-pantalla";

import { QUE_HACE } from "../que-hace";

// ═══ QUE HAY DETRAS DE CADA ENTRADA DEL MENU (Santiago, 2026-09-10, punto 1c) ═══
//
// SU RAZON, y vale más de lo que parece: un profesional nuevo no sabe qué hay detrás de cada item del
// sidebar. Hoy la única forma de averiguarlo es entrar a las dieciséis y mirar, y en una aplicación
// clínica eso significa abrir pantallas que no se sabe si tocan datos de un paciente.
//
// ── POR QUE SE DERIVA DEL SIDEBAR Y NO ES UNA LISTA A MANO ──────────────────────────────────────────
//
// Porque si no, envejece. Una lista escrita aparte se queda con la entrada que se retiró y sin la que se
// añadió, y nadie se entera: no da error, solo miente. Aquí las entradas salen de `navGroupsForRoles`, la
// MISMA fuente que pinta la barra, así que lo que se lista es exactamente lo que el usuario tiene.
//
// Y POR ESO SOLO SE ESCRIBE LA EXPLICACION (`QUE_HACE`), que es lo único que el sidebar no sabe. Si algún
// día falta una, la entrada aparece igual con su rótulo: se degrada a lo que ya había, nunca desaparece.
export function Funcionalidades({ grupos }: { grupos: NavGrupoVisible[] }) {
  const items = grupos.flatMap((g) => g.items);
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-1">
        <TituloSeccion>Qué hay en cada sección</TituloSeccion>
        <p className="text-sm text-muted-foreground">
          Solo aparecen las secciones a las que tienes acceso.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <span className="text-sm font-semibold text-foreground">{i.label}</span>
            {/* SIN EXPLICACION SE PINTA IGUAL, solo con el rótulo: la tarjeta sigue llevando a su sitio,
                que es la mitad del valor. Ocultarla sería castigar al usuario por un texto que falta. */}
            {QUE_HACE[i.href] ? (
              <span className="text-sm text-muted-foreground">{QUE_HACE[i.href]}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
