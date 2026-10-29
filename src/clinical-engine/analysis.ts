// ─────────────────────────────────────────────────────────────────────────────
// ADAPTADOR del motor clinico (NUESTRO codigo TS, no congelado). Reemplaza el
// index.ts de conveniencia que Gildardo escribio aparte: orquesta la ciencia
// CONGELADA (frozen/) en el MISMO orden que el prototipo y expone un unico punto de
// entrada. La app nunca llama a los .js congelados directamente.
//
// DIVERGENCIA CORREGIDA vs el index.ts de Gildardo (hallazgo B11, informativo para
// Gildardo, NUNCA se toca la ciencia congelada): su index.ts arma el objeto para
// computeISCM como { ...imp.raw, ifc } y OMITE FMI (que es derivado, no una columna
// cruda), asi que ISCM salia -1.568 en vez del oro -2.072. El HTML (ATLAS_v7.html
// L5700) y la funcion congelada computeISCM SI usan bis.FMI; el olvido estaba solo en
// su glue. Aqui pasamos FMI explicito. Los golden tests anclan -2.072.
// ─────────────────────────────────────────────────────────────────────────────

import type { Clase } from "./frozen/engine.core";
// Derivado: engine.core.js + 6 exports aditivos (efrProf, clasificadores). Mecanismo de archivo
// derivado, no edita el frozen (ver engine.core.derived.js y DIFF C).
import * as core from "./frozen/engine.core.derived.js";
import type { DFIResult } from "./frozen/engine.dfi";
// El que CORRE es el GENERADO (original + guarda de calcLE8, CA-3): frena el LE8 sobre ausencias. El
// original queda byte-identico (anclado por su DIFF). Ver authorized-modifications.js.
import * as dfi from "./frozen/engine.dfi.authorized.js";
import * as ix from "./frozen/engine.indices.js";
import { ebBisV7, EB_BIS_V7 } from "./frozen/eb-bis-v7.js";
import { type BiodyImport, parseBiodyRow } from "./edge/biody-import";
import { ordinalesPatron } from "./patron";
import { normalizeSexo, type SexoCanonico } from "./edge/normalize";
import type { ResultadoEbBis } from "./types";

/**
 * Contexto que la EB-BIS necesita de FUERA de la medicion.
 *
 * ═══ QUE CAMBIO CON LA v7 (su §2, entrega del 2026-10-26) ═══
 *
 * *"El ICEC ya no entra al calculo. La EB-BIS se calcula aunque la encuesta no este completa."* Asi que
 * `icec` dejo de ser el insumo que HABILITA la EB-BIS y pasa a alimentar SOLO la alerta de discordancia.
 * Lo que ahora habilita el calculo es la EDAD, que antes era opcional (se usaba para restar el IAE) y hoy
 * entra a la formula: sin edad valida la v7 devuelve "pendiente".
 *
 * Por eso la edad sigue siendo opcional en el TIPO y no en el contrato: el que no la tiene recibe un estado
 * con su motivo, que es lo que su §5 pide mostrar, en vez de un null sin explicacion.
 */
export interface ContextoEncuesta {
  /** ICEC/LE8 total de la encuesta (calcLE8). Con la v7 solo decide la alerta de discordancia. */
  icec?: number | null;
  /** Edad en años CUMPLIDOS (entero). Insumo de la formula desde la v7; su §4.1 la exige de 18 a 100. */
  edad?: number | null;
}

