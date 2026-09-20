"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { PARAM_ORIGEN, conOrigen } from "./volver-a-destino";

// EL HELPER DE ENLAZAR (observación b). Quien escribe un enlace hacia una pantalla de detalle no tiene que
// acordarse de nada: envuelve el destino con esto y el "volver" del otro lado ya sabe de dónde viene.
//
// POR QUE UN HOOK Y NO UNA FUNCION SUELTA: la dirección actual solo se conoce en el navegador. Las
// pantallas que enlazan desde el servidor conocen su propia ruta literal y usan `conOrigen` directo.

/**
 * Devuelve una función que añade la dirección ACTUAL como origen del enlace.
 *
 * El propio `?desde=` se descarta al componer: si no, cada salto arrastraría el anterior y la dirección
 * crecería sin final. Lo que se guarda es de dónde vienes AHORA, no la cadena entera.
 */
export function useConOrigen(): (destino: string) => string {
  const ruta = usePathname();
  const parametros = useSearchParams();

  const limpios = new URLSearchParams(parametros.toString());
  limpios.delete(PARAM_ORIGEN);
  const busqueda = limpios.toString();
  const origen = busqueda ? `${ruta}?${busqueda}` : ruta;

  return (destino: string) => conOrigen(destino, origen);
}
