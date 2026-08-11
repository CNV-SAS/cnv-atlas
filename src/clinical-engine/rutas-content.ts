// ═══════════════════════════════════════════════════════════════════════════
// CONTENIDO CLÍNICO DE LAS RUTAS DE ATENCIÓN — PORTADO VERBATIM DE GILDARDO
//
// Fuente: el objeto `RUTAS` de `reference` de la entrega de Gildardo:
//   · ATLAS.html L9243-9440  (docs/entregas/gildardo-2026-07/ATLAS.html)
//   · atlas-dfi.js L40-247    (docs/entregas/gildardo-2026-07/atlas-dfi.js)
//   Ambas fuentes coinciden (la .js es re-extracción del HTML). Es AUTORÍA CLÍNICA de Gildardo.
//
// ATLAS NO edita, resume ni reinterpreta este texto. Los cambios nacen del lado de Gildardo
// (misma disciplina que el motor congelado, regla dura 12 aplicada a CONTENIDO): si una
// indicación clínica "se lee mejor" de otra forma, NO se toca aquí; se le pide a Gildardo. Un
// test (rutas-content.test.ts) ancla el contenido para que no se desincronice en silencio.
//
// NO se porta (es presentación/lógica, no contenido clínico):
//   · `condicion`  → predicado del motor, ya congelado en engine.indices.js (RUTA_COND).
//   · `icono`      → emoji; la UI usa un icono lucide (BRAND, sin emojis en UI).
//   · `color`      → paleta C5 del prototipo; la UI mapea a tokens clínicos de BRAND.
// `urgencia` es un STRING LIBRE (lleva condiciones clínicas, p. ej. "obligatoria si HTA o DM2
// activa"), NUNCA un enum: se muestra verbatim; la UI puede diferenciarlo visualmente sin alterarlo.
// ═══════════════════════════════════════════════════════════════════════════

export type RutaComponent = {
  aplica: boolean;
  indicaciones: string[];
  remision?: boolean; // ejercicio / psicologico / medico
  urgencia?: string; // cuando hay remisión; string libre de Gildardo, NO enum
  soloNutricionista?: boolean; // solo en el componente nutricional
};

export type RutaSeguimiento = { frecuencia: string; criterioEgreso: string };

export type RutaContent = {
  id: string; // R1..R6
  n: number;
  label: string;
  activacion: string;
  componentes: {
    nutricional: RutaComponent;
    ejercicio: RutaComponent;
    psicologico: RutaComponent;
    medico: RutaComponent;
  };
  seguimiento: RutaSeguimiento;
};

// Resuelve el contenido de las rutas ACTIVAS (las que trae dfi.rutas como strings
// "R2 · Reducción Riesgo Cardiometabólico") a su contenido clínico. El id es el prefijo antes del
// primer espacio ("R2"). Omite ids desconocidos. PURA: el pipeline la usa para CONGELAR el contenido
// en el snapshot al diagnosticar (queda anclado a lo que efectivamente se prescribió ese día).
export function resolveRutasContent(rutas: string[]): RutaContent[] {
  return rutas
    .map((r) => RUTAS_CONTENT[r.split(" ")[0]])
    .filter((c): c is RutaContent => Boolean(c));
}

// Una remisión: destinatario + urgencia (string verbatim de Gildardo) + ruta de origen + indicaciones.
// `referralTarget` es la profesión destino como CLAVE del modelo (D-009): para prellenar el registro de
// remisión y para saber cuándo es una AUTO-remisión (destino == profesión del que atiende = conducta propia).
export type Remision = {
  profesional: string;
  referralTarget: "medico" | "psicologo" | "deportologo";
  urgencia: string;
  rutaId: string;
  rutaLabel: string;
  indicaciones: string[];
};

// Destinatario por profesión (rótulo verbatim del prototipo).
const REMISION_PROF: Record<string, string> = {
  medico: "Médico",
  psicologico: "Psicólogo/a",
  ejercicio: "Entrenador/Fisioterapeuta",
};

// Componente de ruta -> profesión del modelo (D-009). "ejercicio" (Entrenador/Fisioterapeuta) mapea a
// deportólogo; a confirmar con Gildardo si son la misma figura (Q32).
const REMISION_TARGET: Record<string, "medico" | "psicologo" | "deportologo"> = {
  medico: "medico",
  psicologico: "psicologo",
  ejercicio: "deportologo",
};

