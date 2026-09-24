import "server-only";

import { createHash } from "node:crypto";

import { appError, err, ok, type Result } from "@/core/errors";

import { leerContextoDeRevision } from "../data/contexto-reader";
import { archivoDeExportacionSchema, porQueNoPasa, TAMANO_MAXIMO_ARCHIVO } from "../validations/archivo";
import { revisarLote, type RevisionDelLote } from "./revisar-lote";

// Orquesta la revision de un archivo exportado del HTML: tamano, formato, contexto de Atlas y el informe.
// NO ESCRIBE NADA (sesion 3): ni en la base ni en almacenamiento. El archivo se lee en memoria y se descarta.

export type ResultadoDeRevision = {
  archivo: { nombre: string; tamano: number; hash: string };
  revision: RevisionDelLote;
};

export async function revisarArchivo(archivo: File): Promise<Result<ResultadoDeRevision>> {
  if (archivo.size === 0) return err(appError("validation", "El archivo está vacío."));
  if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    return err(appError("validation", "El archivo supera el tamaño máximo permitido (25 MB)."));
  }
  const texto = await archivo.text();
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return err(appError("validation", "El archivo no es una exportación del HTML: no se pudo leer como JSON."));
  }
  const validado = archivoDeExportacionSchema.safeParse(crudo);
  if (!validado.success) {
    // EL MENSAJE DICE QUE PASO, no "no tiene el formato" (Santiago, 2026-09-24). Ver `porQueNoPasa`: un
    // rechazo que echa la culpa al formato sin saberlo manda a repetir un trabajo que quizá ya estaba bien.
    return err(appError("validation", porQueNoPasa(crudo, validado.error.issues)));
  }
  const contexto = await leerContextoDeRevision();
  return ok({
    archivo: {
      nombre: archivo.name,
      tamano: archivo.size,
      hash: createHash("sha256").update(texto, "utf8").digest("hex"),
    },
    revision: revisarLote(validado.data, contexto),
  });
}
