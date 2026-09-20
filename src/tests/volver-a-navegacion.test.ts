import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "@/components/layout/nav-config";
import {
  PARAM_ORIGEN,
  conOrigen,
  destinoDeVuelta,
  etiquetaDeDestino,
  origenSeguro,
} from "@/components/shared/volver-a-destino";
import { etiquetaDeEtapa } from "@/modules/diagnoses/etapas";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO DE LA VUELTA (observación b, 2026-09-20) ═══
//
// LO QUE PROTEGE, y no es hipotético: el "volver" del SOAP decía "Volver a la evaluación" cuando se venía
// de Reporte/HC, porque el texto y el destino iban escritos a mano en la pantalla. Se corrigió a mano, que
// es el síntoma. La regla nueva es dinámica con respaldo fijo, y este candado cubre sus tres formas de
// romperse:
//
//   1. Que el origen deje de ganar sobre el padre (o que gane uno que no es de Atlas).
//   2. Que un texto deje de decir a dónde lleva (el defecto original, ahora derivado del destino).
//   3. Que la siguiente pantalla nueva vuelva a escribir su "volver" a mano, que es como entró la primera
//      vez. Sin la tercera parte las otras dos solo protegen lo que ya está escrito.

describe("el origen gana sobre el padre declarado, y solo si es de Atlas", () => {
  it("sin origen se vuelve al padre", () => {
    expect(destinoDeVuelta("/pacientes", null)).toBe("/pacientes");
    expect(destinoDeVuelta("/pacientes", "")).toBe("/pacientes");
  });

  it("con origen interno, manda el origen", () => {
    expect(destinoDeVuelta("/pacientes/abc", "/dashboard")).toBe("/dashboard");
    expect(destinoDeVuelta("/ani-bis-e/1", "/pacientes?pagina=2")).toBe("/pacientes?pagina=2");
  });

  it("un origen que sale de Atlas se descarta: el enlace vuelve al padre", () => {
    // Un "volver" que lleva fuera, dentro de una pantalla en la que el profesional ya confia, es la forma
    // barata de una suplantacion. Las dos ultimas las resuelve el navegador como dominios.
    for (const afuera of [
      "https://otro-sitio.com",
      "http://otro-sitio.com",
      "//otro-sitio.com",
      "/\\otro-sitio.com",
      "javascript:alert(1)",
      "pacientes",
      `/pacientes${"x".repeat(400)}`,
      "/pacientes\nhttps://otro-sitio.com",
    ]) {
      expect(origenSeguro(afuera), afuera).toBeNull();
      expect(destinoDeVuelta("/pacientes", afuera), afuera).toBe("/pacientes");
    }
  });
});

describe("enlazar llevando el origen", () => {
  it("lo añade como parámetro, respetando los que el destino ya tenga", () => {
    expect(conOrigen("/ani-bis-e/1", "/dashboard")).toBe(
      `/ani-bis-e/1?${PARAM_ORIGEN}=${encodeURIComponent("/dashboard")}`,
    );
    expect(conOrigen("/ani-bis-e/1?etapa=reporte", "/pacientes")).toContain("etapa=reporte&");
  });

  it("el ancla se queda AL FINAL", () => {
    // Los enlaces a una pregunta sin responder terminan en `#p-<id>`. Con el parametro pegado detras, el
    // navegador deja de encontrar el ancla: la pantalla abre, pero ya no salta a la pregunta.
    const enlace = conOrigen("/ani-bis-e/1/encuesta/editar#p-32", "/ani-bis-e/1?etapa=encuesta");
    expect(enlace.endsWith("#p-32")).toBe(true);
    expect(enlace).toContain(`?${PARAM_ORIGEN}=`);
  });

  it("un origen que no es de Atlas no se pega: el enlace sale limpio", () => {
    expect(conOrigen("/ani-bis-e/1", "https://otro-sitio.com")).toBe("/ani-bis-e/1");
  });
});

