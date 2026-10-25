"use client";

import { createContext, useContext, useEffect } from "react";

import {
  type Publicado,
  type SeccionId,
} from "../data/borrador-protocolo";

// ═══ EL BORRADOR DEL PROTOCOLO: SU ALMACEN Y SU CONTEXTO ═══
//
// SALIO DE `treatment-panel.tsx` EL 2026-10-25, al mover el boton de imprimir arriba (Gildardo: "debajo
// del menu de subpestañas, igual en todas"). La barra de impresion tiene que saber si hay cambios sin
// guardar, porque la hoja se arma con lo GUARDADO; y esta ARRIBA del panel, asi que no puede leer un
// estado que nace dentro de el.
//
// LA FORMA DE RESOLVERLO ES LA QUE YA ESTABA: el almacen externo. Lo unico que cambia es QUIEN lo crea.
// Ahora puede crearlo un envoltorio de mas arriba y el panel lo HEREDA; si no hay envoltorio, el panel
// crea el suyo y todo sigue igual. Dos suscriptores del mismo almacen, no dos estados que sincronizar.

/**
 * EL ALMACEN DEL BORRADOR, fuera de React a proposito.
 *
 * POR QUE NO ES `useState` DEL PADRE. Una seccion publica desde un efecto, y llamar al `setState` del
 * padre dentro del efecto de un hijo encadena renders (es lo que señala la regla `set-state-in-effect`, y
 * con razon: siete secciones publicando en cascada). Un almacen externo es justo el caso que React
 * documenta para esto: el hijo ACTUALIZA UN SISTEMA EXTERNO, y el padre se SUSCRIBE con
 * `useSyncExternalStore`. Un solo re-render del padre por cambio real, y ninguno por publicar lo mismo.
 *
 * EL GUARD CONTRA EL BUCLE sigue siendo la FIRMA: publicar lo mismo no notifica a nadie.
 */
export type AlmacenBorrador = {
  publicar: (seccion: SeccionId, valor: unknown, firma: string, firmaBase: string) => void;
  leer: () => Partial<Record<SeccionId, Publicado>>;
  suscribir: (oyente: () => void) => () => void;
};

export function crearAlmacenBorrador(): AlmacenBorrador {
  let estado: Partial<Record<SeccionId, Publicado>> = {};
  const oyentes = new Set<() => void>();
  return {
    publicar(seccion, valor, firma, firmaBase) {
      const previo = estado[seccion];
      // LAS DOS entran en el guard: la base tambien se mueve (los tiempos activos en vivo cambian el
      // contexto de la distribucion), y comparar solo la de pantalla dejaria al padre sin enterarse.
      if (previo?.firma === firma && previo?.firmaBase === firmaBase) return;
      // Objeto NUEVO en cada cambio: `useSyncExternalStore` compara por identidad, y mutar el mismo dejaria
      // al padre sin enterarse.
      estado = { ...estado, [seccion]: { valor, firma, firmaBase } };
      for (const o of oyentes) o();
    },
    leer: () => estado,
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
  };
}

export type BorradorCtx = {
  almacen: AlmacenBorrador;
  /** Hay un guardado en vuelo: los campos se apagan para que no se pierda lo que se escriba encima. */
  guardando: boolean;
};

export const BorradorContexto = createContext<BorradorCtx | null>(null);

export function useBorrador(): BorradorCtx {
  const ctx = useContext(BorradorContexto);
  // No se cae con undefined en produccion: una seccion fuera del panel es un error de programacion, y el
  // mensaje tiene que decir cual es en vez de reventar en un `publicar of undefined`.
  if (!ctx) throw new Error("Una sección del protocolo se renderizó fuera del panel de tratamiento.");
  return ctx;
}

/**
 * Publica el borrador de una seccion cada vez que su firma cambia.
 *
 * SE PUBLICA EN UN EFECTO Y NO EN EL RENDER porque cambiar el estado del padre durante el render del hijo
 * es justo lo que React prohibe. El efecto corre despues de pintar, asi que el aviso pegajoso aparece un
 * ciclo despues de teclear, que es imperceptible y es el precio de no reescribir las siete secciones.
 */
export function usePublicar(
  seccion: SeccionId,
  valor: unknown,
  firma: string | null,
  /** La firma de lo que esta seccion presentaria SIN TOCARLA. Es contra lo que se decide si hay cambios. */
  firmaBase: string | null,
): void {
  const { almacen } = useBorrador();
  useEffect(() => {
    // FIRMA NULA = LA SECCION NO APLICA (un tratamiento sin snapshot sellado no tiene cadena ni lista de
    // intercambio que publicar). Se llama al hook igual, sin condicion, porque el orden de los hooks no
    // puede depender de los datos; lo que se salta es la publicacion.
    if (firma == null || firmaBase == null) return;
    almacen.publicar(seccion, valor, firma, firmaBase);
    // `valor` se omite a proposito: la FIRMA es lo que decide si algo cambio, y el valor puede ser un
    // objeto nuevo en cada render (un `.map`, un literal) sin que nada haya cambiado de verdad. Con el
    // valor en las dependencias, el efecto correria en cada render y el guard del padre seria lo unico
    // que impediria el bucle; con la firma, ni siquiera se llega ahi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacen, seccion, firma, firmaBase]);
}
