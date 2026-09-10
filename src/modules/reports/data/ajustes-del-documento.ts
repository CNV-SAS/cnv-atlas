import type { ProtocoloAjustes } from "@/clinical-engine";
import type { EmisionPrescripcion } from "@/modules/treatment/data/emisiones-reader";

// QUE CIFRAS GOBIERNAN UN DOCUMENTO CLINICO DE ESTA CONSULTA.
//
// EL DEFECTO QUE ESTO CIERRA (Santiago, 2026-09-09). La historia clinica se arma de
// `protocol_suggested` mas los `adj_*` VIVOS, recomputados en el momento de imprimir. O sea que la
// historia clinica de una consulta de agosto diria lo que los ajustes digan HOY. Hasta ahora eso no se
// veia porque aprobar CONGELABA los ajustes; en cuanto la prescripcion queda siempre abierta, el
// documento empieza a moverse solo.
//
// LA REGLA, en una linea: si esta consulta EMITIO algo, manda lo que se emitio. Si no emitio nada, mandan
// las cifras vivas y el documento TIENE QUE DECIRLO (cuidado (c) de Santiago: "la HC de una consulta sin
// documento entregado tiene que decir algo, no quedar vacia").
//
// POR QUE SE SUSTITUYEN LOS AJUSTES Y NO EL RESULTADO. `protocol_suggested` es write-once (trigger 0026,
// la unica rama que sobrevive), asi que recomputar la cadena con los ajustes SELLADOS reproduce
// exactamente lo emitido. Sustituir aqui, en la ENTRADA, hace que todo lo que cuelga (la cadena efectiva,
// la prescripcion nutricional, el bloque del plan) siga la misma decision sin tener que tocarlo pieza a
// pieza. Sustituir el resultado obligaria a acordarse de cada consumidor, y siempre falta uno.
//
// Y VIVE EN UN SOLO SITIO A PROPOSITO. La historia clinica se compone en DOS lugares: la pantalla
// (`ani-bis-e/[id]/page.tsx`) y el documento (`hc-documento-reader`). Si cada uno eligiera sus cifras, la
// pantalla y el papel dirian cosas distintas del mismo acto clinico, que es el defecto que
// `componerHistoriaClinica` existe para evitar. Esta es la misma pieza para la otra mitad de la decision.

/** Un numero del jsonb sellado, o null. Un valor corrupto no se convierte en cero: se declara ausente. */
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export type AjustesDelDocumento = {
  /** Las cifras que gobiernan el documento. */
  ajustes: ProtocoloAjustes;
  /**
   * ¿Salen de una emision? `false` significa que esta consulta NO entrego nada y el documento muestra el
   * estado de hoy. Quien lo rinde tiene que decirlo, no callarlo.
   */
  sellados: boolean;
};

export function ajustesDelDocumento(
  emision: EmisionPrescripcion | null,
  vivos: ProtocoloAjustes,
): AjustesDelDocumento {
  const sellados = (emision?.prescripcion as { ajustes?: Record<string, unknown> } | undefined)?.ajustes;
  if (!sellados || typeof sellados !== "object") return { ajustes: vivos, sellados: false };
  return {
    sellados: true,
    ajustes: {
      geb: num(sellados.geb),
      pal: num(sellados.pal),
      kcalObj: num(sellados.kcalObj),
      protGkg: num(sellados.protGkg),
      fatPct: num(sellados.fatPct),
      deficit: num(sellados.deficit),
      pesoMeta: num(sellados.pesoMeta),
    },
  };
}
