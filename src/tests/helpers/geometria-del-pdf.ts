import { inflateSync } from "node:zlib";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DONDE CAE CADA COSA EN EL PDF  ·  2026-11-06
//
// POR QUE EXISTE: el 2026-11-06 Santiago mando el informe de una paciente real y la cifra de la edad
// biologica salia ENCIMA del texto de al lado. En el arbol de vistas ese bloque es una columna y parece
// imposible que se solape; en el papel se solapaba, porque una linea de 30 puntos sin altura declarada no
// reserva su espacio. Ningun candado de los que habia podia verlo: todos miran el TEXTO del PDF
// (`textoDe`) o cuentan sus hojas, y un texto solapado contiene exactamente las mismas letras que uno bien
// puesto.
//
// Asi que hace falta leer la GEOMETRIA. @react-pdf no escribe las posiciones en el `Tm` (que es siempre
// `1 0 0 1 0 792`): las acumula en la pila de transformaciones (`q`/`Q`/`cm`), asi que hay que seguirla.
// Eso es lo unico que hace este modulo.
//
// LAS COORDENADAS SALEN EN PUNTOS DESDE ARRIBA de la hoja, que es como se lee un papel.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Alto de una hoja carta en puntos. Se usa para voltear el eje y contar desde arriba. */
export const ALTO_CARTA = 792;

export type Pieza = {
  /** Punta izquierda, en puntos desde el borde izquierdo. */
  x: number;
  /** Borde superior de la caja de la linea, en puntos desde el borde de ARRIBA. */
  y: number;
  /** Ancho estimado de la pieza. */
  ancho: number;
  /** Alto de la caja de la linea (el tamaño de fuente). */
  alto: number;
  tam: number;
  texto: string;
};

type Matriz = [number, number, number, number, number, number];

