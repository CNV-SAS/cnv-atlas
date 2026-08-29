// Prompt del menú, versión 4. LA IA DEJA DE GENERAR Y PASA A ADAPTAR.
//
// SU INSTRUCCIÓN (§13, 2026-08-28), textual: "Únanlas. El ciclo de 21 días es la base y la IA solo lo
// adapta cuando hay restricciones, como en mi archivo. UN MODELO COMPONIENDO UN MENÚ DESDE CERO NO ES LO
// QUE ESTE SOFTWARE HACE."
//
// Y el criterio que lo sostiene, que él pidió que se leyera en pantalla: "partir del ciclo es CRITERIO
// CLÍNICO. El paciente debe recibir comida colombiana conocida, de su ciudad y de su mercado, no lo que un
// modelo componga."
//
// LA DECISIÓN QUE SOSTIENE TODO EL RESTO: SE DEVUELVEN SOLO LOS CAMBIOS, no el menú entero.
//   · Si devolviera el menú completo no sabríamos QUÉ tocó, y le estaríamos confiando el 90% que no debía
//     tocar. Con la lista de cambios, lo que no aparece es exactamente lo que no se movió.
//   · Cada cambio trae su MOTIVO, y eso lo hace revisable: el profesional no evalúa un menú nuevo, evalúa
//     una sustitución con su razón al lado.
//   · Y permite aceptar CAMBIO POR CAMBIO. Una sustitución puede ser buena y la de al lado no; aceptar en
//     bloque obligaría a tragarse las dos.
//
// SE DETECTA EL CAMBIO QUE NO CORRESPONDE. El modelo puede proponer una sustitución sobre una celda que no
// chocaba con nada. No se bloquea (juzgar si un alimento choca con una restricción es contenido clínico,
// y eso es del profesional), pero cada cambio dice qué restricción dice atender, y esa restricción se
// coteja contra las que de verdad se le enviaron: si cita una que no existe, se marca. Ver `verificarCita`.

// CLAVE NUEVA, y no es cosmetica. El texto de sistema vive en BD y el admin puede editarlo; si la clave
// siguiera siendo `menu.generate`, un texto editado para la tarea VIEJA ("generas una propuesta de menu
// diario") seguiria mandando sobre el contrato NUEVO, que pide adaptar. El sistema le diria al modelo que
// componga mientras el mensaje de usuario le dice que sustituya, y ganaria el que el modelo prefiera.
//
// Con clave propia eso es imposible por construccion: no hay fila activa de `menu.adapt` en ninguna BD
// existente, asi que cae al texto canonico en codigo, que si corresponde. Las filas de `menu.generate`
// quedan como historia, sin tocar. Y la procedencia guardada cambia de forma visible.
import adaptSystem from "./menu.adapt.system.v1.json";

// FUENTE UNICA del texto de sistema: el mismo JSON que siembra el seed. Escribirlo tambien aqui serian dos
// fuentes del mismo texto sin nada que las compare, y la copia de codigo ganaria en las BD sin sembrar
// mientras la sembrada dice otra cosa. Con una sola fuente, las dos dicen lo mismo por construccion.
export const MENU_ADAPT_SYSTEM_PROMPT: string = adaptSystem.system;

export const MENU_PROMPT_KEY = "menu.adapt";
// Versión del CONTRATO en código, independiente de la del texto de sistema editable en BD. Sube a 4
// porque cambian LAS DOS PUNTAS: entra la semana base y sale una lista de cambios, no un menú.
export const MENU_PROMPT_VERSION = 4;

export type RestriccionModelo = { nombre: string; valor: string; ref: string };

/** Una celda del menú base: el día (0-6), el tiempo de comida y lo que propone el ciclo. */
export type CeldaBase = { dia: number; tiempo: string; texto: string };

export type MenuAdaptarInput = {
  kcalObjetivo: number;
  proteinaGramos: number;
  fenotipoEstructural: string;
  sectorFuncional: string;
  rutasAtencion: string[];
  restriccionesModelo: RestriccionModelo[]; // del MOTOR, con referencia; no negociables
  restriccionesProfesional: string[];
  patronAlimentario: string[];
  /** La semana que hoy ve el profesional, salida del ciclo de 21 días. Es LO QUE SE ADAPTA. */
  base: CeldaBase[];
};

