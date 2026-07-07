import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { EngineIndicators, EngineOutput } from "@/clinical-engine";

// Documento PDF del reporte del paciente, construido desde el snapshot inmutable (el
// EngineOutput que la propagacion dejo en reports). NO es un componente de Next: lo
// renderiza render-report.tsx a Buffer en el servidor. El contenido es el del motor;
// mientras sea stub, el reporte lo declara con una nota visible.

export type ReportMeta = {
  patientName: string;
  documentLabel: string; // "CC 12345"
  evaluationDate: string; // ya formateada
  reportId: string;
};

// Etiquetas de los 12 indicadores en orden de presentacion (codigo canonico).
const INDICATOR_LABELS: { key: keyof EngineIndicators; label: string }[] = [
  { key: "ifc", label: "IFC" },
  { key: "irc", label: "IRC" },
  { key: "pabu", label: "PABU" },
  { key: "icaBis", label: "ICA-BIS" },
  { key: "iscm", label: "ISCM" },
  { key: "iehh", label: "IEHH" },
  { key: "iae", label: "IAE" },
  { key: "eb", label: "EB" },
  { key: "FMI", label: "FMI" },
  { key: "FFMI", label: "FFMI" },
  { key: "AF", label: "AF" },
  { key: "IR", label: "IR" },
];

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a2e", lineHeight: 1.4 },
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

function fmt(v: number | null): string {
  return v == null ? "Pendiente" : String(v);
}

// Modo de envio: que contenido incluye el PDF (B10.1). 'atlas' = reporte del motor;
// 'notas' = solo las notas del profesional; 'ambos' = los dos.
export type SendMode = "atlas" | "notas" | "ambos";
export const SEND_MODES: readonly SendMode[] = ["atlas", "notas", "ambos"];

export function ReportDocument({
  snapshot,
  meta,
  mode = "atlas",
  professionalNotes = null,
}: {
  snapshot: EngineOutput;
  meta: ReportMeta;
  mode?: SendMode;
  professionalNotes?: string | null;
}) {
  const { indicators, efrPhenotype, structural, frSector, dfi, nutraceuticos, versions } =
    snapshot;
  const notes = (professionalNotes ?? "").trim();
  const showAtlas = mode === "atlas" || mode === "ambos";
  const showNotes = (mode === "notas" || mode === "ambos") && notes.length > 0;
  return (
    <Document
      title={`Reporte clinico ${meta.documentLabel}`}
      author="Connected Nutrition Ventures"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Reporte clinico ANI-BIS-E</Text>
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

        {showAtlas && !dfi.complete ? (
          <Text style={styles.notice}>
            Diagnostico funcional integral INCOMPLETO: {dfi.degradedReason} Los indicadores
            de composicion y el fenotipo EFR son definitivos; los dominios de estilo de
            vida, la edad biologica (EB/IAE) y las rutas dependen de la encuesta.
          </Text>
        ) : null}

        {showAtlas ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Indicadores</Text>
              {INDICATOR_LABELS.map(({ key, label }) => (
                <View key={key} style={styles.tableRow}>
                  <Text style={styles.cellLabel}>{label}</Text>
                  <Text style={styles.cellValue}>{fmt(indicators[key])}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Diagnostico funcional (EFR)</Text>
              <Text style={styles.para}>
                <Text style={styles.bold}>
                  Estado EFR {efrPhenotype.stateNumber} ({efrPhenotype.key}):{" "}
                </Text>
                {efrPhenotype.diagnostico}
              </Text>
              <Text style={styles.para}>Fenotipo estructural: {structural.nombre}</Text>
              <Text style={styles.para}>Sector funcional (FyR): {frSector.nombre}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Diagnostico funcional integral (DFI){dfi.complete ? "" : " (incompleto)"}
              </Text>
              <Text style={styles.para}>
                <Text style={styles.bold}>Riesgo {dfi.riesgo.nivel} </Text>
                (score {String(dfi.riesgo.score)}): {dfi.riesgo.descripcion}
              </Text>
              {dfi.domains.map((d) => (
                <Text key={d.id} style={styles.para}>
                  {d.nombre} (sev {String(d.sev)}): {d.lectura}
                </Text>
              ))}
              <Text style={styles.para}>
                Rutas de atencion:{" "}
                {dfi.rutas.length ? dfi.rutas.join("; ") : "sin rutas activas"}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recomendacion de nutraceuticos</Text>
              <Text style={styles.para}>{nutraceuticos}</Text>
            </View>
          </>
        ) : null}

        {showNotes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas del profesional</Text>
            <Text style={styles.para}>{notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Motor {versions.engine} · Modelo {versions.model} · Reglas {versions.rules} ·
          Reporte {meta.reportId}
        </Text>
      </Page>
    </Document>
  );
}
