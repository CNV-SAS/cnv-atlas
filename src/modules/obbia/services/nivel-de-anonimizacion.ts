// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL NIVEL DE ANONIMIZACION SE DERIVA, NO SE TECLEA  (Gildardo, 2026-10-24)
//
// *"Abre el vocabulario a pseudonymized, cerrado con CHECK o enum, y que el nivel se derive de lo que el
// export quita."*
//
// ═══ POR QUE DERIVARLO ES EL PUNTO, Y NO UN DETALLE ═══
//
// Porque el rotulo decide COSAS: si un dataset es `anonymized` deja de ser dato personal, CNV puede ser
// propietaria de sus derivados y no hace falta consentimiento adicional. Si alguien lo teclea, el rotulo
// acaba diciendo lo que conviene, y nadie que lo lea despues puede distinguir un dataset de verdad
// anonimizado de uno al que le quitaron el nombre. Derivarlo de la FORMA del export vuelve el rotulo una
// consecuencia de lo que el archivo lleva, que es lo unico verificable.
//
// Y hay una razon concreta en este proyecto: `docs/DATA_GOVERNANCE.md` lo advierte literalmente, *"quitar
// el identificador directo no basta para anonimizar. Los cuasi-identificadores re-identifican en
// combinacion"*, y la columna llevaba dos anos aceptando cualquier texto.
//
// ═══ MODULO PURO ═══
//
// Sin BD, sin React, sin `server-only`: lo puede llamar el lector que genera un dataset, la pantalla que
// avisa de que nivel saldria, y una prueba que lo corre con las cuatro formas posibles.
//
// ═══ LAS DEFINICIONES NO SON NUESTRAS ═══
//
// Salen de `docs/DATA_GOVERNANCE.md`, que es el documento que gobierna esto. Cada umbral lleva su linea
// al lado, que es la regla de este repositorio para cualquier cifra que decida sobre un dato.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * EL VOCABULARIO COMPLETO, y es el mismo que el CHECK de la migracion 0227. Un candado compara las dos
 * listas: si una crece y la otra no, la base rechazaria en runtime un nivel que el codigo cree valido.
 */
export const NIVELES_DE_ANONIMIZACION = ["aggregate", "pseudonymized", "anonymized"] as const;

export type NivelDeAnonimizacion = (typeof NIVELES_DE_ANONIMIZACION)[number];

/**
 * K MINIMO PARA PODER LLAMAR ANONIMIZADO A UN DATASET.
 *
 * FUENTE: `docs/DATA_GOVERNANCE.md`, "Anonimizacion real (estandar tecnico)", punto 3: *"Verificar
 * k-anonimato: ningun registro debe ser unico en la combinacion de cuasi-identificadores. k >= 5 para
 * exports externos."* El propio documento lo marca **PENDIENTE JURIDICO** de ratificacion, y por eso el
 * resultado de este modulo lo arrastra: un nivel `anonymized` sale con la bandera puesta.
 *
 * NO es una cifra nuestra. Si la ratificacion juridica cambia el umbral, se cambia aqui y en el documento.
 */
export const K_MINIMO_PARA_ANONIMIZAR = 5;

/**
 * LO QUE EL EXPORT LLEVA. No es "que nivel quiero", es "que hay en el archivo": de ahi sale el nivel.
 */
