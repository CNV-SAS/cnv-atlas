import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL GUARDADO UNICO DEL PROTOCOLO (Santiago, 2026-09-09).
//
// LO QUE PIDIO, textual: *"quitar todos esos botones de guardar ajustes por bloques y que cada cambio sea
// en vivo... que aparezca un toast o notificación sticky... y un botón que diga Guardar cambios. Así
// pasamos de 8 botones a solo 1 botón."*
//
// POR QUE HACE FALTA UN CANDADO EN LA PANTALLA, y no basta con el del writer: lo que hace SEGURO haber
// quitado los siete botones son tres piezas de interfaz, y las tres se pueden retirar por separado sin
// que nada se ponga rojo:
//
//   1. EL AVISO PEGAJOSO. Con un guardado por bloque, lo escrito ya estaba en la base y no se podia
//      perder. Con uno solo al final, lo unico que impide perderlo es que se vea SIEMPRE, sin importar
//      por donde vaya el scroll. Si alguien lo convierte en un aviso normal, el trabajo se pierde en
//      silencio y nadie se entera hasta que un profesional lo reporta.
//   2. QUE UNA ETAPA VISITADA NO SE DESMONTE. Hasta hoy se rendia solo la etapa activa, asi que irse a
//      Diagnostico un momento borraria el borrador entero. Es la peor forma de perder algo.
//   3. QUE LAS SIETE SECCIONES PUBLIQUEN. Una que deje de publicar no da error: simplemente no se guarda,
//      y el aviso no la nombra. Se perderia justo lo que el profesional acaba de escribir en ella.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const TABS = readFileSync("src/modules/diagnoses/components/evaluation-tabs.tsx", "utf8");
const ACTIONS = readFileSync("src/modules/treatment/actions.ts", "utf8");
const SERVICIO = readFileSync("src/modules/treatment/services/treatment-service.ts", "utf8");

/** Las siete secciones que se guardan juntas. Los nutraceuticos NO entran: escriben una tabla HIJA. */
const SECCIONES = [
  "ajustes",
  "objetivo",
  "restricciones",
  "intercambio",
  "tiemposActivos",
  "tiempos",
  "menuSemanal",
] as const;

describe("las SIETE secciones publican su borrador", () => {
  it.each(SECCIONES)("%s se publica hacia el panel", (seccion) => {
    // Una seccion que deja de publicar no da error: se queda sin guardar, en silencio.
    expect(PANEL, `la sección ${seccion} dejó de publicar su borrador`).toMatch(
      new RegExp(`usePublicar\\(\\s*"${seccion}"`),
    );
  });

  it("y el payload que viaja las lleva las siete", () => {
    // CONTROL de lo de arriba: publicar no sirve de nada si el envio no las recoge. Son dos sitios
    // distintos (la seccion publica, el panel arma), y el hueco puede estar en cualquiera de los dos.
    const cuerpo = PANEL.slice(PANEL.indexOf("const payload = () =>"));
    for (const s of SECCIONES) {
      expect(cuerpo, `el payload no lleva ${s}`).toContain(`${s}:`);
    }
  });

  it("y las SIETE firmas viajan también, incluso las de lo que no se tocó", () => {
    // ES LO QUE DETECTA QUE OTRO PROFESIONAL MOVIO UNA SECCION QUE YO NO TOQUE. Si solo viajaran las
    // modificadas, el guardado pasaria por encima del trabajo ajeno sin enterarse.
    expect(PANEL).toContain("firmas: firmasGuardadas");
    const firmas = PANEL.slice(
      PANEL.indexOf("const firmasGuardadas"),
      PANEL.indexOf("// QUE HAY SIN GUARDAR"),
    );
    for (const s of SECCIONES) {
      expect(firmas, `falta la firma de ${s}`).toContain(`${s}:`);
    }
  });
});

describe("el aviso pegajoso, que es lo que hace seguro quitar los siete botones", () => {
  it("está FIJO al pie, no en el flujo del scroll", () => {
    // Una pantalla de este tamaño se recorre entera: un aviso que se queda arriba no se ve cuando hace
    // falta, que es justo al terminar de editar abajo.
    expect(PANEL, "el aviso de cambios sin guardar dejó de ser pegajoso").toContain("sticky bottom-0");
  });

  it("solo aparece cuando hay algo que guardar", () => {
    // Una barra permanente con un botón que casi nunca hace nada se lee como parte del marco y deja de
    // mirarse, que es como se pierde un aviso.
    expect(PANEL).toContain("{haySinGuardar ? (");
  });

  it("y DICE qué secciones cambiaron, no solo que hay cambios", () => {
    // En una pantalla de este tamaño, saber que algo cambió sin saber QUÉ obliga a recorrerla entera.
    expect(PANEL).toContain("sucias.map((s) => ROTULO_SECCION[s])");
    expect(PANEL).toContain("const ROTULO_SECCION: Record<SeccionId, string>");
  });

  it("y avisa también si se cierra la pestaña del navegador", () => {
    // El aviso pegajoso cubre el descuido de irse a otra parte de la pantalla; esto cubre cerrar o
    // recargar, que es la otra forma de perder una consulta entera.
    expect(PANEL).toContain('window.addEventListener("beforeunload"');
  });

  it("hay UN solo botón de guardar en el panel", () => {
    // Tres disparadores del mismo acto en una pantalla es ruido, y siete es lo que Santiago reportó.
    const panel = sinComentarios(
      PANEL.slice(PANEL.indexOf("export function TreatmentPanel"), PANEL.indexOf("const ROTULO_SECCION")),
    );
    expect((panel.match(/type="submit"/g) ?? []).length, "hay más de un botón de guardar").toBe(1);
    expect(panel).toContain("Guardar cambios");
  });

  it("y ninguna sección conservó el suyo", () => {
    // El barrido completo: si a alguna le vuelve un `<form>` con su acción, vuelven los ocho botones de
    // uno en uno. Se mira el archivo SIN comentarios (que citan las acciones retiradas al explicarlas).
    const codigo = sinComentarios(PANEL);
    for (const accion of [
      "saveAdjustmentsAction",
      "saveObjetivoAction",
      "saveRestriccionesAction",
      "saveIntercambioAction",
      "saveTiemposActivosAction",
      "saveTiemposAction",
      "saveMenuSemanalAction",
    ]) {
      expect(codigo, `volvió ${accion} al panel`).not.toContain(accion);
    }
    // Y las acciones tampoco existen ya: una vertical muerta pasa verde con el hueco abierto.
    for (const accion of ["saveAdjustmentsAction", "saveObjetivoAction", "saveTiemposAction"]) {
      expect(sinComentarios(ACTIONS), `volvió la acción ${accion}`).not.toContain(
        `export async function ${accion}`,
      );
    }
  });
});

