import { ENGINE_VERSION, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";

// ═══ CON QUE SE ESTA DIAGNOSTICANDO HOY (Santiago, 2026-09-10) ═══
//
// LA RAZON, suya y verificada antes de construir: "hoy nadie puede responder desde Atlas con que version
// del motor se esta diagnosticando". Es literal. `engine_version` aparecia en DOS sitios de la interfaz y
// los dos DENTRO de un texto de fallo: el aviso de que un diagnostico viejo no puede mostrarse
// (`evaluation-results.tsx`) y el de que dos evaluaciones de un seguimiento cruzan versiones distintas
// (`followup-comparison.tsx`). La version solo se veia cuando algo iba mal.
//
// MODULO NEUTRO A PROPOSITO (sin "use client" ni `server-only`). Lee del motor y de modulos puros, asi
// que lo pueden importar los dos lados sin arrastrar nada. Es la forma que ya nos costo dos caidas en
// produccion: ver la nota de `patients/columnas.ts`.

/**
 * ═══ CUANTAS VERSIONES HAY DE VERDAD, Y UN SOLO JUEGO DE NOMBRES (Santiago, 2026-09-10) ═══
 *
 * SU PREGUNTA: el pie del diagnostico dice "Motor · modelo · reglas" y el taller decia "Modelo ANI-BIS-E ·
 * Protocolo de tratamiento". Dos juegos de nombres para cosas que se solapan, y van a preguntar.
 *
 * VERIFICADO EN EL CODIGO: son CUATRO, no tres, y ninguna es un duplicado de otra.
 *
 *   · MOTOR (`ENGINE_VERSION`, constante de codigo). La MATEMATICA: el codigo que calcula los
 *     indicadores, el DFI y la EB-BIS. Sube cuando cambia una cifra emitida.
 *   · MODELO (`model_versions.version_name`, fila de base de datos). El CATALOGO DE REFERENCIA contra el
 *     que se resuelve el diagnostico: los 81 estados EFR con su texto, los fenotipos y las definiciones
 *     de indicador. Su id es el que cuelga de cada diagnostico sellado (`model_version_id`).
 *   · REGLAS (`model_versions.rules_version`, columna de ESA MISMA fila). Las reglas diagnosticas.
 *   · PROTOCOLO (`PROTOCOL_ENGINE_VERSION`, constante de codigo). La cadena de PRESCRIPCION (gasto
 *     basal, proteina, grasa, objetivo calorico, clasificador de fenotipo). Se sella en
 *     `protocol_suggested`, que es del TRATAMIENTO, no del diagnostico.
 *
 * LO QUE HAY QUE DECIRLE, y es lo que su pregunta buscaba: MODELO y REGLAS salen de la MISMA FILA, hay
 * exactamente una activa (indice unico parcial sobre `status='active'`), y nunca han divergido: las dos
 * se escribieron juntas en la migracion 0114 y las dos dicen 1.0.0. Pueden separarse por diseño (son dos
 * columnas), pero hoy no hay ningun proceso que mueva una sin la otra.
 *
 * AUN ASI NO SE FUSIONAN. Fusionarlas exigiria elegir cual de las dos se retira, y la que se retire deja
 * de poder sellarse: los diagnosticos ya emitidos guardan las dos por separado (regla 7), asi que borrar
 * una de la pantalla haria que un diagnostico de agosto no se pudiera describir entero. Lo barato es lo
 * contrario: que las CUATRO salgan con el MISMO nombre en los dos sitios, y que aqui se explique que
 * gobierna cada una. El dia que pregunten por la diferencia, la respuesta esta en la pantalla.
 *
 * POR QUE EL PROTOCOLO NO VA EN EL PIE DEL DIAGNOSTICO: ese pie es la traza de lo que se sello en ESE
 * diagnostico, y el protocolo no se sella ahi. Ponerlo afirmaria que el diagnostico se calculo con el.
 */
export type VersionDeclarada = {
  /** El nombre, el MISMO en todas las superficies. */
  nombre: string;
  valor: string;
  /** Que gobierna, en una linea. */
  gobierna: string;
};

// LA CALIBRACION PROVISIONAL NO SE DECLARA AQUI (Santiago, 2026-09-10). Se retira, y la razon es de
// SITIO, no de importancia: ya sale en la tabla de composicion, junto a la EB y al IAE, que es donde el
// profesional la necesita (al leer la cifra que esa calibracion produjo).
//
// Y ALLI ADEMAS ESTA MEJOR PUESTA: la tabla la lee del campo SELLADO de ESE diagnostico
// (`emission_versions.calibration`), asi que dice la verdad de la cifra que tiene al lado. Aqui salia de
// una constante, o sea la calibracion de HOY, que para un diagnostico de agosto podria ser otra. Dos
// avisos del mismo hecho, y el de aqui capaz de contradecir al de alla.

/**
 * QUE SIGNIFICA LA VERSION QUE CORRE HOY.
 *
 * ═══ POR QUE ESTA ESCRITO AQUI Y NO SE LEE DE `version.ts` ═══
 *
 * El historial de `version.ts` son noventa lineas de prosa tecnica (que SHA cambio, por que no se folda
 * un bump, que midio cada cambio sobre la base). Eso es para quien mantiene el motor. Un profesional
 * necesita una frase.
 *
 * Y LO QUE IMPIDE QUE ENVEJEZCA es que la clave es la VERSION: si `ENGINE_VERSION` sube y nadie escribe
 * la entrada nueva, `motor-vigente.test.ts` se pone rojo y nombra la version que falta. Un texto que
 * afirma un estado sin derivarlo miente el dia que el estado cambia; este no puede quedarse solo.
 */
const QUE_ES_ESTA_VERSION: Record<string, { texto: string; fecha: string }> = {
  // SE ESCRIBE PARA QUIEN LA LEE, NO PARA NOSOTROS (Santiago, 2026-09-10). Decia "es un renombre de
  // frontera, no un cambio de ciencia", y eso es conversacion interna: un profesional que lo lee se
  // pregunta que renombre y por que se lo cuentan. Lo que el necesita saber es si esta al dia y desde
  // cuando. La historia del renombre no se pierde: vive en `version.ts` y en docs/VERSIONES.md, que es
  // donde la busca quien mantiene el motor.
  "1.0.0": { texto: "Primera versión oficial del modelo.", fecha: "2026-09-09" },
};

export type MotorVigente = {
  versiones: VersionDeclarada[];
  queEs: string;
  /** Fecha de la versión vigente, en ISO. La pantalla la formatea. */
  desde: string;
  /** El registro del modelo no está sembrado: se dice, no se rellena con un número inventado. */
  sinRegistro: boolean;
};

export function motorVigente(registro: { modelo: string; reglas: string } | null): MotorVigente {
  const entrada = QUE_ES_ESTA_VERSION[ENGINE_VERSION];
  return {
    versiones: [
      { nombre: "Motor", valor: ENGINE_VERSION, gobierna: "La matemática que calcula los indicadores." },
      {
        nombre: "Modelo",
        valor: registro?.modelo ?? "sin registro",
        gobierna: "El catálogo de referencia: estados, fenotipos y definiciones de indicador.",
      },
      {
        nombre: "Reglas",
        valor: registro?.reglas ?? "sin registro",
        gobierna: "Las reglas con las que se resuelve el diagnóstico.",
      },
      {
        nombre: "Protocolo",
        valor: PROTOCOL_ENGINE_VERSION,
        gobierna: "La prescripción de tratamiento. Se sella en el tratamiento, no en el diagnóstico.",
      },
    ],
    // Sin entrada, cadena vacia: la pantalla omite el parrafo antes que afirmar algo inventado sobre la
    // version que corre. El candado es lo que impide que ese caso llegue a produccion.
    queEs: entrada?.texto ?? "",
    desde: entrada?.fecha ?? "",
    sinRegistro: registro == null,
  };
}