// Remisiones AGREGADAS de las rutas activas: los componentes medico/psicologico/ejercicio con
// remision===true. Orden fiel al prototipo: por ruta, y dentro de cada ruta medico → psicologico →
// ejercicio. La urgencia se conserva como STRING verbatim (la UI la diferencia visualmente sin
// alterarla). El nutricional nunca remite (no aparece).
export function buildRemisiones(rutas: RutaContent[]): Remision[] {
  const out: Remision[] = [];
  for (const r of rutas) {
    for (const prof of ["medico", "psicologico", "ejercicio"] as const) {
      const c = r.componentes[prof];
      if (c.remision) {
        out.push({
          profesional: REMISION_PROF[prof],
          referralTarget: REMISION_TARGET[prof],
          urgencia: c.urgencia ?? "",
          rutaId: r.id,
          rutaLabel: r.label,
          indicaciones: c.indicaciones,
        });
      }
    }
  }
  return out;
}

// Remisión CONSOLIDADA por destinatario (§9, Gildardo): en vez de repetir ruta por ruta, UNA línea por
// profesión con el resumen de todo lo que las rutas le envían. El registro D-009 ya es por destinatario
// (guarda referred_to + reason, no la ruta), así que consolidar el display SE CORRESPONDE con el registro.
export type ConsolidatedRemision = {
  profesional: string;
  referralTarget: "medico" | "psicologo" | "deportologo";
  urgencia: string; // la más alta entre las rutas (obligatoria > recomendada > otras); string verbatim
  indicaciones: string[]; // unión sin duplicados de todas las rutas que remiten a este destino
  rutaIds: string[]; // rutas que la originan (solo referencia; NO se guarda en el registro)
};

// Rango de urgencia para elegir la más alta al consolidar. No altera el string (se conserva verbatim);
// solo ordena para saber cuál mostrar cuando dos rutas remiten al mismo destino con urgencias distintas.
function urgenciaRank(u: string): number {
  const s = u.toLowerCase();
  if (s.includes("obligatoria")) return 2;
  if (s.includes("recomendada")) return 1;
  return 0;
}

export function consolidateRemisiones(remisiones: Remision[]): ConsolidatedRemision[] {
  const byTarget = new Map<string, ConsolidatedRemision>();
  const order: string[] = []; // preserva el orden de primera aparición (médico → psicólogo → deportólogo)
  for (const rem of remisiones) {
    let acc = byTarget.get(rem.referralTarget);
    if (!acc) {
      acc = {
        profesional: rem.profesional,
        referralTarget: rem.referralTarget,
        urgencia: rem.urgencia,
        indicaciones: [],
        rutaIds: [],
      };
      byTarget.set(rem.referralTarget, acc);
      order.push(rem.referralTarget);
    }
    if (urgenciaRank(rem.urgencia) > urgenciaRank(acc.urgencia)) acc.urgencia = rem.urgencia;
    for (const ind of rem.indicaciones) if (!acc.indicaciones.includes(ind)) acc.indicaciones.push(ind);
    if (rem.rutaId && !acc.rutaIds.includes(rem.rutaId)) acc.rutaIds.push(rem.rutaId);
  }
  return order.map((t) => byTarget.get(t)!);
}

