// Prompt del menu, version 3. El CONTRATO DE SALIDA es JSON estructurado (lista de alimentos), no prosa.
//
// POR QUE ESTRUCTURADO, tras el retiro del cruce de alergenos (Gildardo 2026-08-27 §10). El JSON nacio
// para poder cruzar alimento contra alimento; ese cruce se retiro entero. La forma estructurada SE QUEDA
// por la otra razon, que sigue viva: es lo que permite RENDERIZAR y EDITAR el menu semanal por celda y
// conectarlo con la lista de intercambio. Sobre prosa libre nada de eso es posible.
//
// LO QUE ESTE PROMPT NO HACE, Y ES DELIBERADO: no lleva bloque de alergias. Pasarle las alergias al
// modelo era una verificacion PARCIAL que no podemos sostener (una instruccion se cumple "casi siempre",
// y casi siempre no es criterio en una reaccion alergica), y el software no es un verificador de
// seguridad alimentaria (regla 0). El plan lo revisa el profesional antes de entregarlo, que es lo que
// Gildardo pide. El PATRON alimentario si va: el lo pidio explicitamente (3.2b del 26) y es lo que el
// paciente declaro, sin tabla de exclusiones ni nadie decidiendo que es keto.

export const MENU_PROMPT_KEY = "menu.generate";
// Version del CONTRATO en codigo (independiente de la version del texto de sistema editable en BD).
export const MENU_PROMPT_VERSION = 3;

export type RestriccionModelo = { nombre: string; valor: string; ref: string };

export type MenuPromptInput = {
  kcalObjetivo: number;
  proteinaGramos: number;
  fenotipoEstructural: string;
  sectorFuncional: string;
  rutasAtencion: string[]; // mismo nombre que en v2, para no tocar el sitio de llamada
  restriccionesModelo: RestriccionModelo[]; // del MOTOR, con referencia; no negociables
  restriccionesProfesional: string[]; // ej. "sin gluten", "vegetariano"
  // NUEVOS EN v3, del 3.2 de Gildardo (2026-08-26).
  patronAlimentario: string[]; // d4_34: vegetariano, vegano, keto, sin gluten, sin lacteos, bajo en sal
};

// La forma exacta que se le pide. Se declara aqui y se valida al parsear: si el modelo devuelve otra
// cosa, la sugerencia queda como parse_failed y NO se muestra como menu valido.
export const MENU_JSON_SHAPE = `{
  "comidas": [
    { "tiempo": "Desayuno", "alimentos": [ { "nombre": "Arepa de maiz", "porcion": "1 unidad mediana" } ] }
  ]
}`;

