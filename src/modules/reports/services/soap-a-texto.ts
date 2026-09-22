import { decimalesEsp, fmtDec } from "@/lib/format/decimal";
import { sinGuionLargo } from "@/lib/format/guion";
import type { AlertasDelSoap, HistoriaClinicaSoap } from "../data/reports-view-types";

// ═══ EL SOAP COMO TEXTO PLANO, PARA COPIAR (Santiago, 2026-09-20) ═══
//
// DE DONDE SALE EL PEDIDO: una integrante usa la historia clinica COPIANDOLA y pegandola en otro sitio.
// El SOAP tiene que permitir lo mismo, y con un boton en vez de con el raton.
//
// TEXTO PLANO Y NO HTML, a proposito: lo que se pega va a un correo, a un WhatsApp o a otro sistema, y
// ahi el formato estorba mas de lo que ayuda (se pega con tipografias, tablas y colores que no encajan).
//
// LA MISMA FUENTE QUE LA PANTALLA: este modulo recibe el documento YA COMPUESTO. Si el texto se armara
// por su cuenta, lo copiado podria decir algo distinto de lo que se ve, que es la peor version de un
// documento clinico.
//
// PURO Y NEUTRO: lo llama la pantalla (cliente) para poner el texto en el portapapeles.

const nl = (partes: (string | null | undefined)[]): string =>
  partes.filter((p) => p != null && p !== "").join("\n");

/**
 * La anamnesis VIGENTE, tal como la pinta la pantalla. Se pasa aparte porque no vive en el documento SOAP
 * (es una tabla propia, append-only) y el texto copiado tiene que decir lo MISMO que se ve.
 *
 * FUE UN DEFECTO REAL (smoke de Santiago, 2026-09-20): el boton copiaba un documento SIN la anamnesis que
 * el profesional acababa de escribir, y esa es la peor version del problema: lo copiado y lo mostrado
 * diciendo cosas distintas del mismo acto clinico.
 */
export type AnamnesisVigente = { texto: string; autor: string; profesion: string | null; fecha: string } | null;

/**
 * La clasificacion detras de la cifra. Va entre parentesis, salvo que ella misma los traiga ("Ganancia real
 * (no agua/grasa)", rotulo de su clasificador que no se toca): entonces va tras un punto medio, para no dejar
 * parentesis anidados (Santiago, 2026-09-22).
 */
export function conClasificacion(clasificacion: string | null | undefined): string {
  if (!clasificacion) return "";
  return clasificacion.includes("(") ? ` · ${clasificacion}` : ` (${clasificacion})`;
}

