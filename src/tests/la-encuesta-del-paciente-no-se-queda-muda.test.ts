import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DOS COSAS QUE EL PACIENTE TIENE QUE PODER VER  ·  Santiago, 2026-11-11
//
// Las dos salieron de probar la CNV-S con un paciente, y las dos son del mismo genero: la pantalla
// SABE algo y no se lo dice, o se lo dice al reves.
//
//   a) *"Al abrir la CNV-S no aparece el enlace para retomarla. La inicial si lo muestra."*
//   b) *"Si el profesional cierra la encuesta, el paciente ve «No se pudo guardar el avance»."*
//
// ═══ (a) LA ASIMETRIA ERA LA PISTA ═══
//
// La caja del enlace se escondia sola cuando no podia construir una URL absoluta, y la construia UNA
// VEZ, en el init del `useState`. En la INICIAL la encuesta se monta en el navegador (despues de firmar),
// asi que habia `window.location.origin` y la caja aparecia. En el SEGUIMIENTO el paciente entra por la
// pagina de reanudacion, que es un Server Component: el primer render ocurre en el servidor, sin
// `window`, el valor se congelaba vacio, y la hidratacion no lo recalculaba.
//
// ═══ (b) EL MENSAJE DECIA LO CONTRARIO DE LO QUE PASABA ═══
//
// *"No pudimos guardar tu avance... tus respuestas siguen aqui; sigue respondiendo e intentamos de
// nuevo"* describe un fallo PASAJERO. Con la encuesta cerrada por el profesional nada de lo que el
// paciente escriba va a guardarse: estaba llenando una encuesta que ya no existe. Se le lleva a la
// pagina de reanudacion, que ya distingue las TRES situaciones (cerrada, completada, enlace invalido) y
// las dice con sus palabras, en vez de inventar un cuarto mensaje que ademas tendria que adivinar cual
// de las tres es.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const sinComentarios = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("el enlace para retomar la encuesta", () => {
  const CAJA = sinComentarios(
    readFileSync("src/modules/evaluations/components/resume-link-box.tsx", "utf8"),
  );

  it("no se esconde por no tener la URL todavia", () => {
    // Era `if (!resumeUrl) return null`: un dato que falta (el origen, en el render del servidor) se
    // convertia en una via de vuelta que el paciente no ve.
    expect(CAJA, "la caja volvio a esconderse sola").not.toMatch(/if\s*\(!resumeUrl\)\s*return null/);
  });

  it("y la completa al abrirla, no en un efecto", () => {
    // En el navegador `window.location.origin` existe siempre. Y NO en un efecto: un `setState` sincrono
    // dentro de un efecto dispara renders en cascada (el lint lo prohibe).
    expect(CAJA).toContain("buildResumeUrl(resumeToken, window.location.origin)");
    expect(CAJA).toContain("onClick={alternar}");
    expect(CAJA, "la URL volvio a calcularse en un efecto").not.toMatch(
      /useEffect\([^)]*\)\s*=>\s*\{[^}]*setResumeUrl/s,
    );
  });

  it("el formulario se la muestra al PACIENTE y no al profesional", () => {
    // La otra mitad, que sigue como estaba: es una credencial, y en la consulta no hace falta.
    const FORM = sinComentarios(
      readFileSync("src/modules/evaluations/components/survey-phase-form.tsx", "utf8"),
    );
    expect(FORM).toContain("{delProfesional ? null : <ResumeLinkBox resumeToken={resumeToken} />}");
  });
});

describe("cuando la encuesta ya no esta abierta", () => {
  const ACCIONES = sinComentarios(readFileSync("src/modules/evaluations/actions.ts", "utf8"));

  it("el guardado y el envio llevan al paciente a la pagina que lo explica", () => {
    // DOS, no una: el guardado de avance es el que Santiago vio, pero el envio final es peor todavia
    // ("vuelve a pulsar Enviar" sobre una encuesta cerrada manda a pulsar para siempre).
    const redirecciones = ACCIONES.match(
      /if \(res\.error\.message === RESUME_INVALID\) redirect\(`\/encuesta\/reanudar\/\$\{resumeToken\}`\)/g,
    );
    expect(redirecciones ?? [], "falta una de las dos acciones").toHaveLength(2);
  });

  it("y reconoce el caso por la CONSTANTE, no por una copia del texto", () => {
    // Con el texto copiado, cambiar el mensaje en el servicio dejaria de reconocerlo EN SILENCIO y el
    // paciente volveria a ver "no se pudo guardar".
    expect(ACCIONES).toContain("RESUME_INVALID,");
    expect(ACCIONES, "el mensaje se copio en vez de importarse").not.toContain(
      "El enlace de la encuesta no es válido",
    );
    const SERVICIO = readFileSync("src/modules/evaluations/services/survey-intake.ts", "utf8");
    expect(SERVICIO).toContain("export const RESUME_INVALID =");
  });

  it("la pagina de reanudacion sigue distinguiendo las tres situaciones", () => {
    // Es el destino de las dos redirecciones: si se colapsaran en un mensaje, el paciente que ya
    // completo la encuesta leeria que su profesional la cerro.
    const PAGINA = readFileSync("src/app/(public)/encuesta/reanudar/[token]/page.tsx", "utf8");
    for (const texto of [
      "Retiraste tu autorización",
      "Evaluación cerrada",
      "Encuesta completada",
      "Enlace no válido",
    ]) {
      expect(PAGINA, `la pagina de reanudacion dejo de decir "${texto}"`).toContain(texto);
    }
  });
});
