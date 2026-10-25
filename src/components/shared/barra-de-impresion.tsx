"use client";

import { Printer } from "lucide-react";

import { imprimirHoja } from "@/components/shared/imprimir-hoja";
import { Button } from "@/components/ui/button";

// ═══ EL BOTON DE IMPRIMIR, EN EL MISMO SITIO EN TODAS LAS SUBPESTAÑAS (Gildardo, 2026-10-25) ═══
//
// ── DE DONDE SALE ───────────────────────────────────────────────────────────────────────────────────
//
// *"Gildardo lo pidio global. Santiago no ve el de Nutricionista: dile donde quedo. Ubicacion: arriba,
// debajo del menu de subpestañas, igual en todas."*
//
// Y TENIA RAZON EN QUE NO SE VEIA. El de Nutricionista estaba en la CABECERA DE LA TARJETA de la
// prescripcion, o sea: detras del estado del paciente, detras de la barra de subpestañas y detras del
// titulo de la tarjeta. Existia y pasaba los candados; lo que no hacia era aparecer donde alguien lo
// busca. Un control que esta y no se encuentra se reporta como que no esta, y con razon.
//
// ── POR QUE UN COMPONENTE Y NO "ponerlo arriba en cada una" ──────────────────────────────────────────
//
// Porque "igual en todas" es la peticion, y eso no se consigue repitiendo el mismo bloque en ocho sitios:
// se consigue teniendo uno. Antes de esto habia TRES escrituras del mismo bloque (la hoja del diagnostico
// funcional, la del protocolo y `HojaImprimible`), cada una con su rotulo y su posicion. La cuarta copia
// habria heredado la que tuviera mas a mano.
//
// ── TIENE QUE VIVIR DENTRO DE LA HOJA ───────────────────────────────────────────────────────────────
//
// `imprimirHoja` SUBE desde el boton buscando su `.imprimible` y la marca como activa, para que salga esa
// hoja y no todas las que esten montadas. Un boton colocado FUERA de su hoja no encontraria ninguna y
// caeria a imprimir la pagina entera, que es peor que no ofrecer el boton. Por eso esto es el primer hijo
// de la hoja, no un elemento de la barra de subpestañas.
export function BarraDeImpresion({
  titulo,
  descripcion,
  etiqueta,
  motivoApagado = null,
}: {
  /** Que es lo que se imprime. En una linea, no el nombre de la pantalla. */
  titulo: string;
  /** Que sale en el papel, para que nadie pulse a ciegas. */
  descripcion: string;
  etiqueta: string;
  /**
   * Por que NO se puede imprimir ahora. Apaga el boton y se dice EN EL ROTULO, no en un aviso aparte
   * (hazard 8): un boton muerto sin explicacion se lee como que el sistema esta roto.
   *
   * El caso que lo pide es la prescripcion: la hoja se arma con lo GUARDADO, asi que con cambios en
   * pantalla sin guardar imprimiria una cifra que no consta en ningun sitio.
   */
  motivoApagado?: string | null;
}) {
  const apagado = motivoApagado !== null;
  return (
    <div className="no-print flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <p className="max-w-prose text-xs text-muted-foreground">{descripcion}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={apagado}
        onClick={(e) => imprimirHoja(e.currentTarget)}
      >
        <Printer className="size-4" aria-hidden />
        {apagado ? motivoApagado : etiqueta}
      </Button>
    </div>
  );
}
