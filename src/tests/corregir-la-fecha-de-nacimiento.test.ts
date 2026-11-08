import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fechaCorregidaDespuesDeEmitir } from "@/modules/clinical-pipeline/fecha-corregida-despues-de-emitir";
import {
  canCompletePatientBirthDate,
  canCorrectPatientBirthDate,
} from "@/modules/patients/policies/can-complete-patient-sex";
import { correccionDeFechaDeNacimientoSchema } from "@/modules/patients/validations";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CORREGIR UNA FECHA DE NACIMIENTO YA REGISTRADA  ·  0244/0245, Santiago 2026-11-08
//
// ═══ DE DONDE SALE ═══
//
// Los cinco casos que Ángela tiene en la mano. Textual suyo: *"Corregir una fecha de nacimiento ya
// registrada: no hay flujo. Construyelo solo para admin, con motivo obligatorio, de donde sale el dato
// (documento de identidad), rastro inline y el valor anterior conservado. Si la correccion cambia la
// rama del consentimiento, lo detecta y marca la consulta para regularizar, no lo esconde. Despues de
// corregir, la consulta aparece en /admin/recalibracion."*
//
// Y el caso medido que lo hacia urgente: en los grupos 10 y 11 de las mediciones repetidas, la edad de la
// ficha difiere NUEVE AÑOS de la del equipo. Hasta hoy la unica salida era SQL a mano.
//
// ═══ QUE VIGILA, Y POR QUE CADA COSA ═══
//
//   1. QUE SIGA SIENDO SOLO DE ADMIN, y separado de completar. Son dos actos: uno rellena un hueco, el
//      otro pisa un valor con el que ya se diagnostico y con el que se decidio la rama del consentimiento.
//   2. QUE EL MOTIVO Y LA FUENTE SIGAN SIENDO OBLIGATORIOS. La fuente es lo que separa una correccion de
//      una suposicion: una fecha de nacimiento no se corrige de memoria.
//   3. QUE EL VALOR ANTERIOR SE CONSERVE Y EL RASTRO SEA INLINE (regla dura 8), y que la tabla sea
//      append-only DE VERDAD y no solo en el comentario.
//   4. QUE LA CONSULTA APAREZCA EN RECALIBRACION, con UNA definicion compartida entre la pantalla que
//      OFRECE y el guard que ACEPTA. Es la divergencia del 2026-11-07, que ya costo una vez.
//   5. QUE EL FORMULARIO NO TRAIGA LOS HAZARDS DEL NAVEGADOR (6 y 8 de CLAUDE.md): nada de `required`
//      incondicional, la exigencia en el boton y DICHA en su rotulo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const ADMIN = { id: "a", email: "a@cnv.com", roles: ["admin"] } as never;
const PROFESIONAL = { id: "p", email: "p@cnv.com", roles: ["professional"] } as never;

const WRITER = readFileSync("src/modules/patients/data/patient-birthdate-writer.ts", "utf8");
const ACTIONS = readFileSync("src/modules/patients/actions.ts", "utf8");
const FORMULARIO = readFileSync(
  "src/modules/patients/components/corregir-fecha-de-nacimiento.tsx",
  "utf8",
);
const FICHA = readFileSync("src/app/(app)/pacientes/[patientId]/page.tsx", "utf8");
const DESFASADAS = readFileSync(
  "src/modules/clinical-pipeline/data/desfasadas-reader.ts",
  "utf8",
);
const REEMITIR = readFileSync(
  "src/modules/clinical-pipeline/services/reemitir-diagnostico.ts",
  "utf8",
);
const MIGRACION_0244 = readFileSync("drizzle/0244_corregir_la_fecha_de_nacimiento.sql", "utf8");
const MIGRACION_0245 = readFileSync(
  "drizzle/0245_la_correccion_de_fecha_es_append_only.sql",
  "utf8",
);

