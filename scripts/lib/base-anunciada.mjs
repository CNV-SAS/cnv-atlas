// CONTRA QUE BASE ESTOY ESCRIBIENDO. Fuente unica para todos los seeds y scripts de catalogo.
//
// EL DEFECTO QUE CIERRA (2026-09-07). El seed de condiciones BIS imprimia `Sembradas 12 condiciones BIS
// (version 2).` y NUNCA decia contra que base. Santiago intento apuntarlo a la nube, salio esa misma
// linea, y las catorce preguntas seguian ahi: el seed habia vuelto a sembrar en local y **no habia forma
// de notarlo desde la salida**. La verificacion en solo lectura lo confirmo: en la nube ni siquiera
// existia la fila de la version.
//
// Es la misma familia que llevamos dias cerrando, ahora en la salida de un script: **un mensaje de
// confirmacion que no deriva de lo que hizo**. "Sembradas 12" describia el ARREGLO LOCAL que el script
// iba a mandar, no lo que la base acepto ni donde.
//
// POR ESO SE ANUNCIA ANTES DE ESCRIBIR, no al final: si el script falla a medias, o alguien lo corta, la
// linea que importa ya salio. Un anuncio al final solo lo ve quien llega al final.
//
// Y SE IMPRIME EL HOST, no una etiqueta "local"/"nube": una etiqueta la decide el script y puede
// equivocarse; el host sale de la URL con la que se construyo el cliente, que es literalmente contra
// quien se habla. Nunca la clave.

/** Host de la base, derivado de la URL real del cliente. Lanza si la URL no es una URL. */
export function hostDe(url) {
  return new URL(url).host;
}

/**
 * Es una base LOCAL. Se usa solo para el enfasis del aviso, nunca para decidir nada: la unica verdad que
 * se imprime es el host.
 */
function esLocal(host) {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/.test(host);
}

/**
 * Anuncia contra que base va a escribir un script, ANTES de escribir. Devuelve el host, para que quien
 * llama pueda repetirlo en su linea final.
 *
 * @param {string} url  La MISMA url con la que se construye el cliente. Si se le pasa otra, este aviso
 *                      mentiria, que es justo lo que viene a evitar: por eso se pasa la variable, no se
 *                      relee el entorno aqui.
 * @param {string} que  Que va a hacer, en una linea ("siembra el catalogo de condiciones BIS").
 */
export function anunciarBase(url, que) {
  const host = hostDe(url);
  const donde = esLocal(host) ? "LOCAL" : "REMOTA";
  console.log(`\n  ${que}`);
  console.log(`  BASE ${donde}: ${host}\n`);
  return host;
}