export interface AnalisisANIBISE {
  sexo: SexoCanonico;
  indices: {
    IFC: number;
    IRC: number;
    PABU: number;
    FMI: number;
    FFMI: number;
    ISCM: number | null;
    IEHH: number | null;
    EB_BIS: number | null;
    IAE: number | null;
  };
  /**
   * LO QUE LA v7 DEVUELVE ADEMAS DE LA CIFRA, y que su §5 reparte entre dos lectores.
   *
   * `EB_BIS` e `IAE` de arriba son para el profesional Y el paciente; esto es el soporte: la z de pares, si
   * el valor se limito al tope, la alerta de discordancia, y el ESTADO con su motivo cuando no se pudo
   * calcular. Va aparte y no mezclado entre los indices por eso mismo: lo que se le muestra a un paciente
   * y lo que no tiene que distinguirse en el tipo, no en la plantilla de cada pantalla.
   */
  ebBis: ResultadoEbBis;
  clases: {
    IFC: { l: string; k: number };
    IRC: { l: string; k: number };
    PABU: { l: string };
    FMI: { l: string; k: number };
    FFMI: { l: string; k: number };
    ISCM: { l: string } | null;
    IEHH: { l: string } | null;
    IAE: { l: string } | null;
  };
  fenotipoEFR: { key: string; dx: string | null; nutraceuticos: string };
  fuente: BiodyImport;
}

// Insumos secundarios que habilitan ISCM (todos presentes o ISCM = null).
const SECONDARY_FIELDS = ["FFW", "MCA_dif", "ECW_sg", "ICW_sg"] as const;


/** El rotulo de la FORMULA que se sella con cada resultado (su §6). */
export const EB_BIS_VERSION_MOTOR = "EB-BIS v7";

/**
 * Corre su funcion y reparte la salida: las dos cifras que ve el paciente, y el soporte del profesional.
 *
 * LA EDAD SE EXIGE ENTERA Y SE COMPRUEBA AQUI, aunque su funcion tambien la compruebe. No es doble guarda
 * por desconfianza: es que un `null` o un decimal que entre a su funcion vuelve con "edad no válida", un
 * motivo correcto pero que no dice si falta la fecha de nacimiento o si alguien paso 30,95. Sus errores 3,
 * 4 y 6 son exactamente eso (edad 0, edad 231, y el 30,95 que el equipo redondea a 31), y los tres se
 * diagnostican por el motivo que llega a la pantalla.
 */
function calcularEbBis(
  sexo: SexoCanonico,
  enc: ContextoEncuesta,
  imp: BiodyImport,
): { EB_BIS: number | null; IAE: number | null; ebBis: ResultadoEbBis } {
  const sinCalcular = (estado: ResultadoEbBis["estado"], motivo: string) => ({
    EB_BIS: null,
    IAE: null,
    ebBis: {
      estado,
      motivo,
      eb: null,
      iae: null,
      zPares: null,
      topado: false,
      alertaDiscordancia: false,
      versionMotor: EB_BIS_VERSION_MOTOR,
      versionParametros: EB_BIS_V7.version,
    } satisfies ResultadoEbBis,
  });

  const edad = enc.edad;
  if (edad == null) return sinCalcular("pendiente", "falta la fecha de nacimiento del paciente");
  if (!Number.isInteger(edad)) {
    // Su error 6: el equipo redondea la columna decimal hacia arriba (30,95 pasa a 31) y Atlas trunca.
    // Su correccion: *"Usar siempre años cumplidos desde la fecha de nacimiento (truncar)"*. Si llega un
    // decimal, alguien lo tomo de la columna del equipo y no de la fecha, y eso se dice en vez de truncar
    // en silencio: truncar aqui taparia el defecto que el pidio corregir en su origen.
    return sinCalcular("pendiente", `la edad no viene en años cumplidos (llego ${edad})`);
  }

  // El ACT es opcional en el contrato de columnas (`TBW`), asi que puede faltar. Se nombra el dato que
  // falta, como hace su funcion con los demas.
  const ACT = imp.raw.TBW;
  if (ACT == null) return sinCalcular("pendiente", "dato faltante o inválido: ACT (agua total)");

  const r = ebBisV7({
    sexo,
    edad,
    Re: imp.Re,
    Ri: imp.Ri,
    C: imp.C,
    peso: imp.peso,
    MLG: imp.FFM,
    ACT,
    FMI: imp.FMI,
    ICEC: enc.icec ?? null,
  });

  if (r.estado !== "ok") return sinCalcular(r.estado, r.motivo);
  return {
    EB_BIS: r.EB_BIS,
    IAE: r.IAE,
    ebBis: {
      estado: "ok",
      motivo: null,
      eb: r.EB_BIS,
      iae: r.IAE,
      zPares: r.zPares,
      topado: r.topado,
      alertaDiscordancia: r.alertaDiscordancia,
      versionMotor: r.version,
      versionParametros: r.versionParametros,
    },
  };
}

