/**
 * El código de un archivo SIN sus comentarios.
 *
 * POR QUE EXISTE, y ya van cuatro veces: cuando un candado prohíbe una frase, el comentario que explica
 * POR QUE está prohibida tiene que CITARLA, y entonces el candado se caza a sí mismo. Pasó con el rótulo
 * "Actividad prescrita (FA)", con el motivo del bloque pendiente de la historia clínica, con la `option`
 * deshabilitada del PAL, y con el disclaimer que se retiró del reporte del paciente.
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
