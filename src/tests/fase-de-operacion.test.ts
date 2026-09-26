import { afterEach, describe, expect, it } from "vitest";

import { faseDeOperacion } from "@/modules/auth/fase-de-operacion";

// ═══ LA FASE DE OPERACION (2026-09-25) ═══
//
// Lo que este candado protege es EL DEFECTO POR OMISION, y no es simetrico:
//
//   · callar cuando habria que avisar es molesto, y se cubre por otro canal;
//   · decir "entorno de pruebas, nada es real" en OPERACION REAL invita a registrar basura sobre pacientes de
//     verdad, y eso no se deshace.
//
// Cuando dos defectos no cuestan lo mismo, el que ocurre por omision tiene que ser el barato. Por eso sin
// variable no hay aviso, y un valor desconocido se trata como ausente en vez de caer a "pruebas".

const original = process.env.ATLAS_FASE;
afterEach(() => {
  if (original === undefined) delete process.env.ATLAS_FASE;
  else process.env.ATLAS_FASE = original;
});

describe("la fase de operacion", () => {
  it("sin variable no hay aviso: NUNCA cae a 'pruebas'", () => {
    delete process.env.ATLAS_FASE;
    expect(faseDeOperacion()).toBeNull();
  });

  it("un valor desconocido tampoco cae a 'pruebas'", () => {
    // Un dedo mal puesto en la configuracion no puede acabar diciendole a un profesional que nada es real.
    process.env.ATLAS_FASE = "produccion";
    expect(faseDeOperacion()).toBeNull();
    process.env.ATLAS_FASE = "";
    expect(faseDeOperacion()).toBeNull();
  });

  it("reconoce las dos fases, con espacios y mayusculas", () => {
    // Se teclea a mano en un panel de Vercel: " Lanzamiento" no puede quedarse sin aviso por un espacio.
    process.env.ATLAS_FASE = " Lanzamiento ";
    expect(faseDeOperacion()).toBe("lanzamiento");
    process.env.ATLAS_FASE = "PRUEBAS";
    expect(faseDeOperacion()).toBe("pruebas");
  });

  it("no depende del segundo factor, que es de lo que colgaba antes", () => {
    // Es la razon de que este modulo exista: Santiago arranca operacion real SIN separar ambientes y CON el
    // segundo factor todavia relajado, asi que el aviso atado a `ATLAS_MFA_RELAXED` habria seguido diciendo
    // "nada de lo que registres aqui es real" en operacion real.
    process.env.ATLAS_MFA_RELAXED = "https://loquesea.supabase.co";
    process.env.ATLAS_FASE = "lanzamiento";
    expect(faseDeOperacion()).toBe("lanzamiento");
  });
});