/**
 * Punto de entrada oficial (composicion BIS). `row` = fila cruda del Excel Biody;
 * `sexoRaw` = sexo de la encuesta (o del Biody); `enc` = contexto opcional (EB-BIS/IAE).
 * Devuelve el analisis o LANZA ClinicalInputError si el import no es apto.
 */
export function analizarDesdeBiody(
  row: Record<string, unknown>,
  sexoRaw: unknown,
  enc: ContextoEncuesta = {},
): AnalisisANIBISE {
  const sexo = normalizeSexo(sexoRaw);
  const imp = parseBiodyRow(row);

  const IFC = core.calcIFC(imp.C, imp.Rinf);
  const IRC = core.calcIRC(imp.Re, imp.Ri, imp.C);
  const PABU = core.calcPABU(imp.Re, imp.Ri, imp.Rinf, imp.C, sexo);

  // Indices secundarios (100% del Excel si vienen los insumos). FIX: FMI explicito.
  const secOk = SECONDARY_FIELDS.every((f) => imp.raw[f] != null);
  const ISCM = secOk ? ix.computeISCM({ ...imp.raw, ifc: IFC, FMI: imp.FMI }) : null;
  const IEHH =
    imp.raw.FFW != null
      ? ix.computeIEHH({ Re: imp.Re, Rinf: imp.Rinf, C: imp.C, FFW: imp.raw.FFW })
      : null;

  // ═══ EB-BIS v7 (su entrega del 2026-10-26, parametros 7.1.0) ═══
  //
  // LA v5 SE RETIRA DEL MOTOR, literal en su §2: *"La EB-BIS v5 (IFC, PABU e ICEC con intercepto fijo de
  // 41,438 años) se retira del motor de ATLAS y se sustituye por la EB-BIS v7."* `ix.computeEBBIS` sigue
  // existiendo en el frozen (es su codigo y no se edita), pero ya no se llama desde aqui: los valores v5
  // ya calculados viven en los snapshots sellados, que es el "campo historico" que su §6 pide conservar.
  //
  // LOS INSUMOS NUEVOS SALEN DE LA MISMA MEDICION, y vale la pena dejar escrito cual es cual porque sus
  // nombres no son los del equipo: MLG es la masa libre de grasa (la `FFM` del export) y ACT es el agua
  // corporal total (la `TBW`). La PSSG (masa seca sin grasa) NO se lee de la columna que el equipo
  // reporta: su funcion la calcula como MLG - ACT, y su funcion es la especificacion. Es la misma decision
  // que ya se tomo con el ASMI (derivar, no leer) y por el mismo motivo: fidelidad a su modelo.
  const { EB_BIS, IAE, ebBis } = calcularEbBis(sexo, enc, imp);

  const cIFC = core.cIFC(IFC, sexo);
  const cIRC = core.cIRC(IRC, sexo);
  const cPABU = core.cPABU(PABU); // cPABU direccional (swap del 18): ya no usa IFC (Q27 resuelto)
  const cFMI = core.cFMI(imp.FMI, sexo);
  const cFFMI = core.cFFMI(imp.FFMI, sexo);

  const dx = core.getDX(cIFC.k, cIRC.k, cFFMI.k, cFMI.k);
  const key = `${core.kl(cIFC.k)}_${core.kl(cIRC.k)}_${core.kl(cFFMI.k)}_${core.kl(cFMI.k)}`;

  return {
    sexo,
    indices: { IFC, IRC, PABU, FMI: imp.FMI, FFMI: imp.FFMI, ISCM, IEHH, EB_BIS, IAE },
    ebBis,
    clases: {
      IFC: { l: cIFC.l, k: cIFC.k },
      IRC: { l: cIRC.l, k: cIRC.k },
      PABU: { l: cPABU.l },
      FMI: { l: cFMI.l, k: cFMI.k },
      FFMI: { l: cFFMI.l, k: cFFMI.k },
      ISCM: ISCM != null ? { l: core.cISCM(ISCM).l } : null,
      IEHH: IEHH != null ? { l: core.cIEHH(IEHH).l } : null,
      IAE: IAE != null ? { l: core.cIAE(IAE).l } : null,
    },
    fenotipoEFR: { key, dx: dx.dx ?? dx.name ?? null, nutraceuticos: dx.n },
    fuente: imp,
  };
}

