import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DEL ORDEN DE LA PANTALLA DEL NUTRICIONISTA (2026-08-24). Se adopta el orden de Gildardo
// (objetivo → validación → fórmula → intercambio → distribución → menú) con DOS divergencias deliberadas.
// Lo que se blinda es que un reorden futuro no las pierda por descuido, y que ninguna sección pierda su
// firma al moverse (el reorden anterior de este panel dejo secciones pegadas por eso).
//
// LO QUE ESTE CANDADO **NO** VERIFICA, y va dicho para que nadie lo lea como una garantía que no da
// (anotado el 2026-09-04, barriendo los candados que afirman una relación con un artefacto que no abren):
// **no abre el archivo de Gildardo**. Lee solo nuestro panel. Así que cuando un caso dice "como en su
// pantalla" o "DIVERGENCIA: él los pone después", está fijando NUESTRO orden y repitiendo lo que su
// archivo decía el 2026-08-24; si él reordena su panel, aquí no se pone nada rojo y la divergencia
// declarada puede haber dejado de serlo.
//
// NO SE CIERRA HOY, y la razón es de proporción: esto es el orden de la pantalla de trabajo del
// profesional, no contenido clínico ni nada que llegue a un paciente, y extraer el orden de secciones de
// su HTML es un porte en sí mismo. Se deja anotado y va al backlog. El caso que sí importaba de esta
// familia (el lenguaje de paciente de `dfi-paciente`) sí se cerró, porque ese sí viaja en un documento.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const pos = (t: string) => {
  const i = PANEL.indexOf(t);
  expect(i, `no se encontró ${t}`).toBeGreaterThan(-1);
  return i;
};

describe("orden del plan alimentario", () => {
  it("la validación va ANTES de la fórmula, como en su pantalla", () => {
    // SE MIDE DONDE SE RENDERIZA, NO DONDE SE LLAMA (2026-09-06, cotejo punto 21). Este caso comparaba
    // la posición de `<ValidacionSection>` y `<CadenaCaloricaSection>` como hermanos del padre, y eso
    // dejó de medir el orden de la pantalla en cuanto la validación pasó a entrar por prop para
    // renderizarse ENTRE los dos bloques de la cadena. La aserción es la misma; lo que cambió es dónde
    // hay que mirarla. Con la comparación vieja habría bastado con invertir el `toBeLessThan` para
    // ponerlo verde, y eso habría fijado exactamente lo contrario de lo que se quiere.
    const dentro = pos("{validacion(adj, opciones)}");
    expect(dentro, "la validación se renderiza dentro de la cadena").toBeLessThan(
      pos("Fórmula sintética"),
    );
  });

  it("y DESPUÉS de los cuatro campos de la meta: son ellos los que la mueven", () => {
    // El contenido del punto 21: el objetivo, la actividad, el déficit y el peso meta cambian la tabla
    // en vivo. Con la tabla arriba y los campos abajo no se lee que una cosa mueve a la otra.
    const meta = pos('<h3 className={tituloBloqueCls("decision")}>Objetivo del plan');
    expect(meta).toBeLessThan(pos("{validacion(adj, opciones)}"));
    for (const campo of ['name="pesoMeta"', 'name="adjKcalObj"', 'name="adjDeficit"']) {
      expect(pos(campo), `${campo} tiene que quedar ARRIBA de la validación`).toBeLessThan(
        pos("{validacion(adj, opciones)}"),
      );
    }
  });

  it("y todo eso después del objetivo del tratamiento: primero se fija la meta", () => {
    expect(pos("<ObjetivoSection")).toBeLessThan(pos("<CadenaCaloricaSection"));
  });

  it("y se recalcula EN VIVO con esos campos, no con lo guardado (punto 21b)", () => {
    // El contenido del 21b: los cuatro campos existen para ver como cambia esta tabla. Con los ajustes
    // GUARDADOS, la tabla solo se movia despues de bajar a la formula y guardar.
    expect(PANEL).toContain("{validacion(adj, opciones)}");
    expect(PANEL, "la tabla usa los ajustes que le llegan, no los de la fila").toContain(
      "computeProtocoloEfectivo(snap, ajustes ?? adjGuardados, opciones ?? {})",
    );
  });

  it("y quien DICE que hay cifras sin guardar es la barra pegajosa, no esta tabla", () => {
    // ALCANCE MOVIDO, NO RETIRADO (2026-09-10). Este caso exigia un aviso DENTRO de la validacion
    // ("todavía sin guardar"), y ese aviso ademas mandaba a un boton que ya no existe ("está en Objetivo
    // del plan, junto a los campos").
    //
    // LA GARANTIA ES LA MISMA y por eso el caso se queda: una previsualizacion tiene que decir que lo es,
    // o el profesional lee una validacion correcta y se va sin guardar. Lo que cambia es QUIEN lo dice: la
    // barra pegajosa del pie, que esta SIEMPRE a la vista, nombra las secciones que cambiaron y trae el
    // boton. Dos avisos del mismo hecho en dos sitios es ruido, y el de arriba no se ve cuando se esta
    // leyendo la tabla de abajo.
    expect(PANEL, "el aviso volvió a la validación, y allí manda a un botón que no existe").not.toContain(
      "todavía sin guardar",
    );
    expect(PANEL, "el aviso pegajoso dejó de existir").toContain("sticky bottom-0");
    expect(PANEL).toContain("Guardar cambios");
  });

  it("la cadena va antes del intercambio, que consume su objetivo", () => {
    expect(pos("<CadenaCaloricaSection")).toBeLessThan(pos("<IntercambioSection"));
  });

  it("DIVERGENCIA: los tiempos activos van ANTES de la distribución (él los pone después)", () => {
    // Gobiernan el reparto: ponerlos después obliga a subir a corregir.
    expect(pos("<TiemposActivosSection")).toBeLessThan(pos("<TiemposSection"));
  });

  it("el menú va al final de la cadena, después de la distribución", () => {
    expect(pos("<TiemposSection")).toBeLessThan(pos("<MenuSemanalSection"));
  });

  it("DIVERGENCIA: la validación tiene ESTADO VACÍO (una tabla de ceros afirmaría algo falso)", () => {
    expect(PANEL).toContain("if (!algunaPorcion) {");
    expect(PANEL).toContain("Todavía no hay plan que validar");
  });

  it("ninguna sección con estado editable perdió su firma al reordenar", () => {
    // La validación es la única sin key, y es correcto: es derivada en vivo y de solo lectura.
    // Se compara sobre el texto con los espacios colapsados, porque varias llamadas son multilínea.
    const FLAT = PANEL.replace(/\s+/g, " ");
    // "guias" salió de la lista el 2026-08-31: la sección se RETIRÓ (cotejo, punto g). Eran nuestras, su
    // archivo no tiene una lista de guías, y decían con otras palabras lo que ya dice el objetivo más los
    // atributos del motor. Va declarado en la ronda porque él aprobó la caja el 26 ("la caja se queda").
    // El servicio, la acción y la tabla NO se tocaron: devolverla es volver a montar un componente.
    for (const sec of [
      "objetivo",
      "cadena",
      "intercambio",
      "tiempos-activos",
      "tiempos",
      "menu-semanal",
    ]) {
      const ok =
        FLAT.includes('sectionKey("' + sec + '"') || FLAT.includes('sectionKey( "' + sec + '"');
      expect(ok, `la sección ${sec} perdió su sectionKey`).toBe(true);
    }
  });
});
