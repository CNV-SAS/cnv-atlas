import { computeProtocoloEfectivo, type ProtocoloSnapshot } from "@/clinical-engine";
import { indicatorSeverities } from "@/clinical-engine/severity";

import { indicesAniAlterados, type IndiceAniResuelto } from "./hc-indices-ani";
import { recomendacionesDe, type RecomendacionBloque } from "./hc-recomendaciones";
import { asesoriaFuera } from "@/clinical-engine/frozen/atlas-asesoria-macro.js";
import type { AsesoriaMacro } from "@/modules/treatment/data/treatment-view-types";

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
  /**
   * Proteina que prescribe el motor, para los snapshots ANTERIORES al sellado (2026-09-03). Los nuevos la
   * traen dentro de `suggested.mtn` y esto se ignora. Obligatorio-y-nullable a proposito: un parametro
   * opcional que cambia una cifra clinica se queda sin cablear y nada truena.
   */
  protKgVigente: number | null;
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
  /**
   * La asesoria por diagnostico de los dos macros, para dejar CONSTANCIA en la historia de las cifras que
   * el profesional prescribio fuera de lo sugerido (P-109). Su punto 3 del 3-sep, textual: "lo que se
   * escriba fuera del rango queda en la historia clinica con el rango, la condicion y la razon".
   *
   * SE PASA LA ASESORIA Y NO EL AVISO YA CALCULADO, a proposito: la comparacion se hace AQUI, contra el
   * mismo efectivo que este composer imprime. Si cada llamador comparara por su cuenta, la historia
   * podria registrar una desviacion sobre una cifra distinta de la que muestra, que es el defecto de las
   * dos fuentes del mismo dato. El campo `fuera` que traiga no se lee.
   *
   * null = no se pudo calcular (sin encuesta o sin composicion). Entonces el bloque no sale, que NO es lo
   * mismo que decir "no hubo desviaciones": una ausencia no puede leerse como una afirmacion.
   */
  asesoria?: { prot: AsesoriaMacro; grasa: AsesoriaMacro } | null;
};

/** Una cifra prescrita fuera de lo que sugiere el diagnostico. Lo que la historia deja por escrito. */
export type HcDesviacionMacro = {
  /** "Proteína" o "Grasa". */
  macro: string;
  /** La cifra tal como se prescribio, con su unidad. */
  cifra: string;
  /** El texto de su `asesoriaFuera`: lleva el rango y las condiciones que lo pedian. */
  texto: string;
};

export type HcCompuesta = {
  severidades: Record<string, number>;
  indices: IndiceAniResuelto[];
  plan: HcPlanNutricional | null;
  /** Diagnosticos declarados ya decodificados (la encuesta guarda multi-seleccion como JSON). */
  diagnosticos: string[];
  recomendaciones: RecomendacionBloque[];
  /** Cifras prescritas fuera de lo sugerido. Vacio = no hubo (o no se pudo comparar; ver `asesoria`). */
  desviaciones: HcDesviacionMacro[];
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
  const efectivo = e.suggested
    ? computeProtocoloEfectivo(e.suggested, e.ajustes, { protKgVigente: e.protKgVigente }).calorico
    : null;

  const plan: HcPlanNutricional | null = efectivo
    ? {
        geb: efectivo.geb,
        get: efectivo.get,
        kcalObjetivo: efectivo.kcalObj,
        proteinaG: efectivo.protG,
        proteinaGKg: efectivo.protGKg,
        carbohidratosG: efectivo.choG,
        grasasG: efectivo.fatG,
        // EL PORCENTAJE DE GRASA, que faltaba (su punto 9 del 3-sep, encontrado revisando). La historia
        // imprimia los GRAMOS y no el porcentaje, y el porcentaje es el que el profesional FIJA: los
        // gramos salen de el. Un documento clinico que registra la consecuencia y no la decision no deja
        // reconstruir la prescripcion.
        grasasPct: efectivo.fatPct,
        actividadFisica: `PAL ${efectivo.pal}`,
        // EL SODIO YA SE CALCULA: el motor de prescripcion lleva conectado desde el 2026-08-31. Este bloque
        // decia "se emitira cuando se incorpore el motor", que era cierto al escribirlo y dejo de serlo sin
        // que nadie volviera a esa linea.
        sodioMax: e.sodioMax,
      }
    : null;

  // CONSTANCIA DE LAS CIFRAS FUERA DE LA REFERENCIA (P-109, porte de su bloque de la HC, L15622-15648).
  //
  // Se compara contra `efectivo`, que es lo que el profesional PRESCRIBIO, no contra la base del motor:
  // su propio codigo lo corrigio antes por lo mismo ("antes leia m.protKg/m.fatPct, que son siempre 0,8 y
  // 30: si el profesional los cambiaba, la historia seguia diciendo la base").
  //
  // NO BLOQUEA Y NO ALARMA. Solo deja escrito que se decidio asi, que es lo unico compatible con su §5
  // del 2026-08-27: ninguna cifra de la prescripcion lleva techo, piso, validacion ni advertencia.
  const desviaciones: HcDesviacionMacro[] = [];
  if (efectivo && e.asesoria) {
    const fueraProt = asesoriaFuera(efectivo.protGKg, e.asesoria.prot) as string | null;
    const fueraGrasa = asesoriaFuera(efectivo.fatPct, e.asesoria.grasa) as string | null;
    if (fueraProt) {
      desviaciones.push({
        macro: "Proteína",
        cifra: `${efectivo.protGKg} ${e.asesoria.prot.unidad}`,
        texto: fueraProt,
      });
    }
    if (fueraGrasa) {
      desviaciones.push({
        macro: "Grasa",
        cifra: `${efectivo.fatPct} ${e.asesoria.grasa.unidad}`,
        texto: fueraGrasa,
      });
    }
  }

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

  return { severidades, indices, plan, diagnosticos, recomendaciones, desviaciones };
}
