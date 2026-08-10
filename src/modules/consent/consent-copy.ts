import type { ConsentType } from "./validations";

// Armado de la COPIA del consentimiento que se envia al paciente tras aceptar (B7, dictamen de firma
// electronica). El dictamen es especifico sobre el contenido: texto integro, las autorizaciones
// MARCADAS y las NO MARCADAS (las no marcadas prueban que las opcionales se ofrecieron y se declinaron),
// fecha y hora, y el canal de derechos. Modulo puro (sin server-only): solo transforma texto; el envio
// y la traza viven en el servicio.

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
  granted: ConsentType[]; // autorizaciones efectivamente marcadas
  consentVersion: string;
  consentText: string; // texto integro de la version aceptada (el mismo que vio en pantalla)
};

// Fecha y hora legible en Colombia (America/Bogota). Se usa el huso fijo del pais, no el del proceso.
function formatAcceptedAt(epochMs: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(epochMs));
}

// Construye el asunto (DISTINTO al del codigo, que llega minutos antes) y el cuerpo en texto plano.
export function buildConsentCopyEmail(input: ConsentCopyInput): { subject: string; text: string } {
  const grantedSet = new Set(input.granted);
  const lines = AUTH_LABELS.map((a) => {
    const mark = grantedSet.has(a.type) ? "[x]" : "[ ]";
    const tag = a.necessary ? "necesaria" : "opcional";
    return `${mark} ${a.label} (${tag})`;
  });

  const text =
    `Esta es tu copia del consentimiento informado que aceptaste en Atlas. Consérvala.\n\n` +
    `Fecha y hora de aceptación: ${formatAcceptedAt(input.acceptedAt)}\n` +
    `Versión del documento: ${input.consentVersion}\n\n` +
    `Autorizaciones (se listan las marcadas y las no marcadas):\n` +
    `${lines.join("\n")}\n\n` +
    `Para conocer, actualizar, rectificar o suprimir tus datos, revocar esta autorización o ` +
    `presentar una queja, escribe a ${RIGHTS_CHANNEL}.\n\n` +
    `A continuación, el texto íntegro del consentimiento que aceptaste:\n\n` +
    `${input.consentText}\n`;

  return { subject: "Tu copia del consentimiento informado de Atlas", text };
}
