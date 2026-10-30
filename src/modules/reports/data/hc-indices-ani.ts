import { indicatorRange, decimalesDe } from "@/modules/diagnoses/data/indicator-ranges";
import type { EngineIndicators } from "@/clinical-engine/types";

// Indices ANI-BIS-E para la tabla de la historia clinica (porte 2026-08-24). Modulo NEUTRO y PURO.
//
// Su HC los muestra como un nivel mas de la tabla de Wang, con REFERENCIA textual fija por fila (verbatim
// de su archivo). Se portan las OCHO filas de su bloque y se filtran igual que el resto de la tabla: solo
// lo alterado, y nada sin valor.
//
// La severidad sale de `indicatorSeverities` (que ya desambigua el azul por etiqueta), no de un color.

// NOMBRE COMPLETO junto a la sigla. La historia clinica la puede leer OTRO profesional, y un medico no
// tiene por que saber que es un IAE. Los nombres NO se inventan: son los que usa el propio archivo de
// Gildardo con su formato "SIGLA · Nombre" (IFC · Funcion Celular, IRC · Riesgo Celular, ISCM · Sindrome
// Celular, IEHH · Hidro-Homeostasis, IAE · Aceleracion del Envejecimiento, ICA-BIS · Desv. φ). El glosario
// interno marca varios de estos como "confirmar Gildardo", asi que escribir ahi un nombre nuestro seria
// afirmar en un documento clinico algo que el no ha confirmado.
//
// UNA SOLA EXCEPCION, el PABU: su archivo NO le da nombre en ninguna parte (solo lo describe como
// marcador direccional de desviacion de φ). Va la sigla sola antes que un nombre inventado.
//
// ═══ LA SEGUNDA EXCEPCION SE RETIRO EL 2026-10-30, Y LA RETIRO EL (su tabla 3 del 2026-10-26) ═══
//
// La EB-BIS iba TAMBIEN sin nombre, y no por falta de uno: el suyo la rotula "Edad Biologica" y nosotros
// no podiamos, porque su tercera ronda del 2026-07-30 decidio que *"la expresion 'edad biologica' no se
// usa en ningun contenido del sistema: ni en pantalla, ni en reportes"*. Era la divergencia deliberada
// D-010/D-011, y en ESTE archivo pesaba el doble: una historia clinica es documento probatorio.
//
// Su tabla 3 vuelve a usar la expresion, ahora como "Edad biologica ESTIMADA", que es el matiz que su
// objecion pedia. Retirada la divergencia, la fila se queda sin razon para ser la unica que esconde su
// nombre, y esconderlo tenia un costo propio aqui: la HC la lee OTRO profesional, y "EB" a secas no se
// entiende sin el modelo. Santiago, 2026-10-30: *"la tabla ANI-BIS-E de la HC muestra 'Edad biologica
// estimada (EB-BIS)', igual que la pantalla"*.
export type IndiceAniFila = {
  /** Clave del MOTOR: con ella se buscan severidad, clasificacion y Δ. No es lo que se pinta. */
  codigo: string;
  /**
   * ROTULO que se pinta, separado de la clave del motor por la misma razon que en la pantalla de
   * resultados: ahi `code` es "EB" y `label` es "EB-BIS", y tocar la clave habria dejado la fila sin
   * veredicto sin que nada fallara. La EB es la unica que difiere, y su rotulo coincide con el `idx` de
   * la fila en el archivo de Gildardo ("EB-BIS"), que es donde el candado de referencias la busca.
   *
   * Se omite cuando el rotulo ES la clave, que son las otras siete: repetirlo ocho veces esconde la
   * unica fila donde los dos difieren.
   */
  sigla?: string;
  /** Nombre completo del propio archivo de Gildardo. null cuando el no le da uno (ver nota arriba). */
  nombre: string | null;
  referencia: (sexoM: boolean) => string;
  /**
   * Formato del valor. EL SUFIJO es suyo (" a" para los años, el signo del IAE); LOS DECIMALES salen de
   * `decimalesDe`, la misma tabla que usa la pantalla y que calcula las Δ (2026-09-06).
   *
   * ANTES ERAN LOS SUYOS VERBATIM, y eran justo el desorden que Santiago devolvio: 2 en cuatro filas,
   * 1 en dos, 3 en el PABU y 4 en el ICA-BIS, sin regla detras. Con la tabla, la HC y la pantalla no
   * pueden mostrar la misma cifra con distinta precision.
   */
  formato: (v: number) => string;
};

/** El valor con los decimales de su indicador, en español. Misma tabla que la pantalla y las Δ. */
const dec = (v: number, codigo: string) => v.toFixed(decimalesDe(codigo)).replace(".", ",");

