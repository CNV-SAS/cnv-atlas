// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS SIMBOLOS QUE LA FUENTE DEL PDF NO SABE DIBUJAR  ·  Y POR QUE SALEN COMO BASURA
//
// ═══ EL DEFECTO, Y LO ENCONTRO SANTIAGO LEYENDO EL INFORME (2026-11-03) ═══
//
// En la hoja 3 del informe de un paciente real salia *"Distribución proteica: e25g por comida"*,
// *"Sueño reparador e7h"* y *"Crucíferas: sulforafano ’ Nrf2 ’ protección epigenética"*. Son
// `≥25g`, `≥7h` y `→`: el texto es correcto en la base y en la pantalla, y se rompe AL IMPRIMIR.
//
// LA CAUSA: `@react-pdf` compone con las fuentes estandar del PDF (Helvetica), cuya codificacion es
// WinAnsi, o sea Latin-1 mas un puñado de signos tipograficos. `≥`, `→`, `φ`, `−`, `Δ`, `≈` y los emojis
// NO ESTAN AHI. El renderizador no falla ni avisa: emite el byte que puede y sale otra letra. Por eso
// `≥` aparecio como una "e" y `→` como una comilla.
//
// Y ES PEOR QUE UN CARACTER FEO: un documento clinico que dice "e25g" donde deberia decir "al menos 25 g"
// no es ilegible, es LEGIBLE Y FALSO. Nadie sospecha una errata; se lee como una unidad raria.
//
// ═══ POR QUE SE TRADUCE Y NO SE EMBEBE UNA FUENTE ═══
//
// Embebber un TTF con esos glifos lo arreglaria de raiz, y se descarto por dos razones concretas:
// cambiaria la tipografia de los TRES documentos (nadie lo pidio) y moveria las medidas, que es justo lo
// que el candado de la maquetacion del informe fija al punto (la geometria del arco de marca se calculo
// contra el `padding` de la pagina). Un arreglo de glifos no puede traer un rediseño.
//
// ═══ EL MAPA NO ES COSMETICO: CADA LINEA CONSERVA EL SIGNIFICADO ═══
//
// `≥` se vuelve ">=" y no se borra: borrarlo convertiria "≥25 g" en "25 g", que es una PRESCRIPCION
// DISTINTA. Lo mismo `↑`/`↓`, que en sus cadenas de biomarcadores van de SUFIJO ("PCR↑, albúmina↓"): se
// vuelven " (alto)" y " (bajo)", que es un parentesis y por tanto se lee bien vaya delante o detras.
//
// LO QUE SI SE QUITA son los pictogramas (emojis, el triangulo de aviso): no llevan informacion que el
// texto de al lado no diga, y no hay forma de escribirlos en Latin-1.
//
// ═══ Y LO QUE NO ESTE EN EL MAPA NO SE CUELA EN SILENCIO ═══
//
// Un caracter desconocido fuera de WinAnsi se quita, porque dejarlo pasar es volver a imprimir basura.
// Pero ANTES de que eso pueda ocurrir, el candado `simbolos-del-pdf` barre todo el texto clinico del
// repositorio y falla si encuentra uno que este mapa no contemple: asi un simbolo nuevo obliga a una
// DECISION en vez de desaparecer. Es la unica forma de que un drop silencioso no sea posible.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Lo que cada simbolo que la fuente no tiene pasa a decir. Las claves son los caracteres tal cual
 * aparecen en el texto clinico; el valor es su equivalente escribible en WinAnsi.
 */
