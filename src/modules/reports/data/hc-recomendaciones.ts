// RECOMENDACIONES de la historia clinica (bloque 11). Modulo NEUTRO y PURO.
//
// Porte del bloque condicional de su archivo (v8 L15255-15272): SIETE bloques, activados por diagnostico,
// mas el generico que va siempre. La captura mostraba solo el generico porque el paciente demo no tenia
// comorbilidades; el codigo tiene las siete ramas (leccion: una captura es un caso, no la funcion).
//
// TRES tienen texto FIJO y se portaron desde el principio. Los otros cuatro citan cifras de
// `motorTratNutri`, y el 2026-08-31, al CONECTAR ese motor, TRES de ellos dejaron de estar pendientes:
// DASH/sodio, nefroproteccion y preservacion de masa muscular solo necesitan `sodioMax` y `protKg/protG`,
// que ya tenemos. Queda UNO, "Manejo del exceso de grasa corporal", que cita `kcalObjetivo` y `deficit`:
// son las CIFRAS CALORICAS, y su formula de gasto difiere de la cadena que el profesional edita. El dijo
// "no lo cambien ahora" y esta preguntado en la ronda del 31.
//
// EL MOTIVO DE LA NOTA CAMBIO, y no es cosmetico: decia "el porte bloqueado", que era FALSO desde el 23 de
// agosto (el motor estaba portado y contestado; lo que faltaba era conectarlo). Un texto que dice que se
// espera algo que ya llego es la misma clase de mentira que arreglamos en la pantalla del sellado.

export type RecomendacionBloque = { titulo: string; items: string[]; pendiente?: boolean };

// Verbatim de su archivo.
const GENERAL: RecomendacionBloque = {
  titulo: "Alimentación saludable general",
  items: [
    "Hidratación de 30 a 35 mL/kg/día",
    "Frutas y verduras de varios colores en cada comida",
    "Preparaciones al vapor, al horno o a la plancha",
    "Planificar las compras según el plan",
    "Leer etiquetas (grasa saturada, azúcar, sodio)",
    "Distribuir las comidas cada 3 a 4 horas",
  ],
};

const GLUCEMICO: RecomendacionBloque = {
  titulo: "Control glucémico",
  items: [
    "Limitar azúcares libres a <25 g/día",
    "Preferir cereales integrales de bajo índice glucémico",
  ],
};

const LIPIDOS: RecomendacionBloque = {
  titulo: "Control de lípidos",
  items: [
    "Reducir grasas saturadas por debajo del 7% del VCT",
    "Omega-3: pescado azul dos o tres veces por semana",
  ],
};

// Diagnosticos personales (d5_39) que activan cada bloque, con el texto EXACTO de la encuesta.
const DX_GLUCEMICO = ["Diabetes tipo 2", "Prediabetes"];
const DX_LIPIDOS = ["Dislipidemia (colesterol alto)", "Hipertrigliceridemia"];

// EL UNICO que sigue esperando, y lo que espera es la FORMULA DEL GASTO, no un porte. Su bloque imprime
// "Objetivo N kcal/dia (deficit M kcal)", y esas dos cifras salen de un gasto que `motorTratNutri` calcula
// con Mifflin sobre el peso meta mientras la cadena que el profesional edita usa Cunningham cuando hay masa
// libre de grasa (siempre, porque medimos bioimpedancia). El lo nombro y dijo "no lo cambien ahora".
// Mostrarlo con una de las dos cifras pondria en la historia clinica un objetivo que no coincide con el que
// el profesional prescribio. Ronda del 31.
const PENDIENTES: { titulo: string; activa: (c: RecomendacionesContexto) => boolean }[] = [
  { titulo: "Manejo del exceso de grasa corporal", activa: (c) => c.exceso && !c.sarcopenia },
];