describe("el texto se deriva del destino, no se escribe", () => {
  it("nombra los sitios a los que de verdad se vuelve", () => {
    expect(etiquetaDeDestino("/dashboard")).toBe("Volver al inicio");
    expect(etiquetaDeDestino("/pacientes")).toBe("Volver a la lista de pacientes");
    expect(etiquetaDeDestino("/pacientes/8c1d-ee")).toBe("Volver a la ficha del paciente");
    expect(etiquetaDeDestino("/ani-bis-e/1")).toBe("Volver a la evaluación");
    expect(etiquetaDeDestino("/ani-bis-e/1/encuesta")).toBe("Volver a la encuesta");
    expect(etiquetaDeDestino("/auditoria/solicitar")).toBe("Volver a las solicitudes");
  });

  it("/pacientes/nuevo es un formulario, no una ficha", () => {
    expect(etiquetaDeDestino("/pacientes/nuevo")).not.toContain("ficha");
  });

  it("la etapa la nombra la barra de pestañas, no este módulo", () => {
    // Si una pestaña se renombra o se parte, este texto se renombra con ella. Es la leccion de `etapas.ts`,
    // que nacio justo de un aviso que seguia mandando a una pestaña que ya no existia.
    expect(etiquetaDeDestino("/ani-bis-e/1?etapa=reporte")).toBe(
      `Volver a ${etiquetaDeEtapa("reporte")}`,
    );
    expect(etiquetaDeDestino("/ani-bis-e/1?etapa=tratamiento")).toBe(
      `Volver a ${etiquetaDeEtapa("tratamiento")}`,
    );
  });

  it("una etapa inventada no inventa rótulo: cae a la evaluación", () => {
    expect(etiquetaDeDestino("/ani-bis-e/1?etapa=loquesea")).toBe("Volver a la evaluación");
  });

  it("toda pantalla del menú tiene nombre, aunque nadie la haya previsto como origen", () => {
    for (const item of NAV_ITEMS) {
      expect(etiquetaDeDestino(item.href), item.href).not.toBe("Volver");
    }
  });

  it("un destino desconocido dice menos, pero no dice nada falso", () => {
    expect(etiquetaDeDestino("/algo/que-no-existe")).toBe("Volver");
  });
});

// ═══ Y LA PARTE QUE IMPIDE QUE VUELVA A ENTRAR ═══
//
// LAS EXCEPCIONES, cada una con su razon. No son "pantallas que se nos olvidaron": son pantallas donde no
// hay de donde venir.
const FUERA_DEL_BARRIDO = new Set([
  // El 404 y el olvido de contraseña viven FUERA de la aplicación (sin sesión, sin pantalla anterior
  // dentro de Atlas): su destino es fijo porque no existe un origen posible.
  "src/app/not-found.tsx",
  "src/app/(auth)/forgot-password/page.tsx",
  // El componente mismo.
  "src/components/shared/volver-a-enlace.tsx",
]);

function archivosTsx(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) out.push(...archivosTsx(p));
    else if (d.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

// Un enlace (`<Link>` o `<a>`) cuyo texto empieza por "Volver". Un BOTON que diga "Volver" no cuenta: esos
// no navegan, deshacen un paso dentro de la misma pantalla ("Volver a revisar", "Volver al menú del
// ciclo"), y prohibirlos seria ruido.
const ENLACE_ESCRITO_A_MANO = /<(?:Link|a)\b[^>]*>\s*Volver/;

// Y EL OTRO CAMINO POR EL QUE ENTRO LA PRIMERA VEZ: el texto iba DENTRO de `VolverA`, que era quien lo
// pintaba. Hoy el componente no recibe texto (el tipo ya no lo admite), pero el tipo es lo que se relaja
// cuando alguien "necesita un caso especial", y este es el caso especial que costo un enlace que mentia.
const TEXTO_DENTRO_DEL_COMPONENTE = /<VolverA\b[^>]*(?<!\/)>[^<]*\S/;

describe("ninguna pantalla escribe su volver a mano", () => {
  const sospechosos = archivosTsx("src/app")
    .concat(archivosTsx("src/modules"), archivosTsx("src/components"))
    .filter((f) => !FUERA_DEL_BARRIDO.has(f))
    .filter((f) => {
      const codigo = sinComentarios(readFileSync(f, "utf8"));
      return ENLACE_ESCRITO_A_MANO.test(codigo) || TEXTO_DENTRO_DEL_COMPONENTE.test(codigo);
    });

  it("la vuelta se pide con VolverA, que sabe de dónde viene el profesional", () => {
    expect(sospechosos).toEqual([]);
  });

  it("el barrido reconoce las dos formas del defecto", () => {
    // Sin esto, el barrido podria estar pasando porque su expresion no caza nada.
    expect(ENLACE_ESCRITO_A_MANO.test('<Link href="/x">Volver a la evaluación</Link>')).toBe(true);
    expect(TEXTO_DENTRO_DEL_COMPONENTE.test("<VolverA href={x}>Volver a la evaluación</VolverA>")).toBe(
      true,
    );
    // Un boton que dice "Volver" dentro de la misma pantalla no es navegacion y no se prohibe.
    expect(ENLACE_ESCRITO_A_MANO.test("<Button onClick={atras}>Volver</Button>")).toBe(false);
  });
});
