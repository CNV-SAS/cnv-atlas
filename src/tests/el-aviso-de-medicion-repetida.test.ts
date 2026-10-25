import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { avisoDeHuellaRepetida } from "@/modules/bis/huella-repetida";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EL AVISO DE MEDICION REPETIDA, Y DONDE VIVE LA CORRECCION
//
// ── DE DONDE SALE (Gildardo, 2026-10-26) ────────────────────────────────────────────────────────
//
// *"Construye un aviso en cada una de esas consultas y en su lista de pendientes... Sin decir quien es el
// otro paciente si no tiene acceso a esa historia, como ya hace el freno."* Y: *"la correccion va en
// Antropometria y BIS, que es donde vive la toma, no en Diagnostico funcional."*
//
// El EFECTO (que aparezca, que distinga de quien es y que se apague al corregir) lo prueba
// `el-aviso-de-medicion-repetida-db`. Aqui se defiende la forma.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const NEUTRO = "src/modules/bis/huella-repetida.ts";
const LECTOR = "src/modules/bis/data/huellas-repetidas-reader.ts";
const AVISO = "src/modules/bis/components/aviso-de-medicion-repetida.tsx";
const ENTRADA = "src/modules/evaluations/components/entrada-evaluacion.tsx";
const PAGINA = "src/app/(app)/ani-bis-e/[id]/page.tsx";
const LISTA = "src/modules/patients/components/lista-pacientes.tsx";
const FILA = "src/modules/patients/roster-fila.ts";
const ROSTER = "src/modules/patients/data/patients-list-reader.ts";

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

describe("el aviso no identifica al otro paciente", () => {
  it("lo que sale del lector son TRES datos, y ninguno identifica a nadie", () => {
    // Es la linea que ya traza el freno: quien mira puede no tener acceso a esa historia clinica, y darle
    // el nombre seria filtrar el dato de un tercero para avisarle de un error. Si alguien añade el id del
    // otro paciente "para poder enlazar", esto falla.
    const neutro = leer(NEUTRO);
    const i = neutro.indexOf("export type HuellaRepetida");
    const cuerpo = neutro.slice(i, neutro.indexOf("};", i));
    for (const prohibido of ["patientId", "patient_id", "evaluationId", "nombre", "documento"]) {
      expect(cuerpo, `el tipo del aviso no puede llevar ${prohibido}`).not.toContain(prohibido);
    }
    expect(cuerpo).toContain("otras");
    expect(cuerpo).toContain("mismoPaciente");
    expect(cuerpo).toContain("otroPaciente");
  });

  it("y el texto tampoco: ni id, ni nombre", () => {
    for (const h of [
      { otras: 1, mismoPaciente: false, otroPaciente: true },
      { otras: 2, mismoPaciente: true, otroPaciente: true },
      { otras: 1, mismoPaciente: true, otroPaciente: false },
    ]) {
      const texto = avisoDeHuellaRepetida(h);
      expect(texto).toMatch(/revisa/i);
      expect(texto, "un uuid en el aviso").not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    }
    // Y DISTINGUE LOS DOS CASOS, porque el consejo es otro: dentro del mismo paciente suele ser el mismo
    // archivo importado dos veces; entre pacientes distintos es una toma en la historia equivocada.
    expect(avisoDeHuellaRepetida({ otras: 1, mismoPaciente: false, otroPaciente: true })).toMatch(
      /otro paciente/,
    );
    expect(avisoDeHuellaRepetida({ otras: 1, mismoPaciente: true, otroPaciente: false })).toMatch(
      /mismo paciente/,
    );
  });

  it("el TEXTO vive en UN sitio: la lista y la consulta no lo escriben distinto", () => {
    // Dos redacciones del mismo aviso acaban diciendo cosas distintas del mismo hecho (hazard 4).
    expect(leer(LISTA)).toContain("avisoDeHuellaRepetida(");
    expect(leer(AVISO)).toContain("avisoDeHuellaRepetida(");
    for (const archivo of [LISTA, AVISO]) {
      expect(leer(archivo), `${archivo} redacta el aviso por su cuenta`).not.toMatch(
        /está repetida en/,
      );
    }
  });
});

