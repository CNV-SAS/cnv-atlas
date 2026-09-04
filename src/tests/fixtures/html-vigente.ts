import { readdirSync, readFileSync } from "node:fs";

// FUENTE UNICA DE "CUAL ES EL HTML VIGENTE DE GILDARDO" (2026-08-29).
//
// EL DEFECTO QUE CIERRA, y es de la peor clase: un test de diff anclado a una entrega SUPERADA pasa
// VERDE POR CONSTRUCCION. No compara mal, compara bien contra el archivo equivocado, asi que su verde
// no dice "el porte esta al dia", dice "el porte coincide con lo que su archivo decia hace dos dias".
//
// Paso de verdad: llego el `ATLAS_v8.html` del 29 y `motor-trat-nutri.test.ts` y `capacitancia.test.ts`
// seguian anclados al del 28. Entre esas dos entregas el hizo, entre otras cosas, la correccion del piso
// calorico, que cambia un numero PRESCRITO. Nada se puso rojo. Lo encontro Santiago acordandose de que
// habia un candado esperando su respuesta, no un test.
//
// Es primo del par de fuentes sin nada que las compare, pero peor: aqui SI habia un comparador, y estaba
// mirando al pasado. Un candado que apunta a una referencia vieja es mas peligroso que no tenerlo,
// porque da una garantia que no existe.
const DIR = "docs/entregas/Gildardo responses";

// La entrega vigente se DERIVA del directorio, no se escribe a mano. Escrita a mano seria una cadena mas
// que envejece en silencio, que es exactamente el defecto que esto cierra.
function entregasOrdenadas(): string[] {
  const MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };
  return readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^html actualizado /.test(d.name))
    .map((d) => {
      const m = /^html actualizado (\d+) (\p{L}+)$/u.exec(d.name);
      if (!m) throw new Error(`carpeta de entrega con nombre inesperado: ${d.name}`);
      const mes = MESES[m[2].toLowerCase()];
      if (!mes) throw new Error(`mes no reconocido en la entrega: ${d.name}`);
      return { name: d.name, orden: mes * 100 + Number(m[1]) };
    })
    .sort((a, b) => a.orden - b.orden)
    .map((e) => e.name);
}

export const ENTREGAS = entregasOrdenadas();

/** Ruta del ATLAS_v8.html de la ULTIMA entrega. Todo test de paridad ancla aqui, nunca a una ruta suelta. */
export const HTML_VIGENTE = `${DIR}/${ENTREGAS[ENTREGAS.length - 1]}/ATLAS_v8.html`;

/**
 * Ruta del HTML de UNA entrega concreta. Existe para que NINGUN test construya rutas de entrega a mano,
 * ni siquiera derivadas: el candado `html-vigente-lock` no puede distinguir una ruta armada desde
 * `ENTREGAS` de una escrita a dedo, y tampoco deberia tener que hacerlo. Con este helper la unica ruta
 * literal del repositorio vive aqui.
 */
export function htmlDeEntrega(carpeta: string): string {
  if (!ENTREGAS.includes(carpeta)) throw new Error(`no existe la entrega ${carpeta}`);
  return `${DIR}/${carpeta}/ATLAS_v8.html`;
}


/**
 * Extrae una funcion COMPLETA del HTML por su NOMBRE, contando llaves hasta cerrar.
 *
 * Por que por nombre y no por rango de lineas, que es como estaba: un rango es una POSICION, y una
 * posicion se desincroniza en cuanto el autor inserta algo mas arriba. Paso el 29-ago: Gildardo metio 12
 * lineas de comentario sobre el piso calorico y el rango L15630-15744 dejo de cubrir la funcion. El
 * nombre es el identificador y no se mueve.
 */
export function funcionDelHtml(nombre: string, ruta: string = HTML_VIGENTE): string {
  const src = readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
  const i = src.indexOf(`function ${nombre}(`);
  if (i < 0) throw new Error(`no aparece function ${nombre}( en ${ruta}`);
  let prof = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    const c = src[j];
    if (c === "{") prof++;
    else if (c === "}") {
      prof--;
      if (prof === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error(`function ${nombre} no cierra en ${ruta}`);
}

/**
 * Igual que `funcionDelHtml`, para las declaradas como `const NOMBRE = (...) => {`. Mismo motivo para
 * anclar por nombre: el rango de lineas es una posicion y se desincroniza sola.
 */
export function constFlechaDelHtml(nombre: string, ruta: string = HTML_VIGENTE): string {
  const src = readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
  const i = src.indexOf(`const ${nombre} = (`);
  if (i < 0) throw new Error(`no aparece const ${nombre} = ( en ${ruta}`);
  let prof = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    const c = src[j];
    if (c === "{") prof++;
    else if (c === "}") {
      prof--;
      // La flecha cierra con `};`, no con `}` sola.
      if (prof === 0) return src.slice(i, j + 2);
    }
  }
  throw new Error(`const ${nombre} no cierra en ${ruta}`);
}
