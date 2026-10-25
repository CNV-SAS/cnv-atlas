/**
 * El código de un archivo SIN sus comentarios.
 *
 * POR QUE EXISTE, y ya van seis veces: cuando un candado prohíbe una frase, el comentario que explica
 * POR QUE está prohibida tiene que CITARLA, y entonces el candado se caza a sí mismo. Pasó con el rótulo
 * "Actividad prescrita (FA)", con el motivo del bloque pendiente de la historia clínica, con la `option`
 * deshabilitada del PAL, con el disclaimer que se retiró del reporte del paciente, y dos veces el
 * 2026-10-25 (el rótulo de la fecha de asignación y la promesa vieja del encabezado de /obbia).
 *
 * Y LAS DOS DEL 25 SE ESCRIBIERON DE CERO sin mirar que esto existía, lo que las volvió la quinta y la
 * sexta copia de la misma receta. Antes de escribir un helper de prueba, buscar si ya está: es la misma
 * lección que el segundo constructor que hereda los defectos que el primero ya había tapado.
 *
 * Las tres primeras veces se escribió la misma función en tres archivos distintos. Vive aquí porque tres
 * copias de la misma receta es exactamente el defecto que nos costó las comorbilidades del motor de
 * nutrición: la cuarta copia habría heredado los huecos que las anteriores ya habían tapado (esta quita
 * también los comentarios JSX `{/* ... *\/}`, que la primera versión no quitaba).
 *
 * Un candado que caza su propia documentación es ruido, y el ruido es como mueren los candados.
 */
export function sinComentarios(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // comentario JSX: {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, "") // bloque: /* ... */
    .replace(/\/\/[^\n]*/g, ""); // línea: // ...
}
