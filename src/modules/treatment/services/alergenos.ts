// Cruce de alergenos: la CAPA 3 del filtro, la unica que da un chequeo exacto.
//
// POR QUE ESTA SEPARADO Y ES PURO. La seguridad no puede depender de que el modelo obedezca una
// instruccion del prompt. El bloque de alergenos que se le manda (capa 1) hace que lo sepa; esto
// comprueba que lo hizo. Es codigo, no instruccion, y por eso vive aparte y sin dependencias: se
// puede probar exhaustivamente sin levantar nada.
//
// POR QUE SOBRE SALIDA ESTRUCTURADA Y NO SOBRE PROSA. Con el menu en prosa libre (v2) lo unico
// posible era buscar subcadenas, y eso falla en las dos direcciones: se le escapa "camarones" cuando
// la alergia dice "mariscos", y se dispara con "leche de almendras" cuando la alergia es a la leche.
// Con el menu como lista de alimentos (v3) el cruce es alimento contra alimento.
//
// LO QUE ESTO NO GARANTIZA, dicho aqui para que nadie lo lea como mas de lo que es: si el modelo
// nombra un alimento que contiene el alergeno sin nombrarlo (un "pan de trigo" para un celiaco lo
// dice; una "salsa cesar" con anchoas no), el cruce no lo ve. Por eso el resultado se le PRESENTA al
// profesional y no sustituye su lectura.

// Un alimento del menu estructurado.
export type MenuAlimento = { nombre: string; porcion?: string };
export type MenuComida = { tiempo: string; alimentos: MenuAlimento[] };
export type MenuEstructurado = { comidas: MenuComida[] };

// Un cruce encontrado: QUE alergeno, en QUE comida y en QUE alimento. Las tres piezas, porque el
// profesional tiene que poder verificarlo de un vistazo sin releer el menu entero.
export type HallazgoAlergeno = {
  alergeno: string; // como lo declaro el paciente
  tiempo: string; // "Desayuno", "Almuerzo"...
  alimento: string; // el alimento del menu que lo contiene
};

// Sinonimos y formas en que un alergeno aparece nombrado en un menu. NO es una lista de "que alimentos
// existen": es el puente entre COMO lo declara el paciente (la opcion de la encuesta o su texto libre)
// y COMO lo nombra un menu. El criterio para agregar una entrada: que sea una forma de nombrar EL MISMO
// alergeno, no un alimento que suela acompanarlo.
//
// Cubre las opciones cerradas de d6_43 (alergias) y d6_44 (intolerancias). El texto libre de "Otra" no
// tiene sinonimos y se cruza tal cual, que es lo correcto: si el paciente escribio "mango", se busca
// "mango".
const SINONIMOS: Record<string, string[]> = {
  leche: ["leche", "lacteo", "lacteos", "queso", "yogur", "yogurt", "mantequilla", "crema de leche", "kumis", "cuajada"],
  huevo: ["huevo", "huevos", "clara de huevo", "yema", "tortilla de huevo", "omelette", "revuelto"],
  mani: ["mani", "cacahuate", "cacahuete", "mantequilla de mani", "crema de mani"],
  trigo: ["trigo", "pan", "pasta", "harina de trigo", "galleta", "galletas", "cereal de trigo", "avena con trigo"],
  soya: ["soya", "soja", "tofu", "salsa de soya", "leche de soya", "edamame"],
  pescado: ["pescado", "atun", "salmon", "tilapia", "bagre", "trucha", "sardina", "bacalao", "mojarra"],
  mariscos: ["marisco", "mariscos", "camaron", "camarones", "langostino", "langosta", "cangrejo", "almeja", "mejillon", "calamar", "pulpo"],
  lactosa: ["leche", "lacteo", "lacteos", "queso", "yogur", "yogurt", "helado", "crema de leche", "kumis"],
  gluten: ["gluten", "trigo", "pan", "pasta", "cebada", "centeno", "harina de trigo", "galleta", "galletas"],
  fructosa: ["fructosa", "jarabe de maiz", "miel", "jugo de fruta concentrado"],
};

// Normaliza para comparar: sin tildes, sin mayusculas, sin puntuacion, espacios colapsados. Lo mismo a
// los dos lados del cruce, siempre, para que "Camarón" y "camaron" sean el mismo texto.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Ninguna"/"Ninguno" es una RESPUESTA, no un alergeno: el paciente dijo que no tiene. Si se colara a la
// lista, cruzaria contra cualquier menu que mencionara la palabra.
const NO_ES_ALERGENO = /^(ninguna|ninguno|no|n\/a|na)$/;

