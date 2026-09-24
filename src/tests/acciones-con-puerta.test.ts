import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ TODA ACCION TIENE QUIEN LA LLAME (2026-09-24) ═══
//
// EL DEFECTO QUE LO MOTIVA: la sesión 2 del 3b construyó la cuarentena, la verificación, el bloqueo del
// producto de tercero y su candado contra base real. Todo verde. Pero NINGUNA pantalla llamaba a la acción
// que REGISTRA la devolución, así que "Devueltas pendientes de verificación" no podía aparecer nunca: no
// había por dónde meter nada. Se construyó el destino y no la puerta.
//
// Y no lo atrapó nada: tsc no se queja de un export que nadie usa, el candado de base probaba el escritor, y
// el lint de exports sin usar no aplica a un módulo de acciones (todas se exportan a propósito).
//
// La comprobación es tonta y por eso funciona: una server action existe para que algo la invoque. Si nadie
// la invoca, o está muerta o le falta la pantalla. Las dos merecen enterarse.

const RAIZ = "src";

function rutas(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) rutas(ruta, acc);
    else if (/\.(ts|tsx)$/.test(nombre)) acc.push(ruta);
  }
  return acc;
}

// EN WINDOWS LAS RUTAS VIENEN CON "\", así que un `includes("/tests/")` era siempre falso y este mismo
// archivo contaba como llamador de las acciones que nombra: el candado se daba por bueno a sí mismo.
const normal = (ruta: string) => ruta.split("\\").join("/");

// SE LEE TODO UNA VEZ. Leer cada archivo por cada acción se pasaba de los 5 s cuando la suite entera corre,
// y un candado que se cae por lento se termina borrando.
const FUENTES = new Map(rutas(RAIZ).map((r) => [normal(r), readFileSync(r, "utf8")]));

/** Los archivos de server actions: los que empiezan con "use server". */
const MODULOS_DE_ACCIONES = [...FUENTES.keys()].filter(
  (f) => /actions\.tsx?$/.test(f) && FUENTES.get(f)!.trimStart().startsWith('"use server"'),
);

const NOMBRES = /export async function (\w*Action)\b/g;

// ═══ LAS DOS QUE YA ESTABAN ASÍ (inventario, no perdón) ═══
//
// Las encontró este candado al escribirse, el 2026-09-24, y son de bloques anteriores. Se dejan VISIBLES en
// vez de taparlas, y el segundo caso exige que sigan siendo exactamente estas dos: si una se conecta, hay
// que quitarla de aquí; si aparece una tercera, falla el caso de arriba.
//
//   · registerUsageAction: registrar el uso de un nutracéutico. Ninguna pantalla lo ofrece.
//   · acknowledgeRestrictionsAction: el reconocimiento de las restricciones del modelo (T2 A2), que es un
//     ACTO CLÍNICO del profesional. El escritor existe y sella quién y cuándo; el botón, no.
const CONOCIDAS = ["acknowledgeRestrictionsAction", "registerUsageAction"];

function sinPuerta(): string[] {
  const huerfanas: string[] = [];
  for (const modulo of MODULOS_DE_ACCIONES) {
    for (const m of FUENTES.get(modulo)!.matchAll(NOMBRES)) {
      const accion = m[1];
      // UNA ACCIÓN QUE COMPONE A OTRA CUENTA COMO PUERTA: `revisarOImportarAction` decide y llama a las dos
      // suyas, y `createCheckoutFormAction` adapta a `createCheckoutAction`. Ahí la pantalla existe, solo
      // que llama a la de arriba. Por eso se busca la INVOCACIÓN, no la mención de la palabra.
      const invocada = new RegExp(`${accion}\\s*\\(|useActionState\\(\\s*${accion}\\b|action=\\{${accion}\\}`);
      let laLlaman = false;
      for (const [ruta, fuente] of FUENTES) {
        if (ruta.includes("/tests/")) continue;
        const llama =
          ruta === modulo
            ? invocada.test(fuente.replace(`export async function ${accion}`, ""))
            : fuente.includes(accion);
        if (llama) {
          laLlaman = true;
          break;
        }
      }
      if (!laLlaman) huerfanas.push(accion);
    }
  }
  return huerfanas.sort();
}

describe("las server actions tienen quién las llame", () => {
  it("hay módulos de acciones que revisar (si no, este candado no probaría nada)", () => {
    expect(MODULOS_DE_ACCIONES.length).toBeGreaterThan(3);
  });

  it("ninguna acción quedó sin pantalla", () => {
    // Si esto falla, la pregunta no es "cómo lo callo": es si falta la pantalla o sobra la acción.
    expect(sinPuerta().filter((a) => !CONOCIDAS.includes(a))).toEqual([]);
  });

  it("y las dos conocidas siguen siendo exactamente esas dos", () => {
    // LA LISTA NO ES UN PERDÓN, ES UN INVENTARIO. Si una se conecta, este caso falla y se quita de aquí; si
    // aparece una tercera, falla el caso de arriba. Lo que no puede pasar es que crezcan en silencio.
    expect(sinPuerta()).toEqual(CONOCIDAS);
  });
});
