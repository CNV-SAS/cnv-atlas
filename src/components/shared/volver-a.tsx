import Link from "next/link";

// VOLVER A: la salida de una pantalla de detalle hacia lo que la contiene.
//
// POR QUE EXISTE. Una pantalla de detalle sin salida es un callejon: el profesional entra a una
// evaluacion desde la ficha del paciente y, para volver, tiene que usar el boton del navegador o
// rehacer el camino por la barra lateral. En una pantalla larga (el panel del nutricionista pasa de
// mil lineas) eso se paga en cada consulta.
//
// POR QUE COMPARTIDO Y NO SUELTO. Ya existia en /pacientes/[id] escrito a mano; al ponerlo tambien en
// /evaluaciones/[id] serian dos copias, y a la tercera pantalla habria tres aspectos distintos de la
// misma idea. Es el mismo problema que acabamos de resolver con los bloques: cuatro dialectos para
// decir lo mismo.
//
// Es un enlace, NO un boton de "atras" del historial: lleva a un sitio CONCRETO y no a "lo anterior".
// La diferencia importa cuando se llega desde un enlace externo o desde un correo, donde el historial
// no tiene a donde volver.
// EL COLOR SE HEREDA, NO SE FIJA, y es un DEFECTO CORREGIDO (2026-08-28). Llevaba `text-muted-foreground`
// (#565b6a), un gris pensado para fondo claro; al meter el enlace dentro del bloque de titulo en ink quedo
// a 2,32:1, muy por debajo de AA, y casi no se veia. Con `text-current` a 70% hereda del contenedor: 8,35:1
// sobre el bloque oscuro y 6,69:1 sobre blanco, practicamente lo mismo que antes en las pantallas claras.
//
// ES LA MISMA FAMILIA QUE EL LOGO SOBRE NAVY: un componente que fija un color pensado para UN fondo se
// vuelve ilegible en cuanto lo ponen en otro, y no falla ruidoso, solo se apaga. La regla general: en un
// componente compartido que puede vivir en cualquier superficie, el color se HEREDA; quien pone el fondo
// es quien sabe que color va encima.
export function VolverA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="w-fit text-sm text-current opacity-70 underline-offset-4 transition-opacity hover:opacity-100 hover:underline"
    >
      {children}
    </Link>
  );
}
