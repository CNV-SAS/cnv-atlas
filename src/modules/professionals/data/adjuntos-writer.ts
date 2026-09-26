import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db, type DbTransaction } from "@/db";
import { professionalAttachments, professionalProfiles } from "@/db/schema";

// ═══ LOS ADJUNTOS DEL INTEGRANTE, CON HISTORIAL (0179, 2026-09-25) ═══
//
// El RUT era UNA RUTA en la fila del profesional: subir uno nuevo PISABA la del anterior y no quedaba
// historial. Santiago pidio verlo, con el vigente y los anteriores.
//
// `professional_profiles.rut_path` SE QUEDA como CACHE del vigente, y no es duplicidad: lo leen el gate de la
// liquidacion, la cola de verificacion y la ruta /rut/[id], y moverlos todos a una subconsulta seria un barrido
// grande para no ganar nada. La fuente de verdad es esta tabla y esa columna su proyeccion, como el saldo de
// inventario frente a sus movimientos. LO QUE NO PUEDE PASAR ES QUE DISCREPEN, y por eso se escriben JUNTAS, en
// la misma transaccion: quien registre un adjunto de RUT actualiza el cache en el mismo acto.

export type AdjuntoEnPantalla = {
  id: string;
  kind: string;
  originalName: string | null;
  documentDate: string | null;
  subidoEn: string;
  vigente: boolean;
  reemplazadoEn: string | null;
};

/**
 * Registra un adjunto y RETIRA el anterior del mismo tipo, apuntandolo al nuevo.
 *
 * Recibe la transaccion porque el caso real (subir un RUT) ya corre dentro de una: el adjunto, el cache y la
 * limpieza de la verificacion anterior son un solo hecho.
 */
export async function registrarAdjunto(
  tx: DbTransaction,
  input: {
    professionalId: string;
    kind: "rut" | "certificado_bancario" | "tarjeta_profesional" | "diploma" | "otro";
    path: string;
    originalName?: string | null;
    contentType?: string | null;
    sizeBytes?: number | null;
    documentDate?: string | null;
    uploadedBy?: string | null;
  },
): Promise<{ id: string }> {
  // ── EL ORDEN ES RETIRAR PRIMERO Y LUEGO INSERTAR, y al reves no compila con la base (0182) ──
  //
  // Los dos invariantes de la tabla se estorban: el nuevo no puede entrar mientras el viejo siga vigente (indice
  // unico), y el viejo no se puede retirar antes de que el nuevo exista (un reemplazado dice por cual). Su
  // candado lo encontro al subir el segundo RUT: "duplicate key value violates unique constraint".
  //
  // SE RESUELVE GENERANDO EL ID AQUI y aplazando la llave foranea al commit (la 0182 la hizo DEFERRABLE). Dentro
  // de la transaccion el estado es transitorio; al commit hay un vigente y el retirado apunta a el.
  const id = randomUUID();

  await tx.execute(sql`
    update professional_attachments
       set superseded_at = now(), superseded_by = ${id}::uuid
     where professional_id = ${input.professionalId}::uuid
       and kind = ${input.kind}
       and superseded_at is null`);

  await tx.insert(professionalAttachments).values({
    id,
    professionalId: input.professionalId,
    kind: input.kind,
    path: input.path,
    originalName: input.originalName ?? null,
    contentType: input.contentType ?? null,
    sizeBytes: input.sizeBytes ?? null,
    documentDate: input.documentDate ?? null,
    uploadedBy: input.uploadedBy ?? null,
  });

  return { id };
}

/** El historial de adjuntos, el vigente primero. */
export async function listarAdjuntos(professionalId: string): Promise<AdjuntoEnPantalla[]> {
  const filas = await db
    .select({
      id: professionalAttachments.id,
      kind: professionalAttachments.kind,
      originalName: professionalAttachments.originalName,
      documentDate: professionalAttachments.documentDate,
      uploadedAt: professionalAttachments.uploadedAt,
      supersededAt: professionalAttachments.supersededAt,
    })
    .from(professionalAttachments)
    .where(eq(professionalAttachments.professionalId, professionalId))
    .orderBy(desc(professionalAttachments.uploadedAt));

  return filas.map((f) => ({
    id: f.id,
    kind: f.kind,
    originalName: f.originalName,
    documentDate: f.documentDate,
    subidoEn: f.uploadedAt.toISOString(),
    vigente: f.supersededAt == null,
    reemplazadoEn: f.supersededAt?.toISOString() ?? null,
  }));
}

/**
 * EL RUT QUE YA ESTABA Y NO TIENE FILA, registrado al pasar (retro-relleno perezoso).
 *
 * Los integrantes que subieron su RUT antes de la 0179 tienen `rut_path` y ningun adjunto, asi que su pestaña
 * saldria vacia diciendo "no has subido ninguno" JUNTO AL enlace para verlo, que es la clase de contradiccion
 * que hay que evitar. Se registra la primera vez que alguien mira.
 *
 * NO ES UNA MIGRACION DE DATOS a proposito: no sabemos cuando se subio ese archivo ni quien lo subio, asi que
 * una migracion tendria que inventar esas fechas para todos. Aqui la fila nace diciendo lo unico cierto (que
 * existe y que es el vigente) y sin fecha de carga falsa.
 */
export async function registrarRutQueYaEstaba(professionalId: string): Promise<void> {
  const [perfil] = await db
    .select({ rutPath: professionalProfiles.rutPath, rutDate: professionalProfiles.rutDocumentDate })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.id, professionalId));
  if (!perfil?.rutPath) return;

  const yaHay = await db
    .select({ id: professionalAttachments.id })
    .from(professionalAttachments)
    .where(
      and(
        eq(professionalAttachments.professionalId, professionalId),
        eq(professionalAttachments.kind, "rut"),
        isNull(professionalAttachments.supersededAt),
      ),
    );
  if (yaHay.length > 0) return;

  await db.insert(professionalAttachments).values({
    professionalId,
    kind: "rut",
    path: perfil.rutPath,
    documentDate: perfil.rutDate,
    originalName: null,
  });
}