// Orden y referencias EXACTOS de su tabla (v8 L15087-15095).
export const INDICES_ANI: IndiceAniFila[] = [
  { codigo: "IFC", nombre: "Función Celular", referencia: (m) => (m ? "≥6,68 óptimo" : "≥3,28 óptimo"), formato: (v) => dec(v, "IFC") },
  {
    // ═══ DESFASE NUESTRO, CORREGIDO EL 2026-09-10 ═══
    //
    // Decia "<1,68 bajo riesgo" / "<2,27 bajo riesgo", que son los cortes de ANTES del 2026-08-29. Ese dia
    // se portaron los cortes del IRC por sexo (su respuesta del 28, punto 6): `cIRC` paso a 1,7/2,1 (H) y
    // 2,3/2,8 (M), y con el subio `emission_versions.classification`. La referencia de ESTA fila se quedo
    // en los viejos, asi que la HC imprimia un corte que su propio clasificador ya no usaba: para un
    // hombre con IRC 1,69 la columna de clasificacion decia "Bajo riesgo" y la de al lado que el bajo
    // riesgo empieza por debajo de 1,68. Un documento clinico contradiciendose consigo mismo.
    //
    // NO ES UNA DISCREPANCIA SUYA (que seria de las que se documentan y no se unifican, como el PABU de
    // P-127): su entrega vigente YA dice "<1,7" y "<2,3". Es la nuestra la que se quedo atras, y es el
    // barrido incompleto de siempre: se cambio el umbral en el clasificador y no en los sitios que lo
    // CITAN. Las otras siete filas se cotejaron una a una contra su entrega vigente y coinciden.
    //
    // Y LA FORMA ES LA SUYA, no la nuestra: el escribe "1,7" y no "1,70". La regla de `fmtDec` que
    // unifico los decimales vale para las bandas que redactamos NOSOTROS (`indicatorBands`); esta columna
    // es transcripcion literal de su archivo, y ahi manda la Regla 0.
    codigo: "IRC", nombre: "Riesgo Celular",
    referencia: (m) => (m ? "<1,7 bajo riesgo" : "<2,3 bajo riesgo"),
    formato: (v) => dec(v, "IRC"),
  },
  { codigo: "ISCM", nombre: "Síndrome Celular", referencia: () => "ISCM-1 ≤ −1", formato: (v) => dec(v, "ISCM") },
  { codigo: "IEHH", nombre: "Hidro-Homeostasis", referencia: () => "≤0.0 óptimo", formato: (v) => dec(v, "IEHH") },
  {
    codigo: "EB", sigla: "EB-BIS", nombre: "Edad biológica estimada",
    referencia: () => "= Edad cronológica",
    formato: (v) => `${dec(v, "EB")} a`,
  },
  {
    codigo: "IAE", nombre: "Aceleración del Envejecimiento",
    referencia: () => "−5 a +5 años",
    formato: (v) => `${v > 0 ? "+" : ""}${dec(v, "IAE")} a`,
  },
  {
    codigo: "PABU", nombre: null,
    referencia: (m) => (m ? "φ = 1,618 (k=0,78)" : "φ = 1,618 (k=0,46)"),
    formato: (v) => dec(v, "PABU"),
  },
  { codigo: "ICA-BIS", nombre: "Desviación de φ", referencia: () => "0.00–0.15 Zona φ", formato: (v) => dec(v, "ICA-BIS") },
];

export type IndiceAniResuelto = {
  codigo: string;
  /** El rotulo ya resuelto: la sigla de la fila, o su clave cuando son la misma. */
  sigla: string;
  nombre: string | null;
  referencia: string;
  valor: string;
  clasificacion: string;
  sev: number;
  /**
   * La Δ contra el corte, de `indicatorRange`: la MISMA funcion que la calcula en la tabla de indices del
   * Diagnostico (Santiago, 2026-09-10).
   *
   * ANTES SALIA VACIA, y no era un olvido: el bloque ANI-BIS-E de su HC no tiene columna de Δ (sus filas
   * son idx/ref/val/clf). Mientras vivio en una tabla aparte eso era coherente. Al entrar DENTRO de la
   * tabla de Wang, que si la tiene, una columna en blanco se lee como dato que falta y no como columna que
   * ese bloque no usa. Se calcula con la misma fuente que la pantalla de trabajo, no con una segunda.
   */
  delta: string;
};

/**
 * Filas ALTERADAS del bloque ANI-BIS-E. Mismos dos filtros que el resto de la tabla de la HC:
 * sev >= 1 (0 es el unico nivel optimo) y nada sin valor. El codigo EB no tiene clasificador en su tabla
 * (su referencia es "= Edad cronologica" y no lleva clasificacion), asi que solo entra si algo le da una.
 */
export function indicesAniAlterados(
  valores: Record<string, number | null | undefined>,
  clasificaciones: Record<string, { label?: string | null } | null | undefined>,
  severidades: Record<string, number | null | undefined>,
  sexoM: boolean,
  /** Los indicadores del snapshot, para la Δ. Sin ellos la columna queda en raya, como estaba. */
  indicadores?: EngineIndicators | null,
): IndiceAniResuelto[] {
  const out: IndiceAniResuelto[] = [];
  for (const fila of INDICES_ANI) {
    const v = valores[fila.codigo];
    if (v == null || !Number.isFinite(v)) continue;
    const sev = severidades[fila.codigo];
    if (sev == null || sev < 1) continue;
    const label = clasificaciones[fila.codigo]?.label;
    if (!label) continue; // sin clasificacion no se puede decir que esta alterado
    out.push({
      codigo: fila.codigo,
      sigla: fila.sigla ?? fila.codigo,
      nombre: fila.nombre,
      referencia: fila.referencia(sexoM),
      valor: fila.formato(v),
      clasificacion: label,
      sev,
      // LA MISMA FUENTE QUE EL DIAGNOSTICO. El EB no la tiene (su fila toma el veredicto del IAE y su
      // referencia es la edad cronologica), asi que ahi la raya es correcta.
      delta:
        (indicadores ? indicatorRange(fila.codigo, indicadores, sexoM)?.delta : null) ?? "-",
    });
  }
  return out;
}
