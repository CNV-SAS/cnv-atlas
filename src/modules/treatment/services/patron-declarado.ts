// PATRON ALIMENTARIO DECLARADO POR EL PACIENTE (d4_34), tal como la encuesta lo capturo.
//
// QUE ES Y QUE NO ES. Esto LEE un campo y decodifica su formato de almacenamiento. No traduce, no
// interpreta y no decide que excluye un patron: eso era `PATRON_EXCLUYE`, contenido clinico que
// redactamos nosotros y que se retiro entero (Gildardo 2026-08-27 §10, regla 0). "Se muestra lo que el
// paciente declaro, y ya", con sus palabras.
//
// POR QUE SIGUE ALIMENTANDO EL PROMPT. Gildardo lo pidio explicitamente en su 3.2b del 26: el generador
// no sabia si el paciente era vegano y por eso le proponia carne. Pasarle lo que el paciente declaro no
// es una tabla de exclusiones ni una verificacion; es darle el dato que la encuesta ya tiene.

/** field_key de la pregunta de patron alimentario en la encuesta. */
export const PATRON_FIELD_KEY = "d4_34";

/**
 * Patron(es) que el paciente declaro. El valor puede venir como JSON (multi-opcion) o como token plano;
 * se cubren los dos porque la encuesta guarda distinto segun el tipo de pregunta.
 */
export function patronDeclarado(
  respuestas: { fieldKey: string | null | undefined; valor: string | null | undefined }[],
): string[] {
  const out: string[] = [];
  for (const r of respuestas) {
    if (r.fieldKey !== PATRON_FIELD_KEY) continue;
    const v = r.valor;
    if (typeof v !== "string" || v.trim() === "") continue;
    let els: string[];
    try {
      const p: unknown = JSON.parse(v);
      els = Array.isArray(p) ? p.map((x) => String(x)) : [v];
    } catch {
      els = [v];
    }
    // El prefijo "Otra: " es del formato de captura, no parte de lo que el paciente escribio.
    for (const el of els) {
      const t = el.replace(/^otr[oa]s?\s*:\s*/i, "").trim();
      if (t !== "") out.push(t);
    }
  }
  return [...new Set(out)];
}
