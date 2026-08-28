import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bisMeasurements, bisRawValues, bisValueCorrections, diagnoses } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import { type MedidaCorregible, variableCruda } from "../services/medidas-corregibles";

// CORRECCION DE UNA MEDIDA ANTROPOMETRICA. Ver las migraciones 0089 (tabla) y 0090 (inversion).
//
// EL MODELO, y por que es al reves de lo que parece: el valor CORREGIDO se escribe en `bis_raw_values`
// y el ORIGINAL del equipo se guarda en `bis_value_corrections`.
//
// La razon es que `bis_raw_values` lo leen SEIS sitios (el pipeline que arma el bisRow para el motor,
// el GET medido de la cadena, los badges celulares, la serie de seguimiento, el panel por profesion y
// la composicion). Con la correccion viviendo aparte, los seis tenian que acordarse de consultarla, y
// solo uno lo hacia: **el diagnostico se generaba sobre el valor sin corregir**. Seis lectores que
// tengan que acordarse de una regla es la clase de regla que se olvida en el septimo.
//
// Asi, los seis ven el valor corregido sin cambiar una linea, y el crudo del equipo no se pierde:
// cambia de sitio y la pantalla lo sigue mostrando ("el equipo midio 84").

export class BisCorrectionError extends Error {}

/** La medicion de la evaluacion, y el gate de "antes del diagnostico". Comun a corregir y restaurar. */
async function medicionEditable(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  evaluationId: string,
): Promise<{ id: string }> {
  const [med] = await tx
    .select({ id: bisMeasurements.id })
    .from(bisMeasurements)
    .where(eq(bisMeasurements.evaluationId, evaluationId))
    .limit(1);
  if (!med) throw new BisCorrectionError("Esta evaluación no tiene una medición BIS que corregir.");

  // EL GATE VIVE AQUI, dentro de la transaccion, y no en la pantalla: un boton oculto no es un candado.
  // Y con la inversion importa mas que antes, porque ahora la escritura toca LA MISMA TABLA que lee el
  // pipeline: sin este gate, corregir despues de diagnosticar dejaria el snapshot emitido sobre un
  // valor que ya no existe en ninguna parte.
  const [diag] = await tx
    .select({ id: diagnoses.id })
    .from(diagnoses)
    .where(eq(diagnoses.evaluationId, evaluationId))
    .limit(1);
  if (diag) {
    throw new BisCorrectionError(
      "El diagnóstico ya se generó sobre esta medición. Para cambiarla, usa Corregir la evaluación: " +
        "así queda una versión nueva y no se reescribe lo que ya se emitió.",
    );
  }
  return med;
}

