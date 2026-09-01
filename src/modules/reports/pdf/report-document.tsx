import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { dfiParaPaciente, type EngineOutput } from "@/clinical-engine";

// Documento PDF del reporte del paciente, construido desde el snapshot inmutable (el
// EngineOutput que la propagacion dejo en reports). NO es un componente de Next: lo
// renderiza render-report.tsx a Buffer en el servidor. El contenido es el del motor clinico REAL
// (portado en B11, paridad con el HTML de Gildardo); ya no es un stub, y el reporte no lo declara como tal.

export type ReportMeta = {
  patientName: string;
  documentLabel: string; // "CC 12345"
  evaluationDate: string; // ya formateada
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
}) {
  // SOLO SE DESESTRUCTURA LO QUE ESTE DOCUMENTO PUEDE IMPRIMIR. `indicators`, `efrPhenotype`,
  // `structural` y `frSector` se retiraron con sus bloques (§7.1): un documento que no tiene el dato no
  // puede filtrarlo por descuido. `dfi` se conserva SOLO por `dfi.complete`, que gatea la banda.
  const { dfi, nutraceuticos, versions } = snapshot;
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
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha</Text>
            <Text>{meta.evaluationDate}</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Patrones asociados a valorar clínicamente, no constituye diagnóstico.
        </Text>

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

        <Text style={styles.footer} fixed>
          Motor {versions.engine} · Modelo {versions.model} · Reglas {versions.rules} ·
          Reporte {meta.reportId}
        </Text>
      </Page>
    </Document>
  );
}