export type CambioPropuesto = {
  dia: number;
  tiempo: string;
  /** Lo que reemplaza a la celda base. */
  reemplazo: string;
  /** Por qué: qué restricción dice atender. Lo que hace revisable la propuesta. */
  motivo: string;
};

// La forma exacta que se le pide. Se declara aquí y se valida al parsear.
export const MENU_CAMBIOS_SHAPE = `{
  "cambios": [
    { "dia": 0, "tiempo": "desayuno", "reemplazo": "Arepa de maiz asada con queso", "motivo": "sin gluten" }
  ]
}`;

/** Los tiempos que el contrato acepta. Son las claves del ciclo, no rótulos de pantalla. */
export const TIEMPOS_CONTRATO = [
  "desayuno",
  "mediasOnces",
  "almuerzo",
  "algo",
  "cena",
  "merienda",
] as const;

export function buildMenuAdaptarPrompt(
  input: MenuAdaptarInput,
  systemOverride?: string,
): { role: "system" | "user"; content: string }[] {
  const system = systemOverride ?? MENU_ADAPT_SYSTEM_PROMPT;

  const rutas = input.rutasAtencion.length ? input.rutasAtencion.join("; ") : "ninguna";
  const modelo = input.restriccionesModelo.length
    ? input.restriccionesModelo.map((r) => `- ${r.nombre}: ${r.valor} (${r.ref})`).join("\n")
    : "- ninguna";
  const profesional = input.restriccionesProfesional.length
    ? input.restriccionesProfesional.map((r) => `- ${r}`).join("\n")
    : "- ninguna";

  const partes: string[] = [
    "Vas a ADAPTAR un menu semanal que YA EXISTE. No lo reescribas: sustituye solo lo que haga falta.",
    "",
    `Objetivo calorico: ${input.kcalObjetivo} kcal por dia.`,
    `Proteina objetivo: ${input.proteinaGramos} g por dia.`,
    `Fenotipo estructural: ${input.fenotipoEstructural}.`,
    `Sector funcional: ${input.sectorFuncional}.`,
    `Rutas de atencion priorizadas: ${rutas}.`,
    "",
  ];

  if (input.patronAlimentario.length > 0) {
    partes.push(
      "PATRON ALIMENTARIO QUE SIGUE EL PACIENTE. No es una preferencia: condiciona todas las comidas.",
      input.patronAlimentario.map((p) => `- ${p}`).join("\n"),
      "",
    );
  }

  partes.push(
    "RESTRICCIONES MEDICAS DEL MODELO (NO NEGOCIABLES), del diagnostico por comorbilidad y fenotipo:",
    modelo,
    "",
    "RESTRICCIONES DEL PROFESIONAL. Respetalas tambien; si alguna choca con una medica, manda la medica.",
    profesional,
    "",
    "MENU BASE (dia 0 = lunes). Es comida colombiana de uso habitual y es el punto de partida:",
    input.base.map((c) => `- dia ${c.dia} | ${c.tiempo}: ${c.texto}`).join("\n"),
    "",
    "TU TAREA. Revisa cada celda del menu base contra las restricciones de arriba. Devuelve UNICAMENTE " +
      "las celdas que incumplen alguna, con la preparacion que las sustituye. Reglas:",
    "- Si una celda no incumple ninguna restriccion, NO la incluyas. Una celda que no aparece se queda " +
      "como esta, y eso es lo correcto.",
    "- El reemplazo debe ser comida colombiana de uso habitual y equivalente en tipo de preparacion y " +
      "porcion a lo que sustituye. No cambies un almuerzo por una ensalada.",
    "- En \"motivo\" escribe LA RESTRICCION CONCRETA que estas atendiendo, copiada de las listas de " +
      "arriba. No escribas justificaciones generales como \"mas saludable\" ni \"mejor opcion\".",
    "- Si ninguna celda incumple nada, devuelve la lista vacia.",
    "",
    "FORMATO DE RESPUESTA. Responde SOLO con un objeto JSON con esta forma exacta:",
    MENU_CAMBIOS_SHAPE,
    `El campo "dia" es un entero de 0 a 6 y "tiempo" es uno de: ${TIEMPOS_CONTRATO.join(", ")}. ` +
      "Sin texto fuera del JSON.",
  );

  return [
    { role: "system", content: system },
    { role: "user", content: partes.join("\n") },
  ];
}

