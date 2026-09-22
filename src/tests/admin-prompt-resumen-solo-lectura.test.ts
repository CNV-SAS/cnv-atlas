import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ EL PROMPT DEL RESUMEN SE VE EN ADMIN, Y NO SE EDITA ALLI (Santiago, 2026-09-22) ═══
//
// El editor de /admin/ia es el del MENU. El del resumen se muestra solo para leer: su texto vive en el
// repositorio y llega a la base por migracion. Un formulario de edicion para el resumen crearia una version
// que el codigo no tiene, y la siguiente migracion la retiraria sin aviso.
describe("el prompt del resumen en admin", () => {
  const pagina = readFileSync("src/app/(app)/admin/ia/page.tsx", "utf8");

  it("se lee de la base por su clave", () => {
    expect(pagina).toContain('getPromptView("criterio.generate")');
    expect(pagina).toContain("{criterioView.activeContent}");
  });

  it("y el único formulario de edición sigue siendo el del menú", () => {
    expect(pagina.match(/<AiPromptForm /g) ?? []).toHaveLength(1);
    expect(pagina).toContain("<AiPromptForm view={promptView} />");
  });
});
