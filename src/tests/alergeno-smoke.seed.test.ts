import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { pickDemoProfessional, reassignDemoEvaluations } from "./fixtures/demo-professional";

// El acceso a BD es server-only; bajo vitest se neutraliza igual que en los otros seeds.
vi.mock("server-only", () => ({}));

// Gateado como los demas seeds: solo corre con DATABASE_URL y su bandera, para que una corrida normal
// de la suite no siembre nada.
let RUN = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local
}
RUN = Boolean(process.env.DATABASE_URL) && process.env.SEED_ALERGENO === "1";

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let schema: any;

// SIEMBRA DEL CASO DE SMOKE DEL AVISO DE ALERGENO.
//
// POR QUE HACE FALTA SEMBRARLO Y NO SE PUEDE PROVOCAR POR EL CAMINO REAL. El prompt le dice al modelo,
// de forma enfatica, que no incluya los alergenos del paciente. Si el modelo obedece (que es lo que
// esperamos), el aviso NUNCA aparece, y entonces no hay nada que mirar en el navegador. Provocarlo por
// el camino real exigiria debilitar el prompt, es decir romper la capa 1 para poder probar la capa 3.
//
// Asi que se siembra el ESTADO, no el calculo: una sugerencia de menu que YA trae su hallazgo. Lo que el
// smoke verifica entonces es lo que de verdad solo se ve en un navegador (la pantalla, el formulario y
// el hazard de React), no la deteccion, que ya esta cubierta por alergenos.test.ts con 18 casos.
//
// CASO DE UN SOLO USO, con candado que avisa cuando se gasta: al descartar el aviso, esa sugerencia
// queda descartada para siempre (la fila es inmutable y el descarte es un evento). Un segundo smoke
// sobre la misma sugerencia veria el estado "ya descartado" y podria leerse como defecto. Por eso el
// seed camina indices y siembra el siguiente sin gastar; si se acabaron, lo dice.
const SMOKE_MAX = 20;
const idDe = (i: number) => {
  const h = i.toString(16).padStart(2, "0");
  return `b0000000-0000-4000-8000-0000aa${h}0000`;
};

const MENU_CON_ALERGENO = {
  comidas: [
    {
      tiempo: "Desayuno",
      alimentos: [
        { nombre: "Arepa de maíz", porcion: "1 unidad mediana" },
        { nombre: "Huevos revueltos", porcion: "2 unidades" },
      ],
    },
    {
      tiempo: "Almuerzo",
      alimentos: [
        { nombre: "Camarones al ajillo", porcion: "150 g" },
        { nombre: "Arroz integral", porcion: "1 taza" },
        { nombre: "Ensalada verde", porcion: "1 plato" },
      ],
    },
    {
      tiempo: "Cena",
      alimentos: [
        { nombre: "Crema de espinacas", porcion: "1 pocillo" },
        { nombre: "Pechuga de pollo", porcion: "120 g" },
      ],
    },
  ],
};

// Los hallazgos son EXACTAMENTE los que produciria el cruce real sobre ese menu: mariscos declarados,
// "Camarones al ajillo" en el almuerzo. Sembrar otra cosa haria que la pantalla mostrara algo que el
// motor nunca produce, y el smoke validaria una ficcion.
const HALLAZGOS = [{ alergeno: "Mariscos", tiempo: "Almuerzo", alimento: "Camarones al ajillo" }];
// Y el conflicto de patron, para poder mirar los dos avisos juntos y comprobar que se distinguen.
const CONFLICTOS = [{ patron: "Vegetariano", tiempo: "Cena", alimento: "Pechuga de pollo" }];

