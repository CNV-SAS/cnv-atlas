// LA OBSERVACION VIGENTE DE CADA PROFESION, Y CUANTAS REEMPLAZA.
//
// POR QUE EXISTE ESTE MODULO Y NO DOS REDUCCIONES. La historia clinica tiene DOS superficies (la pantalla
// y el PDF) y las dos muestran el MISMO documento. Si cada una decidiera por su cuenta cual es la vigente
// o como contar las anteriores, el mismo acto clinico se leeria distinto segun por donde se mire. Ya nos
// paso con los dos canales del plan (seis cosas distintas antes de que un candado lo viera).
//
// MODULO PURO, sin `server-only` ni `"use client"`: lo importan la pantalla (cliente) y el generador del
// PDF (servidor). Es el patron de los valores compartidos entre fronteras RSC.
//
// LA DECISION QUE IMPLEMENTA (Santiago, 2026-09-08): en el DOCUMENTO sale solo la VIGENTE, y el historico
// vive en Seguimiento. Yo habia argumentado que salieran todas, porque un documento probatorio que enseña
// solo la version corregida esconde que hubo correccion. Santiago no descarto el argumento: lo resolvio
// con una LINEA que deja el rastro sin llenar la historia de parrafos casi iguales.
//
// Y ESA LINEA ES LO QUE HACE QUE EL DOCUMENTO NO MIENTA. Sin ella, "Observaciones del profesional" con un
// solo parrafo AFIRMA que eso fue todo lo que se escribio. Con ella dice que hubo mas, cuantas, desde
// cuando, y donde estan. El contenido completo vive en un almacen APPEND-ONLY (`treatment_notes`), asi que
// el documento apunta a una fuente que nadie puede editar despues.
//
// POR PROFESION, que es su §8 del 2026-08-30 ("cada rol escribe lo suyo y no se pisan"): la vigente del
// medico no la reemplaza la nutricionista. Reducir sobre la lista entera taparia la de un rol con la del
// otro, que es exactamente lo que su instruccion excluye.

export type ObservacionCruda = {
  id: string;
  note: string;
  /** Fecha YA FORMATEADA, para mostrar. NO se usa para ordenar: dos formatos distintos ordenan distinto. */
  fecha: string;
  /**
   * El instante REAL (ISO), para decidir cual es la vigente.
   *
   * VA APARTE DE `fecha` A PROPOSITO: la fecha de pantalla llega ya formateada ("8 de septiembre de
   * 2026"), y ordenar por esa cadena da un orden alfabetico que no tiene nada que ver con el tiempo.
   */
  creadaEn: string;
  profesion: string | null;
};

export type ObservacionVigente = ObservacionCruda & {
  /** Cuantas observaciones ANTERIORES de esta misma profesion reemplaza. 0 si es la unica. */
  reemplaza: number;
  /** Fecha de la mas antigua que reemplaza, para acotar el periodo. null si no reemplaza ninguna. */
  desde: string | null;
  /**
   * Las anteriores, de la mas antigua a la mas reciente.
   *
   * LAS DEVUELVE ESTE MODULO Y NO LAS CALCULA CADA PANTALLA, que es como nacio el defecto del 8 de
   * septiembre: la pantalla de Seguimiento tenia su propia reduccion, tomaba la ultima POSICION, y con el
   * reader devolviendo `ascending: false` marcaba como vigente la mas ANTIGUA. El documento hacia lo
   * mismo. Con una sola definicion, cual es la vigente se decide en un sitio.
   */
  anteriores: ObservacionCruda[];
};

/**
 * Reduce la lista completa a la VIGENTE de cada profesion, conservando el rastro de las anteriores.
 *
 * El orden de entrada es el de escritura (mas antigua primero), que es como llegan de `treatment_notes`
 * ordenadas por `created_at`. La vigente es la ULTIMA de cada profesion.
 */
export function observacionesVigentes(todas: ObservacionCruda[]): ObservacionVigente[] {
  const porProfesion = new Map<string, ObservacionCruda[]>();
  for (const o of todas) {
    const k = o.profesion ?? "sin-profesion";
    porProfesion.set(k, [...(porProfesion.get(k) ?? []), o]);
  }
  return [...porProfesion.values()].map((lista) => {
    // SE ORDENA AQUI, POR FECHA, EN VEZ DE CONFIAR EN COMO LLEGO LA LISTA.
    //
    // EL DEFECTO QUE CIERRA (smoke de Santiago, 2026-09-08): esto tomaba `lista[lista.length - 1]` como
    // vigente, o sea la ULTIMA POSICION. Y el reader trae las notas con `ascending: false`, asi que la
    // ultima posicion es la MAS ANTIGUA. Al agregar una observacion nueva salia la primera de la lista y
    // se marcaba como vigente la vieja.
    //
    // ANCLAR EN UNA POSICION ES EL DEFECTO, no el orden del reader: una posicion se desincroniza en
    // cuanto alguien cambia un `order by` en otro archivo, y nada da error. "Vigente" significa "la mas
    // reciente", asi que se calcula con lo que ESO significa. Cualquier llamador puede pasar la lista en
    // el orden que quiera.
    const cronologica = [...lista].sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
    const vigente = cronologica[cronologica.length - 1];
    const anteriores = cronologica.slice(0, -1);
    return {
      ...vigente,
      reemplaza: anteriores.length,
      desde: anteriores.length ? anteriores[0].fecha : null,
      anteriores,
    };
  });
}

/**
 * La linea del rastro, en las palabras exactas que van al documento.
 *
 * VIVE AQUI Y NO EN CADA SUPERFICIE por el mismo motivo que la reduccion: si la pantalla y el PDF la
 * redactaran por separado, el mismo documento diria dos cosas distintas sobre el mismo hecho. Devuelve
 * null cuando no hay nada que rastrear, para que la superficie no tenga que decidirlo.
 */
export function lineaDeReemplazo(o: ObservacionVigente): string | null {
  if (o.reemplaza === 0) return null;
  const cuantas =
    o.reemplaza === 1 ? "una observación anterior" : `${o.reemplaza} observaciones anteriores`;
  const desde = o.desde ? `, desde el ${o.desde}` : "";
  return `Esta observación reemplaza a ${cuantas}${desde}. Las anteriores quedan registradas en el seguimiento de esta consulta y no se borran.`;
}