export async function correctBisValue(input: {
  evaluationId: string;
  variableName: MedidaCorregible;
  value: number;
  actorId: string;
  actorEmail: string;
  ip: string | null;
  // Se devuelve QUE paso, para que el mensaje de la pantalla no afirme una correccion que no ocurrio.
}): Promise<"corregida" | "restaurada" | "sin_cambio"> {
  if (!(input.value > 0)) throw new BisCorrectionError("El valor debe ser mayor que cero.");
  // La traduccion al nombre del crudo se hace UNA VEZ, aqui. Lanza si el campo no tiene equivalente.
  const cruda = variableCruda(input.variableName);

  return await db.transaction(async (tx) => {
    const med = await medicionEditable(tx, input.evaluationId);

    const [actual] = await tx
      .select({ id: bisRawValues.id, value: bisRawValues.value })
      .from(bisRawValues)
      .where(and(eq(bisRawValues.measurementId, med.id), eq(bisRawValues.variableName, cruda)))
      .limit(1);

    const [previa] = await tx
      .select({ original: bisValueCorrections.originalValue })
      .from(bisValueCorrections)
      .where(
        and(
          eq(bisValueCorrections.measurementId, med.id),
          eq(bisValueCorrections.variableName, cruda),
        ),
      )
      .limit(1);

    // SIN CAMBIO, SIN REGISTRO. Pulsar "Guardar" sin tocar el numero no es una correccion: dejaba la
    // medida marcada como "Corregido. El equipo midio 106" con 106 en el campo, que es falso y ademas
    // ensucia la traza. Mismo criterio que el guard de sin-cambios del consentimiento: entrar y
    // confirmar sin cambiar nada no crea un registro.
    if (actual != null && Number(actual.value) === input.value) return "sin_cambio";

    // EL CASO INVERSO, que NO es "sin cambio": si el valor tecleado coincide con el del EQUIPO y habia
    // una correccion, eso equivale a RESTAURAR. Registrarlo como correccion dejaria la medida marcada
    // como corregida mostrando exactamente lo que midio el equipo, que es la misma mentira al reves.
    if (previa && Number(previa.original) === input.value) {
      await tx
        .update(bisRawValues)
        .set({ value: previa.original })
        .where(and(eq(bisRawValues.measurementId, med.id), eq(bisRawValues.variableName, cruda)));
      await tx
        .delete(bisValueCorrections)
        .where(
          and(
            eq(bisValueCorrections.measurementId, med.id),
            eq(bisValueCorrections.variableName, cruda),
          ),
        );
      await recordAudit(tx, {
        event: "bis.correction_cleared",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "bis_measurement",
        entityId: med.id,
        payload: {
          evaluation_id: input.evaluationId,
          medida: input.variableName,
          a: previa.original,
          via: "tecleo del valor original",
        },
        ip: input.ip,
      });
      return "restaurada";
    }

    // EL ORIGINAL SE GUARDA UNA SOLA VEZ, en la PRIMERA correccion. Si se corrige dos veces, el
    // original sigue siendo lo que midio el equipo, no la correccion anterior: `onConflictDoNothing`
    // sobre esta insercion es lo que lo garantiza. Sin eso, la segunda correccion pisaria el original
    // con la primera y "el equipo midio X" pasaria a ser mentira.
    await tx
      .insert(bisValueCorrections)
      .values({
        measurementId: med.id,
        variableName: cruda,
        originalValue: actual?.value ?? "0",
        correctedBy: input.actorId,
        correctedByEmail: input.actorEmail,
      })
      .onConflictDoUpdate({
        target: [bisValueCorrections.measurementId, bisValueCorrections.variableName],
        // El original NO se toca; solo se actualiza quien corrigio por ultima vez.
        set: { correctedBy: input.actorId, correctedByEmail: input.actorEmail },
      });

    if (actual) {
      await tx
        .update(bisRawValues)
        .set({ value: String(input.value) })
        .where(eq(bisRawValues.id, actual.id));
    } else {
      // El equipo no trajo esa medida (el caso "si faltan en el archivo" de su nota). Se inserta como
      // medida del profesional; el original queda en 0, que es lo que la pantalla lee como "sin dato".
      await tx.insert(bisRawValues).values({
        measurementId: med.id,
        variableName: cruda,
        value: String(input.value),
      });
    }

    // Inline en la transaccion (regla dura 8), nunca por el bus.
    await recordAudit(tx, {
      event: "bis.value_corrected",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "bis_measurement",
      entityId: med.id,
      payload: {
        evaluation_id: input.evaluationId,
        medida: input.variableName,
        variable: cruda,
        de: actual?.value ?? null,
        a: input.value,
      },
      ip: input.ip,
    });
    return "corregida";
  });
}

/** Devuelve la medida al valor del equipo y quita el rastro de correccion. */
export async function clearBisCorrection(input: {
  evaluationId: string;
  variableName: MedidaCorregible;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  const cruda = variableCruda(input.variableName);

  await db.transaction(async (tx) => {
    const med = await medicionEditable(tx, input.evaluationId);

    const [fix] = await tx
      .select({ original: bisValueCorrections.originalValue })
      .from(bisValueCorrections)
      .where(
        and(
          eq(bisValueCorrections.measurementId, med.id),
          eq(bisValueCorrections.variableName, cruda),
        ),
      )
      .limit(1);
    if (!fix) throw new BisCorrectionError("Esa medida no está corregida.");

    await tx
      .update(bisRawValues)
      .set({ value: fix.original })
      .where(and(eq(bisRawValues.measurementId, med.id), eq(bisRawValues.variableName, cruda)));

    await tx
      .delete(bisValueCorrections)
      .where(
        and(
          eq(bisValueCorrections.measurementId, med.id),
          eq(bisValueCorrections.variableName, cruda),
        ),
      );

    // Volver al valor del equipo tambien es una decision, y deja rastro igual que corregir.
    await recordAudit(tx, {
      event: "bis.correction_cleared",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "bis_measurement",
      entityId: med.id,
      payload: { evaluation_id: input.evaluationId, medida: input.variableName, a: fix.original },
      ip: input.ip,
    });
  });
}
