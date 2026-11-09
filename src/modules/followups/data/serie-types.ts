// Tipos y constante de la SERIE de seguimiento. Modulo NEUTRO (sin `server-only`): lo importan el reader
// del servidor, el componente y los tests. Una constante compartida entre el servidor y otra capa no puede
// vivir en el reader server-only (misma razon que los demas `*-types` del proyecto).

/**
 * TOPE de puntos en pantalla. El criterio no es un numero redondo: el intervalo minimo comparable que fijo
 * Gildardo es de 12 semanas, asi que 8 puntos cubren unos DOS AÑOS de seguimiento trimestral, que es un
 * horizonte razonable para una grafica. Verificado contra los datos de hoy (2026-08-25): ningun paciente
 * pasa de DOS evaluaciones, asi que el tope todavia no muerde y es preventivo, no validado contra un caso
 * real. Cuando recorta, se DICE cuantas quedaron fuera: nunca truncar en silencio.
 */
export const SERIE_MAX = 8;

export type PuntoSerie = {
  evaluationId: string;
  fecha: string; // measurement_date
  /** Capacitancia de membrana: el parametro de seguimiento del protocolo. Sale del BIS crudo. */
  c: number | null;
  pabu: number | null;
  icaBis: number | null;
  /** Dominios del DFI (5), para el radar comparativo. */
  dominios: { id: string; nombre: string; sev: number }[] | null;
  /**
   * EL RIESGO INTEGRADO PONDERADO del DFI, de 0 a 100, sellado en ese informe. MENOR ES MEJOR.
   *
   * Entra el 2026-11-07 para la tarjeta de respuesta a la intervencion de su v15 §3, que compara el delta
   * de esta cifra contra la ultima consulta comparable. Es la MISMA que la pantalla del diagnostico pinta,
   * leida del sello: recalcularla aqui daria una segunda definicion del riesgo de esa consulta.
   *
   * null cuando el sello no la trae (informes de eras anteriores del motor).
   */
  riesgoScore: number | null;
  /**
   * La EB-BIS v7 SELLADA en ese reporte (edad biologica estimada y su IAE), o null.
   *
   * SE LEE DEL SELLO, NO SE RECALCULA: es la cifra que ese dia se le dijo al paciente. null en los
   * reportes sellados antes del 2026-10-29, que llevan la v5 en `indicators.eb` y no esta: esa es la
   * cifra que la decision de agosto no queria mostrar.
   */
  eb: { eb: number; iae: number } | null;
  /**
   * La version del motor con la que se sello este punto (`snapshot.versions.engine`).
   *
   * HACE FALTA PARA NO RESTAR ENTRE DOS ESCALAS: `sonComparables` compara la version MAYOR, y dos mayores
   * distintas no se comparan (criterio de `docs/VERSIONES.md`, cableado el 2026-10-24). null = no se pudo
   * leer, y entonces tampoco se compara.
   */
  engineVersion: string | null;
  /** El Modulo S de esa consulta. `null` = no aplico la CNV-S (todo lo anterior al 2026-11-08). */
  moduloS: ModuloSDelPunto | null;
};

/**
 * EL MODULO S DE ESA CONSULTA, ya leido por su clave. `null` = la consulta no aplico la CNV-S.
 *
 * ES EL SEGUNDO EJE DE SU TABLA 6 (§3): el escenario de respuesta cruza el delta del DFI con la
 * adherencia, y la adherencia solo se puede saber preguntandosela al paciente. Sin esto, la tarjeta de
 * respuesta a la intervencion solo podia decir cuanto se movio cada cifra.
 *
 * SE LEE DEL SELLO, COMO TODO LO DEMAS DEL PUNTO: son las respuestas que ese dia dio el paciente, no una
 * relectura de hoy. Y SIN COLUMNAS DERIVADAS: la adherencia y la comparabilidad se calculan al leerlas
 * con `modulo-s`, que es la unica definicion (ver su nota: una columna seria el mismo hecho en dos
 * sitios que pueden divergir).
 */
export type ModuloSDelPunto = {
  /** S1: una respuesta POR PRODUCTO, {idDelProducto: opcion}. `null` = no se presento. */
  s1: Record<string, string> | null;
  /** S2: por que no lo tomo como se indico, tambien por producto. */
  s2: Record<string, string> | null;
  /** S3: en que medida siguio el plan de alimentacion. */
  s3: string | null;
  /** S4: los eventos intercurrentes marcados. */
  s4: string[] | null;
  /** S5: si intento cambiar su peso. */
  s5: string | null;
  /** S6: como describiria el cambio desde la ultima consulta. */
  s6: string | null;
  /**
   * El nombre comercial de cada producto, por id, para poder escribir el S1 y el S2.
   *
   * La respuesta guarda el ID (un nombre comercial cambia y una respuesta sellada no), asi que el nombre
   * de hoy lo pone quien lee. Solo se resuelve para el ULTIMO punto, que es el que la tarjeta escribe.
   */
  nombresDeProductos: Record<string, string>;
};


/**
 * Referencia poblacional de capacitancia del grupo del paciente (sexo + decada de edad).
 *
 * SU REGLA, y por eso es una MEDIANA y no un rango: "mejorar es acercarse a la mediana de su grupo de
 * edad y sexo, no subir; alejarse, en cualquier direccion, no es mejoria". La tarjeta la dibuja como linea
 * de referencia, y `SerieLinea` ya sabe que con referencia la mejora es siempre acercarse.
 *
 * null cuando falta sexo o fecha de nacimiento: sin eso NO SE CLASIFICA, que es su decision explicita
 * (a diferencia de calcPABU no hay respaldo razonable, cualquier eleccion se equivoca en casi un
 * nanofaradio). Y no queda mudo: la tarjeta dice por que no hay referencia.
 */
export type RefCapacitancia = {
  mediana: number;
  /**
   * LOS BORDES DE LA BANDA NORMAL Y EL TAMAÑO DE LA MUESTRA (cotejo 2026-09-05, punto 28).
   *
   * Su tarjeta escribe la fila entera: "Referencia hombres 18-29 años (n=503): P25 2.06 · mediana 2.40
   * · P75 2.82 nF". Con la mediana sola no se puede saber si 2,96 esta cerca o lejos: la mediana dice
   * hacia donde, y los percentiles dicen cuanto margen hay. Y el `n` es lo que separa una referencia de
   * una cifra afirmada: 503 personas se lee distinto de 73.
   */
  p25: number;
  p75: number;
  n: number;
  /** La medicion que se clasifico (la ultima), para poder decirla al lado de su banda. */
  valor: number;
  /** Donde cae la ultima medicion: "Normal", "Baja", "Muy baja", "Alta". */
  etiqueta: string;
  /** El percentil donde cae ("P25-P75"), para que la pantalla diga mas que la etiqueta. */
  banda: string | null;
  /** El grupo contra el que se compara, para poder decirlo: "Hombres 30-39". */
  grupo: string;
};

export type SerieSeguimiento = {
  puntos: PuntoSerie[];
  /** Referencia de la capacitancia. null = no se puede comparar (falta sexo o edad). */
  refC: RefCapacitancia | null;
  /** Cuantas mediciones quedaron fuera por el tope. 0 = se muestran todas. */
  omitidas: number;
};