describe("el aviso se deriva: no hay marca que acordarse de apagar", () => {
  it("el lector compara SOLO entre vigentes", () => {
    // De ahi sale que se apague solo: en cuanto la correccion deje una sola version en pie, la otra sale
    // del universo. Y es lo que hace innecesarias las dos excepciones del freno (la copia de la cadena y
    // la medicion marcada cuelgan de la version reemplazada).
    const lector = leer(LECTOR);
    expect(lector).toContain("e.superseded_at is null");
    expect(lector).toContain("e.retirada_at is null");
    expect(lector).toContain("coalesce(p.cuenta_como_de_prueba, false) = false");
  });

  it("y no hay columna, ni marca, ni fecha de revisado", () => {
    // Una marca de "ya lo revise" habria que acordarse de quitarla, y entonces el aviso sobreviviria al
    // arreglo o moriria antes. Que se apague solo no es una funcion: es la consecuencia de derivarlo.
    expect(
      leer(LECTOR).toLowerCase(),
      "una marca de revisado habria que acordarse de quitarla",
    ).not.toContain("revisad");
  });

  it("la huella se arma con LA MISMA funcion que el freno", () => {
    // Dos formatos de la misma huella divergen por un cero de mas (2.04 contra 2.040), y entonces el freno
    // y el aviso dejarian de hablar del mismo hecho.
    const lector = leer(LECTOR);
    expect(lector).toContain("huellaDeLaMedicion(");
    expect(lector).toContain("VARIABLES_DE_LA_HUELLA");
    expect(lector, "una segunda huella escrita en SQL").not.toMatch(/string_agg|array_agg/);
  });
});

describe("donde aparece, y donde NO", () => {
  it("en la consulta, pegado a la medicion", () => {
    const entrada = leer(ENTRADA);
    expect(entrada).toContain("{avisoDeMedicionRepetida}");
    expect(leer(PAGINA)).toContain("<AvisoDeMedicionRepetida repetida={medicionRepetida} />");
  });

  it("y en la lista de pacientes, como CHIP y no como pendiente", () => {
    // SI FUERA UNA `AccionPendiente` taparia el trabajo real (o quedaria tapada por el: la columna dice UN
    // escalon) y MOVERIA EL CONTEO DEL TABLERO, que cuenta esa misma regla. Es un aviso sobre la fila.
    expect(leer(LISTA)).toContain("Medición repetida");
    expect(
      leer("src/modules/patients/pendientes.ts"),
      "entro en la secuencia de pendientes, y ahi no va",
    ).not.toMatch(/repetid/i);
  });

  it("el chip SE SUMA a los demas en vez de competir con ellos", () => {
    // Un paciente puede estar a la vez sin autorizacion vigente y con su medicion repetida, y las dos hay
    // que verlas: la cadena de chips es un if/else, asi que este va APARTE y antes.
    const lista = leer(LISTA);
    const iAviso = lista.indexOf("Medición repetida");
    const iCadena = lista.indexOf("p.esDePrueba ? (");
    expect(iAviso).toBeGreaterThan(0);
    expect(iCadena, "el chip del aviso tiene que ir ANTES de la cadena excluyente").toBeGreaterThan(iAviso);
  });

  it("el lector del roster lo pide UNA vez, no por fila, y un fallo no tumba la lista", () => {
    const roster = leer(ROSTER);
    expect(roster).toContain("await huellasRepetidasEnVigentes()");
    expect(roster, "un aviso que tumba la pantalla donde se trabaja es peor que un aviso que falta").toContain(
      "pacientes.roster.huellas-repetidas",
    );
    expect(leer(FILA), "la fila lo recibe, no lo consulta").toContain("repetidas: ReadonlyMap<string");
  });
});

describe("la correccion vive donde vive la toma", () => {
  it("se monta en Antrop. & BIS", () => {
    expect(leer(ENTRADA)).toContain("{composition ? correccionDeLaMedicion : null}");
    expect(leer(PAGINA)).toContain("correccionDeLaMedicion: <MedicionDeOtroPaciente evaluationId={id} />");
  });

  it("y en Diagnostico queda el PUNTERO, con el nombre derivado del mapa de etapas", () => {
    // Quien lo aprendio ahi va a volver a buscarlo ahi. Y el nombre de la pestaña NO se escribe a mano: un
    // texto que nombra una pestaña sobrevive a que esa pestaña se renombre, y eso ya paso una vez.
    const pagina = leer(PAGINA);
    const i = pagina.indexOf("Si la medición de esta consulta es de otra persona");
    expect(i, "el puntero desaparecio").toBeGreaterThan(0);
    expect(pagina.slice(i, i + 400)).toContain('etiquetaDeEtapa("antro")');
    // Y el boton NO esta en los dos sitios: dos veces el mismo acto irreversible es una de mas.
    expect(
      (pagina.match(/<MedicionDeOtroPaciente/g) ?? []).length,
      "la correccion se monta en dos sitios",
    ).toBe(1);
  });

  it("solo se ofrece si hay medicion: sin toma no hay nada que desligar", () => {
    expect(leer(ENTRADA)).toContain("{composition ? correccionDeLaMedicion : null}");
  });
});
