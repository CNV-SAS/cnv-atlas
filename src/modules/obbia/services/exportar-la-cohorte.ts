import type { CohorteDeInvestigacion } from "../data/cohorte-reader";
import {
  type CeldaConPacientes,
  conCeldasSuprimidas,
  K_ANONIMATO,
  ROTULO_SUPRIMIDO,
} from "./supresion-de-celdas";

/** El rotulo de cada eje de consolidado. Una sola fuente con la pantalla seria mejor, pero la pantalla es
 *  un Server Component y este modulo es PURO: el candado compara las dos listas. */
const ROTULO_DEL_EJE: Record<"pais" | "ciudad" | "sexo" | "profesional", string> = {
  pais: "Por país",
  ciudad: "Por ciudad",
  sexo: "Por sexo",
  profesional: "Por profesional",
};

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

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // DESDE AQUI, TODA TABLA PASA POR LA SUPRESION DE CELDAS  ·  k >= 5 (2026-11-03)
  //
  // Santiago, mirando el archivo: *"hoy trae celdas de 1 paciente (Maracaibo, 51 años). Eso no se puede
  // descargar así."* Y tiene razon: una fila que dice "Maracaibo · 1 consulta · 1 paciente · edad media
  // 51,0" no es una cifra agregada, es UNA PERSONA descrita por su ciudad y su edad. El rotulo del
  // archivo dice "agregado"; esa fila lo desmiente.
  //
  // Y DESDE EL 2026-11-03 ES CONDICION JURIDICA, no solo politica interna: k >= 5 y supresion de celdas
  // pequeñas aplicados TECNICAMENTE en toda salida comercializable, antes de la primera venta.
  //
  // LO SUPRIMIDO SE REUNE, NO SE BORRA (ver `supresion-de-celdas`): las columnas tienen que seguir
  // sumando el total, o un revisor no sabe si falta una categoria o si el dato esta mal.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  const bloques: { titulo: [string, string, string]; filas: CeldaConPacientes[] }[] = [
    {
      titulo: ["Por qué queda fuera", "Consultas", "Pacientes"],
      filas: cohorte.sinAutorizacionPorRazon.map((r) => ({
        grupo: r.razon,
        consultas: r.consultas,
        pacientes: r.pacientes,
      })),
    },
    // EL MES Y LA VERSION NO TRAEN CUENTA DE PACIENTES, asi que se mide sobre las CONSULTAS, y eso es
    // conservador por construccion: una consulta es de un paciente como mucho, asi que menos de k
    // consultas implica menos de k pacientes. Nunca deja pasar una celda pequeña; como mucho suprime una
    // que no hacia falta, y ese es el lado correcto del error.
    {
      titulo: ["Mes de la medición", "Consultas autorizadas", "Pacientes"],
      filas: cohorte.porMes.map((m) => ({
        grupo: m.mes,
        consultas: m.evaluaciones,
        pacientes: m.evaluaciones,
      })),
    },
    {
      titulo: ["Versión del motor sellada", "Consultas", "Pacientes"],
      filas: cohorte.porVersionDelMotor.map((v) => ({
        grupo: v.version,
        consultas: v.evaluaciones,
        pacientes: v.evaluaciones,
      })),
    },
    // LOS CONSOLIDADOS, que son los que de verdad reidentifican: ciudad, sexo, profesional y pais son
    // CUASI-IDENTIFICADORES, y combinados con la edad media de la fila describen a una persona.
    ...cohorte.estratos.map((e) => ({
      titulo: [ROTULO_DEL_EJE[e.eje], "Consultas", "Pacientes"] as [string, string, string],
      filas: e.filas.map((f) => ({
        grupo: f.grupo,
        consultas: f.consultas,
        pacientes: f.pacientes,
      })),
    })),
  ];

  let celdasSuprimidas = 0;
  for (const bloque of bloques) {
    if (bloque.filas.length === 0) continue;
    const { visibles, suprimida, cuantasSeSuprimieron } = conCeldasSuprimidas(bloque.filas);
    celdasSuprimidas += cuantasSeSuprimieron;
    if (visibles.length === 0 && !suprimida) continue;
    lineas.push("", bloque.titulo.join(","));
    for (const f of visibles) lineas.push([f.grupo, f.consultas, f.pacientes].map(campo).join(","));
    if (suprimida) {
      lineas.push([suprimida.grupo, suprimida.consultas, suprimida.pacientes].map(campo).join(","));
    }
  }

  // Y SE DICE CUANTAS SE SUPRIMIERON, arriba, junto al nivel: un archivo que calla lo que le falta se lee
  // como completo. Es la misma regla que el diccionario de su CNVResearch ("dice qué se retiró, no solo
  // qué queda") y la misma que gobierna la cifra de excluidos del panel.
  lineas.splice(
    3,
    0,
    [
      "Celdas suprimidas por k-anonimato",
      celdasSuprimidas,
      `k >= ${K_ANONIMATO}: las categorías con menos de ${K_ANONIMATO} pacientes se reúnen en "${ROTULO_SUPRIMIDO}"`,
    ]
      .map(campo)
      .join(","),
  );

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
    `sobre ${cohorte.vigentes} consultas vigentes. Sin filas de paciente. ` +
    // EL REGISTRO TIENE QUE PODER AFIRMAR EL CONTROL, no solo el contenido (2026-11-03). La condicion
    // juridica es que la supresion este aplicada TECNICAMENTE en toda salida; un registro que no la
    // nombra obliga a abrir el archivo para saber si se aplico, y de eso se trata justamente el registro.
    `Celdas suprimidas con k >= ${K_ANONIMATO}.`
  );
}
