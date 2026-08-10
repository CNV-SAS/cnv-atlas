import { markdownToEmailHtml, markdownToPlainText } from "./consent-email-format";
import type { ConsentType } from "./validations";

// Armado de la COPIA del consentimiento que se envia al paciente tras aceptar (B7, dictamen de firma
// electronica). El dictamen es especifico sobre el contenido: texto integro, las autorizaciones
// MARCADAS y las NO MARCADAS (las no marcadas prueban que las opcionales se ofrecieron y se declinaron),
// fecha y hora, y el canal de derechos. Modulo puro (sin server-only): solo transforma texto; el envio
// y la traza viven en el servicio.
//
// El cuerpo es un RESUMEN (encabezado que pidio Santiago: fecha, version, autorizaciones marcadas y no
// marcadas, canal de derechos) seguido de la INSTANCIA personalizada (ya construida por el servicio: la
// plantilla con la rama que aplica, la firma con los datos del titular y el bloque del profesional). Se
// devuelven las DOS versiones: HTML con estilos en linea (formato) y texto plano LIMPIO (alternativa si
// el cliente no muestra HTML): asi los simbolos de markdown nunca llegan crudos al paciente.

// Canal de derechos (habeas data), tal cual el numeral 9 del consentimiento.
const RIGHTS_CHANNEL = "protecciondatos@cnvsystem.com";

// Etiquetas de cara al paciente de las 6 autorizaciones (con tildes). El orden es el del documento:
// primero las 3 necesarias, luego las 3 opcionales.
const AUTH_LABELS: { type: ConsentType; label: string; necessary: boolean }[] = [
  { type: "servicio", label: "Tratamiento de datos personales para las finalidades del servicio", necessary: true },
  { type: "datos_sensibles", label: "Tratamiento de datos sensibles de salud para la evaluación", necessary: true },
  { type: "internacional_ia", label: "Tratamiento internacional y uso de sistemas automatizados", necessary: true },
  { type: "investigacion", label: "Uso de datos seudonimizados para investigación científica del modelo", necessary: false },
  { type: "comunicaciones_continuidad", label: "Comunicaciones de continuidad de la atención", necessary: false },
  { type: "comunicaciones_comerciales", label: "Comunicaciones comerciales del ecosistema CNV", necessary: false },
];

export type ConsentCopyInput = {
  acceptedAt: number; // epoch-ms del servidor (hora de la aceptacion)
  granted: ConsentType[]; // autorizaciones efectivamente marcadas (para el resumen)
  consentVersion: string;
  instanceMarkdown: string; // INSTANCIA ya personalizada (no la plantilla): rama, firma y profesional
};

// Fecha y hora legible en Colombia (America/Bogota). Se usa el huso fijo del pais, no el del proceso.
function formatAcceptedAt(epochMs: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(epochMs));
}

// Construye el asunto (DISTINTO al del codigo, que llega minutos antes) y el cuerpo en HTML + texto plano.
export function buildConsentCopyEmail(input: ConsentCopyInput): {
  subject: string;
  html: string;
  text: string;
} {
  const grantedSet = new Set(input.granted);
  // Casillas en formato markdown "- [x]/- [ ]" para que el conversor las pinte igual que en el documento.
  const authLines = AUTH_LABELS.map((a) => {
    const mark = grantedSet.has(a.type) ? "[x]" : "[ ]";
    const tag = a.necessary ? "necesaria" : "opcional";
    return `- ${mark} ${a.label} (${tag})`;
  });

  // Encabezado (resumen) en markdown, para convertirlo con el mismo formato que el documento.
  const summary = [
    "Esta es tu copia del consentimiento informado que aceptaste en Atlas. Consérvala.",
    "",
    `**Fecha y hora de aceptación:** ${formatAcceptedAt(input.acceptedAt)}`,
    "",
    `**Versión del documento:** ${input.consentVersion}`,
    "",
    "**Autorizaciones (se listan las marcadas y las no marcadas):**",
    "",
    ...authLines,
    "",
    `Para conocer, actualizar, rectificar o suprimir tus datos, revocar esta autorización o presentar una queja, escribe a ${RIGHTS_CHANNEL}.`,
    "",
    "---",
    "",
  ].join("\n");

  const combined = summary + input.instanceMarkdown;

  return {
    subject: "Tu copia del consentimiento informado de Atlas",
    html: markdownToEmailHtml(combined),
    text: markdownToPlainText(combined),
  };
}
