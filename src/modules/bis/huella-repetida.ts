// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA MEDICION REPETIDA, DICHA EN UNA FRASE  ·  MODULO NEUTRO
//
// POR QUE NEUTRO (sin `server-only`, sin React): el TIPO y el TEXTO los necesitan las dos orillas. El
// lector que los calcula es `server-only` (lee con la conexion de sistema, porque la huella gemela puede
// estar en la historia de otro profesional), y la lista de pacientes es un componente CLIENTE. Un tipo que
// cruza esa frontera no puede vivir en el lector: aunque `import type` se borre al compilar, la arista deja
// el lector al alcance del boundary de cliente y el bundler de produccion puede volverlo referencia-cliente
// (hazard A de CLAUDE.md, y `check:rsc` lo atrapa).
//
// Y EL TEXTO VIVE AQUI, no en cada pantalla, para que la lista y la consulta no lo escriban distinto: dos
// redacciones del mismo aviso acaban diciendo cosas distintas del mismo hecho (hazard 4).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type HuellaRepetida = {
  /** Cuantas OTRAS consultas vigentes comparten esta misma toma fisica. Siempre >= 1. */
  otras: number;
  /**
   * Si alguna de esas otras es del MISMO paciente. Cambia el consejo: dentro del mismo paciente suele ser
   * el mismo archivo importado dos veces; entre pacientes distintos es una toma en la historia equivocada.
   */
  mismoPaciente: boolean;
  /**
   * Si alguna de esas otras es de OTRO paciente. Las dos pueden ser `true` a la vez: hay un grupo con tres
   * consultas de tres pacientes.
   */
  otroPaciente: boolean;
};


/**
 * EL AVISO, EN UNA FRASE. Vive aqui para que la lista y la pantalla de la consulta no lo escriban distinto
 * (hazard 4), y dice lo que se puede decir sin identificar a nadie.
 */
export function avisoDeHuellaRepetida(h: HuellaRepetida): string {
  const otras = h.otras === 1 ? "otra consulta" : `${h.otras} otras consultas`;
  if (h.otroPaciente && h.mismoPaciente) {
    return `Esta medición está repetida en ${otras}, una de ellas de otro paciente: revisa a quién pertenece.`;
  }
  if (h.otroPaciente) {
    return `Esta medición está repetida en ${otras} de otro paciente: revisa a quién pertenece.`;
  }
  return `Esta medición está repetida en ${otras} de este mismo paciente: revisa cuál es la que vale.`;
}
