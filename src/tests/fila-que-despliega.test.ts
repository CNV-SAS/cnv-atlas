import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";
import { QUE_HACE } from "@/modules/dashboard/que-hace";
import { NAV_ITEMS } from "@/components/layout/nav-config";

// ═══ LA FILA DESPLIEGA EN VEZ DE NAVEGAR, Y LA COLUMNA DE ACCIONES (Santiago, 2026-09-10) ═══
//
// SU RAZON: pulsar una fila para ir a la ficha y desde ahi entrar a una evaluacion son dos saltos para
// llegar a lo que se buscaba. Con las ultimas tres a la vista, el camino habitual es UNO. Y la ficha no se
// pierde: pasa a ser un boton de la columna de acciones.

const FILA = readFileSync("src/components/shared/fila-lista.tsx", "utf8");
const LISTA = readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8");
const ACCIONES = readFileSync("src/modules/patients/components/acciones-paciente.tsx", "utf8");
const READER = readFileSync("src/modules/patients/data/patients-list-reader.ts", "utf8");

describe("desplegar no cuesta una consulta", () => {
  it("las evaluaciones vienen en el MISMO embed que ya se hacía", () => {
    // Era lo que había que verificar antes de construirlo: el lector ya embebía las evaluaciones (para
    // contarlas y para la columna de pendientes), y solo les faltaban el id y el tipo. Si hubiera que
    // pedirlas al desplegar, esto sería otra cosa: una llamada por fila sobre 73 pacientes.
    expect(READER).toContain("evaluations(id, type, superseded_at");
  });

  it("y el rótulo del seguimiento se numera donde están todas juntas, no en la vista", () => {
    // "Seguimiento 2" depende del ORDEN entre las evaluaciones del paciente. Calcularlo fila por fila en
    // la vista daría el número de la fila, no el del seguimiento.
    expect(READER).toContain("`Seguimiento ${++n}`");
    expect(LISTA, "la vista empezó a numerar los seguimientos").not.toContain("Seguimiento ${");
  });

  it("son las TRES últimas, de la más reciente a la más antigua", () => {
    // Es el orden en que se buscan: quien despliega viene a por la última.
    expect(READER).toContain(".slice(-3).reverse()");
  });
});

describe("lo que la fila HACE cambia lo que la fila ES", () => {
  it("si despliega, el título es un botón y no un enlace", () => {
    // Un `<a>` que no lleva a ningún sitio se copia, se abre en otra pestaña y se anuncia como enlace, y
    // ninguna de las tres cosas es cierta. Por eso no es un enlace con `preventDefault`.
    expect(FILA).toContain("aria-expanded={desplegado}");
    expect(FILA).toContain('<button type="button" onClick={alPulsar}');
  });

  it("y los dos modos son excluyentes, con error ruidoso", () => {
    // Pasar los dos o ninguno es un error de programación, no un caso de borde: falla al construir la
    // fila en vez de pintar algo que no responde.
    expect(FILA).toContain("exactamente uno.");
  });

  it("el panel va FUERA del <li> de la fila", () => {
    // Dentro sería una celda más del grid de columnas, y además quedaría bajo el área pulsable estirada,
    // así que sus enlaces no se podrían pulsar.
    const i = FILA.indexOf("</li>");
    expect(FILA.slice(i), "el panel se metió dentro de la fila").toContain("desplegado && panel");
  });

  it("una sola fila abierta a la vez", () => {
    // Con varias abiertas la lista deja de poder recorrerse, que es para lo que existe.
    expect(LISTA).toContain("const [abierta, setAbierta] = useState<string | null>(null);");
    expect(LISTA).toContain("a === p.patientId ? null : p.patientId");
  });

  it("y el enlace de cada evaluación abre la pestaña de encuesta", () => {
    expect(LISTA).toContain("?etapa=encuesta");
  });
});

describe("la columna de acciones: la forma de la referencia, no su paleta", () => {
  it("son TRES botones, no ocho", () => {
    // La tabla de Biody lleva ocho, cada uno de un color saturado. En una lista de 73 filas eso convierte
    // la columna en lo más ruidoso de la pantalla, y aquí ya hay dos cosas que SÍ deben saltar: la columna
    // de pendientes y el chip.
    expect((ACCIONES.match(/<TooltipTrigger asChild>/g) ?? []).length).toBe(3);
  });

  it("y van neutros: en Atlas el color significa", () => {
    expect(ACCIONES, "los botones de acción se pintaron de color").not.toMatch(/variant="destructive"/);
    expect((ACCIONES.match(/variant="ghost"/g) ?? []).length).toBe(3);
  });

  it("cada uno dice qué hace al pasar por encima Y tiene nombre accesible", () => {
    // Un botón de icono sin nombre es un botón que solo existe para quien ve el dibujo.
    expect((ACCIONES.match(/aria-label=/g) ?? []).length).toBe(3);
    expect((ACCIONES.match(/<TooltipContent>/g) ?? []).length).toBe(3);
  });

  it("no hay eliminar, aunque la referencia lo tenga", () => {
    // Un paciente con datos clínicos arrastra evaluaciones, diagnósticos sellados y su rastro de
    // auditoría. La razón completa vive en `can-archive-patient`.
    // SOBRE EL CODIGO SIN COMENTARIOS: el comentario que explica por que NO hay boton de eliminar tiene
    // que nombrarlo, asi que el candado se cazaba a si mismo. Es la forma de siempre.
    expect(
      sinComentarios(ACCIONES).toLowerCase(),
      "apareció un botón de eliminar",
    ).not.toContain("eliminar");
    expect(existsSync("src/modules/patients/policies/can-archive-patient.ts")).toBe(true);
  });
});

describe("las funcionalidades se derivan del sidebar, no se escriben aparte", () => {
  it("cada entrada del menú tiene su explicación", () => {
    // Si se escribiera a mano, envejecería: se quedaría con la entrada retirada y sin la añadida, y no da
    // error, solo miente.
    const sinExplicacion = NAV_ITEMS.filter((i) => QUE_HACE[i.href] == null).map((i) => i.href);
    expect(sinExplicacion, "estas entradas del sidebar no tienen explicación").toEqual([]);
  });

  it("y la clave es la RUTA, que es lo único estable", () => {
    // Esta misma semana "Tablero" pasó a "Inicio" y "Administrador de Pacientes" a "Lista de pacientes".
    // Una explicación indexada por rótulo se habría quedado huérfana dos veces.
    const COMPONENTE = readFileSync(
      "src/modules/dashboard/components/funcionalidades.tsx",
      "utf8",
    );
    expect(COMPONENTE).toContain("QUE_HACE[i.href]");
  });

  it("y sin explicación la tarjeta se pinta igual", () => {
    // Ocultarla sería castigar al usuario por un texto que falta: la tarjeta sigue llevando a su sitio,
    // que es la mitad del valor.
    const COMPONENTE = readFileSync(
      "src/modules/dashboard/components/funcionalidades.tsx",
      "utf8",
    );
    expect(COMPONENTE).toContain("QUE_HACE[i.href] ? (");
  });
});