function por(m: Matriz, n: Matriz): Matriz {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

const aplicar = (m: Matriz, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** Junta los trozos hexadecimales de un arreglo TJ en el texto que pinta. */
function textoDeTJ(cuerpo: string): string {
  let salida = "";
  for (const m of cuerpo.matchAll(/<([0-9a-fA-F]*)>/g)) {
    const h = m[1];
    for (let i = 0; i + 1 < h.length; i += 2) salida += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  }
  return salida;
}

/** Los streams de contenido del PDF, ya descomprimidos. Uno por hoja. */
function streamsDe(pdf: Buffer): string[] {
  const latin = pdf.toString("latin1");
  const salida: string[] = [];
  let i = 0;
  for (;;) {
    const a = latin.indexOf("stream", i);
    if (a === -1) break;
    let ini = a + "stream".length;
    while (latin[ini] === "\r" || latin[ini] === "\n") ini += 1;
    const fin = latin.indexOf("endstream", ini);
    if (fin === -1) break;
    // SE SALTA LA PALABRA ENTERA, no un caracter: "endstream" CONTIENE "stream", asi que avanzar uno solo
    // hace que la busqueda siguiente caiga dentro del cierre, intente inflar basura y, al descartarla, se
    // lleve por delante el siguiente stream de verdad. Asi se perdia una hoja de cada dos (14 piezas
    // leidas donde habia mas de cien).
    i = fin + "endstream".length;
    try {
      const c = inflateSync(pdf.subarray(ini, fin)).toString("latin1");
      if (c.includes("BT")) salida.push(c);
    } catch {
      // Las fuentes y las imagenes tambien son streams y no se descomprimen asi: no son de este asunto.
    }
  }
  return salida;
}

/**
 * Cada pieza de texto de una hoja, con su sitio. El ancho se ESTIMA (0,5 del tamaño por caracter, que es
 * lo que mide una sans-serif de media) porque el PDF no guarda el ancho de la linea, solo donde empieza.
 * Para detectar un solapamiento alcanza: la estimacion se queda CORTA, asi que no inventa choques.
 */
export function piezasDe(pdf: Buffer): Pieza[][] {
  return streamsDe(pdf).map((contenido) => {
    let ctm: Matriz = [1, 0, 0, 1, 0, 0];
    const pila: Matriz[] = [];
    let tam = 0;
    const piezas: Pieza[] = [];
    for (const linea of contenido.split(/\r?\n/)) {
      const l = linea.trim();
      if (l === "q") {
        pila.push([...ctm] as Matriz);
        continue;
      }
      if (l === "Q") {
        ctm = pila.pop() ?? ctm;
        continue;
      }
      let m = /^([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) cm$/.exec(l);
      if (m) {
        ctm = por(m.slice(1).map(Number) as Matriz, ctm);
        continue;
      }
      m = /^\/F\d+ ([\d.]+) Tf$/.exec(l);
      if (m) {
        tam = Number(m[1]);
        continue;
      }
      m = /^\[(.*)\]\s*TJ$/.exec(l);
      if (m) {
        const texto = textoDeTJ(m[1]);
        if (!texto.trim()) continue;
        const [x, yAbajo] = aplicar(ctm, 0, ALTO_CARTA);
        piezas.push({
          x,
          // El origen de la linea cae en su base; la caja sube desde ahi. Y se cuenta desde arriba.
          y: ALTO_CARTA - yAbajo - tam * 0.8,
          ancho: texto.length * tam * 0.5,
          alto: tam,
          tam,
          texto,
        });
      }
    }
    return piezas.sort((a, b) => a.y - b.y || a.x - b.x);
  });
}

export type Choque = { hoja: number; a: Pieza; b: Pieza; solapeY: number; solapeX: number };

/**
 * Los pares de textos que se pisan. Dos piezas chocan cuando sus cajas se cruzan en los DOS ejes.
 *
 * LA TOLERANCIA ES GENEROSA A PROPOSITO (`holgura`): las lineas de un mismo parrafo se tocan por el
 * interlineado, y el ancho va estimado. Lo que este detector tiene que encontrar es el solapamiento que se
 * VE, no el roce de una caja con la siguiente.
 */
export function choquesDe(pdf: Buffer, holgura = 2): Choque[] {
  const choques: Choque[] = [];
  piezasDe(pdf).forEach((piezas, hoja) => {
    for (let i = 0; i < piezas.length; i += 1) {
      for (let j = i + 1; j < piezas.length; j += 1) {
        const a = piezas[i];
        const b = piezas[j];
        // ═══ DOS TROZOS DE LA MISMA LINEA NO SON UN CHOQUE ═══
        //
        // Un parrafo con una palabra en negrita sale como VARIOS trozos seguidos sobre la misma base
        // ("Observaciones de tu profesional: " y luego lo que escribio). El renderizador los coloca
        // sabiendo el ancho REAL de cada letra; aqui el ancho va estimado, y una estimacion que se pase
        // los hace parecer solapados. Como comparten base exacta, se reconocen y se saltan.
        //
        // ESTO NO TAPA EL DEFECTO QUE ESTE DETECTOR BUSCA: el de la paciente real tenia las dos piezas a
        // 2,1 puntos de distancia, no sobre la misma base. Lo que se pisa de verdad viene de DOS lineas
        // distintas que se montan, y eso sigue saliendo.
        if (Math.abs(a.y - b.y) < 0.6) continue;
        const solapeY = Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y);
        if (solapeY <= holgura) continue;
        const solapeX = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x);
        if (solapeX <= holgura) continue;
        choques.push({ hoja: hoja + 1, a, b, solapeY, solapeX });
      }
    }
  });
  return choques;
}

/** Un choque, en una linea legible para el mensaje de un fallo. */
export function describir(c: Choque): string {
  return (
    `hoja ${c.hoja}: "${c.a.texto.slice(0, 40)}" (y=${c.a.y.toFixed(1)}, ${c.a.tam}pt) se pisa con ` +
    `"${c.b.texto.slice(0, 40)}" (y=${c.b.y.toFixed(1)}, ${c.b.tam}pt); ` +
    `solape ${c.solapeY.toFixed(1)}pt en vertical y ${c.solapeX.toFixed(1)}pt en horizontal`
  );
}
