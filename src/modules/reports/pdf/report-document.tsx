import { Document, Page, View } from "@react-pdf/renderer";

// EL `Text` NO VIENE DEL PAQUETE: viene del envoltorio que traduce los simbolos que la fuente del PDF no
// sabe dibujar (ver `text-seguro`). Un candado lo exige en toda esta carpeta.
import { Text } from "./text-seguro";

import { dfiParaPaciente, type EngineOutput } from "@/clinical-engine";
import { EncabezadoEnCuadros } from "./encabezado-en-cuadros";
import { COLOR_SEVERIDAD, RadarDelPaciente } from "./radar-del-paciente";

import {
  comparacionDeLaEdad,
  compararAreas,
  parrafoDeAnimo,
  type MetaDePeso,
} from "@/clinical-engine/comparacion-paciente";
import {
  edadParaElPaciente,
} from "@/clinical-engine/edad-para-el-paciente";
import { lecturaSencilla } from "@/clinical-engine/lectura-sencilla-provisional";
import { sonComparables } from "@/modules/followups/services/eb-trajectory";
import { ebBisEnPiezas, NOTA_DFI_SIN_ENCUESTA } from "@/clinical-engine/presentacion-eb-bis";
import { RELLENO_DEL_INFORME, styles } from "./estilos-del-pdf";
import { FranjaDeMarca, PieDeLaPlantilla } from "./marca-de-la-plantilla";
import { formatDateOnlyLong } from "@/lib/format/date";

import type { PuntoDelPaciente } from "../data/serie-del-paciente";
import type { DominiosAnteriores, InformeDelPaciente } from "../data/reports-view-types";

// Documento PDF del reporte del paciente, construido desde el snapshot inmutable (el
// EngineOutput que la propagacion dejo en reports). NO es un componente de Next: lo
// renderiza render-report.tsx a Buffer en el servidor. El contenido es el del motor clinico REAL
// (portado en B11, paridad con el HTML de Gildardo); ya no es un stub, y el reporte no lo declara como tal.

export type ReportMeta = {
  patientName: string;
  documentLabel: string; // "CC 12345"
  /** Fecha de la MEDICION BIS. Se rotula como tal: no es la de la consulta. */
  evaluationDate: string;
  /** Fecha de la CONSULTA. null = no se pudo resolver; entonces solo se muestra la de la medicion. */
  consultationDate?: string | null; // ya formateada
  /**
   * QUIEN LO ATENDIO (una nutricionista, via Santiago, 2026-10-28): *"Nombre del profesional"*.
   *
   * El informe llevaba el nombre del paciente, su documento y dos fechas, y no decia quien se lo entrego.
   * Un documento de salud que no dice quien lo emitio no es un documento: es un volante, y el paciente que
   * quiere preguntar algo no sabe a quien. La historia clinica ya lo trae; el informe no.
   *
   * `profesion` llega YA COMO ETIQUETA ("Nutricionista"), resuelta en el repositorio con
   * `PROFESSION_LABELS`, que es la fuente unica de esos nombres. null = no se pudo resolver, y entonces la
   * linea no sale: no se inventa un autor.
   */
  profesional?: { nombre: string; profesion: string | null } | null;
  reportId: string;
};

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL INFORME SE QUEDA EN EL MINIMO  ·  Santiago, 2026-11-05
//
// SU DECISION, literal: *"el informe lleva SOLO el encabezado en cuadros; la edad biologica estimada,
// grande; el radar con los anillos, la leyenda llana y las cinco filas con barra, veredicto y frase; la
// comparacion con la consulta anterior, si es seguimiento; y la proxima cita. SALEN las rutas, los
// suplementos y las remisiones: la razon es que el informe no puede recomendar algo que la profesional no
// recomendo. Viven en la HC y en la hoja del plan."*
//
// ═══ LA RAZON ES MAS FUERTE QUE LAS ANTERIORES, Y CONVIENE VERLO ═══
//
// Los recortes del 28 y del 30 de octubre se argumentaron por DISCIPLINA: que una cifra es del
// profesional, que este documento trata la salud bioelectrica y no la alimentacion. Este se argumenta por
// lo que el documento AFIRMA: los tres bloques que salen pintaban, uno al lado del otro, lo que sugirio
// el MODELO y lo que indico la PROFESIONAL. Rotulados, pero en el mismo papel y con el mismo peso. Un
// paciente que lee "Nutraceuticos recomendados" en el documento que le entrego su nutricionista lee una
// indicacion suya, no la salida de un clasificador.
//
// Y ESO NO SE ARREGLA ROTULANDO MEJOR: mientras la sugerencia del modelo este en el documento del
// paciente, la distincion depende de que el la lea con cuidado. Fuera del documento, no depende de nada.
//
// ═══ LO QUE NO ESTA EN SU LISTA Y SE QUEDA, declarado para que lo pueda cortar en una linea ═══
//
//   1 · EL VEREDICTO INTEGRADO Y SU PARRAFO DE ORIENTACION. No estan entre los tres que nombra, y la
//       razon que saca a esos tres no los alcanza: no recomiendan nada, son la lectura del modelo sobre
//       la medicion, que es lo que el documento viene a decir. Dejan de ser bloque propio ("Como estas")
//       y pasan a encabezar la hoja de la figura, que es donde se explican. Asi la hoja queda con su
//       resumen arriba y el detalle debajo, y el documento no gana un bloque mas.
//   2 · LA OBSERVACION DE LA PROFESIONAL, junto a la proxima cita. Por su propia razon: es lo UNICO del
//       documento que escribio ella para este paciente. Si algo no puede sobrar por "recomendar lo que
//       ella no recomendo", es justo esto.
//   3 · LA LINEA QUE DICE DONDE ESTA EL RESTO. El lo dice en su mensaje: *"viven en la HC y en la hoja
//       del plan"*. El paciente tambien tiene que saberlo, o un informe sin rutas ni suplementos se lee
//       como un informe al que le falta algo.
//   4 · EL DERECHO A PEDIR LA HISTORIA CLINICA y el identificador del pie. Lo primero es una obligacion
//       legal (asesoria del 2026-09-01) y no contenido clinico; lo segundo es como el paciente nombra su
//       documento si llama a preguntar.
//
// ═══ INDICADORES EN EL REPORTE DEL PACIENTE ═══
//
// ═══ LA EDAD BIOLOGICA ESTIMADA SI VA, DESDE EL 2026-10-26 ═══
//
// Aqui decia lo contrario, y era su decision de entonces (P0, 2026-08-01): *"la cifra de EB-BIS nunca va
// al paciente, y como IAE = EB - edad, mostrar IAE revela el constructo"*, con "edad biologica" declarado
// termino retirado del sistema.
//
// SU TABLA 3 LA REVIERTE, y de forma explicita: las filas de EB-BIS y de IAE dicen "Profesional y
// paciente", y la frase que el escribe es *"Edad biologica estimada: 76,4 años"*, o sea que vuelve a usar
// la expresion, ahora calificada como ESTIMACION. Santiago lo confirmo el 2026-10-28.
//
// QUE CAMBIO PARA QUE SE PUEDA, y no es solo que el cambiara de opinion: la v5 estaba sin calibrar (la
// marca "calibracion provisional" existia por eso) y la v7 esta ajustada sobre 5.891 adultos. La cifra que
// se le muestra al paciente hoy no es la que se le negaba en agosto.
//
// LO QUE SIGUE FUERA son los demas indices del modelo (IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el codigo
// N_N_N_A). Su §7.1 los excluye y su tabla 3 no los devuelve: solo nombra estos dos.
//
// Y SOLO DE LA v7. Se gatea por `snapshot.ebBis`, que es null en los diagnosticos sellados antes: un
// snapshot viejo lleva una EB-BIS v5 en `indicators.eb`, y esa es justo la que el no queria que el
// paciente viera. Pintarla "porque el campo trae un numero" seria publicar la cifra retirada.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * EL VEREDICTO INTEGRADO VA · PENDIENTE DE QUE SANTIAGO LO VEA EN PANTALLA (2026-11-05)
 *
 * Es el punto 1 de la declaracion de arriba: lo dejamos contra su *"el informe lleva SOLO"* porque la
 * razon que saca a las rutas, los suplementos y las remisiones no lo alcanza. Pero la decision es suya
 * cuando lo vea impreso, asi que **se quita poniendo esto en `false`, y nada mas**: ni tocar el JSX, ni
 * dar de baja un candado, ni volver a leer este archivo.
 *
 * Lo que se va con el `false` son DOS lineas y ninguna otra: la del veredicto (`dfiPac.riesgo`) y la
 * frase de enfoque que la acompaña. El parrafo que explica como se lee el documento SE QUEDA: es de una
 * nutricionista, no es veredicto, y sigue siendo cierto sin lo de arriba (dice que debajo aparece cada
 * area por separado, y eso no cambia).
 *
 * El candado de `informe-mas-legible-para-el-paciente` LEE esta bandera y afirma las dos direcciones, asi
 * que al voltearla la suite sigue verde y sigue midiendo la decision. Un candado que hubiera que apagar a
 * mano para ejercer una decision ya tomada es friccion, no garantia.
 */