describe("1 · quien puede corregirla", () => {
  it("solo el admin", () => {
    expect(canCorrectPatientBirthDate(ADMIN)).toBe(true);
    expect(
      canCorrectPatientBirthDate(PROFESIONAL),
      "corregir una fecha ya registrada volvio a ser un acto de consulta",
    ).toBe(false);
  });

  it("y completar la que FALTA sigue siendo del profesional: son dos actos", () => {
    expect(canCompletePatientBirthDate(PROFESIONAL)).toBe(true);
  });

  it("la action lo verifica antes de escribir, no solo la pantalla", () => {
    expect(ACTIONS).toContain("canCorrectPatientBirthDate(user)");
  });

  it("y la ficha ofrece corregir solo cuando la fecha YA esta (excluyente con completar)", () => {
    expect(sinComentarios(FICHA)).toContain(
      "canCorrectPatientBirthDate(user) && !leFaltaLaFecha",
    );
    expect(sinComentarios(FICHA)).toMatch(/<CorregirFechaDeNacimiento/);
  });
});

describe("2 · el motivo y la fuente son obligatorios", () => {
  const BASE = {
    patientId: "11111111-1111-4111-8111-111111111111",
    birthDate: "1988-03-02",
    fuente: "documento_de_identidad",
  };

  it("un motivo de una palabra no pasa: no explica nada dentro de dos años", () => {
    expect(correccionDeFechaDeNacimientoSchema.safeParse({ ...BASE, motivo: "error" }).success).toBe(
      false,
    );
  });

  it("sin fuente no pasa: eso separa una correccion de una suposicion", () => {
    const r = correccionDeFechaDeNacimientoSchema.safeParse({
      ...BASE,
      fuente: undefined,
      motivo: "La edad del equipo no cuadra; se verifico contra la cedula.",
    });
    expect(r.success).toBe(false);
  });

  it("y la fuente es una lista cerrada, la misma que el CHECK de la tabla", () => {
    const r = correccionDeFechaDeNacimientoSchema.safeParse({
      ...BASE,
      fuente: "me lo dijo un colega",
      motivo: "La edad del equipo no cuadra; se verifico contra la cedula.",
    });
    expect(r.success).toBe(false);
    for (const fuente of [
      "documento_de_identidad",
      "registro_civil",
      "el_paciente_lo_confirmo",
      "otro",
    ]) {
      expect(MIGRACION_0244, `la fuente ${fuente} no esta en el CHECK de la tabla`).toContain(
        `'${fuente}'`,
      );
    }
  });

  it("con los tres completos pasa, y hereda los dos cinturones de lo imposible", () => {
    const bueno = correccionDeFechaDeNacimientoSchema.safeParse({
      ...BASE,
      motivo: "La edad del equipo no cuadra; se verifico contra la cedula.",
    });
    expect(bueno.success).toBe(true);
    // Una fecha POSTERIOR A HOY no es la fecha de nacimiento de nadie (cinturon heredado de completar).
    const futuro = correccionDeFechaDeNacimientoSchema.safeParse({
      ...BASE,
      birthDate: "2999-01-01",
      motivo: "La edad del equipo no cuadra; se verifico contra la cedula.",
    });
    expect(futuro.success).toBe(false);
  });
});

describe("3 · el valor anterior se conserva, el rastro va inline y la tabla es append-only", () => {
  it("se guarda una FILA por correccion, no columnas en el perfil", () => {
    // Con columnas, corregir dos veces pisaria el valor anterior de la primera y la historia se pierde.
    expect(WRITER).toContain("insert(correccionesDeFechaDeNacimiento)");
    expect(WRITER).toContain("anterior: perfil.anterior");
  });

  it("el rastro va INLINE en la misma transaccion, nunca por el bus (regla dura 8)", () => {
    expect(WRITER).toContain("recordAudit(tx, {");
    expect(WRITER).toContain('event: "patient.fecha_de_nacimiento_corregida"');
  });

  it("no se corrige a lo mismo: el writer no escribe una fila que no cambia nada", () => {
    expect(sinComentarios(WRITER)).toContain("if (perfil.anterior === input.birthDate) return null");
    expect(MIGRACION_0244).toContain("correcciones_fecha_nacimiento_cambia_check");
  });

  it("y la tabla es append-only DE VERDAD, no solo en su comentario", () => {
    // La 0244 dejaba `FOR ALL` a admin, o sea que podia actualizar o borrar la prueba de que un
    // diagnostico se emitio con otra edad. Un comentario que afirma lo que el codigo no hace es peor que
    // no tenerlo.
    expect(MIGRACION_0245).toContain("BEFORE UPDATE OR DELETE ON correcciones_de_fecha_de_nacimiento");
    // Y el cascade del borrado real del paciente (deshacer un lote de importacion) sigue pasando.
    expect(MIGRACION_0245).toContain("NOT EXISTS (SELECT 1 FROM patients WHERE id = OLD.patient_id)");
  });

  it("la rama del consentimiento se decide con la fecha de FIRMA, y se guarda", () => {
    // Lo que importa no es la edad de hoy: es si la persona era menor EL DIA QUE FIRMO. Esa fecha no
    // cambia, asi que la pregunta se contesta al corregir y queda contestada en la fila.
    expect(WRITER).toContain("motivoDeRegularizacion(");
    expect(WRITER).toContain("cambiaLaRamaDelConsentimiento: cambia");
  });

  it("y cuando cambia, la action lo DICE en vez de dejarlo para que alguien lo note", () => {
    expect(ACTIONS).toContain("cambia la rama del consentimiento");
    expect(ACTIONS).toContain("pendiente de regularizar");
  });
});

