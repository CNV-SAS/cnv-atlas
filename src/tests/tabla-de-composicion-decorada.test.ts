import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// LAS TRES TABLAS DE COMPOSICION SON UN SOLO COMPONENTE (smoke Santiago, 2026-09-10).
//
// EL REPORTE: "falta padding izquierdo en las tres tablas de composicion: Antropometria, Diagnostico y
// Reporte/HC. Ya lo corregimos en las del nutricionista; verifica por que estas quedaron fuera".
//
// POR QUE QUEDARON FUERA, que es lo que habia que verificar: no son tres tablas. Son TRES USOS del mismo
// `CompositionSection`, y ese componente nunca adopto `components/shared/tabla.tsx` (la decoracion unica
// aprobada el 2026-09-03, donde vive el `px-3` de todas las demas). Escribe sus clases a mano desde antes
// de que existiera el helper, asi que el barrido de aquel dia no lo alcanzo: no importaba nada de ahi.
//
// LA CONSECUENCIA PARA EL ARREGLO, y es la unica razon por la que esto lleva candado: **una sola
// correccion cubre las tres**, y al reves, quien retoque este archivo mueve las tres a la vez sin verlo.

const SRC = readFileSync("src/modules/diagnoses/components/composition-section.tsx", "utf8");
const CODIGO = sinComentarios(SRC);

describe("un componente, tres tablas", () => {
  it("Antropometría, Diagnóstico y Reporte/HC salen del mismo sitio", () => {
    // Si algún día se duplica el componente, este candado se pone rojo y quien lo lea sabrá que a partir
    // de ahí hay que corregir en dos sitios.
    const usos = [
      "src/app/(app)/ani-bis-e/[id]/page.tsx",
      "src/modules/bis-intake/components/medidas-con-tabla.tsx",
    ];
    for (const f of usos) {
      expect(readFileSync(f, "utf8"), `${f} dejó de usar CompositionSection`).toContain(
        "CompositionSection",
      );
    }
  });
});

