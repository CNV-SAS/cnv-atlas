import "server-only";

import { computeIntercambio } from "@/clinical-engine/intercambio";
import { computeTiempos, TIEMPOS_DEF, tiemposVivos } from "@/clinical-engine/tiempos";
import { diaDelCiclo, DIAS_DEL_CICLO } from "@/clinical-engine/menu-ciclo";
import { getPrescripcionNutricional, getProtKgPrescrito } from "@/modules/treatment/data/dieta-resumen-reader";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";
import { computeProtocoloEfectivo } from "@/clinical-engine";
import type { EngineOutput } from "@/clinical-engine";

import { recomendacionesDe } from "./hc-recomendaciones";
import type { FilaDistribucion, PlanPaciente } from "./reports-view-types";

export type { FilaDistribucion, PlanPaciente };

// EL PLAN QUE RECIBE EL PACIENTE (Gildardo §7.1, 2026-08-26).
//
// SU LISTA, literal: "el paciente recibe el plan completo, no solo el informe de composición: el
// diagnóstico, la meta y los objetivos, el plan dietético, el ejemplo de menú, la distribución por
// porciones, las recomendaciones automáticas según el caso, y la lista de intercambio -no la lista
// completa, sino los alimentos principales por región o ciudad-".
//
// SEIS DE LOS SIETE SE ARMAN AQUI. El septimo, la lista recortada por region, NO: su `INTER_TABLA_B` es
// nacional y no existe el mapa de que alimentos corresponden a cada region. Esta preguntado (P2 de la
// ronda del 31) y se suma cuando responda. El plan es util sin ella; sin las otras seis, no.
//
// NO ES UN DOCUMENTO NUEVO: entra en el reporte que el paciente YA recibe. Mandarle dos documentos por la
// misma consulta seria repetir lo que acabamos de cerrar en la subpestaña del nutricionista, donde el
// defecto era el mismo (dos sitios diciendo lo mismo del mismo dato).
//
// SE COMPONE DE LOS LECTORES QUE YA EXISTEN (`getTreatmentProtocol`, `getPrescripcionNutricional`) en vez
// de consultar por su cuenta: dos formas de armar el mismo insumo es como el motor de nutricion termino
// viendo cero comorbilidades. Aqui solo se DA FORMA a lo que esos lectores devuelven.

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/**
 * Arma el plan del paciente para una evaluación. `null` si la evaluación no tiene tratamiento con
 * protocolo sellado: sin cadena calórica no hay plan que entregar, y un plan a medias es peor que ninguno.
 */
