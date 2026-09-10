import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses, evaluations, treatments } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import {
  adjustmentSignature,
  intercambioSignature,
  menuSemanalSignature,
  objetivoSignature,
  restriccionesSignature,
  tiemposActivosSignature,
  tiemposSignature,
} from "./protocol-signature";
import { TreatmentStateError } from "./treatment-writer";
import type { IntercambioSaved, MenuSemanalSaved, TiemposSaved } from "./treatment-view-types";

// UN SOLO GUARDADO PARA TODO EL PROTOCOLO (Santiago, 2026-09-09).
//
// LO QUE PIDIO, textual: *"quitar todos esos botones de guardar ajustes por bloques y que cada cambio sea
// en vivo... y un botón que diga Guardar cambios. Así pasamos de 8 botones a solo 1 botón."*
//
// POR QUE ESTO NO ES "LOS SIETE WRITERS EN FILA". Verificado antes de construir: NO son el mismo
// formulario. Eran siete formularios, siete acciones, siete writers y siete errores de concurrencia
// distintos, cada uno con su propia firma validada bajo `SELECT ... FOR UPDATE`. Encadenarlos uno tras
// otro daria el peor resultado posible: si el quinto falla, quedan cuatro secciones guardadas y tres no, y
// el profesional NO SABE CUALES. Eso es peor que los siete botones, donde al menos sabe cual fallo.
//
// POR ESO ES TRANSACCIONAL Y TODO-O-NADA. Una transaccion, un lock, y o se guarda el conjunto o no se
// guarda nada. El aviso de cambios sin guardar sigue en pantalla y el profesional reintenta.
//
// Y LA VALIDACION DE LAS SIETE FIRMAS VA ANTES DE ESCRIBIR NINGUNA, que es MAS ESTRICTO que antes y es
// correcto: hoy se pueden guardar seis bloques aunque el septimo este desfasado. Si otro profesional toco
// el tratamiento, no quieres guardar la mitad de tu version sobre la suya. El rechazo dice QUE secciones
// cambiaron, no solo que algo cambio.
//
// UN SOLO `SELECT ... FOR UPDATE` en vez de siete. Los siete writers lockeaban la misma fila uno detras de
// otro; aqui se lockea una vez y se leen todas las columnas de golpe. Es mas simple y ademas quita seis
// viajes a la base.
//
// EL AUDIT CONSERVA SU GRANULARIDAD: un evento POR SECCION que de verdad cambio, inline en la transaccion
// (regla dura 8). Un evento unico de "protocolo guardado" perderia lo que el log existe para contestar
// (quien cambio las restricciones y cuando), y un evento por seccion ENVIADA mentiria: diria que se
// cambiaron restricciones cada vez que alguien mueve el PAL.
//
// LOS NUTRACEUTICOS NO ENTRAN AQUI, y va declarado para que no se lea como un olvido: escriben una tabla
// HIJA (`treatment_nutraceuticals`), no columnas de `treatments`, y su seccion vive en otro arbol de
// componentes. Conservan su guardado propio. Ver la nota al pie de este archivo.

/** Rechazo de concurrencia del conjunto. Nombra las secciones que otro profesional movio. */
export class StaleProtocoloError extends Error {
  readonly secciones: string[];
  constructor(secciones: string[]) {
    super(`Estas secciones cambiaron desde que se cargaron: ${secciones.join(", ")}.`);
    this.name = "StaleProtocoloError";
    this.secciones = secciones;
  }
}

/** Los seis ajustes de la cadena calorica mas el peso meta, que vive en la evaluacion. */
export type AjustesDeLaCadena = {
  adjGeb: number | null;
  adjPal: number | null;
  adjKcalObj: number | null;
  adjProtGkg: number | null;
  adjFatPct: number | null;
  adjDeficit: number | null;
  pesoMetaFijado: number | null;
};

/**
 * TODO lo editable del protocolo, con la firma de lo que el cliente CARGO.
 *
 * LAS SIETE VIAJAN SIEMPRE, incluso las que el profesional no toco, y es deliberado: la firma de una
 * seccion intacta es lo que detecta que OTRO la movio. Si solo viajaran las modificadas, el guardado
 * pasaria por encima del trabajo ajeno sin enterarse.
 */