describe.skipIf(!RUN)("seed: caso de smoke del aviso de alergeno", () => {
  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
  });

  it("deja una sugerencia de menu con alergeno detectado, lista para mirar en el navegador", async () => {
    // Lanza con mensaje claro si no hay cuenta de nutricionista: el dueño es parte del caso, porque
    // con RLS una fila que existe pero no es de quien entra da 404.
    const pro = await pickDemoProfessional(db, schema, "nutricionista");
    // OJO con los dos ids, que NO son el mismo y apuntan a tablas distintas:
    //   proId   = professional_profiles.id -> es el que referencia evaluations.professional_id
    //   actorId = profiles.id              -> es el que referencia ai_menu_suggestions.generated_by
    // Cruzarlos revienta con una violacion de clave foranea, no con un error claro.
    const proId = pro.proId;
    const actorId = pro.actorId;

    // Un tratamiento con snapshot sellado: sin el, la pantalla de menu no se puede usar.
    const tratamientos = await db
      .select({ id: schema.treatments.id, diagnosisId: schema.treatments.diagnosisId })
      .from(schema.treatments)
      .limit(50);
    const conSnapshot = tratamientos[0];
    expect(conSnapshot, "no hay tratamientos en la base para colgar la sugerencia").toBeTruthy();

    const diag = await db
      .select({ evaluationId: schema.diagnoses.evaluationId })
      .from(schema.diagnoses)
      .where(eq(schema.diagnoses.id, conSnapshot.diagnosisId))
      .limit(1);
    const evaluationId = diag[0]!.evaluationId;

    // El dueño es parte del caso: con RLS, una fila que existe pero no es de quien entra da 404.
    await reassignDemoEvaluations(db, schema, [evaluationId], proId);

    // La ALERGIA declarada, para que la pantalla del paciente y el aviso cuenten lo mismo. Si el smoke
    // ve "Mariscos" en el aviso y la encuesta dice "Ninguna", las dos superficies se contradicen.
    const resp = await db
      .select({ id: schema.surveyResponses.id, versionId: schema.surveyResponses.surveyVersionId })
      .from(schema.surveyResponses)
      .where(eq(schema.surveyResponses.evaluationId, evaluationId))
      .limit(1);
    if (resp[0]) {
      const preguntas = await db
        .select({ id: schema.surveyQuestions.id })
        .from(schema.surveyQuestions)
        .where(
          and(
            eq(schema.surveyQuestions.surveyVersionId, resp[0].versionId),
            eq(schema.surveyQuestions.fieldKey, "d6_43"),
          ),
        )
        .limit(1);
      if (preguntas[0]) {
        await db
          .update(schema.surveyAnswers)
          .set({ answerValue: JSON.stringify(["Mariscos"]) })
          .where(
            and(
              eq(schema.surveyAnswers.responseId, resp[0].id),
              eq(schema.surveyAnswers.questionId, preguntas[0].id),
            ),
          );
      }
    }

    // Camina los indices hasta encontrar uno sin gastar (sin descarte registrado).
    let elegido: string | null = null;
    for (let i = 0; i < SMOKE_MAX; i++) {
      const id = idDe(i);
      const yaHay = await db
        .select({ id: schema.aiMenuSuggestions.id })
        .from(schema.aiMenuSuggestions)
        .where(eq(schema.aiMenuSuggestions.id, id))
        .limit(1);
      if (yaHay.length > 0) {
        const descartada = await db
          .select({ id: schema.clinicalAuditLog.id })
          .from(schema.clinicalAuditLog)
          .where(
            and(
              eq(schema.clinicalAuditLog.event, "menu.allergen_alert_dismissed"),
              eq(schema.clinicalAuditLog.entityId, id),
            ),
          )
          .limit(1);
        if (descartada.length > 0) continue; // gastada: sigue buscando
        elegido = id; // existe y sin gastar: sirve tal cual
        break;
      }
      await db.insert(schema.aiMenuSuggestions).values({
        id,
        treatmentId: conSnapshot.id,
        generatedBy: actorId,
        provider: "seed",
        model: "seed",
        promptVersion: "menu.generate@1+u3",
        generatedText: JSON.stringify(MENU_CON_ALERGENO),
        menuJson: MENU_CON_ALERGENO,
        alergenosDetectados: HALLAZGOS,
        patronConflictos: CONFLICTOS,
        status: "success",
        latencyMs: 0,
      });
      elegido = id;
      break;
    }

    expect(
      elegido,
      `se gastaron los ${SMOKE_MAX} casos de smoke del aviso de alérgeno. Sube SMOKE_MAX o limpia los eventos menu.allergen_alert_dismissed.`,
    ).not.toBeNull();

    console.log(`\n  CASO SEMBRADO`);
    console.log(`  Evaluación: ${evaluationId}`);
    console.log(`  Abrir: /evaluaciones/${evaluationId} -> pestaña Tratamiento -> Menú sugerido (IA)`);
    console.log(`  Profesional dueño: professional_profiles.id=${proId} · profiles.id=${actorId}`);
    console.log(`  Sugerencia sembrada: ${elegido}\n`);
  });
});
