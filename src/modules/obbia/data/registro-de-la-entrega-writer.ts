import "server-only";

import { db } from "@/db";
import { researchDatasets } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import {
  CIFRAS_DEL_PANEL,
  nivelDeAnonimizacion,
  type NivelDeAnonimizacion,
} from "../services/nivel-de-anonimizacion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UNA ENTREGA DE DATOS DE INVESTIGACION QUEDA REGISTRADA  ·  (Santiago, 2026-10-30)
//
// ═══ POR QUE ESTO ES LA MITAD QUE FALTABA ═══
//
// `research_datasets` existe desde el principio y el panel lista sus filas... que son CERO, porque nadie
// las escribia. La pantalla decia *"todavia no se ha entregado ningun dataset"* y era cierto solo porque
// no habia forma de entregar nada. Es el mismo patron de `patients.deleted_at`: una tabla de gobierno sin
// nadie que la escriba se lee como que la regla ya se aplica.
//
// Con la exportacion construida, cada archivo que sale deja su fila: QUE se entrego (el alcance, derivado
// de las cifras), con QUE nivel y cuando. Un archivo de investigacion que sale sin rastro es justo lo que
// esta tabla existe para impedir.
//
// ═══ EL NIVEL NO SE TECLEA ═══
//
// Sale de `nivelDeAnonimizacion(CIFRAS_DEL_PANEL)`, la MISMA funcion que rotula el panel y la que
// Gildardo pidio el 2026-10-24 (*"que el nivel se derive de lo que el export quita"*). Si alguien cambia
// el export para que lleve filas de paciente, el nivel registrado cambia solo, y no hay forma de que una
// entrega seudonimizada quede rotulada como agregada.
//
// ═══ Y EL ASIENTO VA INLINE EN LA MISMA TRANSACCION (regla dura 8) ═══
//
// Nunca por el bus: si la fila se revierte, el asiento tambien. Al reves quedaria registrada una entrega
// que no ocurrio, y esta tabla es precisamente la que se consulta para saber que salio.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type EntregaRegistrada = {
  id: string;
  nivel: NivelDeAnonimizacion;
};

/**
 * Registra la entrega del resumen agregado y devuelve su id y su nivel.
 *
 * `status` queda en "entregado" y no en el "pending" por defecto de la columna: ese default describe una
 * SOLICITUD de dataset (el flujo rico que es post-MVP), y esto no es una solicitud, es un archivo que ya
 * salio. Dejarlo en "pending" diria que algo esta esperando aprobacion cuando el dato ya viajo.
 */
export async function registrarLaEntregaDelResumen(input: {
  alcance: string;
  actorId: string;
  actorEmail: string;
  /** Las cifras que viajaron, para el asiento: sin ellas no se puede saber QUE decia el archivo. */
  cifras: Record<string, number>;
}): Promise<EntregaRegistrada> {
  const { nivel } = nivelDeAnonimizacion(CIFRAS_DEL_PANEL);

  return db.transaction(async (tx) => {
    const [fila] = await tx
      .insert(researchDatasets)
      .values({
        requestedBy: input.actorId,
        scope: input.alcance,
        anonymizationLevel: nivel,
        status: "entregado",
      })
      .returning({ id: researchDatasets.id });

    await recordAudit(tx, {
      event: "investigacion.resumen_exportado",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "research_dataset",
      entityId: fila.id,
      payload: { nivel, ...input.cifras },
      ip: null,
    });

    return { id: fila.id, nivel };
  });
}