export type ProtocoloEditable = {
  ajustes: AjustesDeLaCadena;
  objetivo: string | null;
  restricciones: string[];
  intercambio: IntercambioSaved | null;
  tiemposActivos: Record<string, boolean> | null;
  tiempos: TiemposSaved | null;
  menuSemanal: MenuSemanalSaved | null;
};

export type FirmasBase = {
  ajustes: string;
  objetivo: string;
  restricciones: string;
  intercambio: string;
  tiemposActivos: string;
  tiempos: string;
  menuSemanal: string;
};

export type GuardarProtocoloWrite = {
  treatmentId: string;
  editable: ProtocoloEditable;
  firmas: FirmasBase;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

/** Nombre de cada seccion en el idioma de la PANTALLA: el aviso de rechazo lo lee un profesional. */
const ROTULO: Record<keyof FirmasBase, string> = {
  ajustes: "la cadena calórica",
  objetivo: "el objetivo del tratamiento",
  restricciones: "las restricciones",
  intercambio: "la lista de intercambio",
  tiemposActivos: "los tiempos de comida",
  tiempos: "la distribución por tiempos",
  menuSemanal: "el menú semanal",
};

export async function guardarProtocolo(
  input: GuardarProtocoloWrite,
): Promise<{ guardadas: (keyof FirmasBase)[] }> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '3s'`);

    // EL LOCK, UNA SOLA VEZ. Se lockea `treatments` y se trae la evaluacion por el join, igual que hacia
    // `saveAdjustments`: el peso meta vive en `evaluations` desde la migracion 0096.
    const [fila] = await tx
      .select({
        evaluationId: diagnoses.evaluationId,
        geb: treatments.adjGeb,
        pal: treatments.adjPal,
        kcalObj: treatments.adjKcalObj,
        protGkg: treatments.adjProtGkg,
        fatPct: treatments.adjFatPct,
        deficit: treatments.adjDeficit,
        objetivo: treatments.objetivoTexto,
        restricciones: treatments.restricciones,
        intercambio: treatments.intercambioPorciones,
        tiemposActivos: treatments.tiemposActivos,
        tiempos: treatments.tiempos,
        menuSemanal: treatments.menuSemanal,
      })
      .from(treatments)
      // EL JOIN ES EL GATE CLINICO: sin diagnostico no hay protocolo que editar. Va aqui y no en una
      // consulta aparte porque es la misma lectura, y una guarda que se puede olvidar de llamar es una
      // guarda que alguien va a olvidar.
      .innerJoin(diagnoses, eq(diagnoses.id, treatments.diagnosisId))
      .where(eq(treatments.id, input.treatmentId))
      .for("update", { of: [treatments] })
      .limit(1);
    if (!fila) throw new TreatmentStateError("Tratamiento no encontrado.");

    // EL PESO META SE LOCKEA APARTE, y el ORDEN es siempre este (tratamiento y luego evaluacion): las
    // otras escrituras de `evaluations` no tocan `treatments`, asi que no hay ciclo posible y no hay
    // deadlock. Es el mismo orden que ya tenia `saveAdjustments`; cambiarlo aqui abriria uno.
    const [filaEval] = await tx
      .select({ pesoMeta: evaluations.weightGoalKg })
      .from(evaluations)
      .where(eq(evaluations.id, fila.evaluationId))
      .for("update")
      .limit(1);

    // Number() en TODO (los numeric vuelven string, los integer numero): misma normalizacion que el
    // reader, sin la cual la firma divergiria por escala y rechazaria guardados legitimos.
    const n = (v: unknown): number | null => (v == null ? null : Number(v));
    const vigentes: FirmasBase = {
      ajustes: adjustmentSignature({
        treatmentId: input.treatmentId,
        adjGeb: n(fila.geb),
        adjPal: n(fila.pal),
        adjKcalObj: n(fila.kcalObj),
        adjProtGkg: n(fila.protGkg),
        adjFatPct: n(fila.fatPct),
        adjDeficit: n(fila.deficit),
        pesoMetaFijado: n(filaEval?.pesoMeta),
      }),
      objetivo: objetivoSignature({ treatmentId: input.treatmentId, objetivo: fila.objetivo }),
      restricciones: restriccionesSignature({
        treatmentId: input.treatmentId,
        restricciones: fila.restricciones ?? [],
      }),
      intercambio: intercambioSignature({
        treatmentId: input.treatmentId,
        intercambio: (fila.intercambio as IntercambioSaved | null) ?? null,
      }),
      tiemposActivos: tiemposActivosSignature({
        treatmentId: input.treatmentId,
        activos: (fila.tiemposActivos as Record<string, boolean> | null) ?? null,
      }),
      tiempos: tiemposSignature({
        treatmentId: input.treatmentId,
        tiempos: (fila.tiempos as TiemposSaved | null) ?? null,
      }),
      menuSemanal: menuSemanalSignature({
        treatmentId: input.treatmentId,
        menu: (fila.menuSemanal as MenuSemanalSaved | null) ?? null,
      }),
    };

    // ═══ PRIMERA PASADA: SE VALIDAN LAS SIETE, Y NO SE ESCRIBE NADA ═══
    //
    // Recoge TODAS las desfasadas, no la primera. Un aviso que nombra una sola obliga a reintentar para
    // descubrir la siguiente, que es la forma de convertir un rechazo en tres.
    const desfasadas = (Object.keys(vigentes) as (keyof FirmasBase)[]).filter(
      (k) => vigentes[k] !== input.firmas[k],
    );
    if (desfasadas.length > 0) throw new StaleProtocoloError(desfasadas.map((k) => ROTULO[k]));

    // ═══ SEGUNDA PASADA: SE ESCRIBE SOLO LO QUE DE VERDAD CAMBIO ═══
    //
    // POR QUE NO SE ESCRIBE TODO. El audit lleva un evento por seccion, y escribir las siete siempre haria
    // que cada guardado afirmara que se cambiaron las restricciones, el menu y la distribucion aunque el
    // profesional solo hubiera movido el PAL. El log se lee para contestar quien cambio que: un evento que
    // se emite siempre no contesta nada.
    const e = input.editable;
    const cambio = (k: keyof FirmasBase, nueva: string) => vigentes[k] !== nueva;
    const guardadas: (keyof FirmasBase)[] = [];

    const firmaNuevaAjustes = adjustmentSignature({
      treatmentId: input.treatmentId,
      ...e.ajustes,
    });
    if (cambio("ajustes", firmaNuevaAjustes)) {
      await tx
        .update(treatments)
        .set({
          adjGeb: e.ajustes.adjGeb,
          // Los numeric van como string a Drizzle; los integer, como numero.
          adjPal: e.ajustes.adjPal != null ? String(e.ajustes.adjPal) : null,
          adjKcalObj: e.ajustes.adjKcalObj,
          adjProtGkg: e.ajustes.adjProtGkg != null ? String(e.ajustes.adjProtGkg) : null,
          adjFatPct: e.ajustes.adjFatPct,
          adjDeficit: e.ajustes.adjDeficit,
        })
        .where(eq(treatments.id, input.treatmentId));

      // LA PROCEDENCIA DEL PESO META SOLO CAMBIA SI CAMBIA EL VALOR, y esto viene tal cual de
      // `saveAdjustments`: la cadena manda las siete cifras de golpe, asi que se guarda tambien cuando el
      // profesional vino a mover el PAL y ni toco el peso. Reescribir la procedencia ahi diria que el peso
      // lo fijo el nutricionista cuando lo habia acordado quien hizo la entrada: convertiria un guardado
      // cualquiera en una afirmacion falsa sobre quien decidio.
      const anterior = n(filaEval?.pesoMeta);
      if (anterior !== e.ajustes.pesoMetaFijado) {
        await tx
          .update(evaluations)
          .set({
            weightGoalKg: e.ajustes.pesoMetaFijado != null ? String(e.ajustes.pesoMetaFijado) : null,
            weightGoalSetIn: e.ajustes.pesoMetaFijado != null ? "tratamiento" : null,
          })
          .where(eq(evaluations.id, fila.evaluationId));
      }

      await recordAudit(tx, {
        event: "treatment.adjustments_updated",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "treatment",
        entityId: input.treatmentId,
        payload: {
          adj_geb: e.ajustes.adjGeb,
          adj_pal: e.ajustes.adjPal,
          adj_kcal_obj: e.ajustes.adjKcalObj,
          adj_prot_gkg: e.ajustes.adjProtGkg,
          adj_fat_pct: e.ajustes.adjFatPct,
          adj_deficit: e.ajustes.adjDeficit,
          peso_meta: e.ajustes.pesoMetaFijado,
        },
        ip: input.ip,
      });
      guardadas.push("ajustes");
    }

    if (cambio("objetivo", objetivoSignature({ treatmentId: input.treatmentId, objetivo: e.objetivo }))) {
      await tx
        .update(treatments)
        .set({ objetivoTexto: e.objetivo })
        .where(eq(treatments.id, input.treatmentId));
      await recordAudit(tx, {
        event: "treatment.objetivo_updated",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "treatment",
        entityId: input.treatmentId,
        payload: { objetivo_len: (e.objetivo ?? "").length },
        ip: input.ip,
      });
      guardadas.push("objetivo");
    }

    if (
      cambio(
        "restricciones",
        restriccionesSignature({ treatmentId: input.treatmentId, restricciones: e.restricciones }),
      )
    ) {
      await tx
        .update(treatments)
        .set({ restricciones: e.restricciones })
        .where(eq(treatments.id, input.treatmentId));
      await recordAudit(tx, {
        event: "treatment.restricciones_updated",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "treatment",
        entityId: input.treatmentId,
        payload: { restricciones_count: e.restricciones.length },
        ip: input.ip,
      });
      guardadas.push("restricciones");
    }

    if (
      e.intercambio &&
      cambio(
        "intercambio",
        intercambioSignature({ treatmentId: input.treatmentId, intercambio: e.intercambio }),
      )
    ) {
      await tx
        .update(treatments)
        .set({ intercambioPorciones: e.intercambio })
        .where(eq(treatments.id, input.treatmentId));
      await recordAudit(tx, {
        event: "treatment.intercambio_updated",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "treatment",
        entityId: input.treatmentId,
        payload: {
          objetivo_base: e.intercambio.objetivoBase,
          alimentos_con_porcion: Object.values(e.intercambio.porciones).filter((x) => x > 0).length,
        },
        ip: input.ip,
      });
      guardadas.push("intercambio");
    }

    if (
      e.tiemposActivos &&
      cambio(
        "tiemposActivos",
        tiemposActivosSignature({ treatmentId: input.treatmentId, activos: e.tiemposActivos }),
      )
    ) {
      await tx
        .update(treatments)
        .set({ tiemposActivos: e.tiemposActivos })
        .where(eq(treatments.id, input.treatmentId));
      await recordAudit(tx, {
        event: "treatment.tiempos_activos_updated",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "treatment",
        entityId: input.treatmentId,
        // Se audita QUE tiempos quedaron activos: definen la estructura del dia del paciente.
        payload: {
          activos: Object.entries(e.tiemposActivos)
            .filter(([, v]) => v)
            .map(([k]) => k),
        },
        ip: input.ip,
      });
      guardadas.push("tiemposActivos");
    }

    if (e.tiempos && cambio("tiempos", tiemposSignature({ treatmentId: input.treatmentId, tiempos: e.tiempos }))) {
      await tx
        .update(treatments)
        .set({ tiempos: e.tiempos })
        .where(eq(treatments.id, input.treatmentId));
      await recordAudit(tx, {
        event: "treatment.tiempos_updated",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "treatment",
        entityId: input.treatmentId,
        payload: { overrides: Object.keys(e.tiempos.celdas).length },
        ip: input.ip,
      });
      guardadas.push("tiempos");
    }

    if (
      e.menuSemanal &&
      cambio("menuSemanal", menuSemanalSignature({ treatmentId: input.treatmentId, menu: e.menuSemanal }))
    ) {
      await tx
        .update(treatments)
        .set({ menuSemanal: e.menuSemanal })
        .where(eq(treatments.id, input.treatmentId));
      await recordAudit(tx, {
        event: "treatment.menu_semanal_updated",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "treatment",
        entityId: input.treatmentId,
        // Se auditan CIFRAS, no el contenido del menu: es texto libre del profesional y el log no es su copia.
        payload: {
          dia_inicio: e.menuSemanal.diaInicio,
          celdas_editadas: Object.values(e.menuSemanal.celdas).filter((v) => String(v).trim().length > 0)
            .length,
        },
        ip: input.ip,
      });
      guardadas.push("menuSemanal");
    }

    return { guardadas };
  });
}

/** El rotulo de una seccion, para que el servicio y la pantalla no escriban dos listas distintas. */
export function rotuloDeSeccion(k: keyof FirmasBase): string {
  return ROTULO[k];
}
