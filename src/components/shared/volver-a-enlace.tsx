"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PARAM_ORIGEN, destinoDeVuelta, etiquetaDeDestino } from "./volver-a-destino";

// LA MITAD QUE LEE LA URL. Va aparte de `volver-a.tsx` porque leer los parámetros de la dirección solo se
// puede desde el navegador, y la pantalla que lo usa se rinde en el servidor. Quien decide qué texto y qué
// destino es el módulo neutro; aquí solo se pinta.

// EL COLOR SE HEREDA, NO SE FIJA, y es un DEFECTO CORREGIDO (2026-08-28). Llevaba `text-muted-foreground`
// (#565b6a), un gris pensado para fondo claro; al meter el enlace dentro del bloque de titulo en ink quedo
// a 2,32:1, muy por debajo de AA, y casi no se veia. Con `text-current` a 70% hereda del contenedor: 8,35:1
// sobre el bloque oscuro y 6,69:1 sobre blanco, practicamente lo mismo que antes en las pantallas claras.
//
// ES LA MISMA FAMILIA QUE EL LOGO SOBRE NAVY: un componente que fija un color pensado para UN fondo se
// vuelve ilegible en cuanto lo ponen en otro, y no falla ruidoso, solo se apaga. La regla general: en un
// componente compartido que puede vivir en cualquier superficie, el color se HEREDA; quien pone el fondo
// es quien sabe que color va encima.
const ASPECTO =
  "w-fit text-sm text-current opacity-70 underline-offset-4 transition-opacity hover:opacity-100 hover:underline";

/** El enlace fijo: el padre declarado, sin mirar la URL. Es también el respaldo mientras la URL se lee. */
export function EnlaceDeVuelta({ destino }: { destino: string }) {
  return (
    <Link href={destino} className={ASPECTO}>
      {etiquetaDeDestino(destino)}
    </Link>
  );
}

/** El enlace dinámico: si la dirección dice de dónde se viene, gana sobre el padre declarado. */
export function EnlaceDeVueltaAlOrigen({ padre }: { padre: string }) {
  const parametros = useSearchParams();
  return <EnlaceDeVuelta destino={destinoDeVuelta(padre, parametros.get(PARAM_ORIGEN))} />;
}
