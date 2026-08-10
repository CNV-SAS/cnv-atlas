import { describe, expect, it } from "vitest";

import { buildConsentCopyEmail } from "@/modules/consent/consent-copy";

// La copia (B7) debe llevar lo que exige el dictamen: texto integro, autorizaciones MARCADAS y NO
// MARCADAS, fecha/hora y canal de derechos. Las no marcadas prueban que las opcionales se declinaron.
describe("buildConsentCopyEmail", () => {
  const base = {
    acceptedAt: 1_700_000_000_000,
    consentVersion: "1.5",
    instanceMarkdown: "## 1. Texto integro del consentimiento ...",
  };

  it("lista las necesarias marcadas y las opcionales NO marcadas cuando se declinaron", () => {
    const { text } = buildConsentCopyEmail({
      ...base,
      granted: ["servicio", "datos_sensibles", "internacional_ia"],
    });
    // Necesarias marcadas
    expect(text).toContain("[x] Tratamiento de datos personales para las finalidades del servicio");
    // Opcionales presentes pero NO marcadas (la prueba de que se ofrecieron y se declinaron)
    expect(text).toContain("[ ] Uso de datos seudonimizados para investigación científica del modelo");
    expect(text).toContain("[ ] Comunicaciones comerciales del ecosistema CNV");
  });

  it("marca una opcional cuando se otorgo", () => {
    const { text } = buildConsentCopyEmail({
      ...base,
      granted: ["servicio", "datos_sensibles", "internacional_ia", "investigacion"],
    });
    expect(text).toContain("[x] Uso de datos seudonimizados para investigación científica del modelo");
  });

  it("incluye fecha/hora, canal de derechos, version y el texto integro", () => {
    const { subject, text } = buildConsentCopyEmail({
      ...base,
      granted: ["servicio", "datos_sensibles", "internacional_ia"],
    });
    expect(text).toContain("Fecha y hora de aceptación:");
    expect(text).toContain("protecciondatos@cnvsystem.com"); // canal de derechos
    expect(text).toContain("Versión del documento: 1.5");
    expect(text).toContain("Texto integro del consentimiento"); // el texto aceptado va completo
    // Asunto DISTINTO al del codigo (no debe confundirse con el OTP)
    expect(subject).toBe("Tu copia del consentimiento informado de Atlas");
    expect(subject).not.toContain("código");
  });

  it("entrega HTML con estilos en linea y texto plano limpio (sin markdown crudo)", () => {
    const { html, text } = buildConsentCopyEmail({
      ...base,
      granted: ["servicio", "datos_sensibles", "internacional_ia"],
    });
    // HTML: estilos en linea, casillas renderizadas, sin simbolos crudos.
    expect(html).toContain("style=");
    expect(html).toContain("&#9745;"); // alguna casilla marcada (necesaria)
    expect(html).toContain("&#9744;"); // alguna casilla sin marcar (opcional declinada)
    expect(html).not.toContain("**");
    // Texto plano: limpio, sin markdown.
    expect(text).not.toContain("**");
    expect(text).not.toContain("##");
  });
});
