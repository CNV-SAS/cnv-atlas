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
export function VolverA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
