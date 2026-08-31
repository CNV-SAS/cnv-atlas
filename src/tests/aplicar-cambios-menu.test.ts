import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// CANDADO DEL ATAJO "APLICAR TODAS" (2026-08-31).
//
// LO QUE PRUEBA, y es lo unico que de verdad importa aqui: que aplicar N sustituciones sea UNA SOLA
// ESCRITURA, con UNA sola firma base. La tentacion era hacer un bucle sobre el de a uno, y esa version
// esta rota de un modo que no se ve probando el camino feliz: la PRIMERA escritura cambia el menu, con lo
// que la firma que la SEGUNDA lleva ya no corresponde, y el candado de concurrencia la rechaza. El
// resultado seria una grilla aplicada A MEDIAS, sin que nadie hiciera nada mal.
//
// Y el otro lado: que el de a uno delegue en el de a varios, para que exista UNA sola regla de escritura.
// Si mañana alguien cambia la regla de "solo se guarda lo que difiere del ciclo" en un sitio y no en el
// otro, esto lo dice.

vi.mock("server-only", () => ({}));
vi.mock("@/modules/treatment/data/treatment-reader", () => ({
  getTreatmentProtocol: vi.fn(),
  getTreatmentForApproval: vi.fn(),
}));
vi.mock("@/modules/treatment/services/require-profession", () => ({
  requireNutricionista: vi.fn(async () => ({ ok: true, value: { profession: "nutricionista" } })),
}));
vi.mock("@/modules/treatment/data/treatment-writer", () => ({
  saveMenuSemanal: vi.fn(async () => undefined),
  StaleMenuSemanalError: class StaleMenuSemanalError extends Error {},
  TreatmentStateError: class TreatmentStateError extends Error {},
}));

import { diaDelCiclo, diaInicioDerivado } from "@/clinical-engine/menu-ciclo";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";
import { saveMenuSemanal as writeMenuSemanal } from "@/modules/treatment/data/treatment-writer";
import {
  aplicarCambioMenu,
  aplicarCambiosMenu,
} from "@/modules/treatment/services/treatment-service";

const reader = vi.mocked(getTreatmentProtocol);
const writer = vi.mocked(writeMenuSemanal);

const EVAL = "11111111-1111-4111-8111-111111111111";
const TREATMENT = "22222222-2222-4222-8222-222222222222";
const ACTOR = { actorId: "u1", actorEmail: "n@cnv.test", ip: null };

// Protocolo minimo: lo unico que este servicio lee es el id del tratamiento y el menu guardado.
function protocoloConMenu(menuSemanal: { diaInicio: number; celdas: Record<string, string> } | null) {
  return {
    treatmentId: TREATMENT,
    menuSemanal,
    diagnosisConfirmed: true,
    approved: false,
  } as unknown as Awaited<ReturnType<typeof getTreatmentProtocol>>;
}

/** Las celdas con que se llamo al writer en la enesima escritura. */
const celdasDeLaEscritura = (i: number) =>
  (writer.mock.calls[i][0] as { menu: { celdas: Record<string, string> } }).menu.celdas;

describe("aplicar TODAS las sustituciones", () => {
  beforeEach(() => {
    // clearAllMocks por describe: sin esto una asercion sobre `mock.calls[0]` puede estar leyendo la
    // llamada de OTRO bloque y pasar verde midiendo el caso equivocado. Ya nos paso.
    vi.clearAllMocks();
    reader.mockResolvedValue(protocoloConMenu(null));
  });

  it("es UNA sola escritura con TODAS las celdas, no una por cambio", () => {
    return aplicarCambiosMenu(
      {
        evaluationId: EVAL,
        cambios: [
          { dia: 0, tiempo: "desayuno", reemplazo: "Arepa de maíz con huevo" },
          { dia: 2, tiempo: "almuerzo", reemplazo: "Bandeja sin cerdo" },
          { dia: 5, tiempo: "cena", reemplazo: "Crema de auyama" },
        ],
      },
      ACTOR,
    ).then((r) => {
      expect(r.ok).toBe(true);
      expect(writer, "aplicar todas tiene que ser UNA escritura").toHaveBeenCalledTimes(1);
      expect(celdasDeLaEscritura(0)).toEqual({
        "0_desayuno": "Arepa de maíz con huevo",
        "2_almuerzo": "Bandeja sin cerdo",
        "5_cena": "Crema de auyama",
      });
    });
  });

  it("y esa escritura lleva la firma del menú TAL COMO ESTABA, no una recalculada", async () => {
    // Si se mandara una firma "fresca" el candado de concurrencia nunca rechazaria nada: se habria
    // convertido un merge en un pisotón silencioso.
    reader.mockResolvedValue(protocoloConMenu({ diaInicio: 0, celdas: { "1_cena": "Sopa" } }));
    await aplicarCambiosMenu(
      { evaluationId: EVAL, cambios: [{ dia: 0, tiempo: "desayuno", reemplazo: "Arepa" }] },
      ACTOR,
    );
    const arg = writer.mock.calls[0][0] as { baseSignature: string; menu: { celdas: object } };
    expect(arg.baseSignature).toBeTruthy();
    // Y lo que ya estaba guardado NO se pierde al aplicar: se suma, no se reemplaza la grilla.
    expect(arg.menu.celdas).toEqual({ "1_cena": "Sopa", "0_desayuno": "Arepa" });
  });

  it("un reemplazo IGUAL al del ciclo borra el override en vez de congelarlo", async () => {
    // La misma regla que la grilla manual: guardar lo que el ciclo ya propone haria que esa celda dejara
    // de seguir al ciclo cuando mañana se proponga otra semana.
    const diaInicio = diaInicioDerivado(TREATMENT);
    const delCiclo = (diaDelCiclo(diaInicio, 3) as unknown as Record<string, string>).almuerzo;
    reader.mockResolvedValue(protocoloConMenu({ diaInicio, celdas: { "3_almuerzo": "Otra cosa" } }));

    await aplicarCambiosMenu(
      { evaluationId: EVAL, cambios: [{ dia: 3, tiempo: "almuerzo", reemplazo: delCiclo }] },
      ACTOR,
    );
    expect(celdasDeLaEscritura(0)).toEqual({});
  });

  it("una lista vacía no escribe nada (y no es un error)", async () => {
    const r = await aplicarCambiosMenu({ evaluationId: EVAL, cambios: [] }, ACTOR);
    expect(r.ok).toBe(true);
    expect(writer).not.toHaveBeenCalled();
  });
});

