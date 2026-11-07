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

// EL NOMBRE DEL ARCHIVO TAMBIEN SE DERIVA (2026-09-21). Estaba fijo en `ATLAS_v8.html`, y el 21 de
// septiembre llego `ATLAS_v9.html`: la carpeta vigente se derivaba bien y el archivo no existia, asi que
// todo candado de paridad reventaba con ENOENT. Mejor eso que pasar verde contra el v8, pero es la misma
// leccion de la cabecera un nivel mas abajo: lo que se escribe a mano envejece. Cada carpeta de entrega
// trae UN html; si trajera cero o varios, se falla ruidoso en vez de elegir uno.
function htmlDeLaCarpeta(carpeta: string): string {
  const htmls = readdirSync(`${DIR}/${carpeta}`).filter((f) => /^ATLAS_v\d+\.html$/.test(f));
  if (htmls.length !== 1) {
    throw new Error(`la entrega ${carpeta} trae ${htmls.length} HTML de ATLAS; se esperaba exactamente uno`);
  }
  return `${DIR}/${carpeta}/${htmls[0]}`;
}

/** Ruta del HTML de la ULTIMA entrega. Todo test de paridad ancla aqui, nunca a una ruta suelta. */
export const HTML_VIGENTE = htmlDeLaCarpeta(ENTREGAS[ENTREGAS.length - 1]);

/**
 * Ruta del HTML de UNA entrega concreta. Existe para que NINGUN test construya rutas de entrega a mano,
 * ni siquiera derivadas: el candado `html-vigente-lock` no puede distinguir una ruta armada desde
 * `ENTREGAS` de una escrita a dedo, y tampoco deberia tener que hacerlo. Con este helper la unica ruta
 * literal del repositorio vive aqui.
 */
export function htmlDeEntrega(carpeta: string): string {
  if (!ENTREGAS.includes(carpeta)) throw new Error(`no existe la entrega ${carpeta}`);
  return htmlDeLaCarpeta(carpeta);
}


// ═══ LA SEGUNDA CONVENCION DE CARPETA, Y EL HUECO QUE DEJA ABIERTO (2026-11-06) ═══
//
// Desde el 27 de septiembre Gildardo no entrega en `html actualizado <dia> <mes>`, sino en
// `Nuevos cambios html/<dia> <mes>`. La derivacion de arriba solo reconoce la primera, asi que
// `HTML_VIGENTE` resuelve al `ATLAS_v9.html` del 21 de septiembre mientras su archivo de hoy es el
// `ATLAS_v16.html` del 4 de noviembre: SEIS entregas despues. Es el mismo defecto que la cabecera de este
// archivo describe, una convencion mas abajo.
//
// POR QUE NO SE RE-APUNTA HOY, y queda escrito para que no parezca un descuido. Medido el 2026-11-06, el
// frozen difiere del v16 en OCHO lineas y las copias de `fixtures/reference` en DIEZ, y las dieciocho
// estan ya registradas como trabajo pendiente: dos son `calcPatron` (v16 §4.2, paso 3 del plan), tres son
// la EB-BIS v7 (`cIAE` y los pesos z del IFC y del PABU, v15, paso 3), tres son el motor calorico
// Harris-Benedict + 10 % (v12, y es la pregunta 1 de PENDIENTES, que FRENA) y diez son el parrafo de dieta
// leyendo `d1Clasificar` (v16 §4.3, paso 5). Re-apuntar ahora obligaria a escribir dieciocho tolerancias
// con su razon para borrarlas una por una en los pasos 3 y 5. **El re-anclaje va al final del paso 5, y
// ahi entra con CERO tolerancias**, que es lo que de verdad prueba que el porte esta al dia.
//
// AVANCE, MISMO DIA: las DOS de `calcPatron` ya estan, y `engine.patron.js` salio de `MODULOS` en
// `frozen-deriva-vigente` para entrar en `DE_ENTREGA_MAS_NUEVA`, con su candado propio contra el v16
// (`frozen-patron-diff`). Quedan DIECISEIS. Las tres de la EB-BIS v7 son del mismo paso 3; las tres del
// motor calorico esperan su pregunta 1; las diez del parrafo de dieta son del paso 5.
//
// Mientras tanto la ruta de las entregas nuevas tambien se DERIVA aqui, para que ningun candado la escriba
// a mano: es la regla que vigila `html-vigente-lock.test.ts`, y vale igual para la convencion nueva.
const DIR_NUEVOS = `${DIR}/Nuevos cambios html`;

/** Las entregas de la convencion nueva, ordenadas por fecha. Mismo criterio que `ENTREGAS`. */
function cambiosNuevosOrdenados(): string[] {
  const MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };
  return readdirSync(DIR_NUEVOS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const m = /^(\d+) (\p{L}+)$/u.exec(d.name);
      if (!m) return null; // la carpeta trae tambien documentos suyos, no solo entregas
      const mes = MESES[m[2].toLowerCase()];
      return mes ? { name: d.name, orden: mes * 100 + Number(m[1]) } : null;
    })
    .filter((e): e is { name: string; orden: number } => e !== null)
    .sort((a, b) => a.orden - b.orden)
    .map((e) => e.name);
}

export const CAMBIOS_NUEVOS = cambiosNuevosOrdenados();

/**
 * Ruta del HTML de una entrega de la convencion NUEVA (`Nuevos cambios html/<dia> <mes>`).
 *
 * OJO: estos HTML estan en `.gitignore` (pesan 1,5 MB cada uno y uno trae una publishable key), asi que
 * viven solo en la maquina de Santiago. Un candado anclado aqui falla RUIDOSO en un clon que no los tenga,
 * y eso es lo correcto: lo contrario seria pasar verde sin comparar nada.
 */
export function htmlDeCambioNuevo(carpeta: string): string {
  if (!CAMBIOS_NUEVOS.includes(carpeta)) throw new Error(`no existe la entrega nueva ${carpeta}`);
  const htmls = readdirSync(`${DIR_NUEVOS}/${carpeta}`).filter((f) => /^ATLAS_v\d+\.html$/.test(f));
  if (htmls.length !== 1) {
    throw new Error(`la entrega ${carpeta} trae ${htmls.length} HTML de ATLAS; se esperaba exactamente uno`);
  }
  return `${DIR_NUEVOS}/${carpeta}/${htmls[0]}`;
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
