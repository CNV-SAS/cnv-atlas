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

const PAGE = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
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
      // `professional-criterion.tsx` SALIO de esta lista el 2026-09-08, y no por refactor: el profesional
      // ya no escribe criterios en Diagnostico. Al portar su paso 4, ese campo quedo recibiendo un
      // resumen del modelo y salto su limite de 2.000 caracteres; el limite no era el defecto, era la
      // señal de que un campo hacia dos trabajos. El resumen es del modelo y no se edita
      // (`resumen-diagnostico.tsx`); lo que el profesional escribe son las OBSERVACIONES, que ya existian
      // y viven en `treatment_notes`.
      "src/modules/treatment/components/nutra-decision-section.tsx",
      "src/modules/treatment/components/treatment-panel.tsx",
      "src/modules/nutraceuticals/components/mi-conteo-form.tsx",
    ];
    return dirs.filter((f) => readFileSync(f, "utf8").includes('name="note"'));
  };

  it("las superficies de nota siguen siendo DOS", () => {
    // ERAN CUATRO HASTA EL 2026-09-06 (cotejo, punto 26): el campo de notas del tratamiento se retiró
    // porque su archivo no lo tiene y esas notas no viajaban a ningún documento. Las ya escritas se
    // siguen mostrando en solo lectura, así que la tabla y su lector no se tocaron; lo que desapareció
    // es el `name="note"` de esa superficie.
    //
    // SE AJUSTA EL NÚMERO, NO LA ASERCIÓN: lo que este caso protege es que una superficie nueva no
    // aparezca sin pasar por aquí, y para eso el conteo tiene que ser EXACTO. Cambiarlo a
    // `toBeLessThanOrEqual` habría dejado entrar la siguiente en silencio, que es justo lo que vigila.
    //
    // ERAN CUATRO (hasta el 2026-09-06, punto 26), luego TRES, y desde el 2026-09-08 son DOS: el criterio
    // del profesional dejó de ser una superficie de escritura. Cada bajada tiene su razón escrita arriba.
    //
    // Y ESTE CANDADO HIZO SU TRABAJO EL MISMO DÍA: al separar el resumen del criterio empecé a construir
    // una columna `treatments.observaciones` que habría sido una superficie NUEVA de nota libre. Este
    // conteo, y el resto del archivo, enseñaron que las observaciones YA EXISTEN (`treatment_notes`,
    // append-only, por consulta, con la profesión sellada) y que Gildardo las había pedido en la historia
    // clínica en su §8.3. La columna se retiró antes de existir.
    expect(surfaces()).toHaveLength(2);
  });

  it("la de CLASE B ya no admite notas nuevas, pero lo escrito se sigue leyendo", () => {
    // El campo se retiró (punto 26). Lo que NO se puede perder es lo ya escrito: un profesional que
    // anotó aquí dejaría de ver su propio texto, y solo sería alcanzable por un grant de administrador.
    // Es la lección del almacén que se elige por la propiedad que resuelve lo de delante y se olvida la
    // de LECTURA.
    const panel = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
    expect(panel).toContain("Notas del tratamiento (histórico)");
    expect(panel, "el campo ya no existe").not.toContain("Guardar nota");
    expect(PAGE).toContain("protocol?.notes");
  });

  it("las de CLASE A siguen pegadas a su decisión, no se unifican", () => {
    // El motivo del nutracéutico explica UNA decisión de prescripción, y el conteo explica UN ajuste de
    // inventario. Sacarlas a un cajón común las volvería anotaciones sueltas.
    //
    // EL CRITERIO DEL DIAGNÓSTICO YA NO ESTÁ AQUÍ (2026-09-08): dejó de ser una superficie de escritura.
    // Lo escrito no se perdió, se muestra en solo lectura en la cuarta subpestaña.
    const nutra = readFileSync("src/modules/treatment/components/nutra-decision-section.tsx", "utf8");
    const conteo = readFileSync("src/modules/nutraceuticals/components/mi-conteo-form.tsx", "utf8");
    expect(nutra).toContain('name="note"');
    expect(conteo).toContain('name="note"');
  });

  it("y los criterios ya escritos se siguen viendo, en solo lectura", () => {
    // La mitad que no se puede perder al retirar una superficie: hay 3 filas en producción, escritas y
    // asumidas por un profesional. Migrarlas sería reescribir el acto de otro; borrarlas, peor.
    const resumen = readFileSync("src/modules/diagnoses/components/resumen-diagnostico.tsx", "utf8");
    expect(resumen).toContain("Criterios del profesional, registrados antes");
    expect(resumen, "si vuelve un campo aquí, el resumen deja de ser del modelo").not.toContain(
      'name="note"',
    );
    expect(PAGE).toContain("criteriosPrevios");
  });
});
