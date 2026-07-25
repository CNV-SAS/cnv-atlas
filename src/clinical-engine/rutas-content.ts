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
