import { describe, expect, it } from "vitest";

import { markdownToEmailHtml, markdownToPlainText } from "@/modules/consent/consent-email-format";
import { buildConsentInstance } from "@/modules/consent/consent-instance";
import { CONSENT_TEXT_V1_0 } from "@/modules/consent/text/consent-v1.0";

const SAMPLE = [
  "## 2. Título",
  "",
  "Un párrafo con **negrita** y `código`.",
  "",
  "> Una cita con **énfasis**.",
  "",
  "| | |",
  "|---|---|",
  "| **Responsable (CNV)** | Connected Nutrition Ventures S.A.S. |",
  "| **Canal de derechos** | protecciondatos@cnvsystem.com |",
  "",
  "- [x] Autorizo esto.",
  "- [ ] No autorizo aquello.",
  "- Un ítem normal: `valor`.",
  "",
  "---",
].join("\n");

describe("consent-email-format: HTML para el correo", () => {
  const html = markdownToEmailHtml(SAMPLE);

  it("no deja simbolos de markdown crudos", () => {
    expect(html).not.toContain("## ");
    expect(html).not.toContain("**");
    expect(html).not.toContain("`");
    expect(html).not.toMatch(/\|.*\|/); // ninguna tubería de tabla
  });

  it("usa estilos EN LINEA (no <style> ni clases)", () => {
    expect(html).toContain("style=");
    expect(html).not.toContain("<style");
    expect(html).not.toContain('class="');
  });

  it("tema claro imprimible (texto oscuro sobre blanco, sin fondos oscuros)", () => {
    expect(html).toContain("background:#ffffff");
    expect(html).not.toMatch(/background:#(0|1|2|3)/); // nada de fondos oscuros
  });

  it("convierte encabezado, negrita, cita y casillas", () => {
    expect(html).toContain("<h2");
    expect(html).toContain("<strong>negrita</strong>");
    expect(html).toContain("<blockquote");
    expect(html).toContain("&#9745;"); // casilla marcada
    expect(html).toContain("&#9744;"); // casilla sin marcar
  });

  it("convierte la tabla en líneas etiqueta: valor (no una tabla HTML)", () => {
    expect(html).not.toContain("<table");
    expect(html).toContain("<strong>Responsable (CNV)</strong>: Connected Nutrition Ventures S.A.S.");
    expect(html).toContain("<strong>Canal de derechos</strong>: protecciondatos@cnvsystem.com");
  });
});

describe("consent-email-format: texto plano alternativo", () => {
  const text = markdownToPlainText(SAMPLE);

  it("es texto LIMPIO, sin markdown crudo", () => {
    expect(text).not.toContain("##");
    expect(text).not.toContain("**");
    expect(text).not.toContain("`");
    expect(text).not.toContain("|");
    expect(text).not.toContain("<"); // no HTML
  });

  it("conserva las casillas de forma legible", () => {
    expect(text).toContain("[x] Autorizo esto.");
    expect(text).toContain("[ ] No autorizo aquello.");
  });

  it("convierte la tabla en líneas", () => {
    expect(text).toContain("Responsable (CNV): Connected Nutrition Ventures S.A.S.");
  });
});

describe("consent-email-format: sobre una instancia real completa", () => {
  const instance = buildConsentInstance(CONSENT_TEXT_V1_0, {
    branch: "menor",
    patient: { name: "Sofía Ramírez", document: "TI 1122334455" },
    professional: { fullName: "Ana Gómez", profession: "Nutricionista", license: "N-1" },
    representative: { name: "María Ramírez", document: "CC 999", relationship: "madre", email: "m@e.com" },
    assent: { applies: true, minorName: "Sofía Ramírez" },
    granted: ["servicio", "datos_sensibles", "internacional_ia", "aceptacion_medio_electronico"],
    acceptedAt: 1_754_000_000_000,
  });

  it("el HTML de una instancia real no deja markdown crudo ni tuberías", () => {
    const html = markdownToEmailHtml(instance);
    expect(html).not.toContain("## ");
    expect(html).not.toMatch(/\|-+\|/); // ninguna fila separadora de tabla
    expect(html).toContain("Ana Gómez"); // el profesional relleno
    expect(html).toContain("&#9745;"); // alguna casilla marcada (parentesco/autorizacion)
  });

  it("el texto plano de una instancia real es limpio", () => {
    const text = markdownToPlainText(instance);
    expect(text).not.toContain("**");
    expect(text).not.toContain("|");
    expect(text).toContain("Ana Gómez");
  });
});