describe("el aviso llega: ni fallo silencioso ni salto al inicio", () => {
  const ACTIONS = readFileSync("src/modules/treatment/actions.ts", "utf8");
  const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
  // Los comentarios NOMBRAN las dos cosas prohibidas para explicar por que lo estan; un candado que caza
  // su propia documentacion es ruido, y el ruido es como mueren los candados.
  const sinComentarios = (s: string) => s.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  it("ninguna acción del tratamiento revalida: el revalidate era el que arrastraba al inicio", () => {
    expect(
      sinComentarios(ACTIONS),
      "Volvió un revalidatePath a las acciones del tratamiento. Ese era el que hacía saltar la página al " +
        "inicio en cada botón del panel (smoke del 2026-08-31) y el que desmontaba el formulario antes de " +
        "que el aviso se viera. El refresco va en el cliente, DESPUÉS del toast: useFormToastAndRefresh.",
    ).not.toContain("revalidatePath(");
  });

  it("aplicar (una o todas) devuelve estado: un rechazo del candado NO puede pasar callado", () => {
    // El defecto real que esto cierra: `aplicarCambioMenuAction` era `Promise<void>` y DESCARTABA el
    // Result. Si el candado de concurrencia rechazaba, en pantalla no pasaba nada y el profesional se
    // quedaba creyendo que había aplicado el cambio. En una escritura clínica eso es peor que un error.
    for (const nombre of ["aplicarCambioMenuAction", "aplicarCambiosMenuAction"]) {
      const i = ACTIONS.indexOf(`export async function ${nombre}(`);
      expect(i, `no encuentro ${nombre}`).toBeGreaterThan(-1);
      const cuerpo = ACTIONS.slice(i, ACTIONS.indexOf("\nexport async function", i + 1));
      expect(cuerpo, `${nombre} ya no devuelve estado`).toContain("Promise<TreatmentActionState>");
      expect(cuerpo, `${nombre} ya no avisa del candado`).toContain("stale_write");
    }
  });

  it("y los dos botones del menú montan el hook que dispara el aviso y luego refresca", () => {
    for (const accion of ["aplicarCambioMenuAction", "aplicarCambiosMenuAction", "generateMenuAction"]) {
      const i = PANEL.indexOf(`useActionState(${accion},`);
      expect(i, `${accion} ya no se monta con useActionState`).toBeGreaterThan(-1);
      // El hook va inmediatamente despues; se mira una ventana corta para no cazar el de otro componente.
      expect(PANEL.slice(i, i + 600), `${accion} perdió el hook del aviso`).toContain(
        "useFormToastAndRefresh(state)",
      );
    }
  });
});

describe("aplicar UNO delega en aplicar todas: una sola regla de escritura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reader.mockResolvedValue(protocoloConMenu(null));
  });

  it("el de a uno produce exactamente la misma escritura que la lista de un elemento", async () => {
    await aplicarCambioMenu(
      { evaluationId: EVAL, dia: 4, tiempo: "cena", reemplazo: "Pescado al vapor" },
      ACTOR,
    );
    const unoSolo = celdasDeLaEscritura(0);

    writer.mockClear();
    await aplicarCambiosMenu(
      { evaluationId: EVAL, cambios: [{ dia: 4, tiempo: "cena", reemplazo: "Pescado al vapor" }] },
      ACTOR,
    );
    expect(celdasDeLaEscritura(0)).toEqual(unoSolo);
  });
});