describe("una etapa visitada no se desmonta", () => {
  it("se rinden las visitadas y se ocultan las demás, en vez de rendir solo la activa", () => {
    // SIN ESTO, cambiar de pestaña BORRA EL BORRADOR EN SILENCIO. Con un guardado por bloque no se
    // notaba (lo escrito ya estaba en la base); con uno solo al final, es una consulta perdida.
    expect(TABS, "volvió a rendirse solo la etapa activa").not.toContain("{content[active]}");
    expect(TABS).toContain("visitadas.map((id)");
    expect(TABS).toContain("hidden={id !== active}");
  });

  it("y NO se rinden todas de entrada, que cambiaría la conducta de la pantalla", () => {
    // El panel de diagnóstico DISPARA el pipeline al montar (petición de Gildardo: se genera solo al
    // entrar). Montarlo sin que nadie haya abierto esa pestaña lo dispararía antes de tiempo y sus avisos
    // saldrían sobre una pestaña que el profesional no está mirando.
    expect(TABS).toContain("const [visitadas, setVisitadas] = useState<TabId[]>([active]);");
  });
});

describe("lo que gobierna a otra sección se lee EN VIVO", () => {
  it("la distribución y el menú leen los tiempos activos de pantalla, no los guardados", () => {
    // LA OTRA MITAD DE LO QUE PIDIO SANTIAGO. Hasta hoy las dos tablas leían `protocol.tiemposActivos`,
    // así que marcar una casilla no movía nada hasta "aplicar", y había un aviso explicando que seguían
    // mostrando lo anterior. Ese aviso era la prueba de que el flujo estaba al revés.
    expect(PANEL).toContain("activosEnVivo={activosEnVivo}");
    expect(PANEL).toContain("const activosGuardados = activosEnVivo ?? TIEMPOS_ACTIVOS_DEFAULT;");
    expect(PANEL).toContain("const activos = activosEnVivo ?? TIEMPOS_ACTIVOS_DEFAULT;");
  });

  it("y la distribución lee las porciones del intercambio en vivo", () => {
    expect(PANEL).toContain("intercambioEnVivo={intercambioEnVivo}");
    expect(PANEL).toContain("const savedInter = intercambioEnVivo;");
  });

  it("y ya no hay botón de APLICAR los tiempos, que era un guardado disfrazado", () => {
    const codigo = sinComentarios(PANEL);
    expect(codigo, "volvió el botón de aplicar los tiempos").not.toContain("Aplicar tiempos de comida");
    expect(codigo, "volvió el aviso de que las tablas muestran lo anterior").not.toContain(
      "aún no los has aplicado",
    );
  });
});

describe("el guardado no puede quedar a medias", () => {
  it("el servicio traduce el rechazo de concurrencia SIN refrescar la pantalla", () => {
    // Si refrescara, traería el cambio del otro profesional y DESCARTARIA lo que este escribió, que es
    // justo lo que el rechazo preserva para que lo pueda reaplicar. Lo hace `useFormToastRefreshOnSuccess`
    // (no refresca en warning), y la acción devuelve el stale como WARNING, no como error.
    expect(SERVICIO).toContain("StaleProtocoloError");
    expect(SERVICIO).toContain("no se guardó NADA de lo que hiciste");
    expect(PANEL).toContain("useFormToastRefreshOnSuccess(estadoGuardado)");
    const accion = ACTIONS.slice(ACTIONS.indexOf("export async function guardarProtocoloAction"));
    expect(accion).toContain('result.error.code === "stale_write"');
    expect(accion).toContain("warning: result.error.message");
  });

  it("y el mensaje de éxito DERIVA de lo que se escribió", () => {
    // Decir "guardado" cuando no cambió nada le haría creer al profesional que dejó un registro que no
    // existe, y le quitaría la única pista de que su cambio no llegó.
    const accion = ACTIONS.slice(ACTIONS.indexOf("export async function guardarProtocoloAction"));
    expect(accion).toContain("No había cambios que guardar.");
    expect(accion).toContain("result.value.guardadas");
  });
});