describe("4 · despues de corregir, la consulta aparece en recalibracion", () => {
  const AYER = "2026-11-07T10:00:00.000Z";
  const HOY = "2026-11-08T10:00:00.000Z";

  it("una correccion POSTERIOR al diagnostico lo desfasa", () => {
    const motivo = fechaCorregidaDespuesDeEmitir([{ creadaEn: HOY }], AYER);
    expect(motivo).toContain("fecha de nacimiento corregida");
    expect(motivo).toContain("2026-11-08");
  });

  it("una ANTERIOR no: ese diagnostico ya se emitio con la fecha buena", () => {
    expect(fechaCorregidaDespuesDeEmitir([{ creadaEn: AYER }], HOY)).toBeNull();
  });

  it("y sin saber cuando se emitio no se afirma nada", () => {
    expect(fechaCorregidaDespuesDeEmitir([{ creadaEn: HOY }], null)).toBeNull();
  });

  it("el texto NO lleva las dos fechas: la pantalla es una operacion sin datos de paciente", () => {
    const motivo = fechaCorregidaDespuesDeEmitir([{ creadaEn: HOY }], AYER) ?? "";
    // La fecha de la CORRECCION si (es un acto), las de NACIMIENTO no (son PII del paciente).
    expect(motivo).not.toContain("1988");
    expect(motivo.match(/\d{4}-\d{2}-\d{2}/g) ?? []).toHaveLength(1);
  });

  it("la pantalla la incluye aunque su version sea la de hoy", () => {
    expect(sinComentarios(DESFASADAS)).toContain("!e.vigencia.alDia || e.datoCorregido != null");
  });

  it("y el guard de la reemision la ACEPTA, con la MISMA definicion que la pantalla OFRECE", () => {
    // Es la divergencia del 2026-11-07: dos puertas para la misma pregunta ya se separaron una vez.
    expect(DESFASADAS).toContain("fechaCorregidaDespuesDeEmitir(");
    expect(REEMITIR).toContain("fechaCorregidaDespuesDeEmitir(");
    expect(sinComentarios(REEMITIR)).toContain("if (vigencia.alDia && fechaCorregida == null)");
  });

  it("y el rastro de la reemision dice CUAL de las dos puertas abrio", () => {
    // Con las dos versiones iguales, el payload no distinguiria esta reemision de un duplicado.
    expect(REEMITIR).toContain("fecha_de_nacimiento_corregida_despues_de_emitir");
    expect(REEMITIR).toContain("desfase_de_version");
  });
});

describe("5 · el formulario no trae los hazards del navegador", () => {
  const LIMPIO = sinComentarios(FORMULARIO);

  it("ningun `required` incondicional: la exigencia vive en el boton (hazards 6 y 8)", () => {
    expect(LIMPIO, "volvio un `required` suelto al formulario de correccion").not.toMatch(
      /\brequired\b/,
    );
    expect(LIMPIO).toContain("disabled={pending || !completo}");
  });

  it("y el boton DICE que falta, en vez de quedarse muerto sin explicacion", () => {
    expect(FORMULARIO).toContain("Completa la fecha, la fuente y el motivo");
  });

  it("se envia con `enviarSinReset`, no con la prop `action` (hazard 2 de React 19)", () => {
    expect(LIMPIO).toContain("onSubmit={enviarSinReset(formAction)}");
  });

  it("y las dos consecuencias se dicen ANTES de pulsar", () => {
    expect(FORMULARIO).toContain("pendiente de regularizar");
    expect(FORMULARIO).toContain("Recalibración");
  });
});
