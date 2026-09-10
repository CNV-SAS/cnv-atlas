// EL BORRADOR DEL PROTOCOLO: que secciones hay, como se llaman, y cuando una tiene cambios sin guardar.
//
// MODULO NEUTRO (sin "use client" ni "server-only") a proposito: lo importan las TRES capas. La pantalla
// para dibujar el aviso, el writer para nombrar la seccion que rechaza por concurrencia, y su test para
// comprobar la regla. Los rotulos estaban escritos DOS veces (panel y writer) y son texto que lee un
// profesional: dos copias de una lista visible es como acaban diciendo cosas distintas.
//
// ═══ CUANDO UNA SECCION ESTA SUCIA, Y EL DEFECTO QUE ESTO CIERRA (Santiago, 2026-09-10) ═══
//
// EL SINTOMA: entrar a Tratamiento -> Nutricionista sin tocar nada y salir "Tienes 4 secciones con cambios
// sin guardar: la lista de intercambio, los tiempos de comida, la distribución por tiempos, el menú
// semanal". Recien entrado, sin escribir.
//
// LA CAUSA, y NO era comparacion por referencia: se comparan FIRMAS, que son cadenas. Era que se comparaba
// contra lo GUARDADO, y esas cuatro secciones son justo las que pueden estar guardadas como `null` y
// DERIVAN un valor al montar: la lista de intercambio calcula sus 21 porciones desde el objetivo, los
// tiempos caen a `TIEMPOS_ACTIVOS_DEFAULT`, la distribucion arma su contexto base, y el menu deriva su dia
// de arranque. Lo que la pantalla muestra difiere de lo guardado desde el primer instante, sin que nadie
// haya tocado nada. Las otras tres (cadena, objetivo, restricciones) hacen ida y vuelta exacta
// (null -> null, "" -> null, arreglo -> arreglo) y por eso no salian.
//
// LA REGLA CORRECTA: **una seccion esta sucia si difiere de lo que ELLA MISMA presentaria sin tocarla**, no
// de lo guardado. Es exactamente lo que hacia cada seccion antes de unificar los guardados (comparaban
// contra `guardado ?? defecto`), y es lo que se perdio al subir el estado al panel.
//
// Y LA FIRMA BASE NO ES LA DEL CANDADO DE CONCURRENCIA: son dos cosas distintas y conflarlas fue el
// defecto. La del candado se calcula sobre lo GUARDADO, porque el servidor la recomputa bajo lock y tiene
// que coincidir con la fila. La de aqui se calcula sobre lo PRESENTADO, porque contesta otra pregunta:
// "¿el profesional cambio algo?".
//
// POR QUE IMPORTA TANTO: un aviso que sale siempre se aprende a ignorar, y entonces el dia que haya
// cambios de verdad nadie lo lee. Un aviso que miente es peor que no tenerlo.

/** Las siete secciones que se guardan juntas. Los nutraceuticos NO entran: escriben una tabla HIJA. */
export const SECCIONES = [
  "ajustes",
  "objetivo",
  "restricciones",
  "intercambio",
  "tiemposActivos",
  "tiempos",
  "menuSemanal",
] as const;

export type SeccionId = (typeof SECCIONES)[number];

/** Como se nombra cada seccion en el idioma de la PANTALLA: lo lee un profesional, no un desarrollador. */
export const ROTULO_SECCION: Record<SeccionId, string> = {
  ajustes: "la cadena calórica",
  objetivo: "el objetivo del tratamiento",
  restricciones: "las restricciones",
  intercambio: "la lista de intercambio",
  tiemposActivos: "los tiempos de comida",
  tiempos: "la distribución por tiempos",
  menuSemanal: "el menú semanal",
};

/**
 * Lo que una seccion anuncia hacia el panel.
 *
 * `firma` es lo que hay EN PANTALLA; `firmaBase` es lo que la misma seccion presentaria si nadie la
 * hubiera tocado. La diferencia entre las dos es la unica definicion de "cambiado" que no miente.
 */
export type Publicado = { valor: unknown; firma: string; firmaBase: string };

/** Las secciones con cambios sin guardar, en el orden en que se presentan en la pantalla. */
export function seccionesSucias(publicado: Partial<Record<SeccionId, Publicado>>): SeccionId[] {
  // Una seccion que todavia no publico NO cuenta: al montar, el aviso saldria antes de que nadie tocara
  // nada, que es la otra mitad del mismo defecto.
  return SECCIONES.filter((k) => {
    const p = publicado[k];
    return p != null && p.firma !== p.firmaBase;
  });
}