/** Rutas activas por condicion (predicados PUROS). La seleccion AUTORITATIVA es via
 *  DFI (analizarDFI); esto queda para logica de reglas, no reemplaza al DFI. */
export function rutasPorCondicion(
  d: Record<string, unknown>,
  dominios?: Array<{ nivel: string }>,
): string[] {
  return ix.rutasPorCondicion(d, dominios);
}
export const RUTA_COND = ix.RUTA_COND;

/**
 * Cadena completa: Excel Biody + encuesta D1-D8 -> indices -> LE8/ICEC -> DFI.
 * Devuelve dominios, riesgo integrado y rutas AUTORITATIVAS. Lanza si el import BIS no
 * es apto. Mismo FIX de FMI en el ISCM que alimenta el DFI.
 */
export function analizarDFI(
  row: Record<string, unknown>,
  enc: Record<string, unknown>,
): DFIResult & { le8: ReturnType<typeof dfi.calcLE8> } {
  const sexo = normalizeSexo(enc.sexo ?? row["Género "]);
  const imp = parseBiodyRow(row);

  const IFC = core.calcIFC(imp.C, imp.Rinf);
  const IRC = core.calcIRC(imp.Re, imp.Ri, imp.C);
  const PABU = core.calcPABU(imp.Re, imp.Ri, imp.Rinf, imp.C, sexo);
  const secOk = SECONDARY_FIELDS.every((f) => imp.raw[f] != null);
  const ISCM = secOk ? ix.computeISCM({ ...imp.raw, ifc: IFC, FMI: imp.FMI }) : 0;
  const IEHH =
    imp.raw.FFW != null
      ? ix.computeIEHH({ Re: imp.Re, Rinf: imp.Rinf, C: imp.C, FFW: imp.raw.FFW })
      : 0;

  // EL ENC ADAPTADO SE ARMA UNA VEZ Y VIAJA A LOS DOS CONSUMIDORES, y esto no es estilo: hay DOS
  // puertas al LE8 y la segunda esta DENTRO del frozen. `computeDFIFromData` vuelve a llamar a
  // `calcLE8(d)` por su cuenta para el Dominio 5, asi que adaptar solo la llamada de arriba dejaba el
  // DFI corriendo sobre un ICEC a medias: la misma pantalla mostraria un ICEC y el dominio 5 estaria
  // calculado con otro. Lo destapo el golden (d5 se movio de 0 a 1 con el total intacto en 80).
  const encLe8 = { ...enc, ...ordinalesPatron(enc) };
  const le8 = dfi.calcLE8(encLe8);
  const EB_BIS = le8.total != null ? ix.computeEBBIS(IFC, PABU, le8.total) : null;
  const IAE = ix.computeIAE(EB_BIS, (enc.edad as number) ?? null);

  // `bis` con indices PRECALCULADOS (evita el bug TDZ del prototipo, que no toca la
  // ciencia congelada: computeDFIFromData corta en num("PABU") antes de usar sexoM).
  const bis = {
    Re: imp.Re,
    Ri: imp.Ri,
    Rinf: imp.Rinf,
    C: imp.C,
    IFC,
    IRC,
    PABU,
    ISCM,
    IEHH,
    IAE,
    EB_BIS,
    FMI: imp.FMI,
    FFMI: imp.FFMI,
    // ICA_BIS FALTABA, y su ausencia se veia en pantalla (cotejo 2026-09-05, punto 9).
    //
    // `computeDFIFromData` hace `num("ICA_BIS","icaBis") || (pabu ? pabu - 1.618 : null)`: si el dato
    // no viene en la fila, lo RECALCULA CON SIGNO. En su aplicacion la fila si lo trae (calculado como
    // valor absoluto), asi que su chip dice "+0,42"; en la nuestra no venia, caia al calculo con signo
    // y decia "-0,42". Misma pantalla, dos signos para el mismo concepto: la fila ICA-BIS de la tabla
    // sale de `indicators.icaBis` (absoluto) y el chip del PABU salia de la reserva (con signo).
    //
    // NO SE TOCA SU MATEMATICA: se le entrega el insumo que su codigo lee y que su aplicacion si llena.
    // El valor es EL MISMO que sella el motor (|PABU - phi|, ATLAS_v7 L5721), que es ademas lo que dice
    // la referencia de la fila ("0.00-0.15 Zona φ": un rango que empieza en cero solo tiene sentido para
    // una magnitud) y lo que hace su propio cPABU (`Math.abs(raw) <= 0.15`).
    //
    // Y ASI QUEDA COHERENTE CON SU REGLA: la DIRECCION la dice la etiqueta ("Desviación por exceso" =
    // por debajo de phi) y la MAGNITUD el numero. Su tarjeta se leia contradiciendose sola.
    //
    // Alcance: `icaBis` NO entra en ningun puntaje del DFI. Se usa en UN sitio, el texto del chip
    // (engine.dfi.js:146). No mueve severidades, ni riesgo integrado, ni rutas.
    ICA_BIS: Math.abs(PABU - 1.618),
  };

  const out = dfi.computeDFIFromData(encLe8, bis);
  if (!out) {
    throw new Error("analizarDFI: computeDFIFromData no produjo resultado (sin BIS).");
  }
  return { ...out, le8 };
}