/**
 * Los terminos a buscar, a partir de lo que el paciente declaro en d6_43 (alergias) y d6_44
 * (intolerancias). Cada declaracion se expande a sus formas conocidas; lo que no tenga sinonimos
 * (el texto libre de "Otra") se busca tal cual.
 */
export function terminosDeAlergeno(declaradas: string[]): { alergeno: string; formas: string[] }[] {
  const salida: { alergeno: string; formas: string[] }[] = [];
  for (const d of declaradas) {
    const limpio = String(d ?? "").trim();
    if (limpio === "" || NO_ES_ALERGENO.test(norm(limpio))) continue;
    const clave = norm(limpio);
    // La clave de SINONIMOS puede estar contenida en la declaracion ("Maní" -> "mani").
    const entrada = Object.keys(SINONIMOS).find((k) => clave === k || clave.includes(k));
    salida.push({
      alergeno: limpio,
      formas: entrada ? SINONIMOS[entrada].map(norm) : [clave],
    });
  }
  return salida;
}

/**
 * Cruza el menu estructurado contra los alergenos declarados. Devuelve UN hallazgo por combinacion
 * de alergeno y alimento, con la comida donde aparece.
 *
 * La comparacion es por PALABRA COMPLETA, no por subcadena: sin eso, "pan" cruzaria con "panela" y
 * "sal" con "salmon". Un detector que se dispara de mas es un detector que el profesional aprende a
 * ignorar, y entonces deja de proteger el dia que acierta.
 */
export function cruzarAlergenos(menu: MenuEstructurado, declaradas: string[]): HallazgoAlergeno[] {
  return buscarEnMenu(menu, terminosDeAlergeno(declaradas));
}

// El nucleo de comparacion, compartido por el cruce de alergenos y el de patron alimentario. Es el mismo
// mecanismo (alimentos de la salida contra una lista de formas) y por eso vive una sola vez.
function buscarEnMenu(
  menu: MenuEstructurado,
  terminos: { alergeno: string; formas: string[] }[],
): HallazgoAlergeno[] {
  if (terminos.length === 0) return [];
  const hallazgos: HallazgoAlergeno[] = [];
  for (const comida of menu.comidas ?? []) {
    for (const alimento of comida.alimentos ?? []) {
      const texto = norm(alimento?.nombre ?? "");
      if (texto === "") continue;
      const palabras = new Set(texto.split(" "));
      for (const t of terminos) {
        const pega = t.formas.some((forma) =>
          forma.includes(" ")
            ? texto.includes(forma) // forma compuesta ("crema de leche"): subcadena, ya es especifica
            : palabras.has(forma), // forma simple: palabra completa, nunca subcadena
        );
        if (pega) {
          hallazgos.push({ alergeno: t.alergeno, tiempo: comida.tiempo, alimento: alimento.nombre });
        }
      }
    }
  }
  return hallazgos;
}

/**
 * El texto del aviso. Dice QUE alergeno y EN QUE comida, no solo que hay uno: el profesional tiene que
 * poder verificarlo de un vistazo, sin releer el menu.
 */
export function resumenHallazgos(hallazgos: HallazgoAlergeno[]): string {
  if (hallazgos.length === 0) return "";
  const partes = hallazgos.map((h) => `${h.alergeno} en ${h.tiempo} (${h.alimento})`);
  return partes.join("; ");
}

// Los field_key de donde salen las alergias y el patron alimentario. Estan aqui, con su criterio, y no
// sueltos en el servicio: si manana cambia de donde sale una alergia, se cambia en un sitio.
// d6_43 = alergias alimentarias, d6_44 = intolerancias. Las dos van al mismo bloque: para un menu, una
// intolerancia a la lactosa y una alergia a la leche se cocinan igual, aunque clinicamente no sean lo
// mismo. d4_34 = patron alimentario (vegetariano, vegano, keto, sin gluten, sin lacteos, bajo en sal).
export const ALERGIA_FIELD_KEYS = ["d6_43", "d6_44"] as const;
export const PATRON_FIELD_KEY = "d4_34";

/**
 * Saca de las respuestas las listas que consume el prompt. Recibe pares (fieldKey, valor crudo), que es
 * lo que da el reader, y devuelve texto ya limpio.
 *
 * El valor de una pregunta de opcion multiple llega como arreglo JSON en una cadena. Y el texto libre de
 * "Otra" llega ya pelado del centinela cuando pasa por la glue del motor; aqui se pela otra vez por si
 * el valor viene crudo del reader, que lee sin glue. Pelar dos veces es inocuo; no pelar pierde el
 * alergeno raro, que es justo el que importa.
 */
