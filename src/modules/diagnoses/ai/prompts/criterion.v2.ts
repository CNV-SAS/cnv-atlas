import type { AiMessage } from "@/lib/ai/provider";

import { CRITERION_SYSTEM_PROMPT } from "./criterion.system";

// PROMPT v2 DEL BORRADOR DE CRITERIO · PORTE DEL PASO 4 DE SU ANALISIS IA (punto 8 de su cotejo).
//
// SU INSTRUCCION GOBIERNA EL ALCANCE, y por eso esto es PORTE y no diseño: *"traten de enviar edad,
// diagnostico, todo lo del prompt completo que tiene el html, para que no pierda la sustancia, pero NO
// enviar el nombre"*. La unica excepcion es suya y explicita.
//
// SOLO EL PASO 4. Su pipeline hace cuatro llamadas (patrones, hipotesis, validacion, sintesis) y la
// cadena SE CORTA: `validacion` no la lee nadie, y el paso 4 no recibe ninguno de los tres. Portar los
// otros tres serian tres llamadas al modelo cuyo resultado su propio archivo descarta. Va declarado en
// PENDIENTES_CIENTIFICOS (pregunta 19) por si la intencion era otra.
//
// ───────────────────────────────────────────────────────────────────────────────────────────────────
// LA BARRERA PII ES LA LISTA BLANCA DE ABAJO, y esa es la decision de diseño mas importante del archivo.
//
// El contrato recibe el `enc` ENTERO (todas las respuestas de la encuesta) y el builder lee SOLO las
// claves enumeradas en CAMPOS. Un campo nuevo en la encuesta, o una pregunta que capture algo que no debe
// viajar, NO llega al modelo hasta que alguien lo escriba aqui a mano. Es larga a proposito: la longitud
// es lo que hace que colar un campo sea un acto deliberado y visible en un diff.
//
// La alternativa (que el llamador arme las filas) mueve la barrera fuera de este archivo, donde ya no se
// puede auditar de un vistazo.
//
// LAS ETIQUETAS SALEN DEL INSTRUMENTO, no de su prompt. Su bloque de datos crudos escribe rotulos a mano
// y al cotejarlos aparecio uno equivocado: manda `Frecuencia urinaria: ${enc.d7_57}` y su propio `d7_57`
// es *"¿Siente sed con frecuencia?"* (el mismo texto que el nuestro). Copiar su rotulo haria que el
// modelo leyera una respuesta sobre la sed como si fuera sobre la orina. Tomando el texto de la pregunta
// que el paciente respondio, esa clase de error no se hereda y ademas se corrige sola si el instrumento
// cambia. Declarado en PENDIENTES_CIENTIFICOS.

export const CRITERION_PROMPT_KEY = "criterio.generate";
export const CRITERION_PROMPT_VERSION = 2;
export { CRITERION_SYSTEM_PROMPT };

/**
 * LA LISTA BLANCA. Cada entrada es un `field_key` de la encuesta que SI viaja al modelo, agrupado en las
 * secciones y el orden de SU bloque de datos crudos.
 *
 * Son los 58 campos que su prompt manda, menos `d5_40_otro` (que en Atlas no es campo propio: el texto
 * libre de "Otros" viaja DENTRO de la respuesta de `d5_40`). Ver PENDIENTES_CIENTIFICOS, pregunta 18.
 */
export const CAMPOS: { seccion: string; claves: string[] }[] = [
  {
    seccion: "ANTECEDENTES",
    claves: ["d5_38", "d5_39", "d5_40", "d5_36", "d5_37", "d5_41", "d5_42"],
  },
  {
    seccion: "CONTEXTO SOCIAL",
    claves: ["d8_59", "d8_60", "d8_61", "d8_62"],
  },
  {
    seccion: "HÁBITOS ALIMENTARIOS",
    claves: ["d4_32", "d4_33", "d4_34", "d4_35"],
  },
  {
    // Los quince grupos en el orden del patron, mas los tres de forma. Es el insumo del dominio
    // Metabolico-Estructural y del LE8, asi que van todos: un grupo ausente baja el score en silencio.
    seccion: "FRECUENCIA DE CONSUMO POR GRUPOS",
    claves: [
      "d1_1_i", "d1_2_i", "d1_3_i", "d1_4_i", "d1_5_i", "d1_6_i", "d1_7_i", "d1_8_i",
      "d1_9_i", "d1_10_i", "d1_11_i", "d1_12_i", "d1_13_i", "d1_14_i", "d1_15_i",
      "d1f_sal_i", "d1f_des_i", "d1f_noche_i",
    ],
  },
  {
    seccion: "CONDUCTUAL Y PERCEPTUAL",
    claves: ["d2_19", "d2_20", "d2_21", "d2_22"],
  },
  {
    seccion: "DETERMINANTES DE LA SALUD",
    claves: ["d3_23", "d3_24", "d3_25", "d3_26", "d3_27", "d3_28", "d3_29", "d3_30", "d3_31"],
  },
  {
    // La cirugia digestiva tiene clave PROPIA en Atlas (`d6_qx`), no un numero de la secuencia. Su
    // archivo no la tiene: es pregunta nuestra, y por eso va al final de la seccion y no intercalada.
    seccion: "DIGESTIVO",
    claves: [
      "d6_43", "d6_44", "d6_45", "d6_46", "d6_47", "d6_48", "d6_49", "d6_50", "d6_51", "d6_qx",
    ],
  },
  {
    seccion: "HIDRATACIÓN",
    claves: ["d7_58", "d7_57", "d7_agua"],
  },
];