export type FormaDelExport = {
  /**
   * Si hay una fila por paciente (o por consulta de un paciente), o solo cifras por cohorte.
   *
   * Un agregado no es re-identificable fila a fila, que es la regla 3 del uso agregado del documento:
   * *"Solo uso AGREGADO por cohortes, nunca fila a fila re-identificable."*
   */
  filaPorPaciente: boolean;
  /**
   * Si las filas llevan una llave que permite VOLVER A UNIR los registros de una misma persona: el
   * `patient_id`, o un `research_id` estable.
   *
   * ESO ES SEUDONIMIZACION, no anonimizacion, y el documento lo dice de las dos formas: la operacion del
   * dia a dia es seudonimizada porque *"la data clinica cuelga de patient_id (UUID)... Sigue siendo dato
   * personal bajo Ley 1581"*, y la investigacion interna *"puede usar un research_id estable para analisis
   * longitudinal"*, que es exactamente la capacidad que lo mantiene como dato personal.
   */
  llaveQueRelaciona: boolean;
  /**
   * Los cuasi-identificadores que las filas llevan SIN generalizar (ciudad en vez de region, fecha de
   * nacimiento exacta en vez de rango, etnia en una categoria minoritaria).
   *
   * El documento pide generalizarlos (punto 2 del estandar) y advierte aparte que en grupos minoritarios
   * *"la etnia es casi un identificador directo"*: en Colombia hay menos de 3.000 personas Rrom.
   */
  cuasiIdentificadoresSinGeneralizar: readonly string[];
  /**
   * El k-anonimato VERIFICADO sobre la combinacion de cuasi-identificadores. `null` = no se verifico.
   *
   * NO VERIFICADO NO ES CERO NI ES OK: es "no se sabe", y no se sabe no puede rotularse anonimizado. La
   * verificacion en si no esta construida todavia, asi que hoy este campo llega null siempre; el parametro
   * existe para que el dia que se construya, el nivel salga de ella y no de una decision.
   */
  kVerificado: number | null;
};

export type NivelDerivado = {
  nivel: NivelDeAnonimizacion;
  /** Por que ese y no otro, en una frase que se pueda pegar en el rotulo del dataset. */
  porQue: string;
  /**
   * `true` cuando el nivel depende del umbral que el documento marca PENDIENTE JURIDICO. Quien genere el
   * dataset tiene que decirlo: un `anonymized` emitido antes de la ratificacion es una afirmacion legal
   * que todavia nadie firmo.
   */
  pendienteJuridico: boolean;
};

/**
 * EL NIVEL QUE LE CORRESPONDE A UN EXPORT POR LO QUE LLEVA.
 *
 * El orden de las preguntas no es arbitrario: va de lo que mas protege a lo que menos, y la primera que
 * se cumple manda. Asi, un error de omision (no pasar un cuasi-identificador que si viaja) rotula el
 * dataset como MAS identificable, nunca como menos.
 */
export function nivelDeAnonimizacion(forma: FormaDelExport): NivelDerivado {
  // 1. SIN FILAS POR PACIENTE no hay a quien re-identificar: son cifras de cohorte.
  if (!forma.filaPorPaciente) {
    return {
      nivel: "aggregate",
      porQue: "Solo lleva cifras por cohorte: ninguna fila corresponde a una persona.",
      pendienteJuridico: false,
    };
  }

  // 2. CON UNA LLAVE QUE RELACIONA es seudonimizado por definicion, y no hay nada que discutir: la
  //    capacidad de volver a unir los registros de alguien es lo que lo mantiene como dato personal.
  if (forma.llaveQueRelaciona) {
    return {
      nivel: "pseudonymized",
      porQue:
        "Cada fila lleva una llave estable del paciente, así que sus registros se pueden volver a unir. " +
        "Sigue siendo dato personal (Ley 1581): sirve para investigación interna con la autorización del " +
        "paciente, no para compartir fuera.",
      pendienteJuridico: false,
    };
  }

  // 3. SIN LLAVE PERO CON CUASI-IDENTIFICADORES SIN GENERALIZAR tampoco esta anonimizado. Es el aviso
  //    textual del documento: quitar el identificador directo no basta.
  if (forma.cuasiIdentificadoresSinGeneralizar.length > 0) {
    const lista = [...forma.cuasiIdentificadoresSinGeneralizar].sort().join(", ");
    return {
      nivel: "pseudonymized",
      porQue:
        `No lleva llave del paciente, pero sí cuasi-identificadores sin generalizar (${lista}), que ` +
        "re-identifican en combinación. Quitar el identificador directo no basta para anonimizar.",
      pendienteJuridico: false,
    };
  }

  // 4. SIN K VERIFICADO NO SE SABE, y lo que no se sabe no se rotula anonimizado.
  if (forma.kVerificado === null) {
    return {
      nivel: "pseudonymized",
      porQue:
        "No se verificó el k-anonimato, así que no se puede afirmar que ningún registro sea único en la " +
        "combinación de sus variables. Sin esa verificación el dataset no es anónimo, es seudonimizado.",
      pendienteJuridico: false,
    };
  }

  // 5. VERIFICADO PERO POR DEBAJO DEL UMBRAL: hay registros unicos o casi.
  if (forma.kVerificado < K_MINIMO_PARA_ANONIMIZAR) {
    return {
      nivel: "pseudonymized",
      porQue:
        `El k-anonimato verificado es ${forma.kVerificado}, por debajo del mínimo de ` +
        `${K_MINIMO_PARA_ANONIMIZAR} (DATA_GOVERNANCE.md): hay combinaciones que señalan a muy pocas ` +
        "personas, o a una.",
      pendienteJuridico: true,
    };
  }

  return {
    nivel: "anonymized",
    porQue:
      `Sin identificadores directos, sin llave del paciente, cuasi-identificadores generalizados y ` +
      `k-anonimato verificado en ${forma.kVerificado} (mínimo ${K_MINIMO_PARA_ANONIMIZAR}).`,
    pendienteJuridico: true,
  };
}

