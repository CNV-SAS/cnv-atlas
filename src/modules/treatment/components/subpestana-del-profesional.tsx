"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { BarraDeImpresion } from "@/components/shared/barra-de-impresion";

import { seccionesSucias } from "../data/borrador-protocolo";
import { BorradorContexto, crearAlmacenBorrador } from "./borrador-contexto";

// ═══ LA SUBPESTAÑA DEL PROFESIONAL, CON SU BOTON DE IMPRIMIR ARRIBA (Gildardo, 2026-10-25) ═══
//
// ── EL DEFECTO QUE CIERRA, Y NO ERA QUE FALTARA EL BOTON ─────────────────────────────────────────────
//
// *"Santiago no ve el de Nutricionista: dile donde quedo."* Estaba en la CABECERA DE LA TARJETA de la
// prescripcion: detras del estado del paciente, detras de la barra de subpestañas y detras del titulo de
// la tarjeta. Existia, funcionaba y pasaba sus candados. Lo que no hacia era estar donde alguien lo busca.
//
// **Un control que existe y no se encuentra se reporta como que no existe, y el reporte es correcto.** No
// es un problema de descubribilidad menor: la decision de Gildardo (*"arriba, debajo del menu de
// subpestañas, igual en todas"*) es la que convierte ocho botones repartidos en un solo sitio aprendido.
//
// ── POR QUE ESTE ENVOLTORIO EXISTE, Y NO SE PUSO EL BOTON Y YA ───────────────────────────────────────
//
// Porque el boton NO PUEDE perder su guarda: la hoja se arma con la prescripcion GUARDADA, asi que con
// cambios en pantalla sin guardar imprimiria una cifra que no consta en ningun sitio. Esa guarda vive en
// el borrador, que nace DENTRO del panel; y la barra va ENCIMA del panel.
//
// La salida no es duplicar el estado (dos verdades que hay que sincronizar, y la de la barra seria la que
// se queda vieja): es que el ALMACEN del borrador lo cree este envoltorio y el panel lo HEREDE. Dos
// suscriptores del mismo almacen, que es justo lo que un almacen externo permite y un `useState` no.
//
// ── Y LA BARRA VA DENTRO DE LA HOJA ─────────────────────────────────────────────────────────────────
//
// `imprimirHoja` sube desde el boton buscando su `.imprimible`. Una barra colocada fuera no encontraria
// hoja y caeria a imprimir la pagina entera. Por eso el `.imprimible` envuelve barra + hoja + taller, y la
// barra es su primer hijo: en pantalla eso es justo debajo del menu de subpestañas.
export function SubpestanaDelProfesional({
  /** El documento (la hoja de papel). null = sin encabezado no hay documento que ofrecer. */
  hoja,
  /** La pantalla de trabajo. Va `no-print` completa: son 3.500 lineas de campos en vivo. */
  taller,
  /** Que sale en el papel, para el rotulo de la barra. */
  queSale,
  etiquetaBoton,
}: {
  hoja: ReactNode;
  taller: ReactNode;
  queSale: string;
  etiquetaBoton: string;
}) {
  const almacen = useMemo(() => crearAlmacenBorrador(), []);
  const publicado = useSyncExternalStore(almacen.suscribir, almacen.leer, almacen.leer);
  const haySinGuardar = seccionesSucias(publicado).length > 0;

  // `guardando: false` A PROPOSITO: este envoltorio no guarda nada. El panel vuelve a proveer el contexto
  // con SU `guardando` (el que apaga los campos mientras el guardado esta en vuelo), y ese es el que ven
  // las secciones. Aqui solo hace falta el almacen.
  const ctx = useMemo(() => ({ almacen, guardando: false }), [almacen]);

  return (
    <BorradorContexto.Provider value={ctx}>
      <div className={hoja ? "imprimible flex flex-col gap-6" : "flex flex-col gap-6"}>
        {hoja ? (
          <BarraDeImpresion
            titulo="Imprimir la prescripción"
            descripcion={queSale}
            etiqueta={etiquetaBoton}
            // SE DICE EN EL ROTULO, no en un aviso aparte (hazard 8): un boton muerto sin explicacion se
            // lee como que el sistema esta roto. Y la barra pegajosa del panel ya dice QUE seccion cambio.
            motivoApagado={haySinGuardar ? "Guarda los cambios para imprimir" : null}
          />
        ) : null}
        {hoja}
        <div className={hoja ? "no-print flex flex-col gap-6" : "flex flex-col gap-6"}>{taller}</div>
      </div>
    </BorradorContexto.Provider>
  );
}
