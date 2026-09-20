import type { HistoriaClinicaSoap } from "../data/reports-view-types";

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

export function soapATexto(
  soap: HistoriaClinicaSoap,
  fechaFormateada: string,
  anamnesis: AnamnesisVigente = null,
): string {
  const edad = soap.edad != null ? `${soap.edad} años` : null;
  const medidas = [
    soap.objetivo.pesoKg != null ? `Peso: ${soap.objetivo.pesoKg} kg` : null,
    soap.objetivo.tallaCm != null ? `Talla: ${soap.objetivo.tallaCm} cm` : null,
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
      (c) => `${c.etiqueta}: ${c.valor}${c.clasificacion ? ` (${c.clasificacion})` : ""}`,
    ),
    soap.objetivo.indices.length ? "Índices alterados:" : null,
    ...soap.objetivo.indices.map(
      (i) => `  ${i.nombre}: ${i.valor}${i.clasificacion ? ` (${i.clasificacion})` : ""}`,
    ),
  ]);

  const a = nl([
    "A · ANÁLISIS",
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
            ? `Proteína: ${plan.proteinaG} g${plan.proteinaGKg != null ? ` (${plan.proteinaGKg} g/kg)` : ""}`
            : null,
          plan.carbohidratosG != null ? `Carbohidratos: ${plan.carbohidratosG} g` : null,
          plan.grasasG != null ? `Grasas: ${plan.grasasG} g` : null,
          plan.actividadFisica ? `Actividad física: ${plan.actividadFisica}` : null,
        ])
      : null,
    ...soap.plan.recomendaciones.map((r) => `${r.titulo}: ${r.items.join("; ")}.`),
    soap.plan.remisionesExigidas.length
      ? `Remisiones indicadas por el modelo: ${soap.plan.remisionesExigidas
          .map((r) => `${r.destino} (${r.urgencia}${r.registrada ? ", registrada" : ", sin registrar"})`)
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

  // EL AVISO DE LAS CIFRAS VIVAS VIAJA CON EL TEXTO. En la pantalla es un recuadro; en lo copiado tiene
  // que ir igual, porque lo copiado es lo que acaba pegado en otro sistema, sin el recuadro que lo decia.
  // EL AVISO SE DICE EN CLINICO, no en lenguaje de Atlas. "No tiene una emision registrada" nombra un
  // mecanismo nuestro; lo que el lector necesita saber es que ese plan todavia no se entrego y que por eso
  // las cifras pueden cambiar. Mismo hecho, dicho para quien lo lee fuera de aqui.
  const pie = soap.prescripcionSinEmitir
    ? "Nota: este plan todavía no se le ha entregado al paciente, así que sus cifras pueden cambiar."
    : null;

  return nl([cabecera, "", s, "", o, "", a, "", p, pie ? "" : null, pie]);
}
