import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HTML_VIGENTE } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LAS ETAPAS DE LA EVALUACION · SON SEIS Y VAN EN SU ORDEN (2026-09-10).
//
// EL HUECO QUE CIERRA: teniamos candado para las SUBPESTAÑAS de Diagnostico y ninguno para las PESTAÑAS de
// arriba, que son la navegacion principal. El orden de las subpestañas ya se nos habia movido sin que
// nadie se enterara (nos lo devolvio Gildardo en dos puntos de su cotejo); no hay razon para que el de
// arriba este menos protegido.
//
// Y ESTE CAMBIO ES JUSTO EL CASO: hasta hoy teniamos CINCO etapas con "Evaluacion" como primera, y su
// archivo tiene SEIS, con Encuesta y Antrop. & BIS por separado. Era una decision NUESTRA, escrita en el
// comentario de cabecera del componente ("no son etapas propias"), y sobrevivio porque nada la contrastaba
// con su archivo.
//
// SE DERIVA DE SU ARCHIVO, NO SE ESCRIBE A MANO. Su lista es `MODS_CLINICA`, que es la que pinta la barra
// de arriba (hay otras listas de modulos en su HTML; esta se desambigua por CONTENIDO, no por posicion).

// LA LISTA SE MUDO A UN MODULO NEUTRO (2026-09-09) y este candado la sigue. El traslado sale de este
// mismo barrido: hay avisos que NOMBRAN una pestaña y se rinden desde el SERVIDOR, asi que no podian leer
// la lista de un componente "use client". El componente sigue siendo quien la PINTA, y por eso hay dos
// fuentes: la lista (NUESTRO) y la barra que la consume (BARRA).
const NUESTRO = sinComentarios(readFileSync("src/modules/diagnoses/etapas.ts", "utf8"));
const BARRA = sinComentarios(
  readFileSync("src/modules/diagnoses/components/evaluation-tabs.tsx", "utf8"),
);

/** Los ids de SU barra de modulos clinicos, en su orden. */
function etapasDeSuArchivo(): string[] {
  const src = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
  const i = src.indexOf("const MODS_CLINICA = [");
  if (i < 0) throw new Error(`no aparece MODS_CLINICA en ${HTML_VIGENTE}`);
  const bloque = src.slice(i, src.indexOf("}];", i));
  return [...bloque.matchAll(/id:\s*"([a-z]+)"/g)].map((m) => m[1]);
}

/** Los ids de NUESTRA barra, leidos del arreglo que la pinta. */
function nuestrasEtapas(): string[] {
  const bloque = NUESTRO.slice(
    NUESTRO.indexOf("export const ETAPAS"),
    NUESTRO.indexOf("];", NUESTRO.indexOf("export const ETAPAS")),
  );
  return [...bloque.matchAll(/id:\s*"([a-z]+)"/g)].map((m) => m[1]);
}

describe("las etapas salen de su archivo", () => {
  it("el control: su archivo declara las seis", () => {
    // Sin este control, un cambio de forma en su HTML daria una lista vacia y todo lo de abajo compararia
    // nada contra nada, en verde.
    expect(etapasDeSuArchivo(), `no se extrajo MODS_CLINICA de ${HTML_VIGENTE}`).toHaveLength(6);
  });

  it("son las mismas seis, en el MISMO orden", () => {
    // Los IDS coinciden con los suyos a proposito: al partir Evaluacion en dos se adoptaron sus nombres
    // (`encuesta`, `antro`) en vez de inventar otros, para que esta comparacion sea directa y no dependa
    // de una tabla de traduccion que envejece.
    expect(nuestrasEtapas(), "el orden o el numero de etapas dejó de ser el de su archivo").toEqual(
      etapasDeSuArchivo(),
    );
  });

  it("y cada una tiene su slot de contenido: ninguna pestaña vacía", () => {
    // Una pestaña que existe y no muestra nada cumple el cotejo por fuera y no por dentro.
    for (const id of nuestrasEtapas()) {
      expect(BARRA, `la etapa ${id} no tiene slot`).toContain(`${id}: ReactNode;`);
    }
  });
});

describe("las ETIQUETAS son nuestras, y eso es deliberado", () => {
  it('la cuarta sigue diciendo "Tratamiento"', () => {
    // Su archivo la llama "Rutas de atencion". Se queda como esta por decision de Santiago (2026-09-10):
    // Gildardo pidio partir Evaluacion en dos y no dijo nada del nombre de la cuarta, y ademas nuestra
    // pestaña contiene las rutas Y el panel por profesion, asi que describe mejor lo que hay dentro.
    // Si el la señala, se cambia. Lo que el candado fija es el ORDEN y el NUMERO, que es lo que pidio.
    expect(NUESTRO).toContain('{ id: "tratamiento", label: "Tratamiento" }');
  });
});

describe("los enlaces con la etapa vieja siguen llegando", () => {
  it("`?etapa=evaluacion` se traduce en vez de caer al default", () => {
    // Un enlace guardado que cae al default no da error: abre otra pantalla y ya. Es la forma silenciosa
    // de romper una direccion, y por eso se traduce explicitamente.
    expect(BARRA).toContain('if (raw === "evaluacion") return traducirEtapaVieja(raw, ev);');
  });

  it("y conserva la subpestaña que traían: `?ev=antropometria` va a Antrop. & BIS", () => {
    expect(BARRA).toContain('return ev === "antropometria" ? "antro" : "encuesta";');
  });

  it("ningún enlace del repositorio apunta ya a la etapa vieja", () => {
    // El candado no se conforma con que la traduccion exista: barre que no quede ningun emisor apuntando a
    // una direccion que ya no es. Un enlace nuestro no deberia necesitar la compatibilidad.
    // SIN COMENTARIOS: el comentario de ese enlace EXPLICA la direccion vieja, y una asercion sobre el
    // texto crudo se ponia roja por la prosa y no por la regla.
    const NUESTROS_ENLACES = sinComentarios(
      readFileSync("src/modules/bis-intake/components/bis-conditions-capture.tsx", "utf8"),
    );
    expect(NUESTROS_ENLACES).toContain("?etapa=antro");
    expect(NUESTROS_ENLACES, "sigue emitiendo la etapa vieja").not.toContain("etapa=evaluacion");
  });
});
