import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (SECURITY.md): quien ve el panel de obbia (investigacion). Obbia y admin
// (regla 3). Obbia NUNCA accede a PII: su unica fuente por RLS es research_datasets (data
// agregada/anonimizada); el candado se prueba en obbia-no-pii.test.ts.
export function canViewObbia(user: CurrentUser): boolean {
  return hasAnyRole(user, ["obbia", "admin"]);
}