export async function getPlanPaciente(
  evaluationId: string,
  snapshot: EngineOutput,
): Promise<PlanPaciente | null> {
  const protocol = await getTreatmentProtocol(evaluationId);
  const snap = protocol?.protocolSuggested;
  if (!protocol || !snap) return null;

  // La proteína del motor, para los snapshots anteriores al 2026-09-03 (los nuevos la traen sellada).
  // Va antes porque la cadena la necesita, y no depende de nada que la cadena produzca.
  const protKgVigente = await getProtKgPrescrito(
    evaluationId,
    snapshot.sexo,
    snapshot.indicators as unknown as Record<string, unknown>,
  );

  // La cadena EFECTIVA, la misma que ve el nutricionista en su pantalla. No se recalcula con otros
  // criterios: el paciente tiene que recibir el mismo objetivo que su profesional prescribió.
  const efectivo = computeProtocoloEfectivo(snap, {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    deficit: protocol.adjDeficit,
    pesoMeta: protocol.pesoMetaFijado,
  }, { protKgVigente });
  const kcalObjetivo = Math.round(efectivo.calorico.kcalObj);

  const prescripcion = await getPrescripcionNutricional(
    evaluationId,
    snapshot.sexo,
    snapshot.indicators as unknown as Record<string, unknown>,
    efectivo.pesoEfectivo,
    kcalObjetivo,
    efectivo.calorico.pal,
  );

  // PORCIONES: las que el profesional guardó, y si no las que la cadena calcula. Es la misma resolución
  // que hace su pantalla; el paciente no puede recibir un reparto distinto del que el nutricionista ve.
  const porciones: Record<string, number> = {};
  for (const a of computeIntercambio(kcalObjetivo)) {
    porciones[a.sub] = protocol.intercambioPorciones?.porciones[a.sub] ?? a.porciones;
  }

  const activos = protocol.tiemposActivos ?? Object.fromEntries(TIEMPOS_DEF.map((t) => [t.id, true]));
  const vivos = tiemposVivos(activos);
  const auto = computeTiempos(porciones, activos);

  // La distribución: los overrides del profesional PISAN el reparto automático, igual que en su pantalla.
  // Y solo viajan los alimentos con porciones: una fila en cero no le dice nada a nadie.
  const distribucion: FilaDistribucion[] = [];
  for (const [alimento, fila] of Object.entries(auto)) {
    const porTiempo = vivos
      .map((t) => ({
        tiempo: t.n,
        porciones: protocol.tiempos?.celdas?.[alimento]?.[t.id] ?? fila[t.id] ?? 0,
      }))
      .filter((x) => x.porciones > 0);
    if (porTiempo.length) distribucion.push({ alimento, porTiempo });
  }

  // EL MENU: siete días, no los veintiuno del ciclo. Su §7.1 dice "ejemplo de menú", y veintiún días de
  // comidas en un PDF es un documento que nadie lee. Los siete salen del ciclo del paciente, con los
  // overrides que el nutricionista escribió.
  const diaInicio = protocol.menuSemanal?.diaInicio ?? 0;
  const menu = Array.from({ length: 7 }, (_, d) => {
    const delCiclo = diaDelCiclo(diaInicio, d) as unknown as Record<string, string | undefined>;
    return {
      dia: DIAS_SEMANA[d] ?? `Día ${d + 1}`,
      comidas: vivos
        .map((t) => ({
          tiempo: t.n,
          texto: protocol.menuSemanal?.celdas?.[`${d}_${t.id}`] ?? delCiclo[t.id] ?? "",
        }))
        .filter((c) => c.texto.trim() !== ""),
    };
  }).filter((d) => d.comidas.length > 0);

  // LA PROTEINA QUE VE EL PACIENTE ES LA EFECTIVA, no la del motor (defecto del smoke, 2026-09-03).
  //
  // QUE PASABA: las cifras del plan salian enteras de `prescripcion`, que es lo que PRESCRIBE el modelo.
  // El ajuste del profesional no llegaba a ninguna: si fijaba 3 g/kg en la calculadora, su pantalla decia
  // 3 y el plan del paciente decia 1. **El paciente recibia una prescripcion distinta de la que su
  // profesional habia fijado**, y por los CUATRO caminos, porque los cuatro salen de este lector: el plan
  // impreso, el PDF de la ruta, y las dos llamadas del envio por correo.
  //
  // POR QUE NO LO ARREGLO EL PARCHE DE AYER: aquel cableo `protKgVigente` a `computeProtocoloEfectivo`,
  // que es correcto pero alimenta el OBJETIVO CALORICO y el peso; la proteina que se imprime nunca miraba
  // esa cadena. El arreglo estaba en el archivo correcto y sobre el valor equivocado.
  //
  // QUE SE SUSTITUYE Y QUE NO: solo la PROTEINA, que es la unica cifra de la prescripcion con override del
  // profesional (`adj_prot_gkg`). El sodio y la grasa saturada no lo tienen, asi que siguen saliendo del
  // motor tal cual. Sustituir la fila entera habria borrado su referencia (ESPEN 2023) sin motivo.
  const protGKgEfectiva = efectivo.calorico.protGKg;
  const protGEfectiva = Math.round(efectivo.calorico.protG);

  const recs = recomendacionesDe({
    diagnosticos: [],
    tieneHTA: snap.flags.tieneHTA,
    tieneIRC: snap.flags.tieneIRC,
    sarcopenia: snapshot.indicators.FFMI > 0 && snapshot.indicators.FFMI < 17,
    exceso: (snap.estrategia.deficit ?? 0) > 0,
    sodioMax: prescripcion?.sodioMax ?? null,
    // La EFECTIVA, no la del motor: el texto de la recomendacion habla de la proteina que este paciente
    // tiene prescrita, y esa es la que el profesional fijo.
    protKg: protGKgEfectiva,
    protG: protGEfectiva,
    // El PESO EFECTIVO, que es sobre el que se prescribe, no el actual: la hidratacion se traduce a los
    // litros y los vasos de ESTE plan. Su cifra por kilo se conserva entera y primero.
    pesoKg: efectivo.pesoEfectivo,
  });

  return {
    objetivoTexto: protocol.objetivoTexto,
    kcalObjetivo,
    pesoMeta: protocol.pesoMetaFijado,
    tipoDieta: prescripcion?.tipoEnergia ?? null,
    // Las filas CON CIFRA de su prescripción (proteína, sodio, grasa saturada), sin la referencia
    // bibliográfica: al paciente le sirve el número, no de qué guía sale. Eso es del profesional.
    prescripcion: (prescripcion?.filas ?? []).map((f) =>
      f.nombre === "Proteína"
        ? { nombre: f.nombre, valor: `${String(protGKgEfectiva).replace(".", ",")} g/kg` }
        : { nombre: f.nombre, valor: f.valor },
    ),
    atributos: prescripcion?.atributos ?? [],
    notasDelModelo: prescripcion?.notas ?? [],
    menu,
    tiemposActivos: vivos.map((t) => t.n),
    // SOLO LAS DEL PROFESIONAL. Las del MODELO ya salen arriba, en el bloque del plan dietetico, con su
    // cifra ("Sodio < 1.500 mg/dia") y sus atributos ("Hiposodica", "Patron DASH"). Repetirlas aqui sin el
    // numero seria decir dos veces lo mismo, y peor la segunda.
    restricciones: protocol.restricciones.filter((r) => r.trim() !== ""),
    distribucion,
    // Los bloques PENDIENTES no viajan: son avisos para el profesional ("esto se emitirá cuando..."), y en
    // el documento del paciente serían ruido sobre algo que no puede resolver.
    recomendaciones: recs
      .filter((r) => !r.pendiente)
      .map((r) => ({ titulo: r.titulo, lineas: r.items })),
  };
}

/** Los días del ciclo, expuesto para el candado: el menú del paciente son 7, no los 21 del ciclo. */
export const DIAS_MENU_PACIENTE = 7;
export { DIAS_DEL_CICLO };
