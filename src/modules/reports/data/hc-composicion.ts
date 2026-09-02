import { computeProtocoloEfectivo, type ProtocoloSnapshot } from "@/clinical-engine";
import { indicatorSeverities } from "@/clinical-engine/severity";

import { indicesAniAlterados, type IndiceAniResuelto } from "./hc-indices-ani";
import { recomendacionesDe, type RecomendacionBloque } from "./hc-recomendaciones";
import type { HcPlanNutricional } from "../components/historia-clinica";

// LA COMPOSICION DE LA HISTORIA CLINICA, EN UN SOLO SITIO.
//
// POR QUE EXISTE, y es la condicion que Santiago puso para portar la HC a PDF: **el PDF y la pantalla
// tienen que salir del mismo sitio**. Al medirlo aparecio donde estaba el riesgo de verdad, y no era donde
// se suponia: de los quince bloques, los que tienen lector propio (`getHcHeader`, `resolverAntecedentes`,
// `listReferralsForTreatment`, las autorizaciones) NO son el problema, porque el PDF puede llamar al mismo
// lector. **El problema son los que se ARMABAN INLINE en `page.tsx`**: las severidades, los indices ANI, la
// cadena efectiva, el plan nutricional, los diagnosticos declarados y las recomendaciones. Esos seis no
// tenian nombre en ninguna parte, asi que un PDF que los volviera a armar los armaria a su manera.
//
// LO QUE ESTO NO HACE, a proposito: no lee de la base. Las CONSULTAS se quedan donde estaban (la pagina las
// hace para pintar, el generador del PDF las hara para emitir); lo que se unifica es la COMPOSICION, que es
// donde estaba la divergencia. Mover tambien las consultas seria un refactor de la pagina entera para
// resolver un riesgo que ya queda cerrado aqui.
//
// El resultado es el mismo patron que `getPlanPaciente`: una sola forma del documento, dos presentaciones.

export type HcEntradas = {
  /** Snapshot del motor, o null si la evaluacion no tiene uno compatible. */
  snapshot: {
    indicators: Record<string, number | null> & { FFMI: number };
    classifications: Record<string, unknown>;
  } | null;
  /** Prescripcion SUGERIDA sellada del protocolo (`protocol_suggested`), o null. */
  suggested: ProtocoloSnapshot | null;
  /** Ajustes del profesional. Todos null cuando no ha fijado ninguno. */
  ajustes: {
    geb: number | null;
    pal: number | null;
    kcalObj: number | null;
    protGkg: number | null;
    fatPct: number | null;
    deficit: number | null;
    pesoMeta: number | null;
  };
  /** Sexo del paciente: los cortes de varios indices son sexo-especificos. */
  sexoM: boolean;
  /**
   * Cifras del motor que GOBIERNA (`motorTratNutri`), no de la cadena. Llegan ya computadas porque su
   * lector es `server-only` y esto es una composicion pura.
   */
  sodioMax: number | null;
  protKg: number | null;
  protG: number | null;
  /** Diagnosticos personales DECLARADOS por el paciente (`d5_39`), crudos como los guarda la encuesta. */
  d5_39: string | null;
  /** Banderas de la ruta activa, para los bloques condicionales de recomendaciones. */
  flags: { tieneHTA: boolean; tieneIRC: boolean };
  /** Deficit de la estrategia sellada; > 0 significa exceso de grasa. */
  deficitEstrategia: number;
  /** Peso del paciente, SOLO para traducir la hidratacion a litros y vasos. null = se deja en mL/kg. */
  pesoKg: number | null;
};

export type HcCompuesta = {
  severidades: Record<string, number>;
  indices: IndiceAniResuelto[];
  plan: HcPlanNutricional | null;
  /** Diagnosticos declarados ya decodificados (la encuesta guarda multi-seleccion como JSON). */
  diagnosticos: string[];
  recomendaciones: RecomendacionBloque[];
};

/**
 * Decodifica un campo de multi-seleccion de la encuesta.
 *
 * Vive aqui y no en la pagina porque es exactamente la clase de detalle que se reescribe distinto en el
 * segundo sitio: `Array.isArray` sobre una cadena JSON da false, y esa misma confusion ya nos costo TODAS
 * las comorbilidades del motor de nutricion.
 */
function decodificarMulti(raw: string | null): string[] {
  const t = (raw ?? "").trim();
  if (t === "" || t === "[]") return [];
  if (!t.startsWith("[")) return [t];
  try {
    const arr: unknown = JSON.parse(t);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [t];
  }
}

/** Arma los seis bloques de la historia que antes se componian sueltos en la pagina. */
export function componerHistoriaClinica(e: HcEntradas): HcCompuesta {
  const severidades = e.snapshot
    ? (indicatorSeverities(e.snapshot as never) as Record<string, number>)
    : {};

  const indices = e.snapshot
    ? indicesAniAlterados(
        {
          IFC: e.snapshot.indicators.ifc ?? null,
          IRC: e.snapshot.indicators.irc ?? null,
          ISCM: e.snapshot.indicators.iscm ?? null,
          IEHH: e.snapshot.indicators.iehh ?? null,
          EB: e.snapshot.indicators.eb ?? null,
          IAE: e.snapshot.indicators.iae ?? null,
          PABU: e.snapshot.indicators.pabu ?? null,
          "ICA-BIS": e.snapshot.indicators.icaBis ?? null,
        },
        e.snapshot.classifications as never,
        severidades,
        e.sexoM,
      )
    : [];

  // LA CADENA EFECTIVA, la misma funcion que usan el panel y el plan del paciente. Un documento clinico no
  // puede registrar una cifra que nadie prescribio.
  const efectivo = e.suggested ? computeProtocoloEfectivo(e.suggested, e.ajustes).calorico : null;

  const plan: HcPlanNutricional | null = efectivo
    ? {
        geb: efectivo.geb,
        get: efectivo.get,
        kcalObjetivo: efectivo.kcalObj,
        proteinaG: efectivo.protG,
        proteinaGKg: efectivo.protGKg,
        carbohidratosG: efectivo.choG,
        grasasG: efectivo.fatG,
        actividadFisica: `PAL ${efectivo.pal}`,
        // EL SODIO YA SE CALCULA: el motor de prescripcion lleva conectado desde el 2026-08-31. Este bloque
        // decia "se emitira cuando se incorpore el motor", que era cierto al escribirlo y dejo de serlo sin
        // que nadie volviera a esa linea.
        sodioMax: e.sodioMax,
      }
    : null;

  const diagnosticos = decodificarMulti(e.d5_39);

  const recomendaciones = recomendacionesDe({
    diagnosticos,
    tieneHTA: e.flags.tieneHTA,
    tieneIRC: e.flags.tieneIRC,
    // El corte del FFMI bajo es el del clasificador; se lee del indicador, no se reescribe.
    sarcopenia: e.snapshot ? e.snapshot.indicators.FFMI > 0 && e.snapshot.indicators.FFMI < 17 : false,
    exceso: e.deficitEstrategia > 0,
    // Las cifras del motor que gobierna. Con ellas, tres de los cuatro bloques que esperaban dejan de
    // esperar; el cuarto (exceso de grasa) cita el objetivo calorico, que es lo que sigue preguntado.
    sodioMax: e.sodioMax,
    protKg: e.protKg,
    protG: e.protG,
    pesoKg: e.pesoKg,
  });

  return { severidades, indices, plan, diagnosticos, recomendaciones };
}