/**
 * LA FORMA DE UN EXPORT FILA A FILA DE `evaluaciones_para_investigacion`, TAL COMO ESTA HOY.
 *
 * Existe para que la pantalla pueda decir, sin que nadie lo calcule a mano, que nivel saldria si hoy se
 * generara un dataset de esa vista. Y la respuesta importa: la vista lleva `patient_id` (a proposito, es
 * lo que permite el analisis longitudinal), asi que un export suyo es SEUDONIMIZADO. Para producir uno
 * anonimizado hay que quitar esa columna, generalizar y verificar el k, y nada de eso esta construido.
 */
export const EXPORT_FILA_A_FILA_DE_LA_VISTA: FormaDelExport = {
  filaPorPaciente: true,
  // La vista `evaluaciones_vigentes` selecciona `e.patient_id` (migracion 0224).
  llaveQueRelaciona: true,
  cuasiIdentificadoresSinGeneralizar: [],
  kVerificado: null,
};

/**
 * SI ESE NIVEL SIGUE SIENDO DATO PERSONAL.
 *
 * Existe para que el encabezado del panel no lo afirme a mano (Gildardo, 2026-10-25): decia *"Solo data
 * agregada o anonimizada; nunca datos personales"* mientras el mismo panel, mas abajo, decia que un
 * dataset de esa cohorte seria seudonimizado y que eso SIGUE siendo dato personal. Las dos frases
 * describian lo mismo y se contradecian, que es el hazard 4 en un texto: no se arregla eligiendo una, se
 * arregla haciendo que las dos salgan de la misma fuente.
 *
 * Y LA DEFINICION NO ES NUESTRA: `docs/DATA_GOVERNANCE.md` dice que un dato seudonimizado sigue siendo
 * dato personal (la llave existe en otra parte), y que solo el anonimizado deja de serlo. De ahi que la
 * unica respuesta `false` sea `anonymized`.
 */
export function sigueSiendoDatoPersonal(nivel: NivelDeAnonimizacion): boolean {
  return nivel !== "anonymized";
}

/** La forma de lo que el panel de investigacion muestra hoy: cifras y agrupaciones, ni una fila. */
export const CIFRAS_DEL_PANEL: FormaDelExport = {
  filaPorPaciente: false,
  llaveQueRelaciona: false,
  cuasiIdentificadoresSinGeneralizar: [],
  kVerificado: null,
};
