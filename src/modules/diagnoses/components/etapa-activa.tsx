"use client";

import { createContext, useContext, type ReactNode } from "react";

// ¿LA ETAPA EN LA QUE VIVO ESTA VISIBLE? (2026-09-10)
//
// EL DEFECTO QUE ESTO CIERRA, y lo introduje yo el dia anterior. El panel de diagnostico dispara el
// pipeline en un efecto cuando se cumple la condicion (identidad confirmada + BIS importado). Mientras
// cambiar de pestaña DESMONTABA la anterior, ese efecto solo podia correr estando en Diagnostico. Al hacer
// que una etapa visitada NO se desmonte (para no perder el borrador del tratamiento), el efecto quedo
// ARMADO en segundo plano: Santiago entro a Diagnostico sin BIS, vio el bloqueo correcto, se fue a
// importar el xlsx, y el refresco del import volteo la condicion y el diagnostico se genero SOLO, sin
// volver a la pestaña y sin que hubiera puesto el peso meta ni la prensil.
//
// O SEA QUE FUERON LAS DOS COSAS A LA VEZ: el efecto quedo armado (por el montaje persistente) Y el
// refresco reevaluo la condicion. Ninguna de las dos por separado bastaba.
//
// LA REGLA QUE ESTO IMPONE: un efecto que dispara un ACTO CLINICO tiene que colgar de ENTRAR a la pantalla,
// no de que la condicion se cumpla estando en otra. Con el montaje persistente, "estar montado" dejo de
// significar "estar a la vista", y todo lo que dependia de esa equivalencia hay que decirlo explicito.
//
// POR DEFECTO `true`: un panel renderizado fuera de las pestañas se comporta como siempre. Es el valor
// seguro para todo lo que NO dispara nada; el unico consumidor que hoy lo mira es el que dispara.
const EtapaActivaContexto = createContext(true);

export function EtapaActiva({ activa, children }: { activa: boolean; children: ReactNode }) {
  return <EtapaActivaContexto.Provider value={activa}>{children}</EtapaActivaContexto.Provider>;
}

/** `true` si la etapa que contiene a este componente es la que el profesional esta viendo. */
export function useEtapaActiva(): boolean {
  return useContext(EtapaActivaContexto);
}
