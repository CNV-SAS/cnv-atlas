import type { CohorteDeInvestigacion } from "../data/cohorte-reader";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL CSV DEL RESUMEN DE LA COHORTE  ·  (Santiago, 2026-10-30: "la exportacion registrada")
//
// ═══ QUE SE EXPORTA, Y SOBRE TODO QUE NO ═══
//
// LO QUE SALE ES EL RESUMEN AGREGADO, el mismo que el panel pinta: ni una fila de paciente, ni un
// `patient_id`, ni una fecha de nacimiento. Es lo que un protocolo o un articulo necesita para su tabla
// descriptiva ("de 513 consultas vigentes, 316 autorizadas, 212 con diagnostico sellado...").
//
// LO QUE *NO* SALE ES EL DATASET FILA A FILA, y no por falta de tiempo: el propio panel ya lo dice y lo
// CALCULA (`nivelDeAnonimizacion`), un export fila a fila de esta cohorte seria SEUDONIMIZADO, o sea dato
// personal bajo la Ley 1581, y la verificacion de k-anonimato que `DATA_GOVERNANCE.md` exige para un
// export externo todavia no esta construida. Abrir ese camino aqui seria sacar datos personales de la
// clinica por una ruta sin ese control, que es exactamente lo que el nivel derivado existe para impedir.
//
// Asi que esta exportacion es `aggregate` por CONSTRUCCION, no por rotulo: el nivel se deriva de
// `CIFRAS_DEL_PANEL`, que es la forma que este archivo tiene.
//
// ═══ LAS CIFRAS SALEN DEL MISMO LECTOR QUE LA PANTALLA ═══
//
// `leerCohorteDeInvestigacion`, la misma llamada. Un CSV que recalculara por su cuenta podria entregar
// otras cifras que las que el investigador acaba de leer en pantalla, y entonces una de las dos miente.
//
// ═══ MODULO PURO ═══
//
// Sin BD y sin `server-only`: recibe el resumen y devuelve texto, asi que un test puede comprobar el
// archivo entero sin base. Quien lo llama (la ruta) se encarga de registrar la entrega.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Una fila del CSV: concepto, cifra y la nota que dice de que es la cifra. */
type Fila = [concepto: string, valor: string | number, nota: string];

/**
 * Escapa un campo de CSV. Las notas llevan comas y comillas, y sin esto una sola coma parte la fila y
 * corre las columnas del resto del archivo (el defecto clasico del CSV escrito a mano).
 */
function campo(v: string | number): string {
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * El resumen de la cohorte como CSV.
 *
 * SEPARADOR COMA Y BOM, por lo mismo que el export de respuestas: Excel en español abre un CSV con BOM
 * sin preguntar la codificacion, y sin el los acentos salen partidos.
 *
 * LA PROCEDENCIA VA DENTRO DEL ARCHIVO, no solo en el nombre: un CSV que viaja por correo pierde el
 * nombre en cuanto alguien lo renombra, y entonces nadie sabe de que dia son las cifras ni quien las
 * saco. Es la misma razon por la que el export de respuestas lleva su cabecera.
 */
export function resumenDeLaCohorteACsv(
  cohorte: CohorteDeInvestigacion,
  procedencia: { generadoEl: string; generadoPor: string },
): string {
  const filas: Fila[] = [
    ["Generado el", procedencia.generadoEl, "fecha de la exportación"],
    ["Generado por", procedencia.generadoPor, "quien la pidió"],
    [
      "Nivel de anonimización",
      "aggregate",
      "solo cifras por cohorte: ni una fila de paciente cruza este archivo",
    ],
    [
      "Consultas vigentes",
      cohorte.vigentes,
      "de pacientes reales, no reemplazadas por una corrección y no retiradas (migración 0224)",
    ],
    [
      "Consultas autorizadas para investigación",
      cohorte.conAutorizacion,
      `${cohorte.pacientesAutorizados} pacientes distintos`,
    ],
    [
      "De ellas, con diagnóstico sellado",
      cohorte.conDiagnostico,
      "las únicas que tienen indicadores del modelo",
    ],
    [
      "Fuera, sin autorización",
      cohorte.sinAutorizacion,
      "la autorización de investigación es opcional; se cuenta directo, no por resta",
    ],
    [
      "Fuera por calidad de dato (huella repetida)",
      cohorte.fueraPorHuellaRepetida.consultas,
      `${cohorte.fueraPorHuellaRepetida.grupos} grupos, ${cohorte.fueraPorHuellaRepetida.pacientes} pacientes: la misma toma física en dos historias`,
    ],
    [
      "Importadas del HTML y autorizadas",
      cohorte.importadas,
      `de ${cohorte.importadasVigentes} importadas vigentes; el consentimiento del HTML no tenía casilla de investigación`,
    ],
  ];

  // LOS DESGLOSES VAN DEBAJO, cada uno con su encabezado propio: un CSV de dos columnas con tres tablas
  // distintas pegadas se abre bien y se lee mal. Con un encabezado por bloque, cada tabla se entiende.
  const lineas: string[] = [
    ["Concepto", "Valor", "Nota"].join(","),
    ...filas.map((f) => f.map(campo).join(",")),
  ];

  if (cohorte.sinAutorizacionPorRazon.length > 0) {
    lineas.push("", ["Por qué queda fuera", "Consultas", "Pacientes"].join(","));
    for (const r of cohorte.sinAutorizacionPorRazon) {
      lineas.push([r.razon, r.consultas, r.pacientes].map(campo).join(","));
    }
  }

  if (cohorte.porMes.length > 0) {
    lineas.push("", ["Mes de la medición", "Consultas autorizadas", ""].join(","));
    for (const m of cohorte.porMes) {
      lineas.push([m.mes, m.evaluaciones, ""].map(campo).join(","));
    }
  }

  if (cohorte.porVersionDelMotor.length > 0) {
    lineas.push("", ["Versión del motor sellada", "Consultas", ""].join(","));
    for (const v of cohorte.porVersionDelMotor) {
      lineas.push([v.version, v.evaluaciones, ""].map(campo).join(","));
    }
  }

  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** El nombre del archivo, con la fecha: dos exportaciones del mismo dia se distinguen por su contenido. */
export function nombreDelResumen(generadoEl: string): string {
  return `atlas-cohorte-investigacion-${generadoEl}.csv`;
}

/**
 * El ALCANCE con el que la entrega queda registrada en `research_datasets`.
 *
 * SE DERIVA DE LAS CIFRAS, no es un texto fijo: el registro tiene que poder contestar QUE se entrego sin
 * tener el archivo delante. Dos entregas del mismo dia con cohortes distintas se distinguen aqui.
 */
export function alcanceDelResumen(cohorte: CohorteDeInvestigacion, generadoEl: string): string {
  return (
    `Resumen agregado de la cohorte al ${generadoEl}: ${cohorte.conAutorizacion} consultas autorizadas ` +
    `de ${cohorte.pacientesAutorizados} pacientes, ${cohorte.conDiagnostico} con diagnóstico sellado, ` +
    `sobre ${cohorte.vigentes} consultas vigentes. Sin filas de paciente.`
  );
}
