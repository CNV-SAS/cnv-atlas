import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// CANDADOS SOBRE EL SITIO DE LLAMADA (barrido del 2026-08-28).
//
// LA REGLA QUE LOS ORIGINA: cuando el defecto es una OMISION (nadie invoca al guard), el candado va sobre
// el SITIO DE LLAMADA, no sobre la funcion. Lo aprendimos con el hueco de la revocacion a media sesion:
// el gate existia, funcionaba, tenia su test verde, y aun asi la captura seguia despues de revocar,
// porque nadie volvia a preguntar. Un test de la funcion no cubre eso.
//
// La señal para reconocer esta forma: si al describir el defecto dices "SI habia gate y aun asi paso",
// entonces el gate no era el problema.
//
// El barrido encontro dos guards con candado de funcion y su sitio de llamada sin cubrir. Los dos son
// muros de seguridad, y los dos desaparecerian EN SILENCIO si alguien borra la linea que los invoca:
// nada se pone rojo, y la unica señal seria un paciente afectado.

describe("checkConsentBranchConsistency: el SEGUNDO MURO de la rama menor (DELTA2 B3)", () => {
  // QUE PROTEGE. Un consentimiento otorgado por representante legal cuando el paciente es mayor (o al
  // reves) es un consentimiento invalido: lo firmo quien no debia. El primer muro esta en el formulario
  // (la rama se activa por la fecha de nacimiento); este es el segundo, y corre DENTRO de la transaccion
  // de confirmar identidad, contra la fecha REAL del perfil. Si desaparece, la evaluacion se confirma
  // igual y el consentimiento invalido queda sellado en la historia.
  it("confirmEvaluationIdentity LO INVOCA, y la fuente lo hace ANTES de tocar la evaluacion", async () => {
    // Se comprueba sobre la fuente y no ejecutando: el writer necesita BD real, y lo que importa aqui es
    // el ORDEN (el muro antes de la escritura), que se lee en el archivo.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/modules/evaluations/data/evaluations-writer.ts", "utf8");

    const llamada = src.indexOf("checkConsentBranchConsistency(");
    const escritura = src.indexOf(".update(evaluations)");
    expect(llamada).toBeGreaterThan(-1);
    expect(escritura).toBeGreaterThan(-1);
    expect(llamada).toBeLessThan(escritura);
  });

  it("y su fallo ABORTA: no se ignora ni se degrada a aviso", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/modules/evaluations/data/evaluations-writer.ts", "utf8");
    // El resultado tiene que LANZAR. Un guard cuyo resultado se lee y no se usa es peor que no tenerlo:
    // parece que protege.
    expect(src).toMatch(/if \(!check\.ok\) throw new ConsentBranchMismatchError/);
  });
});

describe("computePatientBandText: el gate D-007 (banda con encuesta incompleta)", () => {
  // QUE PROTEGE. D-007 es decision de Gildardo: no se comunica el cambio de edad biologica si la encuesta
  // esta incompleta, porque una encuesta a medias INFLA la EB-BIS (medido: +14 años entre 3/13 y 13/13).
  // La funcion recibe `dfiComplete` como tercer argumento y su test unitario la cubre bien. Lo que no
  // estaba cubierto es que el SITIO DE LLAMADA le pase el valor REAL: si alguien escribe `true` ahi,
  // el test de la funcion sigue verde y el paciente recibe una banda favorable calculada sobre defaults.
  it("el reader le pasa el dfi.complete REAL del snapshot, no un literal", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/modules/reports/data/reports-repository.ts", "utf8");
    // Se ancla en la ASIGNACION y no en el nombre a secas: `indexOf` a secas encuentra la DECLARACION
    // (la funcion vive en este mismo archivo) y el candado acabaria leyendo la firma en vez de la llamada.
    const i = src.indexOf("= computePatientBandText(");
    expect(i).toBeGreaterThan(-1);
    const llamada = src.slice(i, src.indexOf(");", i));
    // El tercer argumento sale del snapshot sellado, no de una constante.
    expect(llamada).toContain("dfi?.complete === true");
    expect(llamada).not.toMatch(/,\s*true\s*\)?\s*$/);
  });
});

describe("canManageInventory: una policy sin ningun sitio de llamada", () => {
  // QUE ENCONTRO EL BARRIDO. `canManageInventory` no se invoca en ningun sitio: es un control que no
  // controla. No hay agujero de seguridad (la RLS de `nutraceutical_inventory` sigue siendo la autoridad
  // real), pero un `can*` sin uso se lee como si algo estuviera protegido por la app cuando no lo esta.
  // Es la misma familia del ack de restricciones: maquinaria construida y sin cablear.
  //
  // ESTE CANDADO NO ARREGLA NADA, y es a proposito: cablearla o retirarla es una decision de producto
  // (quien ajusta stock desde la app), no nuestra. Lo que hace es DEJAR CONSTANCIA de que hoy no se usa,
  // para que nadie la lea como una proteccion vigente, y ponerse rojo el dia que alguien la cablee, que es
  // justo el momento de volver a mirar si el reparto de roles sigue siendo el correcto.
  it("HOY no la invoca nadie: si esto se pone rojo, alguien la cableo y hay que revisar la decision", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const archivos: string[] = [];
    (function recorrer(dir: string) {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) {
          if (n === "node_modules" || n === "tests") continue;
          recorrer(p);
        } else if (/\.(ts|tsx)$/.test(n)) archivos.push(p.replace(/\\/g, "/"));
      }
    })("src");

    const usos = archivos.filter(
      (f) =>
        !f.endsWith("can-manage-inventory.ts") &&
        /\bcanManageInventory\b/.test(readFileSync(f, "utf8")),
    );
    expect(usos).toEqual([]);
  });
});