export function soapATexto(
  soap: HistoriaClinicaSoap,
  fechaFormateada: string,
  anamnesis: AnamnesisVigente = null,
): string {
  const edad = soap.edad != null ? `${soap.edad} años` : null;
  const medidas = [
    soap.objetivo.pesoKg != null ? `Peso: ${fmtDec(soap.objetivo.pesoKg)} kg` : null,
    soap.objetivo.tallaCm != null ? `Talla: ${fmtDec(soap.objetivo.tallaCm)} cm` : null,
  ].filter(Boolean);

  const cabecera = nl([
    "HISTORIA CLÍNICA (SOAP)",
    `Paciente: ${soap.paciente}${edad ? ` · ${edad}` : ""}${soap.sexo ? ` · ${soap.sexo}` : ""}`,
    `Profesional: ${soap.profesional}`,
    `Fecha de la consulta: ${fechaFormateada}`,
  ]);

  const s = nl([
    "S · SUBJETIVO",
    // ABRE EL APARTADO, igual que en la pantalla: es lo que el profesional escribe para arrancar el relato.
    anamnesis
      ? `Anamnesis (${anamnesis.autor}${anamnesis.profesion ? ", " + anamnesis.profesion : ""}, ${anamnesis.fecha}): ${anamnesis.texto}`
      : null,
    soap.subjetivo.motivos.length ? `Motivo de consulta: ${soap.subjetivo.motivos.join(", ")}.` : null,
    ...soap.subjetivo.antecedentes.map((a) => `${a.grupo}: ${a.items.join(", ")}.`),
    ...soap.subjetivo.encuesta.map((p) => `${p.dominio}. ${p.texto}`),
  ]);

  const o = nl([
    "O · OBJETIVO",
    medidas.length ? medidas.join(" · ") : null,
    ...soap.objetivo.composicion.map(
      (c) => `${c.etiqueta}: ${c.valor}${conClasificacion(c.clasificacion)}`,
    ),
    soap.objetivo.indices.length ? "Índices alterados:" : null,
    ...soap.objetivo.indices.map(
      (i) => `  ${i.nombre}: ${i.valor}${conClasificacion(i.clasificacion)}`,
    ),
  ]);

  const a = nl([
    "A · ANÁLISIS",
    ...alertasEnTexto(soap.analisis.alertas),
    soap.analisis.resumenProfesional,
    soap.analisis.dfiParrafo,
    soap.analisis.metaTerapeutica ? `Meta terapéutica: ${soap.analisis.metaTerapeutica}` : null,
    soap.analisis.motivoSinNarrativa,
    soap.analisis.rutas.length
      ? `Rutas de atención: ${soap.analisis.rutas.map((r) => r.label).join(", ")}.`
      : null,
  ]);

  const plan = soap.plan.nutricional;
  const p = nl([
    "P · PLAN",
    soap.plan.objetivoModelo,
    soap.plan.objetivoTratamiento,
    plan
      ? nl([
          plan.kcalObjetivo != null ? `Energía: ${plan.kcalObjetivo} kcal/día` : null,
          plan.proteinaG != null
            ? `Proteína: ${plan.proteinaG} g${plan.proteinaGKg != null ? ` (${fmtDec(plan.proteinaGKg)} g/kg)` : ""}`
            : null,
          plan.carbohidratosG != null ? `Carbohidratos: ${plan.carbohidratosG} g` : null,
          plan.grasasG != null ? `Grasas: ${plan.grasasG} g` : null,
          plan.actividadFisica ? `Actividad física: ${decimalesEsp(plan.actividadFisica)}` : null,
        ])
      : null,
    ...soap.plan.recomendaciones.map((r) => `${r.titulo}: ${r.items.join("; ")}.`),
    soap.plan.remisionesExigidas.length
      ? `Remisiones indicadas por el modelo: ${soap.plan.remisionesExigidas
          .map((r) => `${r.destino} (${sinGuionLargo(r.urgencia)}${r.registrada ? ", registrada" : ", sin registrar"})`)
          .join("; ")}.`
      : null,
    soap.plan.remisiones.length
      ? `Remisiones registradas: ${soap.plan.remisiones.map((r) => `${r.profesion} (${r.estado})`).join("; ")}.`
      : null,
    // EL RASTRO NO VIAJA (Santiago, 2026-09-20). "Esta observacion reemplaza a 2 anteriores, desde el
    // 19/9..." es contabilidad de Atlas: habla de como guardamos las notas, no de la consulta. En la
    // PANTALLA si va (ahi el profesional decide si mira el historial); en un SOAP que se pega en otro
    // sistema es ruido que nadie puede accionar.
    ...soap.plan.observaciones.map((ob) => `Observación (${ob.fecha}): ${ob.texto}`),
    soap.plan.proximaCita ? `Próxima consulta: ${soap.plan.proximaCita}` : null,
  ]);

  // EL AVISO DE LAS CIFRAS VIVAS NO VIAJA CON LO COPIADO (Santiago, 2026-09-22). Es operativo: dice en que
  // punto del flujo de Atlas esta el plan, no algo de la consulta, y es la misma regla que ya saco de lo
  // copiado la linea de rastro de las observaciones. En la pantalla sigue el recuadro, que es donde se acciona.
  return nl([cabecera, "", s, "", o, "", a, "", p]);
}

// LAS ALERTAS DE LA A, linea por linea. Vive aqui y no junto a su composicion porque este modulo corre en el
// NAVEGADOR (el boton de copiar): importar aquel arrastraria el motor de alertas al cliente, y aqui solo
// hace falta la forma ya compuesta.
/** Las mismas alertas, como lineas de texto para el portapapeles. */
function alertasEnTexto(alertas: AlertasDelSoap | null): string[] {
  if (!alertas) return [];
  const lineas: string[] = [];
  if (alertas.reglas) lineas.push(`Alertas de la consulta: ${alertas.reglas}.`);
  if (alertas.rojas.length) {
    lineas.push("Respuestas de la encuesta en rojo:");
    for (const g of alertas.rojas) lineas.push(`  ${g.dominio}: ${g.respuestas.join("; ")}.`);
  }
  return lineas;
}