/**
 * LA UNICA PUERTA AL LE8. Antes esto era un re-export directo del frozen; ahora envuelve, y la envoltura
 * es lo que hace que el interruptor `LE8_MAPEO_CORREGIDO` este de verdad aplicado.
 *
 * POR QUE: con el interruptor encendido, el dominio de Alimentacion lee `calcPatron(enc).score`, y
 * `calcPatron` espera el ORDINAL 0-4 de cada grupo de frecuencia. Atlas guarda el TEXTO. Pasarle el enc
 * crudo no da error: saca 10 para todo el mundo, en silencio. Ver `ordinalesPatron` y
 * `docs/PLAN_LE8_ENCENDIDO.md`.
 *
 * SE ENVUELVE EN VEZ DE MODIFICAR `calcLE8`: la ciencia no cambia, cambia la FORMA en que se le entrega
 * el dato. Y va aqui, en una sola puerta, porque el defecto que esto evita es una OMISION (llamar al
 * frozen sin adaptar); el candado `le8-encendido.test.ts` vigila que nadie abra una segunda.
 */
export function calcLE8(enc: Record<string, unknown>): ReturnType<typeof dfi.calcLE8> {
  return dfi.calcLE8({ ...enc, ...ordinalesPatron(enc) });
}
export { parseBiodyRow, assertEngineInputs } from "./edge/biody-import";
export {
  normalizeSexo,
  toNum,
  parseBiodyDate,
  ClinicalInputError,
} from "./edge/normalize";
export { BIODY_COLUMNS, ENGINE_REQUIRED } from "./edge/biody-columns";
export type { Clase };