// Los tres que se RESOLVIERON al conectar el motor (2026-08-31). Texto VERBATIM de su archivo.
// LA PROTEINA SE IMPRIME COMO EL LA IMPRIME: el numero crudo con coma decimal (0,7), no con dos decimales.
//  daria "0,70", que es un decimal que su archivo no escribe. Lo caz el test, no la revision.
// (ATLAS_v8.html, bloque de recomendaciones por diagnostico); lo unico que se interpola son sus propias
// variables: `smax` (sodioMax), `pk` (protKg) y `pg` (protG).
function dash(smax: number | null): string[] {
  return [
    `Limitar sodio a <${(smax ?? 1500).toLocaleString("es-CO")} mg/día`,
    "Aumentar potasio: banano, papa, leguminosas, lácteos",
    "5 porciones de frutas y verduras al día",
    "Limitar alcohol y ultraprocesados",
    "Lácteos bajos en grasa a diario",
  ];
}
function nefro(smax: number | null, pk: number, pg: number): string[] {
  return [
    `Proteína ${String(pk).replace(".", ",")} g/kg/día (${pg} g) en ERC sin diálisis`,
    "Controlar potasio y fósforo según laboratorios",
    `Limitar sodio a <${(smax ?? 2000).toLocaleString("es-CO")} mg/día`,
    "Evitar aditivos de fosfato en procesados",
    "Seguimiento mensual con nefrología",
  ];
}
function masaMuscular(pk: number, pg: number): string[] {
  return [
    `Proteína ${String(pk).replace(".", ",")} g/kg/día (${pg} g) repartida en las comidas`,
    "Al menos 3 g de leucina por comida",
    "Ejercicio de resistencia 3 veces/semana o más",
    "Vitamina D 800 a 2.000 UI/día",
    "Creatina 3 a 5 g/día",
  ];
}

export type RecomendacionesContexto = {
  diagnosticos: string[];
  tieneHTA: boolean;
  tieneIRC: boolean;
  sarcopenia: boolean; // FFMI < 17 (su corte)
  exceso: boolean; // deficit calorico > 0
  // Cifras del motor que GOBIERNA (`motorTratNutri`), conectado el 2026-08-31. null si la evaluacion no
  // tiene encuesta legible: los tres bloques que las citan vuelven a marcarse como pendientes antes que
  // imprimir una cifra inventada.
  sodioMax?: number | null;
  protKg?: number | null;
  protG?: number | null;
};

export function recomendacionesDe(ctx: RecomendacionesContexto): RecomendacionBloque[] {
  const out: RecomendacionBloque[] = [];
  if (ctx.diagnosticos.some((d) => DX_GLUCEMICO.includes(d))) out.push(GLUCEMICO);
  if (ctx.diagnosticos.some((d) => DX_LIPIDOS.includes(d))) out.push(LIPIDOS);

  // Los tres que el motor resuelve. Si sus cifras no llegaron (evaluacion sin encuesta legible), el bloque
  // vuelve a salir con su titulo y la marca de pendiente: nunca con una cifra por defecto.
  const hayCifras = ctx.protKg != null && ctx.protG != null;
  const conCifras = (titulo: string, items: string[] | null): void => {
    out.push(items ? { titulo, items } : { titulo, items: [], pendiente: true });
  };
  if (ctx.tieneHTA) conCifras("Dieta DASH y control de sodio", dash(ctx.sodioMax ?? null));
  if (ctx.tieneIRC) {
    conCifras(
      "Nefroprotección (KDIGO 2024)",
      hayCifras ? nefro(ctx.sodioMax ?? null, ctx.protKg!, ctx.protG!) : null,
    );
  }
  if (ctx.sarcopenia) {
    conCifras("Preservación de masa muscular", hayCifras ? masaMuscular(ctx.protKg!, ctx.protG!) : null);
  }

  for (const p of PENDIENTES) {
    if (p.activa(ctx)) out.push({ titulo: p.titulo, items: [], pendiente: true });
  }
  // El generico va SIEMPRE y al final, como en su archivo.
  out.push(GENERAL);
  return out;
}
