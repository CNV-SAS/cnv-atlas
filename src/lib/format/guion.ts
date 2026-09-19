// ═══ NINGÚN GUION LARGO LLEGA A UN USUARIO (Santiago, 2026-09-19) ═══
//
// LA REGLA ES VIEJA (CLAUDE.md: nunca em-dash, ni en código, ni en copy, ni en docs) y este helper existe
// porque hay UNA fuente que no podemos editar: el contenido clínico de Gildardo, que se porta VERBATIM y
// sí los trae ("OBLIGATORIA — sin ejercicio los nutracéuticos son insuficientes").
//
// LA DISTINCIÓN QUE GOBIERNA, y la dio Santiago: si el texto es suyo, se cambia en lo que MOSTRAMOS, no en
// el original. Editar su archivo rompería la fidelidad del port (y sus golden tests, que comparan contra su
// HTML). Editar la pantalla no le quita ni le pone nada a su contenido: cambia un signo por otro.
//
// EN NUESTRO PROPIO COPY no se usa este helper: ahí el guion largo simplemente no se escribe.

/**
 * Cambia el guion largo por el signo que pide la frase: una coma cuando separa cláusulas (que es el 99%
 * de los casos en su archivo) y un guion corto cuando va pegado entre palabras o cifras.
 *
 * NO toca el guion CORTO ni el guion medio de rangos ("50–70%"), que son correctos donde están.
 */
export function sinGuionLargo(texto: string): string {
  return texto
    .replace(/\s+—\s+/g, ", ")
    .replace(/\s+—/g, ",")
    .replace(/—\s+/g, ", ")
    .replace(/—/g, "-");
}