export function buildMenuPrompt(
  input: MenuPromptInput,
  systemOverride?: string,
): { role: "system" | "user"; content: string }[] {
  const system =
    systemOverride ??
    "Eres un nutricionista clinico. Generas menus de un dia, con alimentos de uso habitual en Colombia, " +
      "ajustados a un objetivo calorico y proteico y a restricciones clinicas. Respondes SOLO con JSON " +
      "valido, sin texto antes ni despues, sin bloques de codigo.";

  const rutas = input.rutasAtencion.length ? input.rutasAtencion.join("; ") : "ninguna";
  const modelo = input.restriccionesModelo.length
    ? input.restriccionesModelo.map((r) => `- ${r.nombre}: ${r.valor} (${r.ref})`).join("\n")
    : "- ninguna";
  const profesional = input.restriccionesProfesional.length
    ? input.restriccionesProfesional.map((r) => `- ${r}`).join("\n")
    : "- ninguna";

  const partes: string[] = [
    `Objetivo calorico: ${input.kcalObjetivo} kcal por dia.`,
    `Proteina objetivo: ${input.proteinaGramos} g por dia.`,
    `Fenotipo estructural: ${input.fenotipoEstructural}.`,
    `Sector funcional: ${input.sectorFuncional}.`,
    `Rutas de atencion priorizadas: ${rutas}.`,
    "",
  ];

  // Patron alimentario: condiciona TODAS las comidas, no excluye un alimento suelto.
  if (input.patronAlimentario.length > 0) {
    partes.push(
      "PATRON ALIMENTARIO QUE SIGUE EL PACIENTE. No es una preferencia: condiciona todas las comidas " +
        "del plan. Un menu que no lo respeta no lo va a seguir ni un dia.",
      input.patronAlimentario.map((p) => `- ${p}`).join("\n"),
      "",
    );
  }

  partes.push(
    "RESTRICCIONES MEDICAS DEL MODELO (NO NEGOCIABLES). Salen del diagnostico por comorbilidad y " +
      "fenotipo, y cada una trae su referencia clinica. El menu DEBE cumplirlas: si un alimento " +
      "habitual las incumple, sustituyelo por otro equivalente que si las cumpla.",
    modelo,
    "",
    "RESTRICCIONES DEL PROFESIONAL (exclusiones y preferencias que agrego el nutricionista). " +
      "Respetalas tambien; si alguna choca con una restriccion medica, manda la medica.",
    profesional,
    "",
    "Genera un menu de un dia (desayuno, media manana, almuerzo, media tarde y cena) que cumpla el " +
      "objetivo calorico y de proteina, respete TODOS los bloques anteriores y sea coherente con el " +
      "fenotipo.",
    "",
    "FORMATO DE RESPUESTA. Responde SOLO con un objeto JSON con esta forma exacta:",
    MENU_JSON_SHAPE,
    "Un elemento de \"alimentos\" por cada alimento, nunca varios en el mismo \"nombre\": el nombre " +
      "lleva UN alimento o preparacion, y la porcion casera va en \"porcion\". Sin texto fuera del JSON.",
  );

  return [
    { role: "system", content: system },
    { role: "user", content: partes.join("\n") },
  ];
}

/**
 * Parsea la respuesta del modelo a la forma declarada. Devuelve null si no cumple, y el que llama
 * registra la sugerencia como `parse_failed`.
 *
 * Es DELIBERADAMENTE estricto: un menu que no se puede parsear es un menu que NO SE PUEDE CRUZAR
 * contra las alergias. Aceptar una forma "parecida" dejaria pasar un menu sin chequeo de alergenos,
 * que es peor que no generarlo. Ante la duda, falla.
 *
 * Lo unico que tolera es el envoltorio: algunos modelos devuelven el JSON dentro de un bloque de
 * codigo pese a que se les pide que no. Eso es ruido de formato, no una forma distinta.
 */
export function parseMenuEstructurado(texto: string | null | undefined): {
  comidas: { tiempo: string; alimentos: { nombre: string; porcion?: string }[] }[];
} | null {
  if (typeof texto !== "string" || texto.trim() === "") return null;
  let crudo = texto.trim();
  const cerca = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(crudo);
  if (cerca) crudo = cerca[1].trim();
  let dato: unknown;
  try {
    dato = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (typeof dato !== "object" || dato === null) return null;
  const comidasCrudas = (dato as { comidas?: unknown }).comidas;
  if (!Array.isArray(comidasCrudas) || comidasCrudas.length === 0) return null;
  const comidas: { tiempo: string; alimentos: { nombre: string; porcion?: string }[] }[] = [];
  for (const c of comidasCrudas) {
    if (typeof c !== "object" || c === null) return null;
    const tiempo = (c as { tiempo?: unknown }).tiempo;
    const alimentosCrudos = (c as { alimentos?: unknown }).alimentos;
    if (typeof tiempo !== "string" || tiempo.trim() === "") return null;
    if (!Array.isArray(alimentosCrudos)) return null;
    const alimentos: { nombre: string; porcion?: string }[] = [];
    for (const a of alimentosCrudos) {
      if (typeof a !== "object" || a === null) return null;
      const nombre = (a as { nombre?: unknown }).nombre;
      if (typeof nombre !== "string" || nombre.trim() === "") return null;
      const porcion = (a as { porcion?: unknown }).porcion;
      alimentos.push({
        nombre: nombre.trim(),
        ...(typeof porcion === "string" && porcion.trim() !== "" ? { porcion: porcion.trim() } : {}),
      });
    }
    comidas.push({ tiempo: tiempo.trim(), alimentos });
  }
  return { comidas };
}
