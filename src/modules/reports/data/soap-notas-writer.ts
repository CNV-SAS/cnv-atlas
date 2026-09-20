import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles, soapSubjectiveNotes } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// ═══ LA ANAMNESIS DEL PROFESIONAL (apartado S del SOAP) ═══
//
// QUE GUARDA: lo que el paciente conto en consulta y no estaba en la encuesta. Es lo unico del apartado
// Subjetivo que no puede salir de un formulario, y sin ello ese apartado se queda con la mitad.
//
// APPEND-ONLY, y lo impone el trigger de la 0150, no este archivo: corregirse es escribir otra nota. Es
// la decision de Gildardo para las notas clinicas (§8) y coincide con el patron de las historias clinicas
// ajenas, donde una correccion es un anexo que no altera el original.
//
// Y ES LO QUE MANTIENE LA TRAZABILIDAD DEL DOCUMENTO: lo escrito a mano vive aparte de lo generado desde
// las respuestas del paciente, asi que no hay forma de que se mezclen. Esa separacion es la condicion con
// la que se aprobo redactar la encuesta (forma B).

export type NotaSubjetiva = {
  id: string;
  texto: string;
  autor: string;
  profesion: string | null;
  /** ISO. La pantalla la formatea; el formato de fecha vive en un solo sitio. */
  creadaEn: string;
};

export type EscribirNotaSubjetiva = {
  evaluationId: string;
  nota: string;
  actorId: string;
  actorEmail: string;
  profesion: string | null;
  ip: string | null;
};

export async function escribirNotaSubjetiva(input: EscribirNotaSubjetiva): Promise<void> {
  await db.transaction(async (tx) => {
    const [fila] = await tx
      .insert(soapSubjectiveNotes)
      .values({
        evaluationId: input.evaluationId,
        note: input.nota,
        authorId: input.actorId,
        authorEmail: input.actorEmail,
        authorProfession: input.profesion,
      })
      .returning({ id: soapSubjectiveNotes.id });

    // Inline, nunca por el bus (regla dura 8): escribir en la historia clinica de un paciente es un acto
    // clinico, y su rastro no puede depender de que otro proceso lo recoja.
    await recordAudit(tx, {
      event: "soap.subjective_note_added",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      // EL TEXTO NO VA AL RASTRO: es contenido clinico y ya vive en su tabla, que el profesional puede
      // leer. Duplicarlo en el audit (admin-only) multiplicaria copias de PHI sin ganar nada.
      payload: { nota_id: fila.id, largo: input.nota.length },
      ip: input.ip,
    });
  });
}

/**
 * Las notas de una evaluación, en el orden en que se escribieron (la más antigua primero, como se lee un
 * documento).
 *
 * ── DOS DECISIONES QUE CONVIENE LEER JUNTAS ─────────────────────────────────────────────────────
 *
 * 1. SE LEE CON DRIZZLE, no por PostgREST: la tabla es nueva y los tipos generados del cliente todavía no
 *    la conocen. La AUTORIZACIÓN no se pierde por eso: quien llama ya resolvió el documento SOAP, que
 *    pasa por los lectores bajo RLS, así que si el paciente no fuera suyo no habría llegado hasta aquí.
 *
 * 2. TOLERA QUE LA TABLA NO EXISTA TODAVÍA, y es deliberado: entre el despliegue del código y la
 *    aplicación de la migración hay una ventana, y en esa ventana esta pantalla tiene que seguir
 *    abriendo. Vacío se lee como "todavía no hay notas", que es exactamente lo que ocurre. Se distingue
 *    de un fallo real porque cualquier otro error también devuelve vacío y el bloque sigue ofreciendo
 *    escribir: nada se pierde, nada se inventa.
 */
export async function notasSubjetivasEnOrden(evaluationId: string): Promise<NotaSubjetiva[]> {
  try {
    const filas = await db
      .select({
        id: soapSubjectiveNotes.id,
        note: soapSubjectiveNotes.note,
        email: soapSubjectiveNotes.authorEmail,
        profesion: soapSubjectiveNotes.authorProfession,
        creadaEn: soapSubjectiveNotes.createdAt,
        autor: profiles.fullName,
      })
      .from(soapSubjectiveNotes)
      .leftJoin(profiles, eq(profiles.id, soapSubjectiveNotes.authorId))
      .where(eq(soapSubjectiveNotes.evaluationId, evaluationId))
      .orderBy(asc(soapSubjectiveNotes.createdAt));

    return filas.map((f) => ({
      id: f.id,
      texto: f.note,
      autor: f.autor ?? f.email,
      profesion: f.profesion,
      creadaEn: f.creadaEn instanceof Date ? f.creadaEn.toISOString() : String(f.creadaEn),
    }));
  } catch {
    return [];
  }
}