/** Las claves de la lista blanca, en plano. Para el candado y para el propio builder. */
export const CLAVES_PERMITIDAS: ReadonlySet<string> = new Set(CAMPOS.flatMap((s) => s.claves));

/**
 * LO QUE NUNCA VIAJA, escrito para que un candado pueda afirmarlo y para que se lea aqui sin ir a otro
 * documento. No es una lista operativa (la barrera es la lista blanca de arriba, que es positiva): es la
 * razon de cada exclusion.
 *
 *  · nombre, documento, correo, telefono  -> §6 del consentimiento: los sistemas automatizados trabajan
 *    "a partir de variables clinicas seudonimizadas (sin sus datos de identificacion)". Y el nombre es,
 *    ademas, la unica excepcion que Gildardo puso por escrito.
 *  · fecha de nacimiento -> viaja la EDAD, que es la variable clinica; la fecha es identificacion.
 *  · etnia y ascendencia -> el consentimiento las ata a la finalidad de INVESTIGACION del observatorio
 *    ("si usted decide informar su pertenencia etnica, este dato se utiliza dentro de esta misma
 *    finalidad"), que NO es la del §6. Mandarlas al modelo seria otra finalidad que nadie autorizo.
 *
 * SI viajan edad, sexo, ocupacion, estado civil y estrato: son los determinantes del dominio
 * Epigenetico-Contextual de su modelo, y ya se le declaro por escrito.
 */
export const NUNCA_VIAJAN = [
  "nombre",
  "documento",
  "correo",
  "telefono",
  "fecha de nacimiento",
  "etnia",
  "ascendencia",
] as const;

/** Una respuesta de la encuesta tal como la lee el builder: su clave, el texto de LA PREGUNTA, y el valor. */
export type RespuestaEncuesta = {
  fieldKey: string | null;
  pregunta: string;
  valor: string | null;
};

/** Un dominio del DFI, tal como lo sella el motor. Es el ESQUELETO OBLIGATORIO de su prompt. */
export type DominioDfi = {
  nombre: string;
  severidad: string;
  clasif: string;
  lectura: string;
  items: string[];
};

export type CriterionPromptInput = {
  // ── Identificacion CLINICA. Sin nombre, documento ni contacto: ver NUNCA_VIAJAN. ──
  sexo: string;
  edad: number | null;
  ocupacion: string | null;
  estadoCivil: string | null;
  estrato: string | null;

  // ── Antropometria ──
  peso: number | null;
  talla: number | null;
  cintura: number | null;
  cadera: number | null;

  // ── El bloque DFI: el esqueleto que su prompt declara OBLIGATORIO. ──
  riesgoIntegrado: string;
  riesgoScore: number | null;
  riesgoDescripcion: string | null;
  dominios: DominioDfi[];
  veto: boolean;
  rutas: string[];

  // ── La encuesta ENTERA. El builder lee solo lo que esta en CAMPOS. ──
  encuesta: RespuestaEncuesta[];

  // ── Composicion corporal y bioelectrica, ya formateadas por su capa de display (etiqueta + valor con
  //    sus unidades y decimales), que es lo que el profesional ve en pantalla. ──
  composicion: { etiqueta: string; valor: string }[];

  // ── Estado EFR y fenotipos ──
  estadoEfr: string;
  fenotipoEstructural: string;
  fenotipoMccb: string | null;
  sectorFuncional: string;
  mecanismo: string | null;
  riesgos: string | null;

  // ── Indicadores del modelo, con su clasificacion. ──
  indicadores: { nombre: string; valor: string; clasificacion: string }[];

  // ── Cortes por sexo, ya resueltos: su prompt insiste en que se citen ESOS y no los historicos. ──
  cortes: string[];
};

// NO HAY `biomarcadores`, y su ausencia es el arreglo del punto 9 (2026-09-07): el campo `bio` de su
// tabla de estados EFR es una HIPOTESIS (que laboratorios pedir), y el modelo la convirtio en un
// hallazgo ("hay evidencia de PCR elevada" sobre un paciente sin analitica). Se muestra en pantalla y NO
// viaja. El candado `ai-criterion-prompt.test.ts` lo afirma por CONTENIDO, no por nombre de campo.

const guion = (v: unknown): string => {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : "Ninguno";
  return String(v);
};

