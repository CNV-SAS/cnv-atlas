import { Document, Page, View } from "@react-pdf/renderer";

// EL `Text` NO VIENE DEL PAQUETE: viene del envoltorio que traduce los simbolos que la fuente del PDF no
// sabe dibujar (ver `text-seguro`). Un candado lo exige en toda esta carpeta.
import { Text } from "./text-seguro";

import { dfiParaPaciente, type EngineOutput } from "@/clinical-engine";
import { EncabezadoEnCuadros } from "./encabezado-en-cuadros";
import { COLOR_SEVERIDAD, RadarDelPaciente } from "./radar-del-paciente";

import { cambioDesdeLaAnterior } from "../cambio-desde-la-anterior";
import { ebBisEnPiezas, NOTA_DFI_SIN_ENCUESTA } from "@/clinical-engine/presentacion-eb-bis";
import { styles } from "./estilos-del-pdf";
import { formatDateOnly } from "@/lib/format/date";

import type { PuntoDelPaciente } from "../data/serie-del-paciente";
import type { DominiosAnteriores, InformeDelPaciente } from "../data/reports-view-types";
import { GraficaTrayectoria } from "./grafica-trayectoria";

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
export const EL_VEREDICTO_INTEGRADO_VA = true;

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
  // El cambio desde la consulta anterior, en frases. Vacio cuando no hay dos mediciones que comparar, y
  // entonces el bloque de seguimiento sale solo con su grafica, como estaba.
  const cambios = showAtlas ? cambioDesdeLaAnterior(serie) : [];
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
  return (
    <Document
      title={`Informe ANI-BIS-E ${meta.documentLabel}`}
      author="Connected Nutrition Ventures"
    >
      {/* CARTA, NO A4 (Santiago, 2026-09-20). Salia en A4 mientras la historia clinica (`hc-document`) y
          todo lo que se imprime desde pantalla (`@page { size: letter }`) salian en CARTA: el mismo
          documento tenia dos formas segun por donde se pidiera, y en Colombia el papel es carta. A4 es mas
          angosta y mas alta (210x297 mm contra 216x279), asi que no es la misma hoja con otro nombre:
          impresa en carta deja margenes desiguales, y las dos medidas son las que Santiago necesita para
          la maqueta. */}
      <Page size="LETTER" style={styles.page}>
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
            titulo: "Informe ANI-BIS-E",
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
        {showAtlas && ebBis ? (
          <View style={styles.cifraBloque} wrap={false}>
            <Text style={styles.cifraRotulo}>Edad biológica estimada</Text>
            <Text style={styles.cifraGrande}>{ebBis.cifra}</Text>
            {/* EL IAE CON SU BANDA, verbatim del motor: la cifra con signo y su veredicto son de su
                tabla 3, y la banda ("envejecimiento acelerado estimado") es lectura clinica suya. */}
            <Text style={styles.cifraDelta}>{ebBis.iae}</Text>
            <Text style={styles.cifraPie}>
              Estimada por el modelo ANI-BIS-E sobre tu medición de bioimpedancia.
            </Text>
          </View>
        ) : null}

        {showAtlas && ebBis ? (
          <View style={styles.section}>
            {/* QUE ES, EN UNA LINEA. Su tabla da la cifra y su banda, no una explicación; sin ella la
                frase "acorde con sus pares" deja al paciente sin saber con quién se lo compara. Esto
                describe de dónde sale el número, no lo interpreta: el veredicto es el de su banda. */}
            <Text style={styles.para}>
              Es una estimación que sale de tu medición corporal, comparada con personas de tu misma edad
              y composición. No es una enfermedad ni un pronóstico: es un punto de partida para lo que
              vas a trabajar con tu profesional.
            </Text>
            {/* SU NOTA, cuando la encuesta no está completa (tabla 3): la edad biológica sale sola y el
                diagnóstico integrado queda pendiente. Es lo que explica que el bloque siguiente falte. */}
            {!dfi.complete ? (
              <Text style={styles.para}>
                {NOTA_DFI_SIN_ENCUESTA}: cuando termines la encuesta, tu profesional puede completar la
                lectura por áreas.
              </Text>
            ) : null}
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
        {showAtlas && dfiPac && dfi.complete ? (
          <View style={styles.section} break>
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
            <Text style={styles.para}>
              Este es el resumen de tu valoración: cómo está tu cuerpo hoy, según las medidas que te tomamos
              y lo que nos contaste. La primera frase es el resumen general; debajo aparece cada área por
              separado, y la figura las muestra todas juntas. Si algo no te queda claro, pregúntaselo a
              quien te atendió.
            </Text>
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
            <RadarDelPaciente
              dominios={dfiPac.dominios}
              anteriores={
                dominiosAnteriores
                  ? { ...dominiosAnteriores, fecha: formatDateOnly(dominiosAnteriores.fecha) }
                  : null
              }
            />
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
                  <Text style={styles.dominioLectura}>{d.lectura}</Text>
                </View>
              );
            })}
            {dfiPac.acompanamiento ? (
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
        {showBand ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cambio respecto a tu medición anterior</Text>
            <Text>{bandText}</Text>
            {/* §6: la fecha va como frase aparte, sin tocar el verbatim de Gildardo de arriba. */}
            {bandAppointmentDate ? (
              <Text style={{ marginTop: 4 }}>
                Tu próxima cita está agendada para el {bandAppointmentDate}.
              </Text>
            ) : null}
          </View>
        ) : null}

        {showAtlas && serie.length >= 2 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cómo has cambiado</Text>
            <Text style={styles.para}>
              Tus medidas en las últimas consultas. Son las mismas que te toma el equipo cada vez.
            </Text>
            <GraficaTrayectoria puntos={serie} />
            {/* ═══ EL CAMBIO EN PALABRAS, NO SOLO EN LA GRAFICA (una nutricionista, via Santiago,
                2026-10-28) ═══

                *"Si el paciente va para seguimiento, animarlo comparando el seguimiento con la consulta
                anterior."*

                La gráfica ya estaba; una gráfica de tres líneas no es una frase. Las reglas de qué se
                puede decir y por qué no hay umbral están en `cambio-desde-la-anterior.ts`. Va DESPUES de la
                figura: la figura es el recorrido completo y esto es el último tramo. */}
            {cambios.length ? (
              <>
                <Text style={[styles.para, styles.bold]}>Desde tu consulta anterior</Text>
                {cambios.map((c) => (
                  <Text key={c.medida} style={styles.para}>
                    {c.texto}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

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
        {showAtlas ? (
          <View style={styles.section}>
            <Text style={styles.para}>
              Lo que vas a trabajar, los suplementos y las remisiones a otros profesionales los decide
              quien te atendió, y van en los documentos que ella te entrega: tu hoja del plan, que llega
              junto con este informe cuando hay plan de alimentación, y tu historia clínica.
            </Text>
          </View>
        ) : null}

        {showAtlas && informe && (informe.seguimiento.observacion || informe.seguimiento.proximaCita) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tu seguimiento</Text>
            {/* LA OBSERVACION LLEVA SU ROTULO (Santiago, 2026-09-19): suelta debajo del titulo parecia un
                texto del sistema. Decir de quien es cambia como se lee: no es una nota automatica, es lo
                que su profesional escribio sobre ESTA consulta. */}
            {informe.seguimiento.observacion ? (
              <>
                <Text style={[styles.para, styles.bold]}>Observaciones de tu profesional:</Text>
                <Text style={styles.para}>{informe.seguimiento.observacion}</Text>
              </>
            ) : null}
            {informe.seguimiento.proximaCita ? (
              <Text style={styles.para}>
                <Text style={styles.bold}>Tu próxima consulta: </Text>
                {informe.seguimiento.proximaCita}
              </Text>
            ) : null}
          </View>
        ) : null}

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

            La entrega es GRATUITA y no se dice aqui porque decirlo invita a pensar que podria no serlo. */}
        <Text style={styles.derechoHc}>
          Puedes solicitar tu historia clínica completa a tu profesional tratante.
        </Text>

        {/* EL PIE: SOLO EL IDENTIFICADOR (decision del smoke 2026-09-01).
            Llevaba tambien "Motor anibise-1.2.0 · Modelo ANI-BIS-E 1.0 · Reglas 1.0". Esas tres versiones
            son la CONSTELACION de la regla dura 7 y NO se pierden: viven selladas en el snapshot y en el
            diagnostico, que es donde se piden si alguien reconstruye un caso. En el documento del paciente
            no informan a nadie y suman jerga a un pie de pagina.
            El ID SE QUEDA porque es lo unico del pie que el paciente puede USAR: es como se identifica su
            documento si llama a preguntar. Y desde el se llega a las tres versiones. */}
        <Text style={styles.footer} fixed>
          Informe {meta.reportId}
        </Text>
      </Page>
    </Document>
  );
}