export const EL_VEREDICTO_INTEGRADO_VA = false;

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DOS TIPOS DE INFORME: INICIAL (UNA HOJA) Y SEGUIMIENTO (DOS)  ·  Santiago, 2026-11-06
//
// Lo reviso impreso y escribio la maqueta hoja por hoja. Lo que cambia:
//
//   1 · EL TITULO. *"En vez de Informe ANIBISE, algo tipo 'Informe de evaluacion bioelectrica' y en un
//       subtitulo pequeño 'bajo el modelo de atencion en salud ANI-BIS-E', ya que asi es como esta
//       formalizado en CNV. Esto posiciona el modelo y se adapta a lo que el paciente entiende por
//       informe."* La firma de CNV baja al pie, que es donde la pone su maqueta.
//
//   2 · LA HOJA 1 NO SE PARTE. *"Me gustaria que toda la hoja 'Tu evaluacion bioelectrica integral, area
//       por area' aparezca en la primera junto al cuadro y no haga espacio a otra hoja, ya que queda toda
//       una hoja casi limpia."* Se quita el salto de pagina que la separaba; verificado renderizando que
//       cabe con un nombre largo y los cinco dominios.
//
//   3 · SALEN TRES BLOQUES, y los tres por la misma razon: le hablan al paciente en medidas o le repiten
//       lo que ya sabe.
//         · el parrafo de "Este es el resumen de tu valoracion...", que explicaba como leer el documento;
//         · el veredicto integrado (la bandera de arriba, ahora en `false`);
//         · la grafica de peso, masa grasa y masa sin grasa con sus tres frases. Textual suyo: *"El
//           paciente no quiere saber eso... No utilizar terminos asi como masa grasa, etc. Simplemente,
//           cosas como 'estuviste mas cerca de alcanzar la meta de peso X'."*
//         · y la linea de donde vive el resto (plan, suplementos, remisiones).
//
//   4 · ENTRA LA NOTA DE INTERPRETACION. *"Los resultados corresponden a la medicion realizada en la fecha
//       indicada y deben interpretarse junto con la historia clinica y la valoracion profesional. No
//       constituyen por si solos un diagnostico."*
//
//       Y HAY QUE DECIR POR QUE AHORA SI, porque una frase parecida se RETIRO el 2026-09-01: entonces
//       contradecia al documento, que en el bloque "Como estas" le decia al paciente que su
//       envejecimiento estaba acelerado. Con el veredicto integrado fuera, esa contradiccion ya no existe:
//       el documento muestra la cifra y las cinco areas con su etiqueta, y no emite un juicio de conjunto.
//       Por eso la nota ya no afirma lo contrario de lo que el papel hace.
//
//   5 · LA HOJA 2, SOLO EN SEGUIMIENTO: la comparacion de la edad estimada, el radar de las dos consultas
//       con su leyenda, las cinco areas con si mejoraron o conviene trabajarlas, y un parrafo que anima
//       sin mentir. Las reglas de ese parrafo (frases fijas, nunca IA, sin terminos tecnicos, la meta de
//       peso solo si esta registrada) viven en `clinical-engine/comparacion-paciente.ts`.
//
// ═══ LO QUE SE QUEDA Y NO ESTA EN SU MAQUETA, declarado para que lo pueda cortar ═══
//
//   · LA OBSERVACION DE LA PROFESIONAL Y LA PROXIMA CITA. Es lo UNICO del documento que una persona
//     escribio para este paciente, y la ronda anterior la dejo por eso mismo. Va al final de la ULTIMA
//     hoja: la primera en un inicial, la segunda en un seguimiento.
//   · EL DERECHO A PEDIR LA HISTORIA CLINICA (obligacion legal, asesoria del 2026-09-01) y el
//     identificador del pie.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El titulo que el paciente lee, y el subtitulo que posiciona el modelo. Los dos son de Santiago. */
export const TITULO_DEL_INFORME = "Informe de evaluación bioeléctrica";
export const SUBTITULO_DEL_INFORME =
  "Resultados de medición bajo el modelo de atención en salud ANI-BIS-E";

/**
 * LA NOTA DE INTERPRETACION, al cierre de la hoja 1. Verbatim de Santiago.
 *
 * NO ES UN DESCARGO QUE CONTRADIGA AL DOCUMENTO (ver el punto 4 de arriba): dice que la lectura se hace
 * con la historia clinica y con el profesional, que es cierto, y ya no convive con un veredicto de riesgo.
 */
export const NOTA_DE_INTERPRETACION =
  "Los resultados corresponden a la medición realizada en la fecha indicada y deben interpretarse junto " +
  "con la historia clínica y la valoración profesional. No constituyen por sí solos un diagnóstico.";

// Modo de envio: que contenido incluye el PDF (B10.1). 'atlas' = reporte del motor;
// 'notas' = solo las notas del profesional; 'ambos' = los dos.
export type SendMode = "atlas" | "notas" | "ambos";
export const SEND_MODES: readonly SendMode[] = ["atlas", "notas", "ambos"];