describe("la franja de nivel va en color de marca; la cabecera, sin fondo", () => {
  // PRIMERA VUELTA (mañana): "Las franjas de nivel en color de marca, no gris. La cabecera de columnas se
  // queda gris." SEGUNDA VUELTA (tarde, variante (c)): el gris y el azul chocaban pegados, asi que la
  // cabecera pierde el fondo y queda UNA sola superficie pintada. Ver el caso de abajo.

  it("la franja de nivel lleva el tinte de marca con la letra en azul y el filo a la izquierda", () => {
    // ═══ CUARTA VUELTA DEL TONO (Santiago, 2026-09-19) ═══
    //
    // EL HISTORIAL, porque aquí se revierte una decisión suya y eso no se hace en silencio:
    //   · gris            -> "las franjas en color de marca, no gris" (10/9, mañana).
    //   · bg-primary/10   -> con el rótulo en azul.
    //   · bg-primary/5    -> su lectura del 10/9 por la tarde: "no que quede en gris NI CON ESE AZUL
    //                        ELÉCTRICO". El tinte bajó casi a blanco.
    //   · bg-primary      -> hoy pide justo lo contrario: "el mismo azul eléctrico de Atlas... me imagino
    //                        que tocará letra blanca". Se aplica lo que pide ahora, y queda escrito que
    //                        ya lo había descartado una vez, para que pueda volver atrás sabiendo cuál de
    //                        las dos lecturas prefiere con la pantalla delante.
    //
    // LO QUE NO CAMBIA EN NINGUNA VUELTA, y es lo único que BRAND.md protege aquí: la franja lleva color
    // de MARCA (capa de interfaz), nunca de RIESGO. El verde/ámbar/rojo sigue reservado a los veredictos.
    //   · tinte + filo  -> QUINTA VUELTA (2026-09-21), elegida VIENDO tres variantes lado a lado: el azul
    //                      pleno saturaba la tabla. Tinte claro, letra azul, filo de marca a la izquierda.
    expect(CODIGO, "la franja perdió su tinte").toContain("bg-franja-nivel");
    expect(CODIGO, "la franja perdió la letra en azul").toContain("text-franja-nivel-texto");
    expect(CODIGO, "la franja perdió el filo de marca").toContain("border-l-4 border-l-primary");
    // El color de riesgo se mira EN LA FRANJA, no en el archivo: los chips de veredicto de esta misma
    // tabla sí lo llevan, y con razón. Un detector de archivo entero cazaría a los vecinos.
    const franja = CODIGO.slice(CODIGO.indexOf("<tr className=\"bg-franja-nivel"));
    const linea = franja.slice(0, franja.indexOf(">"));
    for (const riesgo of ["clinical-critical", "clinical-warning", "clinical-optimal"]) {
      expect(linea, "la franja no puede llevar color de riesgo: " + riesgo).not.toContain(riesgo);
    }
  });

  it("y la cabecera de columnas NO lleva fondo: una sola superficie pintada", () => {
    // ═══ SEGUNDA VUELTA (Santiago, 2026-09-10, variante (c)) ═══
    //
    // Este caso decía que la cabecera "sigue gris", y por la tarde eso dejó de ser lo correcto. Su
    // reporte: el gris de la cabecera y el azul de la franja son dos familias y chocan pegados.
    //
    // LO QUE SE CORRIGE NO ES LA ARMONÍA DE LOS DOS COLORES, ES QUE HAYA DOS RELLENOS. La cabecera pierde
    // el fondo; la franja conserva el azul. Queda UNA superficie pintada, y es la que dice dónde empieza
    // cada nivel de Wang, que es lo único que aquí debe separar.
    //
    // La aserción es la misma de antes con el signo cambiado por una decisión suya, no por un rojo que
    // estorbaba: sigue afirmando que la cabecera y la franja NO compiten.
    const thead = CODIGO.slice(CODIGO.indexOf("<thead>"), CODIGO.indexOf("</thead>"));
    expect(thead, "la cabecera de columnas volvió a llevar fondo").not.toContain("bg-muted");
    expect(thead, "la cabecera de columnas se pintó de marca").not.toContain("bg-primary");
  });

  it("y la tabla de indicadores ANI-BIS-E, su vecina, quedó igual", () => {
    // LA QUE FALTABA (Santiago, 2026-09-10): vive en la misma subpestaña y en Reporte/HC, y se quedó fuera
    // del barrido del día anterior por lo mismo que la de Wang (escribe sus clases a mano y nunca adoptó
    // `tabla.tsx`). Su cabecera ya iba sin fondo, así que de la variante (c) solo le faltaba el aire.
    const IND = readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8");
    expect(IND).toContain('<th className="py-2 pl-3 pr-4 font-medium">Indicador</th>');
    expect(IND).toContain('<th className="py-2 pr-3 font-medium">Clasificación</th>');
    expect(IND).toContain('<td className="py-2 pl-3 pr-4">');
  });

  it("NUNCA con color de riesgo: esa reserva es clínica, no de gusto", () => {
    // BRAND.md: el verde/ámbar/rojo codifican severidad y se reservan a los veredictos clínicos. Una
    // franja que solo dice "aquí empieza el Nivel III" no puede insinuar una severidad. El azul de marca
    // es capa de INTERFAZ y por eso sí puede.
    const franja = CODIGO.slice(CODIGO.indexOf("<tr className=\"border-y"), CODIGO.indexOf("</tr>", CODIGO.indexOf("<tr className=\"border-y")));
    expect(franja, "la franja de nivel se pintó con color de riesgo").not.toMatch(/clinical-/);
  });
});

describe("y las celdas tienen padding a los dos lados", () => {
  it("la primera columna no toca el borde", () => {
    // EL DEFECTO: la tabla usaba `pr-4` en todas las celdas y NINGUNA a la izquierda. Sin fondo no se
    // notaba; con la franja y la cabecera pintadas, el rótulo arranca pegado al borde de la banda.
    expect(CODIGO).toContain('className="py-2 pl-3 pr-4 font-medium">Variable');
    expect(CODIGO).toContain('<td className="py-1.5 pl-3 pr-4 text-foreground">');
  });

  it("y la franja, que ocupa el ancho entero, tampoco", () => {
    // El padding lateral es lo que se afirma; el vertical subio a 2.5 al centrar el texto (2026-09-20),
    // asi que la asercion mira los lados y no la clase entera, que es lo que la hacia fragil.
    expect(CODIGO).toContain("px-3 py-2.5 text-xs font-semibold uppercase");
  });

  it("y el texto de la franja va centrado, no levantado", () => {
    // EL DEFECTO (Santiago, 2026-09-20): con la altura de linea heredada (1.5 sobre 12px) el navegador
    // reparte el sobrante arriba y abajo, y como las mayusculas no llenan su mitad superior, la fila se
    // lee descentrada. Con `leading-none` el padding es lo unico que centra, y centra parejo.
    expect(CODIGO).toContain("uppercase leading-none tracking-wide text-franja-nivel-texto");
  });

  it("la última columna cierra con su padding", () => {
    // Sin esto la tabla queda descuadrada al otro lado: entra con 3 y sale pegada.
    expect(CODIGO).toContain('<th className="py-2 pr-3 font-medium">Diagnóstico</th>');
    expect(CODIGO).toContain('<td className="py-1.5 pr-3">{dxNode}</td>');
  });
});