export const RUTAS_CONTENT: Record<string, RutaContent> = {
  R1: {
    id: "R1",
    n: 1,
    label: "Restauración Celular",
    activacion: "IFC bajo + IRC alto + IAE acelerado",
    componentes: {
      nutricional: {
        aplica: true,
        soloNutricionista: false,
        indicaciones: [
          "Omega-3 dietario: ≥2 porciones pescado graso/semana",
          "Reducir grasas trans y aceites refinados",
          "Antioxidantes: cúrcuma, jengibre, té verde",
          "Hidratación: ≥35 ml/kg/día",
        ],
      },
      ejercicio: {
        aplica: true,
        remision: false,
        indicaciones: [
          "Actividad física moderada 3-5 días/semana",
          "Evitar sedentarismo prolongado >2h continuas",
          "Respiración diafragmática 10 min/día",
        ],
      },
      psicologico: {
        aplica: true,
        remision: false,
        indicaciones: [
          "Manejo de estrés crónico — correlaciona con IRC elevado",
          "Técnicas de reducción de estrés: mindfulness, meditación",
          "Evaluar si estrés crónico es factor contribuyente",
        ],
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "recomendada",
        indicaciones: [
          "Valoración médica si IRC > 5.0 — descartar patología inflamatoria subyacente",
          "Laboratorios: PCR ultrasensible, glucemia, perfil lipídico, hemograma",
          "Correlacionar hallazgos BIS con paraclínicos",
        ],
      },
    },
    seguimiento: {
      frecuencia: "Cada 30 días",
      criterioEgreso: "IFC ≥ 4.5 y IRC < 3.5 sostenido 2 controles",
    },
  },
  R2: {
    id: "R2",
    n: 2,
    label: "Reducción Riesgo Cardiometabólico",
    activacion: "FMI elevado / ISCM alto / obesidad sarcopénica / ICC-ICT-IR cardiometabólico",
    componentes: {
      nutricional: {
        aplica: true,
        soloNutricionista: false,
        indicaciones: [
          "Déficit calórico moderado: −400 a −500 kcal/día",
          "Proteína preservada: 1.5 g/kg/día",
          "Reducir azúcares añadidos y harinas refinadas",
          "Fibra soluble: avena, leguminosas, manzana",
          "Limitar sodio <2.300 mg/día si HTA activa",
        ],
      },
      ejercicio: {
        aplica: true,
        remision: true,
        urgencia: "recomendada",
        indicaciones: [
          "Remisión a entrenador certificado con prescripción de ejercicio aeróbico",
          "Cardio aeróbico: 150–300 min/semana intensidad moderada",
          "FC objetivo: 50–70% FCmáx — con HTA máx 60%",
          "Inicio progresivo: 3 días 20 min, aumentar 10 min/semana",
        ],
      },
      psicologico: {
        aplica: false,
        remision: false,
        indicaciones: [],
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "obligatoria si HTA o DM2 activa",
        indicaciones: [
          "Remisión médica si HTA o DM2 activa detectada en D5",
          "Seguimiento glucémico si resistencia a insulina",
          "Perfil lipídico y función hepática si FMI muy elevado",
        ],
      },
    },
    seguimiento: {
      frecuencia: "Cada 45 días",
      criterioEgreso: "ISCM ≤ 1.0 y FMI en rango normal sostenido 2 controles",
    },
  },
  R3: {
    id: "R3",
    n: 3,
    label: "Intervención Conductual",
    activacion: "TCA activo o insatisfacción corporal severa",
    componentes: {
      nutricional: {
        aplica: true,
        soloNutricionista: false,
        indicaciones: [
          "⚠️ Enfoque NO RESTRICTIVO — contraindicado déficit calórico con TCA activo",
          "Normalización: 3 comidas + 2 colaciones regulares",
          "Reintroducción progresiva de grupos alimentarios eliminados",
          "Coordinación obligatoria con psicólogo antes de cualquier plan alimentario",
        ],
      },
      ejercicio: {
        aplica: false,
        remision: false,
        indicaciones: [
          "⚠️ Contraindicado prescribir ejercicio intenso con TCA activo",
          "Solo actividad física suave supervisada si psicólogo lo aprueba",
        ],
      },
      psicologico: {
        aplica: true,
        remision: true,
        urgencia: "OBLIGATORIA — primera acción antes que cualquier intervención nutricional",
        indicaciones: [
          "Remisión urgente a psicología/psiquiatría especializada en TCA",
          "Terapia Cognitivo Conductual (TCC) — primera línea en TCA",
          "Evaluación BSQ (Body Shape Questionnaire) formal",
          "Psicoeducación sobre imagen corporal y relación con alimentos",
          "Documentar remisión en HC antes de iniciar cualquier plan",
        ],
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "recomendada",
        indicaciones: [
          "Valoración médica para descartar complicaciones orgánicas del TCA",
          "Electrocardiograma si purgas frecuentes (riesgo arritmia por hipokalemia)",
          "Laboratorios: electrolitos, función renal, hemograma",
        ],
      },
    },
    seguimiento: {
      frecuencia: "Cada 15 días coordinado con psicología",
      criterioEgreso: "Alta psicológica + IFC estable 2 controles consecutivos",
    },
  },
  R4: {
    id: "R4",
    n: 4,
    label: "Desaceleración del Envejecimiento",
    activacion: "IAE acelerado + Sarcopenia / FFMI bajo clasificado",
    componentes: {
      nutricional: {
        aplica: true,
        soloNutricionista: false,
        indicaciones: [
          "Proteína alta: 1.6–2.0 g/kg/día — prioridad absoluta",
          "Distribución proteica: ≥25g por comida para maximizar síntesis",
          "NO déficit calórico en presencia de sarcopenia activa",
          "Antioxidantes: bayas, cacao, cúrcuma, té verde",
        ],
      },
      ejercicio: {
        aplica: true,
        remision: true,
        urgencia: "OBLIGATORIA — sin ejercicio los nutracéuticos son insuficientes",
        indicaciones: [
          "Remisión a entrenador o fisioterapeuta con prescripción de resistencia progresiva",
          "Ejercicios multiarticulares: sentadilla, peso muerto, press, remo",
          "Carga: 65–75% de 1RM · 3 series × 8–12 repeticiones · 3 días/semana",
          "Si IAE > 10 años o fragilidad: fisioterapia antes de ejercicio de fuerza",
        ],
      },
      psicologico: {
        aplica: false,
        remision: false,
        indicaciones: [],
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "recomendada si IAE > 10 años",
        indicaciones: [
          "Valoración médica si IAE > 10 años",
          "Densitometría ósea si CMO bajo por BIS — riesgo osteoporosis",
          "Laboratorios: vitamina D, testosterona/estrógenos, IGF-1",
          "Descartar causa secundaria de sarcopenia si FFMI muy bajo",
        ],
      },
    },
    seguimiento: {
      frecuencia: "Cada 90 días",
      criterioEgreso: "IAE < 5 años y FFMI en rango normal sostenido",
    },
  },
  R5: {
    id: "R5",
    n: 5,
    label: "Intervención Contextual / Epigenética",
    activacion: "≥3 factores de riesgo epigenético",
    componentes: {
      nutricional: {
        aplica: true,
        soloNutricionista: false,
        indicaciones: [
          "Crucíferas: sulforafano → Nrf2 → protección epigenética",
          "Berries, granada, cacao: polifenoles → metilación protectora",
          "Reducir ultraprocesados: aditivos → disruptores endocrinos epigenéticos",
          "Ayuno intermitente 12:12 mínimo → autofagia",
        ],
      },
      ejercicio: {
        aplica: true,
        remision: false,
        indicaciones: [
          "Ejercicio es el modificador epigenético no farmacológico más potente",
          "150 min/semana mínimo de actividad moderada",
          "Combinar aeróbico y resistencia para máximo efecto epigenético",
        ],
      },
      psicologico: {
        aplica: true,
        remision: false,
        indicaciones: [
          "Manejo de estrés crónico — el cortisol es modificador epigenético negativo",
          "Sueño reparador ≥7h: privación altera epigenoma en <1 semana",
          "Técnicas de reducción de estrés sostenidas",
        ],
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "recomendada",
        indicaciones: [
          "Remisión a médico funcional o integrativo",
          "Revisión de polimedicación con médico — citocromo P450",
          "Reducción exposición ambiental: filtro de agua, ventilación",
          "Laboratorios: metales pesados si exposición ocupacional",
        ],
      },
    },
    seguimiento: {
      frecuencia: "Cada 60 días",
      criterioEgreso: "LE8 score ≥ 80 y reducción a < 2 factores de riesgo epigenético",
    },
  },
  R6: {
    id: "R6",
    n: 6,
    label: "Mantenimiento y Optimización",
    activacion: "Todos los dominios normales y composición corporal en rango",
    componentes: {
      nutricional: {
        aplica: true,
        soloNutricionista: true,
        indicaciones: [
          "Mantener patrón alimentario variado — evaluación semestral",
          "Ajustar proteína según actividad física y edad",
          "Dieta de mantenimiento personalizada según fenotipo MCCB",
        ],
      },
      ejercicio: {
        aplica: true,
        remision: false,
        indicaciones: [
          "Mantener actividad física: 150 min/semana mínimo",
          "Combinar aeróbico y resistencia para preservar FFMI",
          "Aumentar intensidad progresivamente para mantener ICA-BIS cerca de φ",
        ],
      },
      psicologico: {
        aplica: false,
        remision: false,
        indicaciones: [],
      },
      medico: {
        aplica: false,
        remision: false,
        indicaciones: ["Control médico anual de rutina"],
      },
    },
    seguimiento: {
      frecuencia: "Cada 90 días",
      criterioEgreso: "Permanencia en R6 es el objetivo — escalar si algún índice sale de rango",
    },
  },
};
