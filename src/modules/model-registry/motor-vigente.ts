import { ENGINE_VERSION, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";
import { AUTHORIZED_MODIFICATIONS } from "@/clinical-engine/frozen/authorized-modifications.js";
import {
  buildEmissionVersions,
  isProvisionalCalibration,
} from "@/modules/clinical-pipeline/emission-versions";
import { CODIGOS_ANI, indicatorBands, indicatorRange } from "@/modules/diagnoses/data/indicator-ranges";
import { INDICES_ANI } from "@/modules/reports/data/hc-indices-ani";

// ═══ EL TALLER DEL MODELO: CON QUE SE ESTA DIAGNOSTICANDO HOY (Santiago, 2026-09-10) ═══
//
// LA RAZON, suya y verificada antes de construir: "hoy nadie puede responder desde Atlas con que version
// del motor se esta diagnosticando". Es literal. `engine_version` aparece en DOS sitios de la interfaz y
// los dos estan DENTRO de un texto de fallo: el aviso de que un diagnostico viejo no puede mostrarse
// (`evaluation-results.tsx`) y el de que dos evaluaciones de un seguimiento cruzan versiones distintas
// (`followup-comparison.tsx`). O sea que la version solo se ve cuando algo va mal, y la pregunta normal
// ("con que estoy trabajando") se contesta abriendo `version.ts`.
//
// MODULO NEUTRO A PROPOSITO (sin "use client" ni `server-only`). Lee del motor y de modulos puros, asi
// que lo pueden importar los dos lados sin arrastrar nada. Es la forma que ya nos costo dos caidas en
// produccion: ver la nota de `patients/columnas.ts`.
//
// ── LO QUE ESTA PANTALLA NO HACE, y conviene que quede escrito aqui ──────────────────────────────────
//
// NO CALCULA NADA. Muestra lo que el motor ya sella y lo que sus propias tablas ya declaran. Regla 0:
// mostrar un dato capturado no es construir contenido; cruzarlo para sacar una conclusion, si.
//
// NO ENSEÑA LOS SHA de `PROTOCOL_ARTIFACTS_SHA`. Eso es un candado de test (existe para que un cambio en
// los artefactos del protocolo obligue a decidir si sube la version), no informacion para un profesional.
//
// NO PERMITE CAMBIAR NADA. Una version del motor no se toca desde una pantalla.

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
const QUE_ES_ESTA_VERSION: Record<string, string> = {
  "1.0.0":
    "Primera versión oficial del modelo. Es un renombre de frontera, no un cambio de ciencia: no se movió ninguna cifra al hacerlo. Lo que antes se llamó anibise-1.4.0 se llama 1.0.0 de aquí en adelante.",
};

const CALIBRACION = buildEmissionVersions().calibration;

export type MotorVigente = {
  engineVersion: string;
  protocolVersion: string;
  queEs: string;
  calibracion: string;
  calibracionProvisional: boolean;
};

export function motorVigente(): MotorVigente {
  return {
    engineVersion: ENGINE_VERSION,
    protocolVersion: PROTOCOL_ENGINE_VERSION,
    // Sin entrada, cadena vacia: la pantalla omite el parrafo antes que afirmar algo inventado sobre la
    // version que corre. El candado es lo que impide que ese caso llegue a produccion.
    queEs: QUE_ES_ESTA_VERSION[ENGINE_VERSION] ?? "",
    calibracion: CALIBRACION,
    calibracionProvisional: isProvisionalCalibration({ calibration: CALIBRACION }),
  };
}

/**
 * LAS MODIFICACIONES AUTORIZADAS VIGENTES.
 *
 * ES LO QUE DISTINGUE "el motor de Gildardo" de "el motor de Gildardo mas las cosas que el autorizo por
 * escrito", y hoy solo vive en un manifiesto de codigo. Sin esto, la pantalla diria la version y la
 * version no cuenta la historia completa.
 *
 * SE AGRUPAN POR INSTRUCCION, no por entrada. El manifiesto tiene una entrada por TROZO DE TEXTO
 * sustituido, porque asi lo exige su mecanismo (cada `oldSlice` debe aparecer exactamente una vez y no
 * pueden solaparse), y eso hace que UNA sola instruccion suya aparezca como quince entradas (CA-6a..o).
 * Listar quince lineas identicas daria a entender quince decisiones distintas.
 */
export type ModificacionVigente = {
  /** El caId sin la letra del trozo: CA-6a..CA-6o son la MISMA autorizacion, CA-6. */
  caId: string;
  decision: string;
  fecha: string;
  instruccion: string;
  /** Cuantos trozos del frozen toca. Uno o varios, segun cuantos sitios pida su instruccion. */
  trozos: number;
};

export function modificacionesVigentes(): ModificacionVigente[] {
  const porInstruccion = new Map<string, ModificacionVigente>();
  for (const m of AUTHORIZED_MODIFICATIONS as ReadonlyArray<{
    caId: string;
    decision: string;
    date: string;
    instruction: string;
  }>) {
    // "CA-6a" -> "CA-6". La letra final numera el trozo dentro de la misma autorizacion.
    const base = m.caId.replace(/[a-z]$/, "");
    const yaEsta = porInstruccion.get(base);
    if (yaEsta) {
      yaEsta.trozos += 1;
      continue;
    }
    porInstruccion.set(base, {
      caId: base,
      decision: m.decision,
      fecha: m.date,
      instruccion: m.instruction,
      trozos: 1,
    });
  }
  return [...porInstruccion.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * LOS CORTES VIGENTES, los doce indicadores con lo que decide su banda.
 *
 * HOY SOLO SE VEN DE UNO EN UNO Y DENTRO DE UN PACIENTE: la tabla de indices del Diagnostico muestra la
 * referencia de cada indicador junto a SU valor. Para responder "contra que se clasifica el IRC" hay que
 * abrir a alguien, y si ese alguien es mujer solo se ve la mitad.
 *
 * NO ES UNA SEGUNDA FUENTE. Sale de las dos que ya existen y que ya tienen candado propio:
 *   · `indicatorBands` re-encoda los cortes de los clasificadores del motor, y `indicator-ranges.test.ts`
 *     prueba cada frontera contra el clasificador congelado.
 *   · `INDICES_ANI` trae el nombre y la referencia VERBATIM de su archivo, con las dos excepciones
 *     deliberadas (PABU y EB-BIS sin nombre) ya documentadas alli.
 * Escribir aqui los numeros a mano seria exactamente el defecto que este proyecto repite: dos fuentes
 * nuestras del mismo dato sin nada que las compare.
 */
export type CorteVigente = {
  codigo: string;
  nombre: string | null;
  /** Su referencia verbatim, por sexo. null si su archivo no le da una en el bloque de la HC. */
  referenciaH: string | null;
  referenciaM: string | null;
  /** Bandas completas del clasificador del motor. null en los que son PUNTO y no banda (φ, EB). */
  bandasH: string | null;
  bandasM: string | null;
};

/**
 * SONDA PARA LEER LAS REFERENCIAS DE LOS CUATRO QUE NO ESTAN EN SU BLOQUE DE LA HC.
 *
 * Cuatro de los doce (FMI, FFMI, AF, IR) no salen en el bloque ANI-BIS-E de su historia clinica, asi que
 * no tienen fila en `INDICES_ANI`. Su referencia si existe, pero vive dentro de `indicatorRange`, que la
 * devuelve JUNTO a la Δ de un paciente y por eso exige un valor.
 *
 * SE LE PASA UN VALOR CUALQUIERA Y SOLO SE LEE `reference`. Es seguro porque la referencia de esos cuatro
 * depende del SEXO y nada mas: el valor solo decide si la funcion devuelve algo o null. La Δ, que SI
 * depende del valor, se descarta aqui y el candado lo comprueba.
 *
 * Y SE HACE ASI EN VEZ DE ESCRIBIR LOS NUMEROS: los cortes de esos cuatro (FFMI 17/15, AF 6,5/6,0,
 * IR 0,78/0,82) ya viven en `indicatorRange` con la regla de Δ que Gildardo fijo el 2026-08-17.
 * Copiarlos aqui seria una segunda fuente nuestra del mismo corte sin nada que las compare, que es
 * exactamente como se llego a que la HC citara un umbral del IRC que el motor ya no usaba.
 */
const SONDA = { ifc: 1, irc: 1, pabu: 1, icaBis: 1, iscm: 1, iehh: 1, iae: 1, eb: 1, FMI: 1, FFMI: 1, AF: 1, IR: 1 };

export function cortesVigentes(): CorteVigente[] {
  return CODIGOS_ANI.map((codigo) => {
    const fila = INDICES_ANI.find((f) => f.codigo === codigo);
    const referencia = (sexM: boolean) =>
      fila ? fila.referencia(sexM) : (indicatorRange(codigo, SONDA, sexM)?.reference ?? null);
    return {
      codigo,
      nombre: fila?.nombre ?? null,
      referenciaH: referencia(true),
      referenciaM: referencia(false),
      bandasH: indicatorBands(codigo, true),
      bandasM: indicatorBands(codigo, false),
    };
  });
}
