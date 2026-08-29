import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LAS OBSERVACIONES EN LA HISTORIA CLINICA (§8.3, 2026-08-26 Parte 2).
//
// Su instruccion: "Deben aparecer en la historia. Y POR CONSULTA, NO POR PACIENTE".
//
// Y su diagnostico del defecto, en su propio archivo: "notas_profesional aparece UNA SOLA VEZ en todo el
// archivo, ESCRIBIENDO. Nadie la lee, y con onConflict: 'documento' cada control borra el anterior. Lo que
// el profesional escribe hoy se pierde DOS VECES: se sobrescribe y no se muestra".
//
// EN ATLAS SOLO PASABA LA MITAD, y conviene tenerlo claro para no "arreglar" lo que ya estaba bien: las
// notas SI se guardaban correctamente (tabla propia por tratamiento, append-only, con auditoria; nunca se
// sobrescriben), pero NO SE MOSTRABAN fuera del panel de tratamiento. No se perdian; simplemente no
// llegaban al documento probatorio. La mitad del onConflict nunca la tuvimos.

const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");
const HC = readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8");
const SCHEMA = readFileSync("src/db/schema/treatments.ts", "utf8");

describe("las observaciones del profesional aparecen en la historia clínica", () => {
  it("el bloque existe y la HC lo renderiza", () => {
    expect(HC).toContain("export function HcObservaciones");
    expect(HC).toContain("Observaciones del profesional");
    expect(PAGE).toContain("<HcObservaciones");
  });

  it("van ANTES de la próxima consulta y la firma", () => {
    // Es el orden de su HC: lo que el profesional añade cierra el cuerpo clínico, y después vienen la
    // cita y el pie del documento.
    const obs = PAGE.indexOf("<HcObservaciones");
    const cita = PAGE.indexOf("<HcProximaConsulta");
    const firma = PAGE.indexOf("<HcFirmaYFecha");
    expect(obs).toBeGreaterThan(-1);
    expect(obs).toBeLessThan(cita);
    expect(cita).toBeLessThan(firma);
  });

  it("POR CONSULTA: salen del tratamiento de ESTA evaluación, no del paciente", () => {
    // La mitad de su instrucción que es fácil de romper sin notarlo: si algún día se leyeran por paciente,
    // la historia de una consulta mostraría observaciones de otra, fechadas en otra fecha.
    expect(PAGE).toContain("protocol?.notes");
    expect(SCHEMA).toContain('treatmentId: uuid("treatment_id")');
  });

  it("el vacío se EXPLICA: un bloque mudo en un documento probatorio deja una duda", () => {
    // "Sin observaciones" a secas no distingue "el profesional no escribió nada" de "el sistema no lo
    // trajo". En un documento que puede terminar en una auditoría, esa diferencia importa.
    expect(HC).toContain("El profesional no registró observaciones en esta consulta.");
  });

  it("y siguen siendo append-only: la nota no se edita ni se borra", () => {
    // Es lo que Atlas ya hacía bien y no se toca. Su defecto era el `onConflict` que sobrescribía; el
    // nuestro era solo no mostrarlas. Si alguien introdujera un update aquí, volveríamos a su defecto.
    const writer = readFileSync("src/modules/treatment/data/treatment-writer.ts", "utf8");
    const bloque = writer.slice(
      writer.indexOf("export async function addTreatmentNote"),
      writer.indexOf("export async function addTreatmentNote") + 700,
    );
    expect(bloque).toContain("insert(treatmentNotes)");
    expect(bloque).not.toContain("onConflict");
    expect(bloque).not.toContain("update(treatmentNotes)");
  });
});

describe("clase A y clase B: cuáles son las notas y dónde vive cada una", () => {
  // AL MEDIRLO RESULTO MAS CHICO DE LO QUE YO HABIA DESCRITO. Hablé de "cinco notas de tratamiento y una
  // de evaluación" que había que unificar. Contadas en el código hay CUATRO superficies que escriben nota,
  // y solo UNA es de observación libre (clase B). Las otras tres van pegadas a una decisión concreta
  // (clase A) y no se tocan: mezclarlas perdería justamente lo que las hace útiles, que es el vínculo con
  // la decisión que explican.
  //
  // Y la tabla `evaluation_notes` existe SIN WRITER: nadie escribe en ella. No se retira aquí (una
  // migración para borrar una tabla vacía no gana nada), pero queda dicho para que no se lea como una
  // superficie más.
  const surfaces = () => {
    const dirs = [
      "src/modules/diagnoses/components/professional-criterion.tsx",
      "src/modules/treatment/components/nutra-decision-section.tsx",
      "src/modules/treatment/components/treatment-panel.tsx",
      "src/modules/nutraceuticals/components/mi-conteo-form.tsx",
    ];
    return dirs.filter((f) => readFileSync(f, "utf8").includes('name="note"'));
  };

  it("las cuatro superficies de nota siguen siendo cuatro", () => {
    // Si aparece una quinta sin pasar por aquí, la clasificación A/B deja de estar completa y este archivo
    // dejaría de describir el sistema. Es la lección del candado que se cree completo.
    expect(surfaces()).toHaveLength(4);
  });

  it("la de CLASE B (observación libre del tratamiento) es la que llega a la historia", () => {
    const panel = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
    expect(panel).toContain("Notas del tratamiento");
    expect(PAGE).toContain("protocol?.notes");
  });

  it("las de CLASE A siguen pegadas a su decisión, no se unifican", () => {
    // El criterio del diagnóstico explica UN diagnóstico; el motivo del nutracéutico explica UNA decisión
    // de prescripción. Sacarlas a un cajón común las volvería anotaciones sueltas.
    const criterio = readFileSync("src/modules/diagnoses/components/professional-criterion.tsx", "utf8");
    const nutra = readFileSync("src/modules/treatment/components/nutra-decision-section.tsx", "utf8");
    expect(criterio).toContain('name="note"');
    expect(nutra).toContain('name="note"');
  });
});
