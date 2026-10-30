import { Document, Page, Text, View } from "@react-pdf/renderer";

import { dfiParaPaciente, type EngineOutput } from "@/clinical-engine";
import { MarcaDeFondo } from "./marca-de-fondo";
import { COLOR_SEVERIDAD, RadarDelPaciente } from "./radar-del-paciente";

import { cambioDesdeLaAnterior } from "../cambio-desde-la-anterior";
import { ebBisParaTodos, NOTA_DFI_SIN_ENCUESTA } from "@/clinical-engine/presentacion-eb-bis";
import { styles } from "./estilos-del-pdf";

import type { PuntoDelPaciente } from "../data/serie-del-paciente";
import type { InformeDelPaciente } from "../data/reports-view-types";
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
// INDICADORES EN EL REPORTE DEL PACIENTE
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
   * LO QUE HACE DE ESTO UN INFORME Y NO SOLO UN PLAN (Santiago, 2026-09-19): las rutas que va a trabajar,
   * sus suplementos (los que sugiere el modelo y los que le indico su profesional), a que otros
   * profesionales acudir, y su seguimiento. null = no se pudo reunir, y el documento sale sin esa parte
   * en vez de no salir.
   */
  informe?: InformeDelPaciente | null;
  /**
   * LA TRAYECTORIA DEL PACIENTE (peso, masa grasa y masa sin grasa por consulta). Vacia = no hay dos
   * mediciones que comparar, y entonces el bloque no se pinta: una trayectoria de un punto no lo es.
   */
  serie?: PuntoDelPaciente[];
}) {
  // SOLO SE DESESTRUCTURA LO QUE ESTE DOCUMENTO PUEDE IMPRIMIR. `indicators`, `efrPhenotype`,
  // `structural`, `frSector` y `versions` se retiraron con sus bloques (§7.1): un documento que no tiene
  // el dato no puede filtrarlo por descuido. `dfi` se conserva SOLO por `dfi.complete`, que gatea la banda.
  const { dfi, nutraceuticos } = snapshot;
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
  const ebBisPaciente =
    snapshot.ebBis?.estado === "ok"
      ? ebBisParaTodos(snapshot.ebBis.eb, snapshot.ebBis.iae)
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
        {/* LO PRIMERO DE LA PAGINA, para quedar DETRAS del contenido: @react-pdf pinta en orden. */}
        <MarcaDeFondo />
        <Text style={styles.title}>Informe ANI-BIS-E del paciente</Text>
        <Text style={styles.subtitle}>Connected Nutrition Ventures</Text>

        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Paciente</Text>
            <Text>{meta.patientName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Documento</Text>
            <Text>{meta.documentLabel}</Text>
          </View>
          {/* DOS FECHAS, no una (smoke 2026-09-01). "Fecha" a secas era la de la MEDICION, y el paciente no
              tiene como saberlo: puede haberse medido un dia y haber sido atendido otro, y con el tamizaje
              en casa las dos se van a separar siempre. Rotularlas es lo que las distingue.
              La de consulta esta preguntada a Gildardo (punto 2 de la ronda del 31: su archivo la CAPTURA y
              Atlas la deduce). Mostrarla no se adelanta a esa respuesta: si dice que debe capturarse,
              cambia de DONDE sale, no si se muestra. */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha de la medición</Text>
            <Text>{meta.evaluationDate}</Text>
          </View>
          {meta.consultationDate ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Fecha de la consulta</Text>
              <Text>{meta.consultationDate}</Text>
            </View>
          ) : null}
          {/* QUIEN LO ATENDIO, al final del encabezado: la ultima linea del bloque es la que se lee como
              firma. Si no se pudo resolver el nombre, la fila no sale. */}
          {meta.profesional ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Te atendió</Text>
              <Text>
                {meta.profesional.nombre}
                {meta.profesional.profesion ? ` · ${meta.profesional.profesion}` : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {/* AQUI IBA "Patrones asociados a valorar clínicamente, no constituye diagnóstico", y se retiro el
            2026-09-01. Era NUESTRA (no aparece ni una vez en su archivo) y contradecia dos cosas a la vez:
            el bloque siguiente, que se titula "Cómo estás" y le dice al paciente que su envejecimiento
            esta acelerado; y su §7.1, que pone el DIAGNOSTICO como lo primero que el paciente recibe.
            Un documento que diagnostica y ademas declara que no diagnostica no protege a nadie: confunde
            al paciente sobre que tiene en la mano. */}

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
        {showAtlas && ebBisPaciente ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tu edad biológica estimada</Text>
            <Text style={styles.para}>
              <Text style={styles.bold}>{ebBisPaciente.eb}</Text>
            </Text>
            <Text style={styles.para}>{ebBisPaciente.iae}</Text>
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

        {showAtlas && dfiPac && dfi.complete ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cómo estás</Text>
            {/* ═══ LA PEQUEÑA EXPLICACION DEL RESUMEN (una nutricionista, via Santiago, 2026-10-28) ═══

                *"Nombre del profesional, junto a una pequeña explicacion del resumen del diagnostico. Algo
                simple que el paciente pueda entender."*

                EXPLICA EL DOCUMENTO, NO AL PACIENTE: dice de donde salen las cifras y como se lee lo que
                sigue. Ni una palabra sobre que significa clinicamente, porque ese lenguaje es el de
                Gildardo (`dfiParaPaciente` es su mapa portado) y escribirlo nosotros seria inventar
                contenido clinico, que es justo lo que prohibe la Regla 0.

                Y NO VUELVE EL "no constituye diagnostico" que se retiro el 2026-09-01: ese negaba lo que el
                bloque afirma. Esto no niega nada; orienta la lectura. */}
            <Text style={styles.para}>
              Este es el resumen de tu valoración: cómo está tu cuerpo hoy, según las medidas que te tomamos
              y lo que nos contaste. La primera frase es el resumen general; debajo aparece cada área por
              separado, y la figura las muestra todas juntas. Si algo no te queda claro, pregúntaselo a
              quien te atendió.
            </Text>
            <Text style={styles.para}>
              <Text style={styles.bold}>{dfiPac.riesgo}. </Text>
              {dfiPac.enfoque}
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

            ═══ EL TITULO: EL SUYO DICE "salud bioelectrica" Y PROPONGO OTRO ═══

            Su propuesta era *"Tu salud bioelectrica en cinco dominios"*, y pidio decirlo si habia una
            mejor. Hay dos razones para cambiarla, y las dos son del contenido de la hoja:

              1 · DOS DE LAS CINCO AREAS NO SALEN DE LA MEDICION BIOELECTRICA. Conductual-Perceptual y
                  Epigenetico-Contextual salen de lo que el paciente CONTO en la encuesta. Llamar
                  "bioelectrica" al conjunto afirma de la figura algo que no es cierto de dos de sus cinco
                  ejes, y precisamente el DFI se llama INTEGRAL porque junta las dos fuentes.
              2 · EL DOCUMENTO YA LE DICE "AREA" AL PACIENTE, tres parrafos antes: *"debajo aparece cada
                  area por separado"*. "Dominios" seria una segunda palabra para la misma cosa en la misma
                  hoja, y es la palabra interna (el motor los llama dominios; el paciente no).

            Asi que el titulo recoge el de la hoja anterior: "Como estas" y "Como estas, area por area".
            El par dice solo lo que la hoja hace, sin terminologia nueva. ═══ */}
        {showAtlas && dfiPac && dfi.complete ? (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Cómo estás, área por área</Text>
            {/* EL RADAR VA ANTES DEL DETALLE, no despues: es el vistazo, y lo que sigue es la
                explicacion dominio por dominio. Al reves, quien lee las cinco frases ya no necesita la
                figura. Se dibuja solo; si faltan dominios medidos, no aparece. */}
            <RadarDelPaciente dominios={dfiPac.dominios} />
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
            los dos casos, y el que no tiene plan no lee que le mandaron uno que no esta. ═══ */}
        {showAtlas ? (
          <View style={styles.section}>
            <Text style={styles.para}>
              Si tu profesional te indicó un plan de alimentación, lo recibes en una hoja aparte, junto
              con este informe: ahí están tu menú de ejemplo, la lista de intercambio y lo que conviene
              evitar.
            </Text>
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

        {/* ═══ LO QUE VA DESPUES DEL PLAN ═══

            EL ORDEN es el de la consulta: que tienes (arriba), que vas a comer (el plan), que vas a
            trabajar (las rutas), que vas a tomar (los suplementos), a quien mas acudir (las remisiones) y
            cuando te vuelven a ver (el seguimiento).

            LO DEL MODELO Y LO DEL PROFESIONAL VAN SEPARADOS Y ROTULADOS (Santiago): no es lo mismo lo que
            sugiere el modelo que lo que su profesional decidio para el. Y si el profesional no indico
            nada, no se pinta un bloque vacio: sale solo lo del modelo.

            LAS INDICACIONES SON VERBATIM DE GILDARDO, filtradas de lenguaje del modelo en el lector
            (`informe-paciente-reader`): aqui no se reescribe ninguna. */}
        {showAtlas && informe && informe.rutas.length ? (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Lo que vas a trabajar</Text>
            {informe.rutas.map((r) => (
              <View key={r.titulo} style={styles.diaMenu}>
                <Text style={styles.bold}>{r.titulo}</Text>
                {r.indicaciones.map((i) => (
                  <Text key={i} style={styles.para}>
                    · {i}
                  </Text>
                ))}
                {r.frecuencia ? (
                  <Text style={styles.para}>Control: {r.frecuencia.toLowerCase()}.</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {showAtlas ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tus suplementos</Text>
            {/* ═══ DE DONDE SALEN, EN UNA LINEA (Santiago, 2026-09-20) ═══

                SU PEDIDO: que el paciente entienda por que le recomiendan justo esos.

                LO QUE SE DICE es la PROCEDENCIA: que salen de su medicion y que pueden cambiar. Eso es
                verdad literal (la sugerencia del modelo se resuelve con los clasificadores de esta
                consulta) y no nombra nada del modelo.

                LO QUE NO SE DICE, y es deliberado: POR QUE ESOS Y NO OTROS. La respuesta honesta nombraria
                los cuatro clasificadores de los que sale la sugerencia, y §7.1 prohibe el CONCEPTO, no
                solo la sigla (Gildardo retiro hasta "Sector funcional (FyR)"). Una version en lenguaje
                llano ("por tu funcion celular") seria el mismo indice con otro nombre. Santiago decidio
                (2026-09-21) que la procedencia basta y que no se le pregunta a Gildardo. */}
            <Text style={styles.para}>
              Estos suplementos no son una recomendación general: salen de tu propia medición de esta
              consulta y de lo que tu profesional decidió para ti. Si en el próximo control tus resultados
              cambian, la recomendación puede cambiar contigo.
            </Text>
            {/* LA CADENA DEL MODELO se conserva aunque haya prescripcion: son dos cosas distintas, y el
                paciente tiene derecho a saber que sugirio el modelo y que decidio su profesional. */}
            <Text style={styles.para}>
              <Text style={styles.bold}>Nutracéuticos recomendados: </Text>
              {informe?.suplementos.delModelo ?? nutraceuticos}
            </Text>
            {informe?.suplementos.delProfesional.length ? (
              <>
                <Text style={[styles.para, styles.bold]}>Lo que te indicó tu profesional:</Text>
                {informe.suplementos.delProfesional.map((s) => (
                  <Text key={s.nombre} style={styles.para}>
                    · {s.nombre}
                    {s.dosis ? `: ${s.dosis}` : ""}
                    {s.duracionDias ? ` durante ${s.duracionDias} días` : ""}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {showAtlas && informe && (informe.remisiones.delModelo.length || informe.remisiones.delProfesional.length) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Otros profesionales que te pueden acompañar</Text>
            {informe.remisiones.delModelo.length ? (
              <>
                <Text style={[styles.para, styles.bold]}>Remisiones recomendadas:</Text>
                {informe.remisiones.delModelo.map((r) => (
                  <Text key={r.destino} style={styles.para}>
                    · {r.destino}
                    {r.urgencia ? ` (valoración ${r.urgencia.toLowerCase()})` : ""}
                  </Text>
                ))}
              </>
            ) : null}
            {informe.remisiones.delProfesional.length ? (
              <>
                <Text style={[styles.para, styles.bold]}>A quién te remitió tu profesional:</Text>
                {informe.remisiones.delProfesional.map((r) => (
                  <Text key={`${r.destino}-${r.fecha}`} style={styles.para}>
                    · {r.destino}
                  </Text>
                ))}
              </>
            ) : null}
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
