// RECOMENDACIONES de la historia clinica (bloque 11). Modulo NEUTRO y PURO.
//
// Porte del bloque condicional de su archivo (v8 L15255-15272): SIETE bloques, activados por diagnostico,
// mas el generico que va siempre. La captura mostraba solo el generico porque el paciente demo no tenia
// comorbilidades; el codigo tiene las siete ramas (leccion: una captura es un caso, no la funcion).
//
// TRES se portan hoy porque su texto es fijo. Los otros CUATRO citan cifras que produce `motorTratNutri`
// (sodioMax, protKg/protG, kcalObjetivo, deficit), que es el porte bloqueado: aparecen con su TITULO y la
// nota de que esperan, para que la seccion no parezca completa cuando le falta algo que el si tiene.

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

// Los cuatro que esperan el motor. El titulo es el suyo; el contenido llega con el porte.
const PENDIENTES: { titulo: string; activa: (c: RecomendacionesContexto) => boolean }[] = [
  { titulo: "Dieta DASH y control de sodio", activa: (c) => c.tieneHTA },
  { titulo: "Nefroprotección (KDIGO 2024)", activa: (c) => c.tieneIRC },
  { titulo: "Preservación de masa muscular", activa: (c) => c.sarcopenia },
  { titulo: "Manejo del exceso de grasa corporal", activa: (c) => c.exceso && !c.sarcopenia },
];

export type RecomendacionesContexto = {
  diagnosticos: string[];
  tieneHTA: boolean;
  tieneIRC: boolean;
  sarcopenia: boolean; // FFMI < 17 (su corte)
  exceso: boolean; // deficit calorico > 0
};

export function recomendacionesDe(ctx: RecomendacionesContexto): RecomendacionBloque[] {
  const out: RecomendacionBloque[] = [];
  if (ctx.diagnosticos.some((d) => DX_GLUCEMICO.includes(d))) out.push(GLUCEMICO);
  if (ctx.diagnosticos.some((d) => DX_LIPIDOS.includes(d))) out.push(LIPIDOS);
  for (const p of PENDIENTES) {
    if (p.activa(ctx)) out.push({ titulo: p.titulo, items: [], pendiente: true });
  }
  // El generico va SIEMPRE y al final, como en su archivo.
  out.push(GENERAL);
  return out;
}