const num = (v: number | null, u: string, dec = 1): string =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(dec)} ${u}`;

/**
 * Arma el mensaje. NO es parametrizable: solo el bloque de SISTEMA se edita desde /admin/ia, asi que la
 * edicion del prompt nunca puede inyectar un campo nuevo ni PII.
 */
export function buildCriterionPrompt(
  input: CriterionPromptInput,
  systemText: string = CRITERION_SYSTEM_PROMPT,
): AiMessage[] {
  const L: string[] = [];

  L.push(
    "Escribe el diagnóstico integral ESTRUCTURADO POR LOS 5 DOMINIOS DEL DFI (ver bloque DFI).",
    "Sigue el esqueleto del DFI; usa los datos crudos solo como evidencia de respaldo.",
    "",
    "DIAGNÓSTICO FUNCIONAL INTEGRADO (DFI) — ESQUELETO OBLIGATORIO DEL DIAGNÓSTICO:",
    `Riesgo funcional integrado: ${input.riesgoIntegrado}` +
      (input.riesgoScore != null ? ` · índice ${input.riesgoScore}/100` : "") +
      (input.riesgoDescripcion ? ` — ${input.riesgoDescripcion}` : ""),
  );
  input.dominios.forEach((d, i) => {
    L.push(
      `Dominio ${i + 1} · ${d.nombre} [${d.severidad}]: ${d.clasif}. ${d.lectura}` +
        (d.items.length ? ` Evidencia: ${d.items.join(" · ")}` : ""),
    );
  });
  if (input.veto) {
    L.push("VETO CONDUCTUAL ACTIVO: prioridad psicológica; excluir intervención nutricional restrictiva.");
  }
  L.push(`Rutas de Atención derivadas: ${input.rutas.length ? input.rutas.join(" · ") : "ninguna"}`);

  L.push("", "=== DATOS CRUDOS DEL PACIENTE (evidencia de respaldo) ===", "");
  // IDENTIFICACION CLINICA. El rotulo dice "clínica" a proposito: es lo que queda del bloque de
  // identificacion de su prompt una vez retirado lo que no puede viajar.
  L.push(
    "IDENTIFICACIÓN CLÍNICA:",
    `Sexo: ${guion(input.sexo)} | Edad: ${input.edad != null ? `${input.edad} años` : "—"}`,
    `Peso: ${num(input.peso, "kg")} | Estatura: ${num(input.talla, "cm")} | Cintura: ${num(input.cintura, "cm")} | Cadera: ${num(input.cadera, "cm")}`,
    `Ocupación: ${guion(input.ocupacion)} | Estado civil: ${guion(input.estadoCivil)} | Estrato: ${guion(input.estrato)}`,
    "",
  );

  // LA ENCUESTA, POR LA LISTA BLANCA. Se recorre CAMPOS (no las respuestas): asi el orden es el de su
  // prompt y una clave que no este enumerada no puede aparecer aunque venga en el `enc`.
  const porClave = new Map(
    input.encuesta.filter((r) => r.fieldKey).map((r) => [r.fieldKey as string, r]),
  );
  for (const { seccion, claves } of CAMPOS) {
    const filas = claves
      .map((k) => porClave.get(k))
      .filter((r): r is RespuestaEncuesta => r != null)
      .map((r) => `${r.pregunta}: ${guion(r.valor)}`);
    if (filas.length === 0) continue;
    L.push(`${seccion}:`, ...filas, "");
  }

  if (input.composicion.length > 0) {
    L.push(
      "COMPOSICIÓN CORPORAL Y BIOELÉCTRICA:",
      ...input.composicion.map((c) => `${c.etiqueta}: ${c.valor}`),
      "",
    );
  }

  L.push(
    "ESTADO FUNCIONAL:",
    `Estado EFR: ${guion(input.estadoEfr)}`,
    `Fenotipo estructural: ${guion(input.fenotipoEstructural)}` +
      (input.fenotipoMccb ? ` | Fenotipo MCCB: ${input.fenotipoMccb}` : ""),
    `Sector funcional (IFC × IRC): ${guion(input.sectorFuncional)}`,
    `Mecanismo del estado: ${guion(input.mecanismo)}`,
    `Riesgos del estado: ${guion(input.riesgos)}`,
    "",
  );

  if (input.indicadores.length > 0) {
    L.push(
      "INDICADORES DEL MODELO:",
      ...input.indicadores.map((i) => `${i.nombre}: ${i.valor} (${i.clasificacion})`),
      "",
    );
  }

  if (input.cortes.length > 0) {
    // Su prompt PROHIBE los cortes historicos unicos y exige los del sexo del paciente. Se los damos ya
    // resueltos, que es lo que el hace, para que no tenga que elegir.
    L.push("CORTES DEL SEXO DE ESTE PACIENTE (cita estos y sólo estos):", ...input.cortes, "");
  }

  return [
    { role: "system", content: systemText },
    { role: "user", content: L.join("\n").trimEnd() },
  ];
}
