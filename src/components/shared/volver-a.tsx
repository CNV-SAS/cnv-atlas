import { Suspense } from "react";

import { EnlaceDeVuelta, EnlaceDeVueltaAlOrigen } from "./volver-a-enlace";

// VOLVER A: la salida de una pantalla de detalle hacia lo que la contiene.
//
// POR QUE EXISTE. Una pantalla de detalle sin salida es un callejon: el profesional entra a una
// evaluacion desde la ficha del paciente y, para volver, tiene que usar el boton del navegador o
// rehacer el camino por la barra lateral. En una pantalla larga (el panel del nutricionista pasa de
// mil lineas) eso se paga en cada consulta.
//
// POR QUE COMPARTIDO Y NO SUELTO. Ya existia en /pacientes/[id] escrito a mano; al ponerlo tambien en
// /ani-bis-e/[id] serian dos copias, y a la tercera pantalla habria tres aspectos distintos de la
// misma idea. Es el mismo problema que resolvieron los bloques: cuatro dialectos para decir lo mismo.
//
// Es un enlace, NO un boton de "atras" del historial: lleva a un sitio CONCRETO y no a "lo anterior".
// La diferencia importa cuando se llega desde un enlace externo o desde un correo, donde el historial
// no tiene a donde volver.
//
// ═══ DINAMICO CON RESPALDO FIJO (observacion b, 2026-09-20) ═══
//
// RECIBE EL PADRE, NO EL DESTINO: el padre es lo que la pantalla SABE (quien la contiene); de donde viene
// el profesional lo sabe el enlace que lo trajo, y llega por la URL. Si llega, gana; si no, el padre.
//
// Y NO RECIBE TEXTO. El rotulo sale del destino (`etiquetaDeDestino`), porque un texto escrito a mano se
// queda pegado al destino viejo el dia que hay dos vias de entrada. Eso ya paso una vez, con el SOAP.
//
// SUSPENSE: leer los parametros de la direccion es cosa del navegador, y Next exige que esa lectura este
// envuelta. El respaldo mientras tanto no es un hueco, es el enlace al PADRE: el destino seguro.
export function VolverA({ padre }: { padre: string }) {
  return (
    <Suspense fallback={<EnlaceDeVuelta destino={padre} />}>
      <EnlaceDeVueltaAlOrigen padre={padre} />
    </Suspense>
  );
}