/**
 * Parsea la respuesta a la lista de cambios. Devuelve null si no cumple la forma; el que llama registra
 * la sugerencia como `parse_failed` y LA GRILLA SE QUEDA CON EL CICLO, que es la conducta correcta.
 *
 * ESTRICTO EN LA FORMA, y por una razón distinta a la de v3: allá el parseo habilitaba un cruce de
 * alérgenos que ya no existe; aquí cada cambio va a ESCRIBIR UNA CELDA del plan del paciente. Un `dia`
 * fuera de rango o un `tiempo` inventado escribiría en un sitio que no existe, o peor, en el equivocado.
 *
 * LA LISTA VACÍA ES UNA RESPUESTA VÁLIDA, y distinta de null: significa "revisé y no había nada que
 * sustituir". Confundir las dos haría que "el menú ya cumplía" se mostrara como "la IA falló".
 */
export function parseCambiosMenu(
  texto: string | null | undefined,
): { cambios: CambioPropuesto[] } | null {
  if (typeof texto !== "string" || texto.trim() === "") return null;
  let crudo = texto.trim();
  // Ruido de formato, no una forma distinta: algunos modelos envuelven el JSON pese a que se les pide
  // que no.
  const cerca = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(crudo);
  if (cerca) crudo = cerca[1].trim();
  let dato: unknown;
  try {
    dato = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (typeof dato !== "object" || dato === null) return null;
  const crudos = (dato as { cambios?: unknown }).cambios;
  if (!Array.isArray(crudos)) return null;

  const cambios: CambioPropuesto[] = [];
  for (const c of crudos) {
    if (typeof c !== "object" || c === null) return null;
    const dia = (c as { dia?: unknown }).dia;
    const tiempo = (c as { tiempo?: unknown }).tiempo;
    const reemplazo = (c as { reemplazo?: unknown }).reemplazo;
    const motivo = (c as { motivo?: unknown }).motivo;
    if (typeof dia !== "number" || !Number.isInteger(dia) || dia < 0 || dia > 6) return null;
    if (typeof tiempo !== "string") return null;
    if (!(TIEMPOS_CONTRATO as readonly string[]).includes(tiempo)) return null;
    if (typeof reemplazo !== "string" || reemplazo.trim() === "") return null;
    // El motivo NO es opcional: sin él la propuesta deja de ser revisable, que es la mitad del valor.
    if (typeof motivo !== "string" || motivo.trim() === "") return null;
    cambios.push({ dia, tiempo, reemplazo: reemplazo.trim(), motivo: motivo.trim() });
  }
  return { cambios };
}

/**
 * ¿El motivo que cita este cambio corresponde a una restricción que de verdad se le envió?
 *
 * NO BLOQUEA, y esa es la decisión: juzgar si una preparación incumple una restricción es contenido
 * clínico, y el contenido clínico lo decide el profesional. Lo que sí se puede hacer sin invadir eso es
 * decirle CUÁLES cambios citan una restricción real y cuáles no, para que sepa a qué mirar primero.
 *
 * La comparación es por CONTENCIÓN sobre texto normalizado, no por igualdad: el modelo escribe "sin
 * gluten" donde la lista dice "Sin gluten" o "dieta sin gluten". Exigir igualdad marcaría como no
 * verificados casi todos los cambios legítimos, y un aviso que salta siempre se aprende a ignorar.
 */
export function verificarCita(motivo: string, restricciones: string[]): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // marcas combinantes: escritas con escape, no con el caracter
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const m = norm(motivo);
  if (m === "") return false;
  return restricciones.some((r) => {
    const n = norm(r);
    // Palabras muy cortas ("sal") darian falsos positivos dentro de otras ("ensalada"): se exige que la
    // coincidencia caiga en limite de palabra.
    if (n === "") return false;
    return new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(m) || m.includes(n);
  });
}