export function ReportDocument({
  snapshot,
  meta,
  mode = "atlas",
  professionalNotes = null,
  bandText = null,
  bandAppointmentDate = null,
  informe = null,
  serie = [],
  dominiosAnteriores = null,
  metaDePesoKg = null,
}: {
  snapshot: EngineOutput;
  meta: ReportMeta;
  mode?: SendMode;
  professionalNotes?: string | null;
  // P0 Parte 2 (P5): el texto del cambio respecto a la medición anterior (3 bandas). null = sin sección.
  // La regla de si va o no la decide el reader (computePatientBandText); aquí solo se pinta si hay texto.
  bandText?: string | null;
  // §6 (Gildardo Q33): la fecha de la próxima cita, solo para el "empeoró" confirmado. Va como frase
  // APARTE, después del texto verbatim de Gildardo (no se edita su redacción). null = no se pinta.
  bandAppointmentDate?: string | null;
  /**
   * ═══ EL PLAN YA NO ENTRA AQUI, Y LA PROP SE QUITA EN VEZ DE DEJARLA SIN USO ═══
   *
   * Santiago, 2026-10-30: *"[El informe] es transversal a todas las disciplinas: trata la salud
   * bioelectrica, no la alimentacion. Salen tambien: la lista de intercambio; el ejemplo de menu para una
   * semana; y 'Lo que debes evitar', si es de alimentacion. Todo eso ya va en la hoja del plan, que el
   * correo adjunta cuando hay prescripcion."*
   *
   * Es el tercer recorte del mismo sitio y el que cierra el criterio: el 28 de octubre salieron la
   * prescripcion, las porciones y las recomendaciones porque eran CIFRAS del profesional; estos tres se
   * quedaron porque eran "lo que el paciente puede seguir". El criterio nuevo no es ese: es que este
   * documento trata la salud bioelectrica, y la alimentacion es UNA disciplina de las que lo aplican. Un
   * informe con el menu de la semana se lee como un informe de nutricion, y el mismo paciente puede ir a
   * ejercicio o a psicologia.
   *
   * Y NO QUEDA UNA PROP MUERTA: un `plan` que nadie lee es el cable que alguien vuelve a conectar sin
   * saber por que se desconecto. Los tres bloques siguen vivos, en una sola copia
   * (`bloques-del-plan.tsx`), y los pinta el PDF del plan, que es el segundo adjunto del correo.
   */
  /**
   * ═══ DE AQUI YA SOLO SE LEE EL SEGUIMIENTO (Santiago, 2026-11-05) ═══
   *
   * Traia cuatro cosas: las rutas, los suplementos, las remisiones y el seguimiento. Las tres primeras
   * salieron del documento (ver la cabecera), y queda el seguimiento: la observacion de la profesional y
   * la proxima cita, que es lo ultimo de su lista.
   *
   * LA PROP NO SE AFINA A `{ seguimiento }` a proposito, y es la decision contraria a la que se tomo con
   * el `plan` el 30 de octubre: aquello se quito entero porque no quedaba ni un uso, y una prop muerta es
   * el cable que alguien vuelve a conectar. Aqui el objeto SIGUE VIVO y lo arma un lector que tambien
   * alimenta otras superficies; recortar el tipo en este documento obligaria a construir un segundo tipo
   * para la misma lectura. Lo que impide el descuido es que este documento no toque los otros tres
   * campos, y de eso hay candado.
   *
   * null = no se pudo reunir, y el documento sale sin esa parte en vez de no salir.
   */
  informe?: InformeDelPaciente | null;
  /**
   * LA TRAYECTORIA DEL PACIENTE (peso, masa grasa y masa sin grasa por consulta). Vacia = no hay dos
   * mediciones que comparar, y entonces el bloque no se pinta: una trayectoria de un punto no lo es.
   */
  serie?: PuntoDelPaciente[];
  /**
   * LAS CINCO AREAS DE LA CONSULTA ANTERIOR, para que el radar dibuje las dos figuras (Santiago,
   * 2026-11-05). null = consulta inicial, y el radar sale como siempre.
   */
  dominiosAnteriores?: DominiosAnteriores | null;
  /**
   * LA META DE PESO REGISTRADA por el profesional (`evaluations.weight_goal_kg`), en kg.
   *
   * null = no hay meta registrada, y entonces el parrafo de la hoja 2 sale SIN frase de meta. No se cae al
   * default de Lorentz a proposito: la frase va en la DIRECCION de la meta, y una meta que nadie fijo no
   * tiene direccion (bajar es acercarse para unos y alejarse para otros). Es la regla 4 de
   * `comparacion-paciente.ts`.
   */
  metaDePesoKg?: number | null;
}) {
  // SOLO SE DESESTRUCTURA LO QUE ESTE DOCUMENTO PUEDE IMPRIMIR. `indicators`, `efrPhenotype`,
  // `structural`, `frSector` y `versions` se retiraron con sus bloques (§7.1): un documento que no tiene
  // el dato no puede filtrarlo por descuido. `dfi` se conserva SOLO por `dfi.complete`, que gatea la banda.
  //
  // Y DESDE EL 2026-11-05 TAMPOCO `nutraceuticos`: salia en el bloque de suplementos, que ya no existe.
  // Dejarlo desestructurado y sin usar seria tener a mano, en el documento del paciente, justo la cadena
  // que la decision de hoy saca de el.
  const { dfi } = snapshot;
  // EL DFI EN SU LENGUAJE, no en el del modelo. Porte de su mapa (`dfiParaPaciente`): CRITICO pasa a
  // Prioritario, el dominio conductual con severidad alta se reemplaza por una frase que no menciona TCA,
  // y el veto se reformula como acompañamiento. Ver el porqué en `clinical-engine/dfi-paciente.ts`.
  const dfiPac = dfiParaPaciente(snapshot);
  const notes = (professionalNotes ?? "").trim();
  const showAtlas = mode === "atlas" || mode === "ambos";
  const showNotes = (mode === "notas" || mode === "ambos") && notes.length > 0;
  // El cambio solo se muestra con el contenido de Atlas (no en modo 'solo notas'): es lectura del modelo.
  // Y NO se muestra si el diagnóstico está incompleto: la banda es cambio de EB-BIS, salida que DEPENDE de
  // la encuesta, y con la encuesta a medias la EB se infla. Es la aplicación de D-007 (decisión de Gildardo:
  // no emitir lo que depende de la encuesta si está incompleta) a la banda. El gate va aquí, en el render,
  // para que valga también en reportes YA SELLADOS con encuesta incompleta (no se reescriben, pero dejan de
  // mostrar la banda). El sellado (computeTrajectoryToSeal) ya no sella banda para incompletos de aquí en más.
  const showBand = showAtlas && Boolean(bandText) && dfi.complete;
  // LA EDAD BIOLOGICA ESTIMADA, solo de la v7 (ver la cabecera: un snapshot viejo lleva la cifra v5 en
  // `indicators.eb`, que es justo la que su decision de agosto no queria que el paciente viera).
  // SE ARMA SOLO CON `snapshot.ebBis`, que lleva sus dos cifras: este documento NO puede tocar
  // `snapshot.indicators` (un candado lo prohibe, y con razon: ahi estan los doce indicadores y §7.1 dice
  // que ninguno va al paciente). Ver el porque de la copia en `ResultadoEbBis`.
  //
  // ═══ Y DESDE HOY SE PARTE EN DOS PIEZAS, PORQUE LA CIFRA VA GRANDE Y SOLA (Santiago, 2026-11-05) ═══
  //
  // `ebBisParaTodos` devuelve las dos frases enteras de su tabla 3 ("Edad biologica estimada: 76,4 años" y
  // "+12,4 años: envejecimiento acelerado estimado"). Para la pieza grande hace falta la CIFRA sin su
  // rotulo, porque el rotulo pasa a ser el titulo del bloque.
  //
  // NO SE RECORTA SU FRASE AQUI, NI SE COMPONE CON LOS FORMATEADORES A MANO: el motor gano una tercera
  // salida, `ebBisEnPiezas`, por la misma razon por la que existen las otras dos. La frontera de su §5 es
  // de TIPO (una funcion para lo del paciente, otra para lo del profesional), y si este documento armara
  // la cifra por su cuenta esa garantia dejaria de estar en el tipo y pasaria a depender de que cada
  // documento se acuerde. Es el precedente de `bandaIae`, que se separo por lo mismo.
  const ebBis =
    snapshot.ebBis?.estado === "ok"
      ? ebBisEnPiezas(snapshot.ebBis.eb, snapshot.ebBis.iae)
      : null;
  // ═══ Y LA MISMA CIFRA, CONTADA (Santiago, 2026-11-06) ═══
  //
  // `ebBisEnPiezas` da la cifra y el IAE con su banda, que es lo que su tabla 3 define. Lo que el informe
  // necesita ademas es la EDAD REAL debajo y la frase que explica que significa la diferencia, y eso es
  // redaccion para el paciente, no contenido clinico: vive en `edad-para-el-paciente.ts`, que compone
  // sobre las mismas piezas del motor y mete su banda verbatim.
  const edadPac =
    snapshot.ebBis?.estado === "ok"
      ? edadParaElPaciente(snapshot.ebBis.eb, snapshot.ebBis.iae)
      : null;

  // ═══ LA HOJA 2 EXISTE CUANDO HAY CONSULTA ANTERIOR CON QUE COMPARAR ═══
  //
  // La condicion es `dominiosAnteriores`, no el TIPO de la evaluacion, y es a proposito: un seguimiento
  // cuya consulta anterior no llego a sellar sus areas no tiene nada que comparar, y una hoja 2 con cinco
  // "no se puede comparar" es peor que no tenerla. El tipo lo decide el dato, no el rotulo.
  const esSeguimiento = showAtlas && Boolean(dominiosAnteriores) && dfi.complete && Boolean(dfiPac);
  // ¿La lectura del dominio conductual YA trae la frase de acompañamiento? Se pregunta por el HECHO (la
  // sustitucion que hace su mapa cuando `d4` tiene severidad alta) y no comparando textos: dos frases que
  // hoy dicen lo mismo pueden dejar de parecerse con un retoque suyo, y entonces una comparacion de
  // cadenas apagaria el aviso sin que nadie lo note.
  const yaDijoElAcompanamiento = (dfiPac?.dominios ?? []).some(
    (d) => d.id === "d4" && d.sev != null && d.sev >= 2,
  );
  // LA COMPARACION DE LA EDAD la decide el motor, que recibe las dos cifras y las dos versiones. La
  // comparabilidad por version MAYOR sale de `sonComparables`, que es donde ya vive ese criterio.
  const edad = dominiosAnteriores
    ? comparacionDeLaEdad({
        ebHoy: snapshot.ebBis?.estado === "ok" ? snapshot.ebBis.eb : null,
        ebAnterior: dominiosAnteriores.edad?.eb ?? null,
        mismaEscala: sonComparables(snapshot.versions?.engine, dominiosAnteriores.engineVersion),
      })
    : null;
  const ebAnteriorEnPiezas =
    dominiosAnteriores?.edad && edad?.estado === "comparable"
      ? ebBisEnPiezas(dominiosAnteriores.edad.eb, dominiosAnteriores.edad.iae)
      : null;
  const areas = dominiosAnteriores && dfiPac ? compararAreas(dfiPac.dominios, dominiosAnteriores.porDominio) : [];
  // LA META DE PESO sale de la serie que ya viaja al documento (las dos ultimas mediciones) y de la meta
  // REGISTRADA. Sin los tres datos no hay frase: no se rellena ninguno.
  const pesoHoy = serie.length >= 2 ? serie[serie.length - 1].pesoKg : null;
  const pesoAntes = serie.length >= 2 ? serie[serie.length - 2].pesoKg : null;
  const metaPeso: MetaDePeso | null =
    metaDePesoKg != null && metaDePesoKg > 0 && pesoHoy != null && pesoAntes != null
      ? { metaKg: metaDePesoKg, pesoHoyKg: pesoHoy, pesoAnteriorKg: pesoAntes }
      : null;

  /**
   * La observacion de la profesional y la proxima cita: van al final de la ULTIMA hoja.
   *
   * ═══ COMPACTO DESDE EL 2026-11-06, Y ES POR LA HOJA 1 ═══
   *
   * Era un bloque con titulo propio ("Tu seguimiento"), el rotulo de la observacion en su propia linea y
   * la cita en otra: unos 55 puntos. En la maqueta nueva de Santiago la hoja 1 no tiene ese aire, y la
   * medicion con las cinco lecturas mas largas lo confirmo: la empujaba a una segunda hoja.
   *
   * Asi que el titulo sale y el rotulo pasa a ir EN LINEA con el texto. Lo que NO cambia es que la
   * observacion diga de QUIEN es (Santiago, 2026-09-19): suelta se leia como un texto del sistema, y
   * decir que la escribio su profesional cambia como se lee. El rotulo se conserva; su renglon, no.
   */
  const bloqueDeSeguimiento =
    showAtlas && informe && (informe.seguimiento.observacion || informe.seguimiento.proximaCita) ? (
      <View style={{ marginTop: 3 }}>
        {informe.seguimiento.observacion ? (
          <Text style={styles.para}>
            {/* EL ROTULO DICE "MENSAJE" Y NO "OBSERVACIONES" (0237, 2026-11-07): hasta ese dia aqui
                salia la NOTA CLINICA, y "observaciones de tu profesional" la describia bien. Ahora sale
                el campo que la profesional escribio PARA el paciente, de 200 caracteres, y llamarlo
                observacion haria creer que lo que lee es la nota clinica completa. */}
            <Text style={styles.bold}>Mensaje de tu profesional: </Text>
            {informe.seguimiento.observacion}
          </Text>
        ) : null}
        {informe.seguimiento.proximaCita ? (
          <Text style={styles.para}>
            <Text style={styles.bold}>Tu próxima consulta: </Text>
            {/* EN LETRAS, Y ADEMAS ESTABA SALIENDO CRUDA. `proxima_cita` es una columna `date` y el
                lector la devuelve tal cual, asi que aqui se imprimia "2026-07-12": una fecha en el
                formato de la base, en el documento de un paciente. `formatDateOnlyLong` no convierte
                zona (una fecha pura no es un instante) y devuelve lo que recibe si no reconoce la
                forma, asi que no puede empeorar lo que ya estuviera formateado. */}
            {formatDateOnlyLong(informe.seguimiento.proximaCita)}
          </Text>
        ) : null}
      </View>
    ) : null;

  /**
   * El pie, fijo en las dos hojas.
   *
   * LLEVA LA FIRMA DE CNV, que BAJO del encabezado (Santiago: *"En vez de dejar CONNECTED NUTRITION
   * VENTURES arriba... en el footer vaya tal cual esos datos"*). Cuando llegue su plantilla .docx, el pie
   * gana su decoracion y sus datos de contacto; hasta entonces la firma no desaparece del documento, que
   * es lo que pasaria si se quitara de arriba sin ponerla abajo.
   *
   * EL IDENTIFICADOR SE QUEDA porque es lo unico del pie que el paciente puede USAR: es como nombra su
   * documento si llama a preguntar, y desde el se llega a las tres versiones selladas.
   */
  // ═══ Y DESDE EL 2026-11-06 EL PIE ES EL DE LA PLANTILLA (Santiago) ═══
  //
  // *"Te adjunto una plantilla que ya esta decorada y tiene footer. Para que en el footer vaya tal cual
  // esos datos."* La plantilla vive fuera del repositorio; de ella salieron los datos verbatim, la franja
  // de colores de arriba y la barra degradada de abajo. Ver `marca-de-la-plantilla.tsx`.
  //
  // EL IDENTIFICADOR BAJA A SU PROPIA LINEA. En el PDF de la paciente real salia pegado a la razon social
  // ("Connected Nutrition Ventures SAS · Informe f4fa4e7c-...") y se leia como parte del nombre de la
  // empresa. Sigue estando porque es lo unico del pie que el paciente puede USAR.
  const pie = <PieDeLaPlantilla lado={RELLENO_DEL_INFORME.lado} identificador={meta.reportId} />;
  return (
    <Document
      title={`${TITULO_DEL_INFORME} ${meta.documentLabel}`}
      author="Connected Nutrition Ventures"
    >
      {/* CARTA, NO A4 (Santiago, 2026-09-20). Salia en A4 mientras la historia clinica (`hc-document`) y
          todo lo que se imprime desde pantalla (`@page { size: letter }`) salian en CARTA: el mismo
          documento tenia dos formas segun por donde se pidiera, y en Colombia el papel es carta. A4 es mas
          angosta y mas alta (210x297 mm contra 216x279), asi que no es la misma hoja con otro nombre:
          impresa en carta deja margenes desiguales, y las dos medidas son las que Santiago necesita para
          la maqueta. */}
      <Page size="LETTER" style={styles.pageInforme}>
        {/* LA FRANJA DE LA PLANTILLA, sangrada hasta el borde y en todas las hojas (`fixed`). Es lo que
            hace que el documento se vea de la casa sin gastar media hoja en un membrete. */}
        <FranjaDeMarca />
        {/* ═══ EL ENCABEZADO EN CUADROS, COMPARTIDO CON LA HOJA DEL PLAN Y LA HISTORIA CLINICA ═══

            Era un titulo, una firma y cinco filas etiqueta-valor. La caja de tres columnas pone la
            identidad del paciente donde la vista cae primero, que es la mitad de la sugerencia que Santiago
            pidio adoptar, y el mismo bloque lo pintan ahora los tres documentos.

            LAS DOS FECHAS SIGUEN SIENDO DOS (smoke 2026-09-01): la de la MEDICION va en la caja, porque es
            la que fecha este documento, y la de la CONSULTA en la linea de debajo. "Fecha" a secas era la
            de la medicion y el paciente no tenia como saberlo: puede haberse medido un dia y haber sido
            atendido otro, y con el tamizaje en casa las dos se van a separar siempre.

            Y LA FRANJA Y LA NUBE SALEN (Santiago, 2026-11-05): *"Fuera la franja y la nube."* Se habian
            puesto el 30 de octubre para que el documento se viera de la casa; la jerarquia tipografica de
            la maqueta nueva consigue lo mismo, fotocopia limpio y no gasta tinta. El componente
            `MarcaDeFondo` se borra en vez de quedarse sin llamadores, por la razon de siempre: una pieza
            muerta es el cable que alguien vuelve a conectar sin saber por que se desconecto. */}
        <EncabezadoEnCuadros
          datos={{
            titulo: TITULO_DEL_INFORME,
            subtitulo: SUBTITULO_DEL_INFORME,
            // LA FIRMA BAJA AL PIE (ver el comentario de `pie`): aqui se apaga, no se borra del
            // componente, porque la hoja del plan y la historia clinica la siguen llevando arriba.
            sinFirma: true,
            paciente: meta.patientName,
            documento: meta.documentLabel,
            tercera: { rotulo: "Fecha de medición", valor: meta.evaluationDate },
            profesional: meta.profesional ?? null,
            otraFecha: meta.consultationDate
              ? { rotulo: "Fecha de la consulta", valor: meta.consultationDate }
              : null,
          }}
        />

        {/* AQUI IBA "Patrones asociados a valorar clínicamente, no constituye diagnóstico", y se retiro el
            2026-09-01. Era NUESTRA (no aparece ni una vez en su archivo) y contradecia dos cosas a la vez:
            el bloque siguiente, que se titula "Cómo estás" y le dice al paciente que su envejecimiento
            esta acelerado; y su §7.1, que pone el DIAGNOSTICO como lo primero que el paciente recibe.
            Un documento que diagnostica y ademas declara que no diagnostica no protege a nadie: confunde
            al paciente sobre que tiene en la mano. */}

        {/* ═══ LA BANDA DE CAMBIO SE MUDO ABAJO, CON EL RESTO DE LA COMPARACION (2026-11-05) ═══

            Estaba aqui, en la primera hoja, desde antes de que el informe tuviera grafica de trayectoria.
            Su lista de hoy pide *"la comparacion con la consulta anterior, si es seguimiento"* como UNA
            cosa, y hoy eran tres repartidas por el documento: esta banda arriba, el radar de evolucion en
            la hoja de la figura y la grafica con sus frases al final.

            Asi que la banda baja a juntarse con la grafica. No cambia ni su texto (verbatim de Gildardo) ni
            su gateo (sigue dependiendo de `dfi.complete` y de que el profesional confirmara un
            "empeoro"): cambia de SITIO, para que el paciente lea su evolucion de una sola vez en vez de
            encontrarsela en tres puntos del papel. */}

        {/* El aviso de incompletitud del diagnóstico NO va al reporte del paciente (decisión 2026-08-08): es
            jerga técnica (DFI, "faltan 10 de 13 respuestas") y, peor, le informa al paciente sobre la calidad
            del trabajo de su profesional, que no le corresponde. La completitud es para el PROFESIONAL, que ya
            la ve en su pantalla. Si el paciente debe saber algo, será otra cosa y en su lenguaje, y lo redacta
            Gildardo. `dfi.degradedReason` sigue disponible en el snapshot para la vista del profesional. */}

        {/* ═══ LO QUE YA NO VA AL PACIENTE (Gildardo, §7.1 del 2026-08-26) ═══
            Aqui iban CUATRO bloques y los cuatro se retiraron el 2026-09-01, por instruccion suya literal:

              "lo que hoy le mandan -IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el codigo N_N_N_A- NO DEBE
               SALIR ASI. Ningun indice del modelo va al paciente. Eso es el documento del profesional."

            1 · INDICADORES: los seis que nombra, mas FMI, FFMI, AF e IR. Todos son indices del modelo.
            2 · DIAGNOSTICO FUNCIONAL (EFR): llevaba el codigo de estado que el nombra y el sector FyR.
            3 · DIAGNOSTICO FUNCIONAL INTEGRAL (DFI): riesgo, score y severidades por dominio.
            4 · Y con ellos la RAMA de "diagnostico incompleto", que era jerga sobre jerga.

            POR QUE EL DFI SE VA ENTERO Y NO SE "SUAVIZA" AQUI: su archivo YA TIENE la version para el
            paciente, y no es una simplificacion nuestra sino una decision clinica suya (BAJO/MEDIO/ALTO/
            CRITICO pasan a Optimo/A mejorar/Requiere atencion/Prioritario; el dominio conductual con
            severidad alta se reemplaza por una frase de acompanamiento que NO menciona TCA; el veto se
            reformula como acompanamiento). Escribir nosotros ese lenguaje seria inventar contenido
            clinico. Esta preguntado; hasta que responda, el bloque no va.

            LO QUE QUEDA es lo que SI es para el paciente: el cambio respecto a su medicion anterior (texto
            que redacto el), la recomendacion de nutraceuticos, las notas de su profesional y su derecho a
            pedir la historia clinica. El documento queda corto, y eso es correcto: es preferible a mandarle
            indices que no puede leer y una palabra como "CRITICO" sin nadie que se la explique.

            El PLAN COMPLETO -diagnostico, meta, plan dietetico, menu, distribucion, recomendaciones y la
            lista de intercambio recortada por region- es lo que su §7.1 dice que el paciente debe recibir,
            y se construye aparte. Este documento NO es ese plan todavia. ═══ */}
        {/* ═══ LA EDAD BIOLOGICA ESTIMADA (su tabla 3, 2026-10-26) ═══

            VA ANTES DE "Cómo estás" y no después, por el orden de su §7.1: primero qué tiene, después la
            solución. Y porque es el bloque que SOBREVIVE a la encuesta incompleta: si fuera debajo del
            diagnóstico, un paciente sin encuesta completa abriría su informe con un hueco.

            LAS DOS FRASES SON SUYAS, del motor (`presentacion-eb-bis`), no escritas aquí: la misma cifra
            sale por la pantalla del profesional y por este informe, y dos redacciones del mismo hecho
            acaban diciendo cosas distintas. */}
        {/* ═══ LA CIFRA GRANDE Y SOLA (Santiago, 2026-11-05) ═══

            *"La edad biologica estimada, grande, 'estimada por el modelo ANI-BIS-E'."*

            Era una fila mas entre los bloques, con la cifra en negrita dentro de un parrafo. Ahora es la
            pieza que sostiene la primera hoja: el rotulo pequeño en versalitas, el numero en 34 puntos y
            el IAE con su banda al lado.

            ═══ EL PIE ES EL UNICO SITIO DONDE NO SE ADOPTO LA SUGERENCIA, Y ES IMPORTANTE ═══

            La sugerencia pone bajo la cifra *"Diferencia estimada reportada por el equipo"*. En Atlas eso
            es FALSO: el delta no lo reporta el Biody, lo calcula la EB-BIS v7 de Gildardo con sus
            parametros 7.1.0. Atribuirlo al equipo seria decir que la cifra viene de un aparato cuando
            viene de un MODELO, y a un paciente que luego pregunte "¿esto lo midio la maquina?" habria que
            decirle que no. Su frase, que es la que Santiago aprobo, dice lo que de verdad pasa. */}
        {showAtlas && edadPac ? (
          <View style={styles.cifraBloque} wrap={false}>
            <Text style={styles.cifraRotulo}>Edad biológica estimada</Text>
            {/* ═══ LA CIFRA, CON SU ALTURA DECLARADA (2026-11-06) ═══

                El `lineHeight` no es decoracion: sin el, esta linea de 30 puntos y la de abajo se
                montaban una sobre otra en el PDF de verdad. Medido sobre el informe de la paciente real
                que mando Santiago: el "76,4 años" caia en y=610,5 y el texto del IAE en y=612,6, o sea
                DOS PUNTOS por encima y cruzandose en horizontal (x 237-340 contra x 182-393). En pantalla
                el bloque es una columna y parece correcto; en el papel se solapaban. */}
            <Text style={styles.cifraGrande}>{edadPac.cifra}</Text>
            {/* LA EDAD REAL, DEBAJO (Santiago, 2026-11-06). Sin ella la cifra grande no significa nada:
                "76,4 años" solo se puede leer sabiendo cuantos años tiene la persona. Sale de su propia
                formula (`EB = edad + IAE`), no de un dato nuevo. */}
            {edadPac.edadReal ? <Text style={styles.cifraEdadReal}>{edadPac.edadReal}</Text> : null}
            {/* LA FRASE, con la banda de Gildardo verbatim al final. Sustituye al IAE suelto
                ("+12,4 años: envejecimiento acelerado estimado"), que es cierto y no se entiende. */}
            <Text style={styles.cifraDelta}>{edadPac.frase}</Text>
            {/* EL PIE DE LA CIFRA SE FUSIONO CON LA EXPLICACION DE DEBAJO (2026-11-06): decian la misma
                cosa en dos bloques ("sale de tu medicion" / "estimada por el modelo sobre tu medicion"),
                y los dos bloques costaban una hoja. El hecho que aporta cada uno se conserva en la frase
                de abajo: QUIEN la estima (el modelo, no el equipo) y CONTRA QUE se compara. */}
          </View>
        ) : null}

        {/* ═══ AQUI IBA EL PARRAFO QUE EXPLICABA EL MODELO, Y SALE (Santiago, 2026-11-07) ═══

            Decia *"Estimada por el modelo ANI-BIS-E al comparar tu medición con personas de tu mismo
            sexo, tu misma edad y tu misma composición corporal. No es una enfermedad ni un pronóstico."*

            Su punto c lo marca como texto que sobra. LAS DOS COSAS QUE SI HACIAN FALTA DE EL VIAJAN
            AHORA EN LA FRASE DE LA CIFRA (`edad-para-el-paciente`): de donde sale el numero ("a partir
            de tu medición") y la media linea de seguridad ("Es una estimación: no es una enfermedad ni
            un pronóstico"). Lo que se pierde es el detalle del grupo de comparacion, que era la parte
            larga y la que empujaba la hoja.

            `CONTRA_QUIEN_SE_COMPARA` se BORRA del motor con el, y no se deja "por si acaso": no le
            quedaba ningun otro lector (verificado con grep antes de quitarlo), y una pieza muerta es el
            cable que alguien vuelve a conectar sin saber por que se desconecto. Su razonamiento, que es
            lo que valia la pena guardar (la v7 compara por sexo, edad Y composicion, asi que decir "de
            tu mismo sexo y edad" describiria otro modelo), se queda escrito en `eb-bis-v7` y en el
            propio `edad-para-el-paciente`. */}
        {/* LA NOTA DE LA ENCUESTA INCOMPLETA SE QUEDA, y ahora cuelga sola de la cifra: es lo que
            explica que el bloque de las cinco areas falte, asi que sin ella el informe tendria un hueco
            sin motivo. */}
        {showAtlas && edadPac && !dfi.complete ? (
          <View>
            <Text style={styles.para}>
              {NOTA_DFI_SIN_ENCUESTA}: cuando termines la encuesta, tu profesional puede completar la
              lectura por áreas.
            </Text>
          </View>
        ) : null}

        {/* ═══ LA FIGURA Y LAS CINCO AREAS, EN SU PROPIA HOJA (Santiago, 2026-10-30) ═══

            *"Despues del bloque 'Como estas' (el que termina en 'Requiere atencion...'), un salto de
            pagina: el radar y la explicacion de los 5 dominios van en su propia hoja. El radar, centrado
            en la hoja. Esa hoja con titulo propio."*

            EL SALTO ARREGLA ALGO MAS QUE EL AIRE: la figura mide 272 puntos de alto y no se puede partir
            (`wrap={false}`), asi que caia entera a la hoja siguiente cuando no cabia, dejando media hoja
            en blanco encima y separandola de las cinco frases que explica. Con el salto, el sitio de la
            figura deja de depender de cuanto texto haya salido antes, que es lo que lo hacia cambiar de un
            paciente a otro.

            ═══ EL TITULO DE ESTA HOJA, EN TRES PASOS (cerrado por Santiago el 2026-10-30) ═══

            Su propuesta era *"Tu salud bioelectrica en cinco dominios"*, y pidio decirlo si habia una
            mejor. Devolvi dos objeciones, las dos del contenido de la hoja:

              1 · DOS DE LAS CINCO AREAS NO SALEN DE LA MEDICION BIOELECTRICA. Conductual-Perceptual y
                  Epigenetico-Contextual salen de lo que el paciente CONTO en la encuesta. Llamar
                  "bioelectrica" al conjunto afirma de la figura algo que no es cierto de dos de sus cinco
                  ejes, y precisamente el DFI se llama INTEGRAL porque junta las dos fuentes.
              2 · EL DOCUMENTO YA LE DICE "AREA" AL PACIENTE, tres parrafos antes: *"debajo aparece cada
                  area por separado"*. "Dominios" seria una segunda palabra para la misma cosa en la misma
                  hoja, y es la palabra interna (el motor los llama dominios; el paciente no).

            Y EL CIERRE ES SUYO, con una razon que no estaba en la mesa: *"Santiago quiere 'bioelectrica'
            en el titulo, para posicionar el sistema"*. Eso no es cosmetico, es de producto, y no lo
            decide el contenido de la hoja. Su salida mete las dos cosas: *"Tu evaluacion bioelectrica
            INTEGRAL, area por area"*, porque *"'integral' es la palabra que cubre los ejes de la
            encuesta, y es la misma razon por la que el DFI se llama integral"*.

            Asi que de mis dos objeciones sobrevive la segunda (el titulo dice "area", como el resto del
            documento, y no introduce "dominios") y la primera queda CONTESTADA, no descartada: lo que
            afirmaria de mas, lo corrige "integral". ═══ */}
        {/* ═══ Y DESDE EL 2026-11-06 YA NO HAY SALTO DE PAGINA ═══

            Santiago: *"Me gustaria que toda la hoja 'Tu evaluacion bioelectrica integral, area por area'
            aparezca en la primera junto al cuadro y no haga espacio a otra hoja, ya que queda toda una
            hoja casi limpia."*

            Lo que el salto arreglaba (que la figura de 272 puntos no se partiera y no cayera sola a la
            hoja siguiente) sigue resuelto por otro lado: con los tres bloques que salieron hoy, encima de
            la figura ya no queda texto variable que la empuje. El `wrap={false}` de la figura se queda,
            que es lo que impide partirla. Verificado renderizando con un nombre largo y los cinco
            dominios: una sola hoja. */}
        {showAtlas && dfiPac && dfi.complete ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tu evaluación bioeléctrica integral, área por área</Text>

            {/* ═══ EL VEREDICTO INTEGRADO Y SU ORIENTACION, QUE ERAN EL BLOQUE "COMO ESTAS" (2026-11-05) ═══

                Su lista de hoy dice que el informe lleva SOLO cinco cosas, y "Como estas" no es ninguna de
                las cinco. Pero tampoco es ninguno de los tres que manda sacar, y la razon que saca a esos
                tres no lo alcanza: esto no recomienda nada, es la lectura del modelo sobre la medicion.

                ASI QUE NO SE PIERDE Y DEJA DE SER BLOQUE: encabeza la hoja de la figura, que es donde se
                explica. El documento no gana un bloque mas (que es lo que su "SOLO" quiere evitar) y el
                paciente no pierde la unica frase que le dice como esta en conjunto.

                ═══ LA PEQUEÑA EXPLICACION ES DE UNA NUTRICIONISTA (via Santiago, 2026-10-28) ═══

                *"Nombre del profesional, junto a una pequeña explicacion del resumen del diagnostico. Algo
                simple que el paciente pueda entender."*

                EXPLICA EL DOCUMENTO, NO AL PACIENTE: dice de donde salen las cifras y como se lee lo que
                sigue. Ni una palabra sobre que significa clinicamente, porque ese lenguaje es el de
                Gildardo (`dfiParaPaciente` es su mapa portado) y escribirlo nosotros seria inventar
                contenido clinico, que es justo lo que prohibe la Regla 0.

                Y SU TEXTO SIGUE SIENDO CIERTO EN EL SITIO NUEVO, que es lo que permite moverlo sin
                reescribirlo: dice *"la primera frase es el resumen general; debajo aparece cada area por
                separado, y la figura las muestra todas juntas"*, y aqui las tres cosas estan a la vista en
                esa misma hoja. Antes la figura quedaba en la hoja siguiente. */}
            {/* ═══ AQUI IBA EL PARRAFO QUE EXPLICABA COMO LEER EL DOCUMENTO, Y SALE (Santiago, 2026-11-06) ═══

                Decia *"Este es el resumen de tu valoracion... La primera frase es el resumen general;
                debajo aparece cada area por separado, y la figura las muestra todas juntas."* Santiago lo
                marco como texto que sobra, y su primera mitad ADEMAS dejo de ser cierta hoy: con el
                veredicto integrado apagado ya no hay "primera frase" que resuma nada, asi que el parrafo
                anunciaba un bloque que no esta.

                Lo que hacia falta de el sigue dicho por la propia figura: su leyenda explica que cuanto
                mas cerca del centro, mejor. */}
            {/* La bandera de arriba es el interruptor de Santiago: una linea, sin tocar nada mas. */}
            {EL_VEREDICTO_INTEGRADO_VA ? (
              <Text style={styles.para}>
                <Text style={styles.bold}>{dfiPac.riesgo}. </Text>
                {dfiPac.enfoque}
              </Text>
            ) : null}

            {/* EL RADAR VA ANTES DEL DETALLE, no despues: es el vistazo, y lo que sigue es la
                explicacion dominio por dominio. Al reves, quien lee las cinco frases ya no necesita la
                figura. Se dibuja solo; si faltan dominios medidos, no aparece.

                Y DIBUJA LAS DOS CONSULTAS cuando hay una anterior (Santiago, 2026-11-05): la de hoy en
                linea gruesa y la de entonces en contorno fino, con su leyenda. Si es inicial,
                `dominiosAnteriores` llega en null y sale como siempre. */}
            {/* ═══ EN LA HOJA 1 EL RADAR DIBUJA SOLO LA CONSULTA DE HOY (Santiago, 2026-11-06) ═══

                *"La hoja 1 muestra exactamente lo mismo, solo que el radar solo se muestra el de la
                evaluacion actual. Y no muestra el radar de seguimiento (2 evaluaciones)."*

                Las dos figuras pasan a la hoja 2, que es la hoja de la comparacion: ahi la leyenda de las
                dos lineas esta al lado de lo que explica, en vez de en la hoja del retrato de hoy. */}
            <RadarDelPaciente dominios={dfiPac.dominios} anteriores={null} />
            {dfiPac.dominios.map((d) => {
              // SIN COLOR cuando el dominio no se midio: pintarlo de verde seria la lectura favorable de
              // un vacio, que su punto 4 del 30-ago prohibe. Y SIN ETIQUETA, porque su mapa no cubre ese
              // caso; la lectura que el motor produce ya dice que no se evaluo.
              const color = d.sev == null ? "#d1d5db" : COLOR_SEVERIDAD[Math.min(3, Math.max(0, d.sev))];
              return (
                <View key={d.id} style={[styles.dominio, { borderColor: color }]} wrap={false}>
                  <Text>
                    <Text style={styles.bold}>{d.dominio}</Text>
                    {d.nivel ? (
                      <Text style={{ color, fontFamily: "Helvetica-Bold" }}>{`  ·  ${d.nivel}`}</Text>
                    ) : null}
                  </Text>
                  {/* ═══ LA LECTURA, EN LENGUAJE DE PACIENTE (Santiago, 2026-11-06) ═══

                      *"Los cinco textos de dominio son jerga ('microambiente hostil', 'fenotipo de
                      riesgo', 'carga contextual amplificada'). Aplica ya la propuesta en lenguaje
                      sencillo de la pregunta 13, marcada como provisional."*

                      El `?? d.lectura` no es defensivo por costumbre: es la salida. Esa capa es NUESTRA y
                      provisional (ver su archivo), y calla donde manda Gildardo: en el dominio conductual
                      con severidad alta, donde su frase de acompañamiento ya sustituyo la lectura, y en un
                      dominio sin medir. Si la capa se borra el dia que el conteste, el informe vuelve solo
                      a su texto clinico sin dejar un hueco. */}
                  <Text style={styles.dominioLectura}>
                    {lecturaSencilla(d.id, d.sev) ?? d.lectura}
                  </Text>
                </View>
              );
            })}
            {/* ═══ EL ACOMPAÑAMIENTO NO SE DICE DOS VECES (Santiago, 2026-11-06) ═══

                *"La frase del bienestar emocional sale dos veces en el seguimiento."*

                Y es cierto, y son DOS textos distintos de Gildardo que dicen lo mismo: la lectura del
                dominio conductual con severidad alta (*"Te acompañaremos de cerca en tu relación con la
                alimentación y la imagen corporal; tu bienestar emocional es la prioridad"*) y la frase
                del veto (*"Tu profesional te acompañará de cerca; priorizaremos tu bienestar emocional
                antes que cualquier cambio en la alimentación"*). Cuando el veto se activa, casi siempre
                el dominio conductual ya esta alto, asi que salian las dos seguidas.

                NO SE REESCRIBE NINGUNA, que es lo que la Regla 0 prohibe: se deja de pintar la SEGUNDA
                cuando la primera ya esta en la hoja. El paciente recibe la misma idea, una vez, con las
                palabras de el. */}
            {dfiPac.acompanamiento && !yaDijoElAcompanamiento ? (
              <Text style={styles.para}>{dfiPac.acompanamiento}</Text>
            ) : null}
          </View>
        ) : null}

        {/* ═══ EL PLAN YA NO VA EN ESTE DOCUMENTO (Santiago, 2026-10-30) ═══

            Aqui iban los tres ultimos bloques del plan que habian sobrevivido al recorte del 28 de
            octubre: "Lo que debes evitar", la lista de intercambio y el ejemplo de menu. Salen, y el
            criterio que los saca es mas general que el que los dejo: *"es transversal a todas las
            disciplinas: trata la salud bioelectrica, no la alimentacion"*.

            O SEA QUE EL CRITERIO DEL 28 ERA EL EQUIVOCADO, y conviene decirlo porque lo escribi yo aqui
            mismo: entonces la linea se trazo entre la CIFRA del profesional (que sale) y lo que el
            paciente puede seguir (que se queda). Con esa linea, el menu de la semana se quedaba. La linea
            de verdad es otra: este informe trata la salud bioelectrica del paciente, y la alimentacion es
            UNA de las disciplinas que la aplican. El mismo paciente puede ir a ejercicio o a psicologia,
            y su informe no puede parecer un informe de nutricion.

            NO SE PIERDE NADA, y esto es lo que hace que el recorte sea seguro: los tres bloques ya salen
            en la hoja del plan, y el correo ADJUNTA esa hoja cuando hay prescripcion emitida
            (`send-report`, segundo adjunto, desde el 28 de octubre). Si el adjunto no existiera, esto
            seria quitarle al paciente su menu. El candado de la §7.1 exige las dos mitades juntas.

            "Lo que debes evitar" sale con los otros dos porque SI es de alimentacion, que era su
            condicion (*"si es de alimentacion"*): el bloque pinta `plan.restricciones`, que el tipo
            documenta como *"lo que el paciente no puede comer"* y que se precarga de las tres preguntas
            de alergias e intolerancias de la encuesta. Comprobado, no supuesto.

            ═══ LO QUE SI QUEDA EN SU SITIO: LA SEÑAL DE QUE EL PLAN EXISTE ═══

            `PLAN_DISENO_DOCUMENTOS.md` §3 defendia que el informe llevara el plan entero, y de su
            argumento sobrevive una mitad que ahora hace falta mas que antes: *"lo que si conviene, y es
            distinto: que el informe DIGA que el plan va dentro... Hoy no lo dice en ninguna parte"*.

            Con los bloques fuera, un paciente que abre solo el informe no veria ni el plan ni una señal de
            que existe, y este es el sitio donde lo buscaria: donde estaba. Asi que queda la linea, no los
            bloques.

            VA EN CONDICIONAL Y NO MIRA SI HAY PRESCRIPCION, a proposito: el informe dejo de recibir el
            plan (y eso no se deshace por una frase), asi que no puede saberlo. Redactada asi es cierta en
            los dos casos, y el que no tiene plan no lee que le mandaron uno que no esta.

            ═══ Y LA LINEA BAJO AL FINAL EL 2026-11-05, porque ya no señala solo al plan ═══

            Con las rutas, los suplementos y las remisiones fuera, lo que vive en otro papel dejo de ser
            una cosa y pasaron a ser cuatro. La linea los cubre a todos y se mudo a donde estaban ellos,
            justo antes del seguimiento, por el mismo argumento con que se escribio: el paciente la busca
            donde estaba lo que falta. ═══ */}

        {/* ═══ LA COMPARACION CON LA CONSULTA ANTERIOR, TODA JUNTA (Santiago, 2026-11-05) ═══

            La banda de cambio bajo de la primera hoja hasta aqui, para que la evolucion se lea de una
            sola vez: esta banda (el texto que redacto Gildardo), la grafica de las tres medidas con sus
            frases, y el radar de las dos consultas, que esta en la hoja anterior porque es la misma
            figura.

            NI SU TEXTO NI SU GATEO CAMBIAN. Sigue dependiendo de `dfi.complete` (la banda es cambio de
            EB-BIS, salida que DEPENDE de la encuesta: con la encuesta a medias la EB se infla, D-007) y de
            que el profesional CONFIRMARA comunicar un "empeoro", que es un acto aparte de aprobar. */}
        {/* ═══ LA BANDA Y LA GRAFICA SE MUDARON, Y LA GRAFICA SALIO (Santiago, 2026-11-06) ═══

            LA BANDA DE CAMBIO (el texto verbatim de Gildardo) pasa a la hoja 2, que es la hoja de la
            comparacion. No cambia ni su redaccion ni su gateo: sigue dependiendo de `dfi.complete` y de
            que el profesional CONFIRMARA comunicar un "empeoro".

            LA GRAFICA DE PESO, MASA GRASA Y MASA SIN GRASA SALE DEL DOCUMENTO, con sus tres frases.
            Textual suyo: *"Peso: 98.4 kg / Masa grasa: 43.5 kg / Masa sin grasa: 54.9 kg... este texto y
            grafica tambien sobra. El paciente no quiere saber eso, simplemente un resumen de que mejoro y
            que debe seguir mejorando en terminos simples. No utilizar terminos asi como masa grasa, etc."*

            Y SE BORRAN LAS DOS PIEZAS QUE LA PINTABAN (`grafica-trayectoria.tsx` y
            `cambio-desde-la-anterior.ts`) en vez de dejarlas sin llamadores, por la razon de siempre: una
            pieza muerta es el cable que alguien vuelve a conectar sin saber por que se desconecto. Lo
            unico que se conserva de ellas es `CAMBIO_MINIMO_KG`, con su razon entera, porque la frase de la
            meta de peso sigue necesitando un piso: vive en `comparacion-paciente.ts`.

            EL EJEMPLO QUE SANTIAGO VIO EN ESA GRAFICA (+18 kg de peso y +25,5 kg de grasa en dos meses)
            NO ERA UN DEFECTO DE LA GRAFICA: medido el 2026-11-06, la toma del 13 de julio de ese paciente
            es la del XLSX de prueba (80,4 kg y 177 cm, la misma en 29 mediciones de 23 pacientes) y la del
            14 de septiembre mide 164 cm. Son dos cuerpos distintos, y en toda la cohorte es el UNICO salto
            de ese tamaño. Queda anotado donde se decide que hacer con la data de prueba. */}

        {/* ═══ LAS RUTAS, LOS SUPLEMENTOS Y LAS REMISIONES SALEN DEL INFORME  ·  Santiago, 2026-11-05 ═══

            Aqui iban tres bloques: "Lo que vas a trabajar", "Tus suplementos" y "Otros profesionales que
            te pueden acompañar". Su razon, literal: *"el informe no puede recomendar algo que la
            profesional no recomendo. Viven en la HC y en la hoja del plan."*

            ═══ POR QUE ESTA RAZON ES MAS FUERTE QUE LAS DOS ANTERIORES ═══

            Los tres bloques pintaban, uno al lado del otro y rotulados, lo que sugirio el MODELO y lo que
            indico la PROFESIONAL. El rotulo era correcto y no bastaba: en el papel que le entrega su
            nutricionista, "Nutraceuticos recomendados" se lee como una indicacion suya, no como la salida
            de un clasificador. Y mientras la sugerencia del modelo este en el documento, la distincion
            depende de que el paciente lea con cuidado; fuera, no depende de nada.

            ═══ NO SE PIERDE NADA, Y ES LA CONDICION QUE HACE SEGURO EL RECORTE ═══

            Las tres cosas siguen existiendo donde SI son del profesional: en la historia clinica (que es
            su documento) y en la hoja del plan (que el correo adjunta cuando hay prescripcion emitida).
            Lo que el paciente pierde es verlas atribuidas a quien no las decidio.

            LO QUE SE VA CON ELLAS, y conviene decirlo porque fue trabajo de dos rondas: la frase para un
            area sin ninguna linea en lenguaje de paciente (2026-11-03) y la linea de procedencia de los
            suplementos (2026-09-20). Las dos existian para que esos bloques no engañaran; sin los bloques
            no tienen a quien proteger.

            Y EL LECTOR NO SE TOCA: `informe-paciente-reader` sigue armando las rutas, los suplementos y
            las remisiones, porque los lee la pantalla del profesional. Lo que cambia es que este documento
            no los pinte. ═══ */}

        {/* ═══ DONDE ESTA EL RESTO, EN UNA LINEA (ver el comentario del plan, mas arriba) ═══

            Un informe que no lleva ni rutas, ni suplementos, ni remisiones, ni plan se lee como un informe
            al que le falta algo, y el paciente no tiene como saber que eso vive en otro papel. Santiago lo
            dice en su mensaje (*"viven en la HC y en la hoja del plan"*); esta linea es lo que se lo dice
            a el.

            VA EN CONDICIONAL Y NO MIRA SI HAY PRESCRIPCION NI REMISIONES, a proposito: el documento dejo
            de recibir esos datos, asi que no puede saberlo. Redactada asi es cierta en los dos casos, y
            quien no tiene plan no lee que le mandaron uno que no esta. */}
        {/* ═══ Y LA LINEA SALE EL 2026-11-06, POR DECISION DE SANTIAGO ═══

            *"Creo que este texto sobra: 'Lo que vas a trabajar, los suplementos y las remisiones a otros
            profesionales los decide quien te atendió...'"*

            El argumento con que se escribio era que un informe sin rutas ni suplementos se lee como un
            informe al que le falta algo. Su respuesta, implicita en la maqueta que mando, es que la hoja
            ya no se lee asi: con el titulo nuevo ("Informe de evaluacion bioelectrica") el documento
            ANUNCIA de que es, y entonces no promete nada que no traiga. La hoja del plan sigue viajando
            adjunta al mismo correo cuando hay prescripcion. */}

        {/* ═══ LA NOTA DE INTERPRETACION, AL CIERRE DE LA HOJA 1 (Santiago, 2026-11-06) ═══

            Su texto, verbatim. Por que ahora si, cuando una frase parecida se retiro el 2026-09-01: ver el
            punto 4 de la cabecera del archivo. En una linea: entonces convivia con un veredicto de riesgo
            que la contradecia, y ese veredicto ya no esta. */}
        {/* VA EN LETRA PEQUEÑA, como el derecho a la historia clinica, y por la misma razon: es una nota
            sobre COMO se lee el documento, no contenido clinico, y en el cuerpo del texto competia con
            las cinco areas. Es ademas lo que su maqueta dibuja (la nota al cierre de la hoja) y lo que
            hace que la hoja 1 quepa entera. El rotulo va en negrita dentro de la misma linea. */}
        {showAtlas ? (
          <Text style={styles.notaAlPie}>
            <Text style={styles.bold}>Interpretación. </Text>
            {NOTA_DE_INTERPRETACION}
          </Text>
        ) : null}

        {/* EN UN INFORME INICIAL ESTA ES LA ULTIMA HOJA, asi que la observacion de la profesional va
            aqui. En un seguimiento va al final de la hoja 2, que es la ultima: el paciente la busca al
            final del documento, no al final de la primera hoja. */}
        {esSeguimiento ? null : bloqueDeSeguimiento}

        {/* "NOTAS DEL PROFESIONAL" SE RETIRO (smoke de Santiago, 2026-09-19): salia DOS VECES lo mismo.
            La observacion de la consulta ya viaja arriba, en "Tu seguimiento", que es su sitio (va con la
            proxima cita, que es la otra cosa que el paciente necesita saber de su seguimiento). Este
            bloque era el de las notas del REPORTE, que se retiraron; al empezar a mandar la observacion
            por el camino del modo de envio, el mismo texto se pinto en dos sitios con dos rotulos.

            SE CONSERVA PARA LOS INFORMES VIEJOS, que no traen `informe`: ahi la nota es lo unico que hay
            y no puede desaparecer al reconstruir el documento. */}
        {showNotes && !informe ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nota de tu profesional</Text>
            <Text style={styles.para}>{notes}</Text>
          </View>
        ) : null}

        {/* EL DERECHO A LA HISTORIA CLINICA, y va SIEMPRE, en los tres modos de envio.
            Asesoria legal (2026-09-01): el paciente tiene derecho a su historia clinica COMPLETA
            (Resolucion 1995 y Ley 1581). El criterio clinico de Gildardo -que la historia es el documento
            del profesional y no se manda por defecto- es legitimo y se respeta: NO se adjunta. Pero el
            derecho es de acceso A SOLICITUD, y un derecho que el titular no sabe que tiene esta vacio.
            Esta linea es lo unico que hace que exista.

            DISCRETA A PROPOSITO, no destacada: no invita ni disuade, informa. Va en el pie y no en un
            bloque propio.

            Y DICE "A TU PROFESIONAL", no a CNV, porque es exacto: el profesional es el responsable del
            tratamiento y CNV el encargado (Anexo 3, clausula 13). Mandarlo a CNV lo mandaria a quien no
            puede entregarsela.

            La entrega es GRATUITA y no se dice aqui porque decirlo invita a pensar que podria no serlo.

            ═══ Y VA UNA SOLA VEZ, EN LA ULTIMA HOJA (Santiago, 2026-11-06) ═══

            *"'Puedes solicitar tu historia clinica', en las dos hojas: va una sola vez, al final."* En un
            informe inicial esta ES la ultima hoja, asi que sale aqui; en uno de seguimiento se calla aqui
            y sale al cierre de la hoja 2. Una frase que se repite en un documento de dos hojas se lee
            como un documento descuidado, y ademas gasta el sitio que necesita lo que solo se dice una
            vez. */}
        {esSeguimiento ? null : (
          <Text style={styles.derechoHc}>
            Puedes solicitar tu historia clínica completa a tu profesional tratante.
          </Text>
        )}

        {/* EL PIE: la firma de CNV y el identificador (ver el comentario de `pie`). Llevaba tambien
            "Motor anibise-1.2.0 · Modelo ANI-BIS-E 1.0 · Reglas 1.0", que se retiro en el smoke del
            2026-09-01: esas tres versiones son la CONSTELACION de la regla dura 7 y NO se pierden, viven
            selladas en el snapshot, que es donde se piden si alguien reconstruye un caso. */}
        {pie}
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════════════════════════
          HOJA 2 · SEGUIMIENTO  ·  Santiago, 2026-11-06

          Su maqueta, en orden: el titulo y su subtitulo; el cuadro de comparacion de la edad estimada;
          el radar con las dos lineas y su leyenda; las cinco areas con si mejoraron o conviene
          trabajarlas; y un resumen corto que motive, en un parrafo, sin pasar a una tercera hoja.

          SOLO SALE CON CONSULTA ANTERIOR COMPARABLE: ver `esSeguimiento` arriba. Un informe inicial
          termina en la hoja 1, que es lo que el pidio ("El primero solo tiene 1 hoja y el segundo tiene
          2 hojas").
          ══════════════════════════════════════════════════════════════════════════════════════════ */}
      {esSeguimiento && dfiPac && dominiosAnteriores ? (
        <Page size="LETTER" style={styles.pageInforme}>
          <FranjaDeMarca />
          <Text style={styles.tituloDeHoja}>Seguimiento de la evaluación</Text>
          <Text style={styles.subtituloDeHoja}>
            Cómo has cambiado desde tu consulta del {formatDateOnlyLong(dominiosAnteriores.fecha)}
          </Text>

          {/* ═══ LA COMPARACION DE LA EDAD ESTIMADA ═══

              *"Tabla/cuadro de EBBIS e IAE con comparacion de la consulta actual vs la anterior. Si
              mejoro o debe seguir trabajandose."*

              DOS DECISIONES QUE CONVIENE VER:

              1 · EL VEREDICTO NO LO ESCRIBIMOS NOSOTROS. Debajo del cuadro va el texto de Gildardo (la
                  banda de trayectoria), que es verbatim suyo y ya trae su propio gate: el "empeoro" no
                  llega al paciente sin que el profesional lo confirme. Un segundo juicio nuestro sobre la
                  misma resta seria dos fuentes del mismo veredicto, y una sin ese gate.

              2 · SE COMPARA LA EDAD ESTIMADA, Y EL IAE DE HOY VA AL LADO SIN COMPARARSE. El IAE es la
                  edad estimada menos la cronologica, y entre dos consultas la cronologica tambien cambio:
                  restar dos IAE mezcla las dos cosas en una sola cifra que no significa nada simple. Si
                  Gildardo quiere la comparacion del IAE, es una fila mas y su texto. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tu edad biológica estimada</Text>
            {edad?.estado === "comparable" && ebBis && ebAnteriorEnPiezas ? (
              <>
                <View style={styles.tableRow}>
                  <Text style={[styles.cellLabel, { width: 130 }]}>Ahora</Text>
                  <Text style={[styles.cellValue, styles.bold]}>{ebBis.cifra}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.cellLabel, { width: 130 }]}>Consulta anterior</Text>
                  <Text style={styles.cellValue}>{ebAnteriorEnPiezas.cifra}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.cellLabel, { width: 130 }]}>Diferencia</Text>
                  <Text style={[styles.cellValue, styles.bold]}>{edad.frase}</Text>
                </View>
                {/* EL VEREDICTO, SUYO Y VERBATIM, con su gate intacto. */}
                {showBand ? <Text style={[styles.para, { marginTop: 6 }]}>{bandText}</Text> : null}
                {showBand && bandAppointmentDate ? (
                  <Text style={styles.para}>
                    {/* En letras y sin convertir zona: `patient_band_appointment_date` tambien sale de
                        una columna `date`, y llegaba aqui sin formatear. */}
                    Tu próxima cita está agendada para el {formatDateOnlyLong(bandAppointmentDate)}.
                  </Text>
                ) : null}
              </>
            ) : (
              /* LO NO COMPARABLE SE DICE, no se deja en blanco ni se compara a medias. El motivo lo
                 redacta el motor (`comparacionDeLaEdad`), en lenguaje de paciente. */
              <Text style={styles.para}>
                {edad && edad.estado === "sin_comparacion"
                  ? edad.porque
                  : "Todavía no se puede comparar esta cifra."}
              </Text>
            )}
          </View>

          {/* EL RADAR CON LAS DOS FIGURAS Y SU LEYENDA, que es la que explica que significa estar por
              dentro. Aqui esta al lado de lo que compara, y no en la hoja del retrato de hoy. */}
          <RadarDelPaciente
            dominios={dfiPac.dominios}
            anteriores={{ ...dominiosAnteriores, fecha: formatDateOnlyLong(dominiosAnteriores.fecha) }}
          />

          {/* ═══ LAS CINCO AREAS, CON SU CAMBIO ═══

              *"Me gustaria mostrar nuevamente los 5 dominios y cada uno si mejoro o empeoro con la
              explicacion."*

              LA ESCALA ES LA QUE YA EXISTE: la severidad por area (0 a 3) de su clasificador. El cambio
              mas pequeño posible es pasar de un nivel al siguiente, asi que no hace falta inventar un
              umbral; queda en `CAMBIO_MINIMO_AREA` por si el decide que hacen falta dos.

              LAS TRES FRASES SON NUESTRAS Y PROVISIONALES, y entran a PENDIENTES para que el las apruebe
              o las reescriba: no hay texto suyo para "esta area mejoro". El NOMBRE y la LECTURA de cada
              area si son suyos, del mapa de paciente. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Área por área</Text>
            {dfiPac.dominios.map((d, i) => {
              const cambio = areas[i];
              const color = d.sev == null ? "#d1d5db" : COLOR_SEVERIDAD[Math.min(3, Math.max(0, d.sev))];
              return (
                <View key={d.id} style={[styles.dominio, { borderColor: color }]} wrap={false}>
                  <Text>
                    <Text style={styles.bold}>{d.dominio}</Text>
                    {cambio ? <Text style={styles.dominioLectura}>{`  ·  ${cambio.frase}`}</Text> : null}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ═══ EL PARRAFO QUE ANIMA, SIN MENTIR ═══

              *"Resumen corto de como va respecto a la meta de peso, de mejoras/cosas a mejorar. Algo como
              que motive en un parrafo. Que no se extienda a la tercera hoja. En un lenguaje que el
              paciente entienda."*

              FRASES FIJAS, NUNCA GENERADAS POR IA, y la primera la elige el CONTEO de areas, asi que no
              puede decir "mejoraste" cuando ninguna mejoro. La meta de peso solo si esta registrada y
              siempre en la direccion de esa meta. Las cuatro reglas estan en
              `clinical-engine/comparacion-paciente.ts`. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lo que dice tu seguimiento</Text>
            <Text style={styles.para}>{parrafoDeAnimo(areas, metaPeso)}</Text>
          </View>

          {/* LA OBSERVACION DE LA PROFESIONAL CIERRA LA ULTIMA HOJA. */}
          {bloqueDeSeguimiento}

          <Text style={styles.derechoHc}>
            Puedes solicitar tu historia clínica completa a tu profesional tratante.
          </Text>
          {pie}
        </Page>
      ) : null}
    </Document>
  );
}