export function extraerDeEncuesta(
  respuestas: { fieldKey: string | null | undefined; valor: string | null | undefined }[],
): { alergias: string[]; patron: string[] } {
  const decod = (v: string | null | undefined): string[] => {
    if (typeof v !== "string" || v.trim() === "") return [];
    let els: string[];
    try {
      const p: unknown = JSON.parse(v);
      els = Array.isArray(p) ? p.map((x) => String(x)) : [v];
    } catch {
      els = [v];
    }
    return els
      .map((el) => el.replace(/^otr[oa]s?\s*:\s*/i, "").trim())
      .filter((el) => el !== "" && !NO_ES_ALERGENO.test(norm(el)));
  };
  const alergias: string[] = [];
  const patron: string[] = [];
  for (const r of respuestas) {
    if (r.fieldKey == null) continue;
    if ((ALERGIA_FIELD_KEYS as readonly string[]).includes(r.fieldKey)) alergias.push(...decod(r.valor));
    else if (r.fieldKey === PATRON_FIELD_KEY) patron.push(...decod(r.valor));
  }
  return { alergias: [...new Set(alergias)], patron: [...new Set(patron)] };
}

// ── Patron alimentario ────────────────────────────────────────────────────────────────────────────
//
// MISMO MECANISMO, CONFIANZA DISTINTA, Y POR ESO CONSECUENCIA DISTINTA. Comparar los alimentos de la
// salida contra una lista es identico; lo que cambia es la naturaleza de la lista:
//
//   - Un ALERGENO es una lista CERRADA de cosas concretas ("mariscos", "mani"). Se puede enumerar, y si
//     falta un sinonimo se pierde UN alimento.
//   - Un PATRON excluye CATEGORIAS ENTERAS y abiertas. Un vegano no excluye "pollo": excluye todo lo de
//     origen animal, y esa lista no se termina nunca (chorizo, chicharron, morcilla, manteca...).
//
// Consecuencia: este cruce **encuentra lo evidente y no puede prometer completitud**. Por eso lo que
// produce es un AVISO DE ADHERENCIA, no un bloqueo de seguridad: un menu que se salta el patron es un
// plan que el paciente no va a seguir (Gildardo, 3.2), no un plan que lo manda a urgencias. La alergia
// se trata como seguridad; esto, como calidad del plan.
//
// Un detector honesto sobre lo que NO garantiza vale mas que uno que se presenta como completo.
const PATRON_EXCLUYE: Record<string, string[]> = {
  vegano: ["pollo", "carne", "res", "cerdo", "pescado", "atun", "salmon", "mariscos", "camaron", "camarones",
    "jamon", "chorizo", "tocino", "chicharron", "huevo", "huevos", "leche", "queso", "yogur", "yogurt",
    "mantequilla", "miel", "crema de leche", "cuajada", "kumis"],
  vegetariano: ["pollo", "carne", "res", "cerdo", "pescado", "atun", "salmon", "mariscos", "camaron",
    "camarones", "jamon", "chorizo", "tocino", "chicharron"],
  "sin gluten": ["trigo", "pan", "pasta", "cebada", "centeno", "harina de trigo", "galleta", "galletas"],
  "sin lacteos": ["leche", "queso", "yogur", "yogurt", "mantequilla", "crema de leche", "cuajada", "kumis"],
  keto: ["arroz", "pan", "pasta", "papa", "yuca", "platano", "azucar", "arepa", "harina"],
  "bajo en sal": ["embutido", "embutidos", "jamon", "chorizo", "salchicha", "enlatado", "enlatados"],
};

export type ConflictoPatron = { patron: string; tiempo: string; alimento: string };

/**
 * Cruza el menu contra el patron alimentario declarado (d4_34). Devuelve los choques evidentes.
 *
 * Es el caso que Gildardo puso por delante de todo: "el menu no sabe si el paciente es vegano".
 */
export function cruzarPatron(menu: MenuEstructurado, patrones: string[]): ConflictoPatron[] {
  const terminos: { alergeno: string; formas: string[] }[] = [];
  for (const p of patrones) {
    const limpio = String(p ?? "").trim();
    if (limpio === "" || NO_ES_ALERGENO.test(norm(limpio))) continue;
    const clave = norm(limpio);
    const entrada = Object.keys(PATRON_EXCLUYE).find((k) => clave === k || clave.includes(k));
    if (!entrada) continue; // patron libre que no sabemos traducir a alimentos: no se inventa nada
    terminos.push({ alergeno: limpio, formas: PATRON_EXCLUYE[entrada].map(norm) });
  }
  return buscarEnMenu(menu, terminos).map((h) => ({
    patron: h.alergeno,
    tiempo: h.tiempo,
    alimento: h.alimento,
  }));
}
