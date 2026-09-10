"use client";

import { useSyncExternalStore } from "react";

// ═══ SI LA BARRA ESTA COLAPSADA, Y QUE LO RECUERDE ENTRE PANTALLAS (Santiago, 2026-09-10) ═══
//
// SU CUIDADO ERA JUSTO ESTE: "si se colapsa y vuelve a abrirse al navegar, estorba mas de lo que ayuda".
// Y no es una preferencia menor: quien colapsa la barra lo hace para ganar ancho en una pantalla larga
// (el panel del nutricionista pasa de las mil lineas), asi que reabrirse al cambiar de seccion deshace
// exactamente lo que se pidio.
//
// ── POR QUE `useSyncExternalStore` Y NO UN ESTADO CON EFECTO ────────────────────────────────────────
//
// Lo natural seria `useState(false)` y leer `localStorage` en un efecto. No se puede: la regla
// `react-hooks/set-state-in-effect` prohibe llamar a setState dentro de un efecto, y ademas ese patron
// pinta la barra ABIERTA y la cierra despues, que es un parpadeo en cada carga.
//
// `useSyncExternalStore` resuelve las dos: lee la preferencia en el propio render (`leer`) y tiene una
// instantanea de SERVIDOR distinta (`false`, la barra abierta), que es la unica respuesta honesta cuando
// no hay navegador. Es el mismo mecanismo que usa el borrador del panel de tratamiento.
//
// ── POR QUE `localStorage` Y NO LA BASE ────────────────────────────────────────────────────────────
//
// Es una preferencia de ESTE dispositivo, no del profesional: la misma persona en el portatil de consulta
// y en la pantalla grande no quiere lo mismo. Y no es dato sensible, asi que no cae en la prohibicion de
// guardar informacion clinica en el navegador. Si el acceso falla (modo privado, cookies bloqueadas), se
// cae a la barra abierta, que es el estado que no esconde nada.

const CLAVE = "atlas:nav-colapsada";

const oyentes = new Set<() => void>();

function avisar(): void {
  for (const o of oyentes) o();
}

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  // OTRA PESTAÑA TAMBIEN CUENTA: `storage` solo dispara en las demas pestañas, asi que si el profesional
  // colapsa en una, la otra se entera sin recargar.
  window.addEventListener("storage", cb);
  return () => {
    oyentes.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function leer(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

/** En el servidor no hay preferencia: la barra se rinde ABIERTA, que es lo que no esconde nada. */
const enServidor = () => false;

/** Si la barra lateral esta colapsada a iconos. */
export function useNavColapsada(): boolean {
  return useSyncExternalStore(suscribir, leer, enServidor);
}

/** Colapsa o expande la barra, y lo recuerda. */
export function alternarNavColapsada(): void {
  try {
    window.localStorage.setItem(CLAVE, leer() ? "0" : "1");
  } catch {
    // Sin almacenamiento no hay preferencia que guardar: la barra se queda como este hasta recargar.
  }
  avisar();
}
