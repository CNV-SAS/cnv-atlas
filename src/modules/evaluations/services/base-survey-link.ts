import "server-only";

import { createBaseSurveyLink } from "../data/survey-links-writer";
import { getBaseSurveyLinkForProfessional } from "../data/survey-links-reader";

// Get-or-create del link base (inicial reusable) de consultorio del profesional. ESTABLE: si ya
// existe, devuelve el mismo (no se regenera). El indice unico parcial garantiza uno solo por
// profesional; si una request paralela lo crea justo antes, el insert choca (createBaseSurveyLink
// devuelve null) y se re-lee para resolver la carrera. Lo comparten la action del link y la del QR.
export async function getOrCreateBaseSurveyLink(input: {
  organizationId: string;
  professionalId: string;
  createdBy: string;
}): Promise<{ token: string } | null> {
  const existing = await getBaseSurveyLinkForProfessional(input.professionalId);
  if (existing) return existing;
  const created = await createBaseSurveyLink(input);
  return created ?? (await getBaseSurveyLinkForProfessional(input.professionalId));
}
