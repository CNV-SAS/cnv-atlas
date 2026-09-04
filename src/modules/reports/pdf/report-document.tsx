import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { dfiParaPaciente, type EngineOutput } from "@/clinical-engine";

import type { PlanPaciente } from "../data/reports-view-types";

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
  reportId: string;
};

// Indicadores en el reporte del PACIENTE. EB e IAE quedan FUERA a proposito (P0, decision de
// Gildardo 2026-08-01): la cifra de EB-BIS nunca va al paciente, y como IAE = EB - edad, mostrar
// IAE revela el constructo; la clase de IAE tampoco se imprime. La expresion "edad biologica" es
// termino retirado del sistema. La EB-BIS/IAE SI las ve el profesional (con marca de calibracion
// provisional), en la vista interna. Gate del Hito 3 en LANZAMIENTO.md.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a2e", lineHeight: 1.4 },
  // Discreta: mismo gris del pie, sin negrita y sin caja. Informa, no invita ni disuade.
  derechoHc: { marginTop: 18, fontSize: 8, color: "#6b7280" },
  // Cada dia del menu junto: un dia partido entre dos hojas obliga a pasar pagina a media comida.
  diaMenu: { marginTop: 6 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 12 },
  meta: { marginBottom: 12 },
  metaRow: { flexDirection: "row", marginBottom: 1 },
  metaLabel: { width: 110, color: "#555" },
  notice: {
    backgroundColor: "#fff4e5",
    borderColor: "#d99a2b",
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginBottom: 14,
    color: "#8a5a00",
    fontSize: 9,
  },
  // Rotulo de advertencia permanente (siempre visible; preview interno y version al
  // paciente). El motor produce asociaciones a valorar, no un diagnostico.
  disclaimer: {
    backgroundColor: "#eef2f7",
    borderColor: "#16324f",
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    color: "#16324f",
    fontSize: 9,
    fontWeight: "bold",
  },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 4, color: "#16324f" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 2 },
  cellLabel: { width: 90 },
  cellValue: { flex: 1, textAlign: "right" },
  para: { marginBottom: 2 },
  bold: { fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#888",
    borderTopWidth: 0.5,
    borderColor: "#ddd",
    paddingTop: 6,
  },
});


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
  plan = null,
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
   * EL PLAN QUE RECIBE EL PACIENTE (Gildardo §7.1). null = la evaluacion no tiene tratamiento con
   * protocolo sellado, y entonces no hay plan que entregar: un plan a medias es peor que ninguno.
   *
   * EL ORDEN DE LOS BLOQUES ES EL SUYO, y es el que Santiago pidio conservar: primero se le explica al
   * paciente QUE TIENE (el diagnostico, ya traducido arriba), y despues LA SOLUCION. Su §7.1 pone el
   * diagnostico primero en la lista por esa misma razon.
   */
  plan?: PlanPaciente | null;
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
  return (
    <Document
      title={`Reporte clinico ${meta.documentLabel}`}
      author="Connected Nutrition Ventures"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Reporte clínico ANI-BIS-E</Text>
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
        {showAtlas && dfiPac && dfi.complete ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cómo estás</Text>
            <Text style={styles.para}>
              <Text style={styles.bold}>{dfiPac.riesgo}. </Text>
              {dfiPac.enfoque}
            </Text>
            {dfiPac.dominios.map((d) => (
              <Text key={d.id} style={styles.para}>
                {/* SIN ETIQUETA cuando el dominio no se midio: su mapa no cubre ese caso porque es
                    anterior a su punto 4 del 30-ago, y ponerle una seria agregarle un nivel a su escala.
                    La lectura que el motor produce ya dice que no se evaluo. */}
                {d.nivel ? `${d.dominio} (${d.nivel}): ` : `${d.dominio}: `}
                {d.lectura}
              </Text>
            ))}
            {dfiPac.acompanamiento ? (
              <Text style={styles.para}>{dfiPac.acompanamiento}</Text>
            ) : null}
          </View>
        ) : null}

        {/* ═══ EL PLAN, en su orden: meta, dieta, menu, distribucion, recomendaciones, lista por region ═══
            El DIAGNOSTICO va ARRIBA, en el bloque "Cómo estás": primero que tiene, despues la solucion.
            Los SIETE bloques de su §7.1 estan aqui desde el 2026-09-03, cuando llego su mapa de regiones
            (decia "falta el septimo, bloqueado por P2"; el bloqueo se cerro con su respuesta §2). ═══ */}
        {showAtlas && plan ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tu meta</Text>
              {plan.objetivoTexto ? <Text style={styles.para}>{plan.objetivoTexto}</Text> : null}
              {plan.pesoMeta != null ? (
                <Text style={styles.para}>Peso que acordaste con tu profesional: {plan.pesoMeta} kg.</Text>
              ) : null}
              {plan.kcalObjetivo != null ? (
                <Text style={styles.para}>Tu plan es de {plan.kcalObjetivo} calorías al día.</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tu plan de alimentación</Text>
              {plan.tipoDieta ? (
                <Text style={styles.para}>
                  <Text style={styles.bold}>Dieta {plan.tipoDieta.toLowerCase()}</Text>
                  {plan.kcalObjetivo != null ? ` de ${plan.kcalObjetivo} kcal al día.` : "."}
                </Text>
              ) : null}
              {plan.prescripcion.map((f) => (
                <Text key={f.nombre} style={styles.para}>
                  {f.nombre}: {f.valor}
                </Text>
              ))}
              {plan.atributos.length ? (
                <Text style={styles.para}>{plan.atributos.join(" · ")}</Text>
              ) : null}
              {plan.notasDelModelo.map((n) => (
                <Text key={n} style={styles.para}>
                  {n}
                </Text>
              ))}
            </View>

            {/* LO QUE NO PUEDE COMER, ANTES DEL MENU y no despues, y el orden importa: el paciente lee el
                menu para saber que comer, y tiene que llegar sabiendo que evitar. Su §7.1 no nombra este
                bloque; va declarado, con su razon: un plan sin las restricciones es un plan que el
                paciente no puede seguir, porque el menu que recibe puede contradecirlas. */}
            {plan.restricciones.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lo que debes evitar</Text>
                {plan.restricciones.map((r) => (
                  <Text key={r} style={styles.para}>
                    {r}
                  </Text>
                ))}
              </View>
            ) : null}

            {plan.menu.length ? (
              <View style={styles.section} break>
                <Text style={styles.sectionTitle}>Ejemplo de menú para una semana</Text>
                <Text style={styles.para}>
                  Es un ejemplo, no una obligación: puedes cambiar preparaciones por otras equivalentes.
                </Text>
                {plan.menu.map((d) => (
                  <View key={d.dia} style={styles.diaMenu}>
                    <Text style={styles.bold}>{d.dia}</Text>
                    {d.comidas.map((c) => (
                      <Text key={c.tiempo} style={styles.para}>
                        {c.tiempo}: {c.texto}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            {plan.distribucion.length ? (
              <View style={styles.section} break>
                <Text style={styles.sectionTitle}>Cómo repartir tus porciones en el día</Text>
                <Text style={styles.para}>
                  Comidas de tu día: {plan.tiemposActivos.join(", ")}.
                </Text>
                {plan.distribucion.map((f) => (
                  <View key={f.alimento} style={styles.tableRow}>
                    <Text style={styles.cellLabel}>{f.alimento}</Text>
                    <Text style={styles.cellValue}>
                      {f.porTiempo.map((t) => `${t.tiempo} ${t.porciones}`).join(" · ")}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* EL ENCABEZADO QUE AGRUPA, que es la única alineación en esta dirección (2026-09-04). Aquí
                cada recomendación era su propia sección de primer nivel, así que "Alimentación saludable
                general" quedaba al mismo rango que "Tu meta" y sin decir de qué es. La hoja impresa sí
                las agrupaba, y esa es la mejor de las dos. */}
            {plan.recomendaciones.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recomendaciones para tu caso</Text>
                {plan.recomendaciones.map((r) => (
                  <View key={r.titulo}>
                    <Text style={styles.bold}>{r.titulo}</Text>
                    {r.lineas.map((l) => (
                      <Text key={l} style={styles.para}>
                        {l}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            {/* BLOQUE 7 · la lista de intercambio recortada por región. `break`: su archivo la imprime en
                su propia página, y aquí importa más, porque es la hoja que el paciente lleva al mercado. */}
            <View style={styles.section} break>
              <Text style={styles.sectionTitle}>Tu lista de intercambio</Text>
              <Text style={styles.para}>
                Los alimentos de un mismo grupo aportan aproximadamente lo mismo por porción, así que puedes
                intercambiarlos libremente. Sigue las porciones que te indicó tu nutricionista para cada
                grupo y elige entre los alimentos de la lista, variando cada día para lograr una
                alimentación completa y diversa. La cantidad entre paréntesis es el tamaño de una porción de
                intercambio.
              </Text>
              <Text style={styles.para}>
                {plan.listaIntercambio.region
                  ? `Preparada para ${plan.listaIntercambio.ciudad}, región ${plan.listaIntercambio.region}: ${plan.listaIntercambio.total} alimentos de los ${plan.listaIntercambio.deTotal}.`
                  : `Lista completa: ${plan.listaIntercambio.deTotal} alimentos.`}
              </Text>
              {plan.listaIntercambio.grupos.map((g) => (
                <View key={g.nombre} style={styles.diaMenu}>
                  <Text style={styles.bold}>{g.nombre}</Text>
                  {g.subgrupos.map((s) => (
                    <Text key={s.sub} style={styles.para}>
                      {s.sub}: {s.alimentos.join(", ")}
                      {s.hayMas ? ", entre otros" : ""}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {showAtlas ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recomendación de nutracéuticos</Text>
            <Text style={styles.para}>{nutraceuticos}</Text>
          </View>
        ) : null}

        {showNotes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas del profesional</Text>
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
          Reporte {meta.reportId}
        </Text>
      </Page>
    </Document>
  );
}
