import { mayorDelMotor } from "@/modules/followups/services/eb-trajectory";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN INFORME DE OTRA ERA DEL MOTOR NO AFIRMA NADA SOBRE ENVEJECIMIENTO  ·  Santiago, 2026-11-08
//
// ═══ EL DEFECTO ═══
//
// *"Los informes de las consultas reales que quedaron en 1.x (repetidas, sin fecha, menores) muestran el
// dominio Envejecimiento calculado con la v5, aunque no muestren la EB-BIS. Si uno de esos se envía, no
// debe afirmar nada sobre envejecimiento."*
//
// La cifra YA estaba suprimida: el cuadro de la edad biologica solo sale con `ebBis.estado === "ok"`, y
// un sello de la era 1.x no lo trae. Lo que quedaba vivo era el DOMINIO 3: su severidad sale del IAE de
// la v5, y de ahi salen su etiqueta ("Prioritario"), su color, su punta en la figura y su frase
// ("Tu cuerpo envejece..."). O sea que el documento no decia la cifra retirada pero SI su veredicto.
//
// Y es la misma leccion que ya costo una ronda con el panel de la reemision: suprimir una cifra no basta
// si lo que se deriva de ella sigue a la vista.
//
// ═══ LA SALIDA MAS SIMPLE, QUE ES LA QUE SE APLICA ═══
//
// No se frena el envio ni se esconde el bloque de las cinco areas: las otras cuatro NO dependen de la
// EB-BIS y son validas. Lo que se hace es dejar el dominio 3 **sin medir**, que es un estado que el
// informe ya sabe pintar (gris, sin etiqueta, con su frase) desde que existe, y poner en su lectura la
// frase que dice lo que pasa.
//
// Frenar el envio habria dejado a esas consultas sin poder entregar NADA, y esconder el bloque habria
// quitado cuatro areas buenas para tapar una.
//
// ═══ EL CORTE ES LA VERSION MAYOR, QUE ES EL CRITERIO DE LA CASA ═══
//
// `docs/VERSIONES.md`: *"Mayor = la ciencia cambia y lo emitido antes no es comparable"*. El mismo que
// usan la banda de trayectoria y la tarjeta de respuesta a la intervencion. Un sello sin version tampoco
// se afirma: si no se puede saber con que ciencia se calculo, no se puede sostener su veredicto.
//
// MODULO NEUTRO (sin `server-only` ni `"use client"`): lo usa el documento PDF, que se renderiza en el
// servidor, y los tests.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El id del dominio de envejecimiento en el DFI. Es suyo, no una convencion nuestra. */
export const DOMINIO_ENVEJECIMIENTO = "d3";

/** Lo que el informe dice en lugar del veredicto. Describe el documento, no al paciente. */
export const SIN_ESTIMACION =
  "Sin estimación en esta consulta: se emitió con una versión anterior del modelo.";

type DominioDelPaciente = {
  id: string;
  dominio: string;
  nivel: string | null;
  sev: number | null;
  lectura: string;
};

/**
 * ¿El sello de este informe es de otra era del motor?
 *
 * `true` tambien cuando la version no se puede leer: sin saber con que ciencia se calculo, su veredicto
 * no se puede sostener. Es la misma puerta que `sonComparables`, escrita aqui porque aquella compara DOS
 * sellos y esta compara un sello con el motor de hoy.
 */
export function esDeOtraCiencia(
  versionSellada: string | null | undefined,
  versionDeHoy: string,
): boolean {
  const sellada = mayorDelMotor(versionSellada);
  const hoy = mayorDelMotor(versionDeHoy);
  if (sellada == null || hoy == null) return true;
  return sellada !== hoy;
}

/**
 * Los cinco dominios del paciente, con el de ENVEJECIMIENTO sin veredicto si el informe es de otra era.
 *
 * Devuelve la MISMA lista cuando no hace falta tocar nada, para que el caso normal no pague ni una copia
 * y para que el diff de un informe de hoy sea exactamente cero.
 */
export function sinEnvejecimientoDeOtraCiencia<T extends DominioDelPaciente>(
  dominios: T[],
  versionSellada: string | null | undefined,
  versionDeHoy: string,
): T[] {
  if (!esDeOtraCiencia(versionSellada, versionDeHoy)) return dominios;
  return dominios.map((d) =>
    d.id === DOMINIO_ENVEJECIMIENTO
      ? // SIN `sev` Y SIN `nivel`: es lo que apaga su color, su etiqueta y el color de su punta en la
        // figura. Dejar la severidad y cambiar solo la frase habria dejado un dominio pintado de rojo
        // con un texto que dice que no se estimo, que es la contradiccion de siempre.
        { ...d, sev: null, nivel: null, lectura: SIN_ESTIMACION }
      : d,
  );
}