export const EQUIVALENCIAS_PDF: Record<string, string> = {
  // ── Comparadores: el valor cambia si se pierden ────────────────────────────────────────────────
  "≥": ">=", // ≥
  "≤": "<=", // ≤
  "≈": "~", // ≈ (la meta del ICN)
  "−": "-", // − menos matematico (la referencia "−5 a +5 años" del IAE)
  "‑": "-", // ‑ guion sin salto (HOMA‑IR)
  // ── Flechas ───────────────────────────────────────────────────────────────────────────────────
  "→": "->", // →
  "←": "<-", // ←
  // SUFIJOS DE BIOMARCADOR, en parentesis para que se lean bien en cualquier posicion.
  "↑": " (alto)", // ↑
  "↓": " (bajo)", // ↓
  // ── Griegas y matematicas del modelo ──────────────────────────────────────────────────────────
  "φ": "phi", // φ (la proporcion aurea del PABU)
  "α": "alfa", // α
  "σ": "sigma", // σ
  "μ": "u", // μ
  "Δ": "Delta", // Δ
  "Ω": "ohm", // Ω (las unidades del Biody)
  "∈": " en ", // ∈
  "∞": "inf", // ∞
  "⁺": "+", // ⁺
  // ── Pictogramas: se quitan, no dicen nada que el texto no diga ────────────────────────────────
  //
  // Y ESO HAY QUE JUSTIFICARLO UNA VEZ, porque son de Gildardo. Los suyos son SEMAFOROS y ETIQUETAS que
  // van PEGADOS a la palabra que dicen lo mismo: el 🔴 de `atlas-alertas` precede a su nivel escrito, el
  // 🧬 de `engine.dfi` encabeza el dominio Epigenetico que se nombra al lado, el 📏 de `engine.patron`
  // marca una medida que la fila ya rotula. Quitarlos no pierde informacion; dejarlos imprime basura.
  //
  // EN PANTALLA SE QUEDAN, que es la otra mitad: esta traduccion es SOLO del PDF, donde la fuente no los
  // tiene. En el navegador se dibujan igual que en su archivo.
  "⚠": "", // ⚠
  "✅": "", // ✅
  "❤": "", // ❤
  "⏳": "", // ⏳
  "⚖": "", // ⚖
  "\u{1F6A8}": "", // 🚨
  "\u{1F534}": "", // 🔴
  "\u{1F7E0}": "", // 🟠
  "\u{1F7E1}": "", // 🟡
  "\u{1F7E2}": "", // 🟢
  "\u{1F535}": "", // 🔵
  "\u{1F52C}": "", // 🔬
  "\u{1FA9E}": "", // 🪞
  "\u{1F9EC}": "", // 🧬
  "\u{1F4CF}": "", // 📏
  "️": "", // selector de variacion (viaja pegado a los de arriba)
};

/** Es un caracter que la codificacion WinAnsi de las fuentes estandar del PDF sabe escribir. */
function loDibujaLaFuente(c: string): boolean {
  const n = c.codePointAt(0) ?? 0;
  if (n === 0x0a || n === 0x0d || n === 0x09) return true; // saltos y tabulador
  if (n >= 0x20 && n <= 0x7e) return true; // ASCII imprimible
  if (n >= 0xa0 && n <= 0xff) return true; // Latin-1 (tildes, eñes, º, ·, ×, ±)
  // El bloque de WinAnsi que no es Latin-1: comillas tipograficas, guiones largos, bullet, euro.
  return "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".includes(
    c,
  );
}

/**
 * El texto listo para componer en el PDF: traduce lo que la fuente no sabe dibujar y quita lo que no
 * tiene equivalente.
 *
 * ES IDEMPOTENTE y no toca nada que ya sea escribible, asi que aplicarla dos veces es inofensivo: es lo
 * que permite ponerla en el `Text` del PDF y no en cada uno de los 169 sitios que lo usan.
 */
export function paraPdf(texto: string): string {
  let salida = "";
  for (const c of texto) {
    if (loDibujaLaFuente(c)) {
      salida += c;
      continue;
    }
    salida += EQUIVALENCIAS_PDF[c] ?? "";
  }
  // Los reemplazos pueden dejar un espacio doble (" (alto)" junto a un espacio que ya estaba). Se
  // normalizan los espacios HORIZONTALES y no los saltos de linea, que en un PDF son maquetacion.
  return salida.replace(/[ \t]{2,}/g, " ");
}

/**
 * Los caracteres de un texto que la fuente no dibuja y que este modulo NO contempla. Vacio = cubiertos.
 * Lo usa el candado para barrer el texto clinico del repositorio.
 */
export function simbolosSinEquivalencia(texto: string): string[] {
  const fuera = new Set<string>();
  for (const c of texto) {
    if (loDibujaLaFuente(c)) continue;
    if (c in EQUIVALENCIAS_PDF) continue;
    fuera.add(c);
  }
  return [...fuera];
}
