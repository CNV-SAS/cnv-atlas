// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS ESTILOS DE LOS PDF DEL PACIENTE  ·  UNA SOLA HOJA DE ESTILO
//
// Vivian dentro de `report-document.tsx`, y salieron de ahi el 2026-10-28, cuando el plan paso a tener su
// PROPIO PDF (el adjunto del correo que pidio Santiago). Dos hojas de estilo para dos documentos que el
// mismo paciente recibe el mismo dia se leen como dos sistemas distintos, y divergen por donde nadie mira:
// es el mismo motivo por el que los dos comparten los BLOQUES (`bloques-del-plan.tsx`).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
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
  // CADA DOMINIO, UN BLOQUE (Santiago, 2026-09-21): el nombre en negrita, su etiqueta con su color y la
  // frase debajo. En parrafo corrido las cinco se leian como un solo texto y no se veia cual pedia trabajo.
  // La barra de la izquierda repite el color de la etiqueta: refuerza, no sustituye a la palabra.
  dominio: { marginTop: 5, paddingLeft: 7, borderLeftWidth: 2.5 },
  dominioLectura: { marginTop: 1, color: "#374151" },
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
